#!/usr/bin/env python3
import csv
from pathlib import Path


BASE = Path("frontend/referencias/EXCEL")
SOURCE = BASE / "PRODUCTOS_MARKETSYS_CON_PRESENTACIONES_KG.csv"
TARGET = BASE / "PRODUCTOS_MARKETSYS_REVISION_IVA.csv"


def normalize(value):
    return (value or "").strip().upper()


def iva_for_category(category):
    category = normalize(category)
    if category in {"FRUTAS", "VERDURAS", "GRANOS", "LACTEOS", "LÁCTEOS", "CARNES"}:
        return "0", "Conservador por alimento fresco/basico. Revisar con contador si aplica."
    if category in {"ASEO", "GASEOSAS", "BEBIDAS", "MECATO", "DULCERIA", "DULCERÍA", "GALLETAS", "CONDIMENTOS"}:
        return "0.19", "Conservador gravado 19%. Revisar excepciones puntuales."
    if category == "ABARROTES":
        return "REVISAR", "No se actualiza automaticamente. Puede mezclar 0%, 5% y 19%."
    return "REVISAR", "Categoria no clasificada. Revisar producto por producto."


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as src:
        reader = csv.DictReader(src)
        fieldnames = list(reader.fieldnames or [])
        extra = ["iva_sugerido", "iva_aplicar", "criterio_iva", "notas_revision_iva"]
        with TARGET.open("w", encoding="utf-8", newline="") as dst:
            writer = csv.DictWriter(dst, fieldnames=fieldnames + extra)
            writer.writeheader()
            for row in reader:
                iva, criterio = iva_for_category(row.get("categoria", ""))
                row["iva_sugerido"] = iva
                row["iva_aplicar"] = "" if iva == "REVISAR" else iva
                row["criterio_iva"] = criterio
                row["notas_revision_iva"] = ""
                writer.writerow(row)

    print(f"Archivo generado: {TARGET}")


if __name__ == "__main__":
    main()
