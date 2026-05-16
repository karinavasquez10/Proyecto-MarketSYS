const fs = require("fs");
const path = require("path");
const mysql = require("../backend/node_modules/mysql2/promise");
const XLSX = require("../frontend/node_modules/xlsx");

const root = path.join(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const input = path.join(root, "frontend", "referencias", "EXCEL", "PRODUCTOS_MARKETSYS_CON_PRESENTACIONES_KG.xlsx");
const reportPath = path.join(root, "frontend", "referencias", "EXCEL", "reporte_presentaciones_kg_marketsys.json");
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

const normalizeHeader = (header) =>
  clean(header)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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

const readRows = () => {
  const workbook = XLSX.readFile(input, { raw: true });
  const sheet = workbook.Sheets.Productos || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true }).map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }
    return normalized;
  });
};

async function main() {
  if (!fs.existsSync(input)) {
    throw new Error(`No existe el archivo: ${input}`);
  }

  const env = parseEnv(envPath);
  const rows = readRows();
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
    filas_nuevas_detectadas: 0,
    insertables: 0,
    invalidos: [],
    duplicados: [],
    insertados: [],
  };

  try {
    const [categories] = await connection.query("SELECT id_categoria, nombre FROM categorias WHERE is_deleted = 0");
    const [units] = await connection.query("SELECT id_unidad, nombre, abreviatura FROM unidades_medida WHERE is_deleted = 0");
    const categoryByName = new Map(categories.map((category) => [clean(category.nombre).toLowerCase(), category]));
    const unitByAbrev = new Map(units.map((unit) => [clean(unit.abreviatura).toLowerCase(), unit]));
    const unitByName = new Map(units.map((unit) => [clean(unit.nombre).toLowerCase(), unit]));

    const newRows = rows.filter((row) => !clean(row.id_producto));
    report.filas_nuevas_detectadas = newRows.length;

    const insertables = [];
    for (const row of newRows) {
      const nombre = clean(row.nombre).toUpperCase();
      const codigoInterno = clean(row.codigo_interno).toUpperCase();
      const codigoBarras = clean(row.codigo_barras) || null;
      const categoriaNombre = clean(row.categoria);
      const unidadAbrev = clean(row.unidad_abrev).toLowerCase();
      const unidadNombre = clean(row.unidad).toLowerCase();
      const precioCompra = parseNumber(row.precio_compra);
      const precioVenta = parseNumber(row.precio_venta);
      const stockActual = parseNumber(row.stock_actual) ?? 0;
      const stockMinimo = parseNumber(row.stock_minimo) ?? 0;
      const stockMaximo = parseNumber(row.stock_maximo) ?? 0;

      const category = categoryByName.get(categoriaNombre.toLowerCase());
      const unit = unitByAbrev.get(unidadAbrev) || unitByName.get(unidadNombre);

      if (!nombre || !codigoInterno || !category || !unit || precioCompra === null || precioVenta === null) {
        report.invalidos.push({
          nombre,
          codigo_interno: codigoInterno,
          motivo: "Falta nombre, código interno, categoría, unidad o precios numéricos",
        });
        continue;
      }

      const [duplicates] = await connection.query(
        `
          SELECT id_producto, nombre, codigo_interno
          FROM productos
          WHERE is_deleted = 0
            AND (codigo_interno = ? OR UPPER(nombre) = ?)
          LIMIT 5
        `,
        [codigoInterno, nombre]
      );

      if (duplicates.length > 0) {
        report.duplicados.push({
          nombre,
          codigo_interno: codigoInterno,
          coincidencias: duplicates,
        });
        continue;
      }

      insertables.push({
        codigo_barras: codigoBarras,
        codigo_interno: codigoInterno,
        nombre,
        descripcion: clean(row.notas_para_actualizar) || "Presentación por kilogramo",
        id_categoria: category.id_categoria,
        id_unidad: unit.id_unidad,
        precio_compra: Number(precioCompra.toFixed(2)),
        precio_venta: Number(precioVenta.toFixed(2)),
        stock_actual: Number(stockActual.toFixed(2)),
        stock_minimo: Number(stockMinimo.toFixed(2)),
        stock_maximo: Number(stockMaximo.toFixed(2)),
      });
    }

    report.insertables = insertables.length;

    if (applyChanges && insertables.length > 0) {
      await connection.beginTransaction();
      for (const item of insertables) {
        const [result] = await connection.query(
          `
            INSERT INTO productos (
              codigo_barras, codigo_interno, nombre, descripcion, id_categoria, id_unidad,
              precio_compra, precio_venta, stock_actual, stock_minimo, stock_maximo,
              estado, cambia_estado, cambia_apariencia, tiempo_cambio
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NULL)
          `,
          [
            item.codigo_barras,
            item.codigo_interno,
            item.nombre,
            item.descripcion,
            item.id_categoria,
            item.id_unidad,
            item.precio_compra,
            item.precio_venta,
            item.stock_actual,
            item.stock_minimo,
            item.stock_maximo,
          ]
        );
        report.insertados.push({ id_producto: result.insertId, ...item });
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
