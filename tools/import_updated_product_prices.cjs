const fs = require("fs");
const path = require("path");
const mysql = require("../backend/node_modules/mysql2/promise");
const XLSX = require("../frontend/node_modules/xlsx");

const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const input = path.join(root, "frontend", "referencias", "EXCEL", "PRODUCTOS_MARKETSYS_PRECIOS ACTUALIZADOS.xlsx");
const reportPath = path.join(root, "frontend", "referencias", "EXCEL", "reporte_actualizacion_precios_marketsys.json");
const applyChanges = process.argv.includes("--apply");

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

const clean = (value) => String(value ?? "").trim();

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = clean(value);
  if (!text) return null;
  text = text.replace(/\$/g, "").replace(/COP/gi, "").replace(/\s+/g, "");
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = (text.match(/\./g) || []).length;
    if (dots > 1) text = text.replace(/\./g, "");
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const normalizeHeader = (header) =>
  clean(header)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const readRows = () => {
  if (!fs.existsSync(input)) {
    throw new Error(`No existe el archivo: ${input}`);
  }

  const workbook = XLSX.readFile(input, { raw: true });
  const sheet = workbook.Sheets.Productos || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
};

const changed = (a, b) => {
  if (a === null || a === undefined) return false;
  return Number(Number(a).toFixed(2)) !== Number(Number(b || 0).toFixed(2));
};

async function main() {
  const rows = readRows();
  const env = parseEnv(envPath);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
  });

  const report = {
    archivo: input,
    aplicar_cambios: applyChanges,
    filas_excel: rows.length,
    filas_validas: 0,
    actualizables: 0,
    no_encontrados: [],
    sin_id: [],
    invalidos: [],
    cambios_precio_venta: 0,
    cambios_precio_compra: 0,
    cambios_stock: 0,
    ejemplos: [],
  };

  try {
    const [dbProducts] = await connection.query(`
      SELECT id_producto, codigo_barras, codigo_interno, nombre, precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo
      FROM productos
      WHERE is_deleted = 0
    `);
    const byId = new Map(dbProducts.map((product) => [Number(product.id_producto), product]));
    const updates = [];

    for (const row of rows) {
      const id = Number(row.id_producto);
      if (!id) {
        report.sin_id.push(row.nombre || row.codigo_interno || "(fila sin nombre)");
        continue;
      }

      const current = byId.get(id);
      if (!current) {
        report.no_encontrados.push(id);
        continue;
      }

      const precioCompra = parseNumber(row.precio_compra);
      const precioVenta = parseNumber(row.precio_venta);
      const stockActual = parseNumber(row.stock_actual);
      const stockMinimo = parseNumber(row.stock_minimo);
      const stockMaximo = parseNumber(row.stock_maximo);

      if (precioCompra === null || precioVenta === null) {
        report.invalidos.push({
          id_producto: id,
          nombre: row.nombre || current.nombre,
          motivo: "precio_compra o precio_venta vacío/no numérico",
        });
        continue;
      }

      const update = {
        id_producto: id,
        codigo_barras: clean(row.codigo_barras) || null,
        codigo_interno: clean(row.codigo_interno) || current.codigo_interno,
        nombre: clean(row.nombre) || current.nombre,
        precio_compra: Number(precioCompra.toFixed(2)),
        precio_venta: Number(precioVenta.toFixed(2)),
        stock_actual: Number((stockActual ?? current.stock_actual ?? 0).toFixed(2)),
        stock_minimo: Number((stockMinimo ?? current.stock_minimo ?? 0).toFixed(2)),
        stock_maximo: Number((stockMaximo ?? current.stock_maximo ?? 0).toFixed(2)),
      };

      if (changed(update.precio_venta, current.precio_venta)) report.cambios_precio_venta += 1;
      if (changed(update.precio_compra, current.precio_compra)) report.cambios_precio_compra += 1;
      if (
        changed(update.stock_actual, current.stock_actual) ||
        changed(update.stock_minimo, current.stock_minimo) ||
        changed(update.stock_maximo, current.stock_maximo)
      ) {
        report.cambios_stock += 1;
      }

      updates.push(update);
      report.filas_validas += 1;
    }

    report.actualizables = updates.length;
    report.ejemplos = updates.slice(0, 12);

    if (applyChanges) {
      await connection.beginTransaction();
      for (const update of updates) {
        await connection.query(
          `
            UPDATE productos
            SET codigo_barras = ?,
                codigo_interno = ?,
                nombre = ?,
                precio_compra = ?,
                precio_venta = ?,
                stock_actual = ?,
                stock_minimo = ?,
                stock_maximo = ?
            WHERE id_producto = ? AND is_deleted = 0
          `,
          [
            update.codigo_barras,
            update.codigo_interno,
            update.nombre,
            update.precio_compra,
            update.precio_venta,
            update.stock_actual,
            update.stock_minimo,
            update.stock_maximo,
            update.id_producto,
          ]
        );
      }
      await connection.commit();
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
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
