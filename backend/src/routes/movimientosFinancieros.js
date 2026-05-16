import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

const TIPOS = new Set(["ingreso", "egreso"]);
const CATEGORIAS = new Set([
  "venta",
  "venta_manual",
  "compra",
  "gasto",
  "abono_cliente",
  "pago_proveedor",
  "ajuste",
  "otro",
]);
const METODOS = new Set(["efectivo", "tarjeta", "transferencia", "mixto", "credito", "otro"]);

const normalizeText = (value) => String(value || "").trim().toLowerCase();

router.get("/", async (req, res) => {
  try {
    const { tipo, categoria, desde, hasta, id_caja, id_usuario, limit = 300 } = req.query;
    const conditions = [];
    const params = [];

    if (tipo) {
      conditions.push("mf.tipo = ?");
      params.push(normalizeText(tipo));
    }
    if (categoria) {
      conditions.push("mf.categoria = ?");
      params.push(normalizeText(categoria));
    }
    if (desde) {
      conditions.push("DATE(mf.fecha) >= ?");
      params.push(desde);
    }
    if (hasta) {
      conditions.push("DATE(mf.fecha) <= ?");
      params.push(hasta);
    }
    if (id_caja) {
      conditions.push("mf.id_caja = ?");
      params.push(id_caja);
    }
    if (id_usuario) {
      conditions.push("mf.id_usuario = ?");
      params.push(id_usuario);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 300, 1), 1000);

    const [rows] = await pool.query(
      `
        SELECT
          mf.*,
          u.nombre AS nombre_usuario,
          cl.nombre AS nombre_cliente,
          pr.nombre AS nombre_proveedor,
          c.estado AS estado_caja
        FROM movimientos_financieros mf
        LEFT JOIN usuarios u ON mf.id_usuario = u.id_usuario
        LEFT JOIN clientes cl ON mf.id_cliente = cl.id_cliente
        LEFT JOIN proveedores pr ON mf.id_proveedor = pr.id_proveedor
        LEFT JOIN caja c ON mf.id_caja = c.id_caja
        ${where}
        ORDER BY mf.fecha DESC, mf.id_movimiento_financiero DESC
        LIMIT ${safeLimit}
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener movimientos financieros:", error);
    res.status(500).json({ message: "Error al obtener movimientos financieros" });
  }
});

router.post("/", async (req, res) => {
  const tipo = normalizeText(req.body.tipo);
  const categoria = normalizeText(req.body.categoria || "otro");
  const metodoPago = req.body.metodo_pago ? normalizeText(req.body.metodo_pago) : null;
  const monto = Number(req.body.monto);
  const idUsuario = req.body.id_usuario || req.user?.id || null;
  const {
    id_caja = null,
    id_cliente = null,
    id_proveedor = null,
    referencia_tabla = null,
    referencia_id = null,
    soporte_url = null,
    observacion = null,
    fecha = null,
  } = req.body;

  if (!TIPOS.has(tipo)) {
    return res.status(400).json({ message: "Tipo inválido. Use ingreso o egreso." });
  }
  if (!CATEGORIAS.has(categoria)) {
    return res.status(400).json({ message: "Categoría inválida para el movimiento financiero." });
  }
  if (metodoPago && !METODOS.has(metodoPago)) {
    return res.status(400).json({ message: "Método de pago inválido." });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a cero." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (id_caja) {
      const [cajas] = await connection.query(
        "SELECT id_caja, estado, monto_final FROM caja WHERE id_caja = ? FOR UPDATE",
        [id_caja]
      );
      if (cajas.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Caja no encontrada." });
      }
      if (cajas[0].estado !== "abierta") {
        await connection.rollback();
        return res.status(400).json({ message: "Solo se pueden registrar movimientos sobre una caja abierta." });
      }
      const montoActual = Number(cajas[0].monto_final || 0);
      if (tipo === "egreso" && montoActual < monto) {
        await connection.rollback();
        return res.status(400).json({ message: "La caja no tiene saldo suficiente para este egreso." });
      }
    }

    const [result] = await connection.query(
      `
        INSERT INTO movimientos_financieros
          (tipo, categoria, monto, metodo_pago, id_caja, id_usuario, id_cliente, id_proveedor,
           referencia_tabla, referencia_id, soporte_url, observacion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      `,
      [
        tipo,
        categoria,
        monto,
        metodoPago,
        id_caja || null,
        idUsuario,
        id_cliente || null,
        id_proveedor || null,
        referencia_tabla || null,
        referencia_id || null,
        soporte_url || null,
        observacion || null,
        fecha || null,
      ]
    );

    if (id_caja) {
      const descripcionCaja = observacion || `${categoria.replace(/_/g, " ")} registrado desde movimientos financieros`;
      await connection.query(
        "INSERT INTO movimientos_caja (id_caja, tipo, descripcion, monto) VALUES (?, ?, ?, ?)",
        [id_caja, tipo, descripcionCaja, monto]
      );
      await connection.query(
        `UPDATE caja
         SET monto_final = COALESCE(monto_final, 0) ${tipo === "ingreso" ? "+" : "-"} ?
         WHERE id_caja = ?`,
        [monto, id_caja]
      );
    }

    const [rows] = await connection.query(
      `
        SELECT
          mf.*,
          u.nombre AS nombre_usuario,
          cl.nombre AS nombre_cliente,
          pr.nombre AS nombre_proveedor,
          c.estado AS estado_caja
        FROM movimientos_financieros mf
        LEFT JOIN usuarios u ON mf.id_usuario = u.id_usuario
        LEFT JOIN clientes cl ON mf.id_cliente = cl.id_cliente
        LEFT JOIN proveedores pr ON mf.id_proveedor = pr.id_proveedor
        LEFT JOIN caja c ON mf.id_caja = c.id_caja
        WHERE mf.id_movimiento_financiero = ?
      `,
      [result.insertId]
    );

    await connection.commit();
    try {
      await registrarAuditoria({
        id_usuario: idUsuario || 1,
        accion: "Registro de movimiento financiero",
        tabla_nombre: "movimientos_financieros",
        registro_id: result.insertId,
        detalles: {
          id_movimiento_financiero: result.insertId,
          tipo,
          categoria,
          monto,
          metodo_pago: metodoPago,
          id_caja,
        },
        req,
      });
    } catch (auditError) {
      console.error("Error al registrar auditoría de movimiento financiero:", auditError);
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar movimiento financiero:", error);
    res.status(500).json({ message: "Error al registrar movimiento financiero" });
  } finally {
    connection.release();
  }
});

export default router;
