#!/usr/bin/env python3
import csv
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_XLSX = ROOT / "frontend" / "referencias" / "EXCEL" / "NUEVO INVENTARIO.xlsx"
DB_REFERENCE_TSV = Path("/tmp/marketsys_inventory_reference.tsv")
OUTPUT_SQL = ROOT / "frontend" / "referencias" / "EXCEL" / "import_nuevo_inventario_marketsys.sql"
OUTPUT_REPORT = ROOT / "frontend" / "referencias" / "EXCEL" / "reporte_import_nuevo_inventario_marketsys.json"

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

CATEGORY_MAP = {
    "ABARROTES": "Abarrotes",
    "ASEO": "Aseo",
    "CONDIMENTOS": "Condimentos",
    "FRUTAS": "Frutas",
    "GALLETAS": "Galletas",
    "GASEOSAS": "Gaseosas",
    "GRANOS": "Granos",
    "LACTEOS": "Lacteos",
    "LÁCTEOS": "Lacteos",
    "MECATO": "Dulceria",
    "DULCERIA": "Dulceria",
    "DULCERÍA": "Dulceria",
    "OTROS": "Otros",
    "VERDURAS": "Verduras",
}

DEFAULT_PREFIXES = {
    "Abarrotes": "ABA",
    "Aseo": "ASE",
    "Condimentos": "CON",
    "Dulceria": "MEC",
    "Frutas": "FRU",
    "Galletas": "GAL",
    "Gaseosas": "GAS",
    "Granos": "GRA",
    "Lacteos": "LAC",
    "Otros": "OTR",
    "Verduras": "VER",
}


def clean(value):
    text = str(value or "").strip()
    if text.upper() == "NULL":
        return ""
    return re.sub(r"\s+", " ", text)


def normalize(value):
    text = clean(value).lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def sql(value):
    if value is None:
        return "NULL"
    text = str(value)
    return "'" + text.replace("\\", "\\\\").replace("'", "''") + "'"


def parse_number(value, default=0):
    text = clean(value)
    if not text:
        return default
    text = text.replace("$", "").replace("COP", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return float(text)
    except ValueError:
        return default


def money(value):
    return round(float(value or 0), 2)


def stock(value):
    parsed = parse_number(value, 0)
    return round(abs(parsed), 2)


def column_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref or "")
    if not letters:
        return 0
    result = 0
    for char in letters.group(0):
        result = result * 26 + (ord(char) - ord("A") + 1)
    return result - 1


def shared_strings(archive):
    try:
        xml = archive.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(xml)
    values = []
    for item in root.findall("main:si", NS):
        parts = [node.text or "" for node in item.findall(".//main:t", NS)]
        values.append("".join(parts))
    return values


