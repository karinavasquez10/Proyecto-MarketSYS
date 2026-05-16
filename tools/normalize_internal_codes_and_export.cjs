const fs = require("fs");
const path = require("path");
const mysql = require("../backend/node_modules/mysql2/promise");
const XLSX = require("../frontend/node_modules/xlsx");

const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const outputDir = path.join(root, "frontend", "referencias", "EXCEL");
const outputXlsx = path.join(outputDir, "PRODUCTOS_MARKETSYS_ACTUALIZADO.xlsx");
const outputCsv = path.join(outputDir, "PRODUCTOS_MARKETSYS_ACTUALIZADO.csv");

const prefixes = {
  Abarrotes: "ABA",
  Aseo: "ASE",
  Condimentos: "CON",
  Frutas: "FRU",
  Galletas: "GAL",
  Gaseosas: "GAS",
  Granos: "GRA",
  Lacteos: "LAC",
  Mecato: "MEC",
  Verduras: "VER",
};

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

const buildWorkbookRows = (products) => {
  return products.map((product) => ({
    id_producto: product.id_producto,
    codigo_barras: product.codigo_barras || "",
    codigo_interno: product.codigo_interno || "",
    nombre: product.nombre || "",
    categoria: product.categoria || "",
    unidad: product.unidad || "",
    unidad_abrev: product.unidad_abrev || "",
    producto_bascula: ["kg", "g", "gr"].includes(String(product.unidad_abrev || "").toLowerCase()) ? "SI" : "NO",
    precio_compra: moneyNumber(product.precio_compra),
    precio_venta: moneyNumber(product.precio_venta),
    stock_actual: moneyNumber(product.stock_actual),
    stock_minimo: moneyNumber(product.stock_minimo),
    stock_maximo: moneyNumber(product.stock_maximo),
    estado: product.estado ? "ACTIVO" : "INACTIVO",
    notas_para_actualizar: "",
  }));
};

const writeExcel = (products) => {
  fs.mkdirSync(outputDir, { recursive: true });

  const rows = buildWorkbookRows(products);
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
    { wch: 28 },
  ];

  const instructions = XLSX.utils.aoa_to_sheet([
    ["Guía de actualización"],
    ["Puedes modificar precios, stocks, códigos de barras, nombres, categoría y unidad."],
    ["No cambies id_producto si quieres actualizar productos existentes."],
    ["codigo_interno fue normalizado por categoría: FRU-001, VER-001, ABA-001, etc."],
    ["producto_bascula es informativo: SI cuando la unidad es kg/g."],
  ]);
  instructions["!cols"] = [{ wch: 120 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
  XLSX.utils.book_append_sheet(workbook, instructions, "Guia");
  XLSX.writeFile(workbook, outputXlsx);
  fs.writeFileSync(outputCsv, XLSX.utils.sheet_to_csv(worksheet), "utf8");
};

async function main() {
  const env = parseEnv(envPath);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    multipleStatements: false,
  });

  try {
    const [products] = await connection.query(`
      SELECT
        p.id_producto,
        p.codigo_barras,
        p.codigo_interno,
        p.nombre,
        p.descripcion,
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

    const counters = {};
    const updates = products.map((product) => {
      const category = product.categoria || "General";
      const prefix = prefixes[category] || category.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(3, "X");
      counters[prefix] = (counters[prefix] || 0) + 1;
      return {
        id_producto: product.id_producto,
        codigo_interno: `${prefix}-${String(counters[prefix]).padStart(3, "0")}`,
      };
    });

    await connection.beginTransaction();
    for (const update of updates) {
      await connection.query(
        "UPDATE productos SET codigo_interno = ? WHERE id_producto = ?",
        [update.codigo_interno, update.id_producto]
      );
    }
    await connection.commit();

    const [updatedProducts] = await connection.query(`
      SELECT
        p.id_producto,
        p.codigo_barras,
        p.codigo_interno,
        p.nombre,
        p.descripcion,
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

    writeExcel(updatedProducts);

    console.log(JSON.stringify({
      productos_actualizados: updates.length,
      categorias: counters,
      excel: outputXlsx,
      csv: outputCsv,
    }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
