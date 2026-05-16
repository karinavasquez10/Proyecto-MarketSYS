import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

const parseConfigValue = (row) => {
  if (row.tipo === "booleano") return row.valor === "true" || row.valor === "1";
  if (row.tipo === "numero") return Number(row.valor || 0);
  if (row.tipo === "json") {
    try {
      return row.valor ? JSON.parse(row.valor) : null;
    } catch {
      return null;
    }
  }
  return row.valor ?? "";
};

const serializeConfigValue = (value, tipo = "texto") => {
  if (tipo === "booleano") return value === true || value === "true" || value === 1 || value === "1" ? "true" : "false";
  if (tipo === "numero") return String(Number(value || 0));
  if (tipo === "json") return JSON.stringify(value ?? null);
  return String(value ?? "");
};

const groupRows = (rows) => rows.reduce((acc, row) => {
  if (!acc[row.grupo]) acc[row.grupo] = {};
  acc[row.grupo][row.clave] = {
    id_configuracion: row.id_configuracion,
    clave: row.clave,
    valor: parseConfigValue(row),
    tipo: row.tipo,
    descripcion: row.descripcion,
    actualizado_en: row.actualizado_en,
  };
  return acc;
}, {});

router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM configuracion_sistema ORDER BY grupo ASC, clave ASC"
    );
    res.json({
      items: rows.map((row) => ({ ...row, valor: parseConfigValue(row) })),
      grupos: groupRows(rows),
    });
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({ message: "Error al obtener configuración" });
  }
});

router.put("/", async (req, res) => {
  const { configuraciones = [], id_usuario = req.user?.id || null } = req.body;
  if (!Array.isArray(configuraciones)) {
    return res.status(400).json({ message: "configuraciones debe ser un arreglo" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of configuraciones) {
      const clave = String(item.clave || "").trim();
      if (!clave) continue;

      const [actualRows] = await connection.query(
        "SELECT tipo FROM configuracion_sistema WHERE clave = ?",
        [clave]
      );
      const tipo = item.tipo || actualRows[0]?.tipo || "texto";
      const valor = serializeConfigValue(item.valor, tipo);

      await connection.query(
        `
          INSERT INTO configuracion_sistema
            (clave, valor, tipo, grupo, descripcion, actualizado_por)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            valor = VALUES(valor),
            tipo = VALUES(tipo),
            grupo = VALUES(grupo),
            descripcion = COALESCE(VALUES(descripcion), descripcion),
            actualizado_por = VALUES(actualizado_por)
        `,
        [
          clave,
          valor,
          tipo,
          item.grupo || clave.split(".")[0] || "general",
          item.descripcion || null,
          id_usuario,
        ]
      );
    }

    await connection.commit();

    try {
      await registrarAuditoria({
        id_usuario: id_usuario || 1,
        accion: "Actualización de configuración del sistema",
        tabla_nombre: "configuracion_sistema",
        registro_id: null,
        detalles: { claves: configuraciones.map((item) => item.clave).filter(Boolean) },
        req,
      });
    } catch (auditError) {
      console.error("Error al auditar configuración:", auditError);
    }

    const [rows] = await pool.query(
      "SELECT * FROM configuracion_sistema ORDER BY grupo ASC, clave ASC"
    );
    res.json({
      items: rows.map((row) => ({ ...row, valor: parseConfigValue(row) })),
      grupos: groupRows(rows),
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al guardar configuración:", error);
    res.status(500).json({ message: "Error al guardar configuración" });
  } finally {
    connection.release();
  }
});

router.get("/impuesto", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT impuesto FROM categorias WHERE is_deleted = 0 LIMIT 1");
    if (rows && rows[0]) return res.json({ impuesto: rows[0].impuesto });
    res.json({ impuesto: 0 });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