def first_sheet_path(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    first_sheet = workbook.find("main:sheets/main:sheet", NS)
    rel_id = first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = rel_map[rel_id].lstrip("/")
    return target if target.startswith("xl/") else f"xl/{target}"


def read_xlsx_rows(path):
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        sheet = ET.fromstring(archive.read(first_sheet_path(archive)))
        rows = []
        for row in sheet.findall(".//main:sheetData/main:row", NS):
            values = []
            for cell in row.findall("main:c", NS):
                idx = column_index(cell.attrib.get("r", ""))
                while len(values) <= idx:
                    values.append("")
                cell_type = cell.attrib.get("t")
                raw_value = cell.find("main:v", NS)
                inline_value = cell.find("main:is/main:t", NS)
                if inline_value is not None:
                    value = inline_value.text or ""
                elif raw_value is None:
                    value = ""
                elif cell_type == "s":
                    value = strings[int(raw_value.text or 0)]
                else:
                    value = raw_value.text or ""
                values[idx] = value
            rows.append(values)
        return rows


def select_header(rows):
    expected = {"codigo", "nombre", "categoria", "precio_compra", "precio_venta", "cantidad"}
    best = (0, [], -1)
    for index, row in enumerate(rows[:12]):
        headers = [normalize(cell) for cell in row]
        score = sum(1 for header in headers if header in expected)
        if score > best[2]:
            best = (index, headers, score)
    if best[2] < 3:
        raise RuntimeError("No se pudo detectar el encabezado del Excel nuevo.")
    return best[0], best[1]


def read_excel_products():
    rows = read_xlsx_rows(INPUT_XLSX)
    header_index, headers = select_header(rows)
    products = []
    for row in rows[header_index + 1:]:
        padded = list(row) + [""] * max(0, len(headers) - len(row))
        item = {headers[index]: padded[index] for index in range(len(headers)) if headers[index]}
        if clean(item.get("nombre")):
            products.append(item)
    return products


def read_reference():
    lines = DB_REFERENCE_TSV.read_text(encoding="utf8").splitlines()
    categories = {}
    units = {}
    products_lines = []
    product_header = None

    for line in lines:
        if not line:
            continue
        parts = line.split("\t")
        if parts[0] == "section":
            continue
        if parts[0] == "CATEGORIAS":
            categories[clean(parts[2])] = int(parts[1])
            continue
        if parts[0] == "UNIDADES":
            units[clean(parts[3]).lower()] = {"id": int(parts[1]), "nombre": clean(parts[2])}
            continue
        if parts[0] == "id_producto":
            product_header = parts
            continue
        if product_header:
            products_lines.append(line)

    products = []
    if product_header:
        reader = csv.DictReader(products_lines, fieldnames=product_header, delimiter="\t")
        products = list(reader)

    return categories, units, products


def pick(row, *keys):
    for key in keys:
        value = row.get(key)
        if clean(value):
            return clean(value)
    return ""


def mapped_category(value):
    raw = clean(value).upper()
    return CATEGORY_MAP.get(raw, clean(value).title() or "Otros")


def product_code_value(row):
    return pick(row, "codigo_barras", "barras", "codigo_de_barras") or pick(row, "codigo")


def build_code_counters(products):
    counters = {}
    prefixes = {}
    pattern = re.compile(r"^([A-Z]+)-(\d+)$")
    for product in products:
        category = clean(product.get("categoria"))
        code = clean(product.get("codigo_interno"))
        match = pattern.match(code)
        if not category or not match:
            continue
        prefix, number = match.group(1), int(match.group(2))
        current = counters.get(category, 0)
        if number > current:
            counters[category] = number
            prefixes[category] = prefix
    for category, prefix in DEFAULT_PREFIXES.items():
        prefixes.setdefault(category, prefix)
        counters.setdefault(category, 0)
    return counters, prefixes


def next_internal_code(category, counters, prefixes):
    counters[category] = counters.get(category, 0) + 1
    return f"{prefixes.get(category, DEFAULT_PREFIXES.get(category, 'PRD'))}-{counters[category]:03d}"


def main():
    excel_rows = read_excel_products()
    categories, units, db_products = read_reference()
    unit_kg = units.get("kg", {}).get("id", 1)
    unit_ud = units.get("ud", {}).get("id", 5)

    by_internal = {clean(row["codigo_interno"]): row for row in db_products if clean(row["codigo_interno"])}
    by_barcode = {clean(row["codigo_barras"]): row for row in db_products if clean(row["codigo_barras"])}
    by_name = {normalize(row["nombre"]): row for row in db_products if clean(row["nombre"])}
    counters, prefixes = build_code_counters(db_products)

    updates = []
    inserts = []
    barcode_conflicts = []
    match_counter = Counter()
    stock_negative_count = 0

    for row in excel_rows:
        name = pick(row, "nombre", "producto", "descripcion").upper()
        category = mapped_category(pick(row, "categoria", "nombre_categoria"))
        barcode = product_code_value(row) or None
        generic_code = pick(row, "codigo")
        description = pick(row, "descripcion")
        product_type = pick(row, "tipo_producto").upper()
        purchase_price = money(parse_number(pick(row, "precio_compra", "costo", "precio_de_compra"), 0))
        sale_price = money(parse_number(pick(row, "precio_venta", "precio", "precio_de_venta"), 0))
        current_stock_raw = parse_number(pick(row, "cantidad", "stock", "stock_actual", "existencia"), 0)
        current_stock = round(abs(current_stock_raw), 2)
        if current_stock_raw < 0:
            stock_negative_count += 1

        match = None
        match_type = None
        if generic_code and generic_code in by_internal:
            match = by_internal[generic_code]
            match_type = "codigo_columna_vs_interno"
        elif barcode and barcode in by_barcode:
            match = by_barcode[barcode]
            match_type = "codigo_columna_vs_barras"
        elif normalize(name) in by_name:
            match = by_name[normalize(name)]
            match_type = "nombre_exacto_normalizado"

        if match:
            if barcode and barcode in by_barcode and by_barcode[barcode]["id_producto"] != match["id_producto"]:
                barcode_conflicts.append({
                    "id_producto": match["id_producto"],
                    "producto": name,
                    "codigo_barras_excel": barcode,
                    "producto_conflicto": by_barcode[barcode]["nombre"],
                })
                barcode_to_save = clean(match.get("codigo_barras")) or None
            else:
                barcode_to_save = barcode

            updates.append({
                "id_producto": int(match["id_producto"]),
                "codigo_interno": clean(match["codigo_interno"]),
                "codigo_barras": barcode_to_save,
                "nombre": name,
                "descripcion": description or None,
                "categoria": category,
                "precio_compra": purchase_price,
                "precio_venta": sale_price,
                "stock_actual": current_stock,
                "cruce_por": match_type,
            })
            match_counter[match_type] += 1
            continue

        internal_code = next_internal_code(category, counters, prefixes)
        unit_id = unit_kg if product_type == "BASCULA" else unit_ud
        inserts.append({
            "codigo_interno": internal_code,
            "codigo_barras": barcode,
            "nombre": name,
            "descripcion": description or None,
            "categoria": category,
            "id_unidad": unit_id,
            "precio_compra": purchase_price,
            "precio_venta": sale_price,
            "stock_actual": current_stock,
            "tipo_producto": product_type,
        })

    lines = [
        "-- MarketSYS - Importacion NUEVO INVENTARIO.xlsx",
        "-- Generado automaticamente. Conserva codigo_interno en productos existentes.",
        "START TRANSACTION;",
        "",
        "INSERT INTO categorias (nombre, descripcion, impuesto)",
        "SELECT 'Otros', 'Categoria creada desde importacion NUEVO INVENTARIO', 0",
        "WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Otros' AND is_deleted = 0);",
        "",
    ]

    for item in updates:
        lines.extend([
            f"-- UPDATE {item['codigo_interno']} | {item['nombre']}",
            "UPDATE productos",
            "SET",
            f"  codigo_barras = {sql(item['codigo_barras'])},",
            f"  nombre = {sql(item['nombre'])},",
            f"  id_categoria = (SELECT id_categoria FROM categorias WHERE nombre = {sql(item['categoria'])} AND is_deleted = 0 LIMIT 1),",
            f"  precio_compra = {item['precio_compra']:.2f},",
            f"  precio_venta = {item['precio_venta']:.2f},",
            f"  stock_actual = {item['stock_actual']:.2f}",
            f"WHERE id_producto = {item['id_producto']} AND is_deleted = 0;",
            "",
        ])

    for item in inserts:
        lines.extend([
            f"-- INSERT {item['codigo_interno']} | {item['nombre']}",
            "INSERT INTO productos (codigo_barras, codigo_interno, nombre, descripcion, id_categoria, id_unidad, precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo, estado, cambia_estado, cambia_apariencia)",
            "VALUES (",
            f"  {sql(item['codigo_barras'])}, {sql(item['codigo_interno'])}, {sql(item['nombre'])}, {sql(item['descripcion'])},",
            f"  (SELECT id_categoria FROM categorias WHERE nombre = {sql(item['categoria'])} AND is_deleted = 0 LIMIT 1),",
            f"  {item['id_unidad']}, {item['precio_compra']:.2f}, {item['precio_venta']:.2f}, {item['stock_actual']:.2f}, 0, 0, 1, 0, 0",
            ");",
            "",
        ])

    lines.append("COMMIT;")
    OUTPUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf8")

    report = {
        "archivo_excel": str(INPUT_XLSX),
        "archivo_sql": str(OUTPUT_SQL),
        "filas_excel": len(excel_rows),
        "actualizaciones": len(updates),
        "creaciones": len(inserts),
        "coincidencias": dict(match_counter),
        "stocks_negativos_convertidos_a_positivo": stock_negative_count,
        "conflictos_codigo_barras": barcode_conflicts,
        "categorias_usadas": sorted(set([item["categoria"] for item in updates + inserts])),
        "muestra_creaciones": inserts[:40],
        "muestra_actualizaciones": updates[:20],
    }
    OUTPUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
