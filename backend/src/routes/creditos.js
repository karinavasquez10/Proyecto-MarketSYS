import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { recalcularEstadoCredito } from "../utils/creditos.js";

const router = express.Router();

const METODOS_ABONO = new Set(["efectivo", "tarjeta", "transferencia", "mixto", "otro"]);

const normalize = (value) => String(value || "").trim().toLowerCase();

router.get("/", async (req, res) => {
  try {
    const { tipo, estado, desde, hasta, tercero, limit = 300 } = req.query;
    const conditions = [];
    const params = [];

    if (tipo) {
      conditions.push("cr.tipo = ?");
      params.push(normalize(tipo));
    }
    if (estado) {
      conditions.push("cr.estado = ?");
      params.push(normalize(estado));
    }
    if (desde) {
      conditions.push("DATE(cr.fecha_emision) >= ?");
      params.push(desde);
    }
    if (hasta) {
      conditions.push("DATE(cr.fecha_emision) <= ?");
      params.push(hasta);
    }
    if (tercero) {
      conditions.push("(cl.nombre LIKE ? OR pr.nombre LIKE ? OR cr.numero_documento LIKE ?)");
      params.push(`%${tercero}%`, `%${tercero}%`, `%${tercero}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 300, 1), 1000);

    const [rows] = await pool.query(
      `
        SELECT
          cr.*,
          cl.nombre AS nombre_cliente,
          cl.identificacion AS identificacion_cliente,
          pr.nombre AS nombre_proveedor,
          pr.identificacion AS identificacion_proveedor,
          u.nombre AS nombre_usuario,
          COALESCE(SUM(ac.monto), 0) AS total_abonado,
          COUNT(ac.id_abono_credito) AS cantidad_abonos
        FROM creditos cr
        LEFT JOIN clientes cl ON cr.id_cliente = cl.id_cliente
        LEFT JOIN proveedores pr ON cr.id_proveedor = pr.id_proveedor
        LEFT JOIN usuarios u ON cr.creado_por = u.id_usuario
        LEFT JOIN abonos_credito ac ON cr.id_credito = ac.id_credito
        ${where}
        GROUP BY cr.id_credito
        ORDER BY cr.fecha_creacion DESC, cr.id_credito DESC
        LIMIT ${safeLimit}
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener créditos:", error);
    res.status(500).json({ message: "Error al obtener créditos" });
  }
});

router.get("/:id_credito/abonos", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          ac.*,
          u.nombre AS nombre_usuario,
          c.estado AS estado_caja
        FROM abonos_credito ac
        LEFT JOIN usuarios u ON ac.id_usuario = u.id_usuario
        LEFT JOIN caja c ON ac.id_caja = c.id_caja
        WHERE ac.id_credito = ?
        ORDER BY ac.fecha DESC, ac.id_abono_credito DESC
      `,
      [req.params.id_credito]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener abonos:", error);
    res.status(500).json({ message: "Error al obtener abonos" });
  }
});

router.post("/:id_credito/abonos", async (req, res) => {
  const idCredito = req.params.id_credito;
  const monto = Number(req.body.monto);
  const metodoPago = normalize(req.body.metodo_pago || "efectivo");
  const idUsuario = req.body.id_usuario || req.user?.id || null;
  const {
    id_caja = null,
    soporte_url = null,
    observacion = null,
    fecha = null,
  } = req.body;

  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ message: "El monto del abono debe ser mayor a cero." });
  }
  if (!METODOS_ABONO.has(metodoPago)) {
    return res.status(400).json({ message: "Método de pago inválido." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [creditos] = await connection.query(
      "SELECT * FROM creditos WHERE id_credito = ? FOR UPDATE",
      [idCredito]
    );

    if (creditos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Crédito no encontrado." });
    }

    const credito = creditos[0];
    if (["pagado", "anulado"].includes(credito.estado)) {
      await connection.rollback();
      return res.status(400).json({ message: "Este crédito no permite nuevos abonos." });
    }
    if (monto > Number(credito.saldo_pendiente || 0)) {
      await connection.rollback();
      return res.status(400).json({ message: "El abono no puede superar el saldo pendiente." });
    }

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
        return res.status(400).json({ message: "Solo se pueden registrar abonos sobre una caja abierta." });
      }
      if (credito.tipo === "por_pagar" && Number(cajas[0].monto_final || 0) < monto) {
        await connection.rollback();
        return res.status(400).json({ message: "La caja no tiene saldo suficiente para este pago." });
      }
    }

    const [abonoResult] = await connection.query(
      `
        INSERT INTO abonos_credito
          (id_credito, monto, metodo_pago, id_caja, id_usuario, soporte_url, observacion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      `,
      [
        idCredito,
        monto,
        metodoPago,
        id_caja || null,
        idUsuario,
        soporte_url || null,
        observacion || null,
        fecha || null,
      ]
    );

    const tipoMovimiento = credito.tipo === "por_cobrar" ? "ingreso" : "egreso";
    const categoria = credito.tipo === "por_cobrar" ? "abono_cliente" : "pago_proveedor";
    await connection.query(
      `
        INSERT INTO movimientos_financieros
          (tipo, categoria, monto, metodo_pago, id_caja, id_usuario, id_cliente, id_proveedor,
           referencia_tabla, referencia_id, observacion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abonos_credito', ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      `,
      [
        tipoMovimiento,
        categoria,
        monto,
        metodoPago,
        id_caja || null,
        idUsuario,
        credito.id_cliente || null,
        credito.id_proveedor || null,
        abonoResult.insertId,
        observacion || `Abono crédito ${credito.numero_documento || credito.id_credito}`,
        fecha || null,
      ]
    );

    if (id_caja) {
      await connection.query(
        "INSERT INTO movimientos_caja (id_caja, tipo, descripcion, monto, fecha) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))",
        [
          id_caja,
          tipoMovimiento,
          observacion || `Abono crédito ${credito.numero_documento || credito.id_credito}`,
          monto,
          fecha || null,
        ]
      );
      await connection.query(
        `UPDATE caja
         SET monto_final = COALESCE(monto_final, 0) ${tipoMovimiento === "ingreso" ? "+" : "-"} ?
         WHERE id_caja = ?`,
        [monto, id_caja]
      );
    }

    const estadoCredito = await recalcularEstadoCredito(connection, idCredito);

    if (credito.id_venta && estadoCredito) {
      await connection.query(
        "UPDATE ventas SET estado = ? WHERE id_venta = ?",
        [estadoCredito.estado === "pagado" ? "pagada" : "credito", credito.id_venta]
      );
    }
    if (credito.id_compra && estadoCredito) {
      await connection.query(
        "UPDATE compras SET estado = ? WHERE id_compra = ?",
        [estadoCredito.estado === "pagado" ? "pagada" : "credito", credito.id_compra]
      );
    }

    const [rows] = await connection.query(
      "SELECT * FROM abonos_credito WHERE id_abono_credito = ?",
      [abonoResult.insertId]
    );

    await connection.commit();

    try {
      await registrarAuditoria({
        id_usuario: idUsuario || 1,
        accion: "Registro de abono de crédito",
        tabla_nombre: "abonos_credito",
        registro_id: abonoResult.insertId,
        detalles: {
          id_credito: Number(idCredito),
          monto,
          metodo_pago: metodoPago,
          id_caja,
        },
        req,
      });
    } catch (auditError) {
      console.error("Error al auditar abono de crédito:", auditError);
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    await connection.rollback();
    console.error("Error al registrar abono:", error);
    res.status(500).json({ message: "Error al registrar abono" });
  } finally {
    connection.release();
  }
});

export default router;
