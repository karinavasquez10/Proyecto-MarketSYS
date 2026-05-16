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
DB_PRODUCTS_TSV = Path("/tmp/marketsys_productos_actuales.tsv")
REPORT_JSON = ROOT / "frontend" / "referencias" / "EXCEL" / "reporte_nuevo_inventario_diagnostico.json"

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize(value):
    text = clean(value).lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def parse_number(value):
    text = clean(value)
    if not text:
        return None
    text = text.replace("$", "").replace("COP", "").replace(" ", "")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return float(text)
    except ValueError:
        return None


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
    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels
    }
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
    best = None
    best_score = -1
    expected = {"codigo", "codigo_barras", "codigo_interno", "nombre", "categoria", "precio_compra", "precio_venta", "stock", "cantidad"}
    for index, row in enumerate(rows[:12]):
        normalized = [normalize(cell) for cell in row]
        score = sum(1 for cell in normalized if cell in expected)
        if score > best_score:
            best = (index, normalized)
            best_score = score
    if best is None or best_score < 2:
        raise RuntimeError("No se pudo detectar la fila de encabezados del Excel.")
    return best


def read_excel_products():
    rows = read_xlsx_rows(INPUT_XLSX)
    header_index, headers = select_header(rows)
    normalized_rows = []
    for row in rows[header_index + 1:]:
        padded = list(row) + [""] * max(0, len(headers) - len(row))
        item = {headers[index]: padded[index] for index in range(len(headers)) if headers[index]}
        if clean(item.get("nombre")):
            normalized_rows.append(item)
    return headers, normalized_rows


def read_db_products():
    with DB_PRODUCTS_TSV.open("r", encoding="utf8", newline="") as file:
        return list(csv.DictReader(file, delimiter="\t"))


def pick(row, *keys):
    for key in keys:
        value = row.get(key)
        if clean(value):
            return clean(value)
    return ""


def main():
    if not INPUT_XLSX.exists():
        raise FileNotFoundError(INPUT_XLSX)
    if not DB_PRODUCTS_TSV.exists():
        raise FileNotFoundError(DB_PRODUCTS_TSV)

    headers, excel_rows = read_excel_products()
    db_rows = read_db_products()

    db_by_internal = {clean(row["codigo_interno"]): row for row in db_rows if clean(row["codigo_interno"])}
    db_by_barcode = {clean(row["codigo_barras"]): row for row in db_rows if clean(row["codigo_barras"])}
    db_by_name = {normalize(row["nombre"]): row for row in db_rows if clean(row["nombre"])}

    matches = Counter()
    unmatched = []
    duplicate_excel_keys = Counter()
    categories = Counter()
    negative_stock = []
    sample_updates = []

    for row in excel_rows:
        internal_code = pick(row, "codigo_interno", "codigo_interno_producto")
        barcode = pick(row, "codigo_barras", "barras", "codigo_de_barras")
        generic_code = pick(row, "codigo")
        name = pick(row, "nombre", "producto", "descripcion")
        category = pick(row, "categoria", "nombre_categoria")
        stock_value = parse_number(pick(row, "stock", "stock_actual", "cantidad", "existencia"))
        purchase_value = parse_number(pick(row, "precio_compra", "costo", "precio_de_compra"))
        sale_value = parse_number(pick(row, "precio_venta", "precio", "precio_de_venta"))

        categories[category or "(sin categoria)"] += 1
        key_for_duplicates = internal_code or barcode or generic_code or normalize(name)
        duplicate_excel_keys[key_for_duplicates] += 1

        if stock_value is not None and stock_value < 0:
            negative_stock.append({"producto": name, "stock_excel": stock_value, "stock_sugerido": abs(stock_value)})

        match = None
        match_type = None
        if internal_code and internal_code in db_by_internal:
            match = db_by_internal[internal_code]
            match_type = "codigo_interno"
        elif barcode and barcode in db_by_barcode:
            match = db_by_barcode[barcode]
            match_type = "codigo_barras"
        elif generic_code and generic_code in db_by_internal:
            match = db_by_internal[generic_code]
            match_type = "codigo_columna_vs_interno"
        elif generic_code and generic_code in db_by_barcode:
            match = db_by_barcode[generic_code]
            match_type = "codigo_columna_vs_barras"
        elif normalize(name) in db_by_name:
            match = db_by_name[normalize(name)]
            match_type = "nombre_exacto_normalizado"

        if not match:
            unmatched.append({
                "nombre": name,
                "codigo_interno_excel": internal_code,
                "codigo_barras_excel": barcode,
                "codigo_excel": generic_code,
                "categoria_excel": category,
            })
            continue

        matches[match_type] += 1
        if len(sample_updates) < 20:
            sample_updates.append({
                "id_producto": match["id_producto"],
                "codigo_interno_conservado": match["codigo_interno"],
                "nombre_actual": match["nombre"],
                "nombre_excel": name,
                "codigo_barras_actual": match["codigo_barras"],
                "codigo_barras_excel": barcode or generic_code,
                "precio_compra_excel": purchase_value,
                "precio_venta_excel": sale_value,
                "stock_excel": stock_value,
                "stock_sugerido": abs(stock_value) if stock_value is not None and stock_value < 0 else stock_value,
                "categoria_excel": category,
                "cruce_por": match_type,
            })

    duplicates = [
        {"clave": key, "repeticiones": count}
        for key, count in duplicate_excel_keys.items()
        if key and count > 1
    ]

    report = {
        "archivo": str(INPUT_XLSX),
        "encabezados_detectados": headers,
        "filas_productos_excel": len(excel_rows),
        "productos_bd_activos": len(db_rows),
        "coincidencias": dict(matches),
        "total_coincidencias": sum(matches.values()),
        "sin_coincidencia": len(unmatched),
        "muestra_sin_coincidencia": unmatched[:40],
        "categorias_excel": dict(categories),
        "stocks_negativos_a_positivo": len(negative_stock),
        "muestra_stocks_negativos": negative_stock[:30],
        "claves_duplicadas_en_excel": duplicates[:40],
        "muestra_actualizaciones": sample_updates,
    }

    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
