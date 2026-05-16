const fs = require("fs");
const path = require("path");
const XLSX = require("../frontend/node_modules/xlsx");

const input = path.join(__dirname, "..", "frontend", "referencias", "EXCEL", "INVENTARIO MERKAFRUVER.xls");
const output = path.join(__dirname, "..", "frontend", "referencias", "EXCEL", "import_productos_marketsys.sql");

const categoryMap = {
  ABARROTES: "Abarrotes",
  ASEO: "Aseo",
  VERDURAS: "Verduras",
  FRUTAS: "Frutas",
  LACTEOS: "Lacteos",
  GRANOS: "Granos",
  GASEOSAS: "Gaseosas",
  MECATO: "Mecato",
  GALLETAS: "Galletas",
  CONDIMENTOS: "Condimentos",
};

const categoriesToCreate = [
  ["Gaseosas", "Productos gaseosos y bebidas carbonatadas", 0.19],
  ["Condimentos", "Condimentos, especias y sazonadores", 0.19],
  ["Mecato", "Snacks, paquetes y productos de mecato", 0.19],
  ["Galletas", "Galletas dulces y saladas", 0.19],
];

function sql(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

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

function normalizePrice(value, fallback = 0) {
  const number = parseNumber(value);
  return number > 0 ? Number(number.toFixed(2)) : fallback;
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

const lines = [
  "START TRANSACTION;",
  "",
  "-- Categorias nuevas detectadas en el Excel",
];

for (const [name, description, tax] of categoriesToCreate) {
  lines.push(`
INSERT INTO categorias (nombre, descripcion, impuesto)
SELECT ${sql(name)}, ${sql(description)}, ${tax}
WHERE NOT EXISTS (
  SELECT 1 FROM categorias WHERE LOWER(nombre) = LOWER(${sql(name)}) AND is_deleted = 0
);`.trim());
}

lines.push("", "-- Productos preparados desde INVENTARIO MERKAFRUVER.xls");

let prepared = 0;
let defaultedPurchasePrice = 0;
let negativeStock = 0;

for (const row of data) {
  const originalCode = clean(row.Codigo);
  const name = clean(row.Nombre).toUpperCase();
  const excelCategory = clean(row.Categoria).toUpperCase();
  const categoryName = categoryMap[excelCategory] || "Abarrotes";
  const productType = clean(row["Tipo producto"]).toUpperCase();
  const isBarcode = /^\d{8,14}$/.test(originalCode);
  const barcode = isBarcode ? originalCode : null;
  const internalCode = isBarcode ? null : originalCode;
  const salePrice = normalizePrice(row["Precio venta"], 1);
  let purchasePrice = normalizePrice(row["Precio compra"], 0);

  if (purchasePrice <= 0) {
    purchasePrice = Number(Math.max(1, salePrice * 0.7).toFixed(2));
    defaultedPurchasePrice += 1;
  }

  const rawStock = parseNumber(row.Stock);
  const stock = Number(Math.max(0, rawStock).toFixed(2));
  if (rawStock < 0) negativeStock += 1;

  const unitId = productType === "BASCULA" ? 1 : 5;
  const description = [
    productType ? `Tipo original: ${productType}` : "",
    rawStock < 0 ? `Stock original negativo: ${rawStock}` : "",
    excelCategory ? `Categoria original: ${excelCategory}` : "",
  ].filter(Boolean).join(" | ");

  lines.push(`
INSERT INTO productos (
  codigo_barras, codigo_interno, nombre, descripcion, id_categoria, id_unidad,
  precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo,
  estado, cambia_estado, cambia_apariencia, tiempo_cambio
)
SELECT
  ${sql(barcode)}, ${sql(internalCode)}, ${sql(name)}, ${sql(description)},
  (SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER(${sql(categoryName)}) AND is_deleted = 0 ORDER BY id_categoria LIMIT 1),
  ${unitId},
  ${purchasePrice}, ${salePrice}, ${stock}, 0, 0,
  1, 0, 0, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM productos
  WHERE is_deleted = 0
    AND (
      (${barcode ? `codigo_barras = ${sql(barcode)}` : "FALSE"})
      OR (${internalCode ? `codigo_interno = ${sql(internalCode)} AND nombre = ${sql(name)}` : "FALSE"})
    )
);`.trim());

  prepared += 1;
}

lines.push("");
lines.push("COMMIT;");
lines.push("");
lines.push(`-- Resumen: productos preparados=${prepared}, precio_compra_estimado=${defaultedPurchasePrice}, stock_negativo_en_excel=${negativeStock}`);

fs.writeFileSync(output, lines.join("\n\n"), "utf8");
console.log(JSON.stringify({
  archivo: output,
  productos_preparados: prepared,
  precio_compra_estimado: defaultedPurchasePrice,
  stock_negativo_en_excel: negativeStock,
}, null, 2));
