const fs = require("fs");
const path = require("path");
const XLSX = require("../frontend/node_modules/xlsx");

const input = path.join(__dirname, "..", "frontend", "referencias", "EXCEL", "INVENTARIO MERKAFRUVER.xls");
const output = path.join(__dirname, "..", "frontend", "referencias", "EXCEL", "productos_preparados_marketsys.csv");

const categoryMap = {
  ABARROTES: [5, "Abarrotes", ""],
  ASEO: [1, "Aseo", ""],
  VERDURAS: [3, "Verduras", ""],
  FRUTAS: [2, "Frutas", ""],
  LACTEOS: [4, "Lacteos", ""],
  GRANOS: [7, "Granos", ""],
  GASEOSAS: [9, "Bebidas", "Mapeado desde GASEOSAS"],
  MECATO: [6, "Dulceria", "Mapeado desde MECATO; revisar si conviene crear categoria Mecato"],
  GALLETAS: [6, "Dulceria", "Mapeado desde GALLETAS; revisar si conviene crear categoria Galletas"],
  CONDIMENTOS: [5, "Abarrotes", "Mapeado desde CONDIMENTOS; revisar si conviene crear categoria Condimentos"],
};

const columns = [
  "codigo_original",
  "codigo_barras",
  "codigo_interno",
  "nombre",
  "descripcion",
  "categoria_excel",
  "id_categoria_sugerido",
  "categoria_sugerida",
  "tipo_producto",
  "id_unidad_sugerido",
  "unidad_sugerida",
  "precio_compra",
  "precio_venta",
  "stock_original",
  "stock_actual_sugerido",
  "stock_minimo",
  "stock_maximo",
  "estado",
  "cambia_estado",
  "cambia_apariencia",
  "tiempo_cambio",
  "observacion_importacion",
];

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseNumber(value) {
  if (value === "" || value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value).trim();
  if (!text) return 0;
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = (text.match(/\./g) || []).length;
    if (dots > 1) text = text.replace(/\./g, "");
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const workbook = XLSX.readFile(input, { raw: true });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: "",
  blankrows: false,
  raw: true,
});

const headers = rows[1];
const data = rows
  .slice(2)
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])))
  .filter((row) => clean(row.Nombre));

const outputRows = [columns.join(";")];
let negativeStock = 0;
let zeroCost = 0;
let unmappedCategories = 0;

for (const row of data) {
  const code = clean(row.Codigo);
  const name = clean(row.Nombre).toUpperCase();
  const excelCategory = clean(row.Categoria).toUpperCase();
  const productType = clean(row["Tipo producto"]).toUpperCase();
  const [categoryId, categoryName, categoryObservation] = categoryMap[excelCategory] || [
    "",
    "",
    `Categoria no mapeada: ${excelCategory}`,
  ];

  if (!categoryId) unmappedCategories += 1;

  const isBarcode = /^\d{8,14}$/.test(code);
  const purchasePrice = parseNumber(row["Precio compra"]);
  const salePrice = parseNumber(row["Precio venta"]);
  const originalStock = parseNumber(row.Stock);
  const minStock = parseNumber(row.Min);
  const maxStock = parseNumber(row.Max);

  if (originalStock < 0) negativeStock += 1;
  if (purchasePrice <= 0) zeroCost += 1;

  const unitId = productType === "BASCULA" ? 1 : 5;
  const unitName = productType === "BASCULA" ? "Kilogramo" : "Unidad";
  const suggestedStock = Math.max(0, originalStock);
  const observations = [
    categoryObservation,
    originalStock < 0 ? "Stock original negativo; sugerido cargar en 0" : "",
    purchasePrice <= 0 ? "Precio compra en 0; revisar costo real" : "",
  ].filter(Boolean).join(" | ");

  const normalized = [
    code,
    isBarcode ? code : "",
    isBarcode ? "" : code,
    name,
    "",
    excelCategory,
    categoryId,
    categoryName,
    productType,
    unitId,
    unitName,
    purchasePrice,
    salePrice,
    originalStock,
    suggestedStock,
    minStock,
    maxStock,
    1,
    0,
    0,
    "",
    observations,
  ];

  outputRows.push(normalized.map(csv).join(";"));
}

fs.writeFileSync(output, outputRows.join("\n"), "utf8");
console.log(JSON.stringify({
  archivo: output,
  productos: data.length,
  stock_negativo: negativeStock,
  precio_compra_cero: zeroCost,
  categorias_sin_mapa: unmappedCategories,
}, null, 2));
