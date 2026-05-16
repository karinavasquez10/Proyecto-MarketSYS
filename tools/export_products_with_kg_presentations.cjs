const fs = require("fs");
const path = require("path");
const mysql = require("../backend/node_modules/mysql2/promise");
const XLSX = require("../frontend/node_modules/xlsx");

const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const outputDir = path.join(root, "frontend", "referencias", "EXCEL");
const outputXlsx = path.join(outputDir, "PRODUCTOS_MARKETSYS_CON_PRESENTACIONES_KG.xlsx");
const outputCsv = path.join(outputDir, "PRODUCTOS_MARKETSYS_CON_PRESENTACIONES_KG.csv");

const kgPresentationNames = [
  "MORA",
  "MANZANA ROJA",
  "MANZANA VERDE",
  "PERA",
  "GRANADILLA",
  "FRESA",
];

const parseEnv = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
};

const moneyNumber = (value) => Number(Number(value || 0).toFixed(2));

const toRow = (product) => ({
  id_producto: product.id_producto || "",
  codigo_barras: product.codigo_barras || "",
  codigo_interno: product.codigo_interno || "",
  nombre: product.nombre || "",
  categoria: product.categoria || "",
  unidad: product.unidad || "",
  unidad_abrev: product.unidad_abrev || "",
  producto_bascula: ["kg", "g", "gr"].includes(String(product.unidad_abrev || "").toLowerCase()) ? "SI" : "NO",
  precio_compra: product.precio_compra === "" ? "" : moneyNumber(product.precio_compra),
  precio_venta: product.precio_venta === "" ? "" : moneyNumber(product.precio_venta),
  stock_actual: product.stock_actual === "" ? "" : moneyNumber(product.stock_actual),
  stock_minimo: product.stock_minimo === "" ? "" : moneyNumber(product.stock_minimo),
  stock_maximo: product.stock_maximo === "" ? "" : moneyNumber(product.stock_maximo),
  estado: product.estado === 0 ? "INACTIVO" : "ACTIVO",
  notas_para_actualizar: product.notas_para_actualizar || "",
});

async function main() {
  const env = parseEnv(envPath);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
  });

  try {
    const [products] = await connection.query(`
      SELECT
        p.id_producto,
        p.codigo_barras,
        p.codigo_interno,
        p.nombre,
        p.precio_compra,
        p.precio_venta,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.estado,
        c.nombre AS categoria,
        u.nombre AS unidad,
        u.abreviatura AS unidad_abrev
      FROM productos p
      LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
      LEFT JOIN unidades_medida u ON u.id_unidad = p.id_unidad
      WHERE p.is_deleted = 0 AND p.estado = 1
      ORDER BY c.nombre ASC, p.nombre ASC, p.id_producto ASC
    `);

    const [maxRows] = await connection.query(`
      SELECT MAX(CAST(SUBSTRING(codigo_interno, 5) AS UNSIGNED)) AS max_fru
      FROM productos
      WHERE codigo_interno REGEXP '^FRU-[0-9]+$' AND is_deleted = 0
    `);
    let nextFruitCode = Number(maxRows[0]?.max_fru || 0) + 1;

    const fruitsByName = new Map(
      products
        .filter((product) => product.categoria === "Frutas")
        .map((product) => [String(product.nombre || "").toUpperCase(), product])
    );

    const newRows = kgPresentationNames.map((name) => {
      const source = fruitsByName.get(name);
      const code = `FRU-${String(nextFruitCode).padStart(3, "0")}`;
      nextFruitCode += 1;

      return {
        id_producto: "",
        codigo_barras: "",
        codigo_interno: code,
        nombre: `${name} KG`,
        categoria: "Frutas",
        unidad: "Kilogramo",
        unidad_abrev: "kg",
        precio_compra: "",
        precio_venta: "",
        stock_actual: 0,
        stock_minimo: 0,
        stock_maximo: 0,
        estado: 1,
        notas_para_actualizar: source
          ? `Nuevo por kg basado en ${source.nombre} (${source.codigo_interno})`
          : "Nuevo por kg",
      };
    });

    const rows = [...products.map(toRow), ...newRows.map(toRow)];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 42 },
      { wch: 16 },
      { wch: 14 },
      { wch: 11 },
      { wch: 15 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 42 },
    ];

    const instructions = XLSX.utils.aoa_to_sheet([
      ["Guía de actualización"],
      ["Las filas con id_producto vacío son productos nuevos que se insertarán."],
      ["Llena precio_compra y precio_venta de las nuevas presentaciones KG."],
      ["No cambies codigo_interno de las filas nuevas salvo que quieras otro código."],
      ["No cambies id_producto de productos existentes."],
    ]);
    instructions["!cols"] = [{ wch: 120 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
    XLSX.utils.book_append_sheet(workbook, instructions, "Guia");

    fs.mkdirSync(outputDir, { recursive: true });
    XLSX.writeFile(workbook, outputXlsx);
    fs.writeFileSync(outputCsv, XLSX.utils.sheet_to_csv(worksheet), "utf8");

    console.log(JSON.stringify({
      productos_existentes: products.length,
      nuevos_kg: newRows.map((row) => ({ codigo_interno: row.codigo_interno, nombre: row.nombre })),
      excel: outputXlsx,
      csv: outputCsv,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
