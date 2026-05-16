import express from "express";
import pool from "../config/database.js";
import { registrarMovimientoInventario } from "../utils/inventario.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

const safeRegistrarMovimientoInventario = async (connection, data) => {
  try {
    await registrarMovimientoInventario(connection, data);
  } catch (error) {
    console.error("No se pudo registrar movimiento de inventario (no crítico):", error);
  }
};

router.post("/ajuste", async (req, res) => {
  const {
    id_producto,
    id_usuario = null,
    nombre,
    descripcion = "",
    precio_venta,
    stock_actual,
    observacion = "",
  } = req.body;

  if (!id_producto) {
    return res.status(400).json({ message: "Debe indicar el producto a ajustar." });
  }

  const nuevoStock = Number(stock_actual);
  const nuevoPrecioVenta = Number(precio_venta);

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ message: "El nombre del producto es obligatorio." });
  }
  if (!Number.isFinite(nuevoStock)) {
    return res.status(400).json({ message: "La cantidad debe ser un número válido." });
  }
  if (!Number.isFinite(nuevoPrecioVenta) || nuevoPrecioVenta < 0) {
    return res.status(400).json({ message: "El precio de venta debe ser un número válido." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [productos] = await connection.query(
      `SELECT id_producto, nombre, descripcion, precio_venta, stock_actual
       FROM productos
       WHERE id_producto = ? AND is_deleted = 0
       FOR UPDATE`,
      [id_producto]
    );

    if (productos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const productoAnterior = productos[0];
    const stockAnterior = Number(productoAnterior.stock_actual || 0);
    const diferenciaStock = Number((nuevoStock - stockAnterior).toFixed(2));
    const nombreLimpio = String(nombre).trim();
    const descripcionLimpia = String(descripcion || "").trim();
    const observacionLimpia = String(observacion || "").trim();

    await connection.query(
      `UPDATE productos
       SET nombre = ?, descripcion = ?, precio_venta = ?, stock_actual = ?
       WHERE id_producto = ? AND is_deleted = 0`,
      [nombreLimpio, descripcionLimpia || null, nuevoPrecioVenta, nuevoStock, id_producto]
    );

    const cambios = [];
    if (productoAnterior.nombre !== nombreLimpio) cambios.push(`Nombre: ${productoAnterior.nombre} -> ${nombreLimpio}`);
    if (String(productoAnterior.descripcion || "") !== descripcionLimpia) cambios.push("Descripción actualizada");
    if (Number(productoAnterior.precio_venta || 0) !== nuevoPrecioVenta) {
      cambios.push(`Precio venta: ${Number(productoAnterior.precio_venta || 0)} -> ${nuevoPrecioVenta}`);
    }
    if (stockAnterior !== nuevoStock) cambios.push(`Stock: ${stockAnterior} -> ${nuevoStock}`);

    await safeRegistrarMovimientoInventario(connection, {
      id_producto,
      id_usuario,
      tipo: "ajuste",
      cantidad: diferenciaStock,
      stock_anterior: stockAnterior,
      stock_nuevo: nuevoStock,
      referencia_tabla: "productos",
      referencia_id: id_producto,
      observacion: observacionLimpia || cambios.join("; ") || "Ajuste manual de inventario",
    });

    const [actualizado] = await connection.query(
      `SELECT
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
        c.nombre as nombre_categoria,
        c.id_categoria,
        c.impuesto,
        u.nombre as nombre_unidad,
        u.abreviatura as unidad_abrev,
        p.estado
       FROM productos p
       INNER JOIN categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN unidades_medida u ON p.id_unidad = u.id_unidad
       WHERE p.id_producto = ?`,
      [id_producto]
    );

    await connection.commit();

    try {
      await registrarAuditoria({
        id_usuario: id_usuario || null,
        accion: "Ajuste manual de inventario",
        tabla_nombre: "productos",
        registro_id: id_producto,
        detalles: {
          id_producto,
          stock_anterior: stockAnterior,
          stock_nuevo: nuevoStock,
          precio_venta_anterior: Number(productoAnterior.precio_venta || 0),
          precio_venta_nuevo: nuevoPrecioVenta,
          cambios,
        },
        req,
      });
    } catch (auditError) {
      console.error("Error al registrar auditoría de ajuste de inventario:", auditError);
    }

    res.status(201).json({
      message: "Ajuste de inventario registrado correctamente.",
      producto: actualizado[0] || null,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al ajustar inventario:", error);
    res.status(500).json({ message: "Error al ajustar inventario." });
  } finally {
    connection.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const { id_producto, tipo, desde, hasta, limit = 200 } = req.query;
    const conditions = [];
    const params = [];

    if (id_producto) {
      conditions.push("mi.id_producto = ?");
      params.push(id_producto);
    }
    if (tipo) {
      conditions.push("mi.tipo = ?");
      params.push(tipo);
    }
    if (desde) {
      conditions.push("DATE(mi.fecha) >= ?");
      params.push(desde);
    }
    if (hasta) {
      conditions.push("DATE(mi.fecha) <= ?");
      params.push(hasta);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Math.min(Math.max(parseInt(limit) || 200, 1), 1000);

    const [rows] = await pool.query(
      `
        SELECT
          mi.*,
          p.nombre AS nombre_producto,
          p.codigo_barras,
          p.codigo_interno,
          u.nombre AS nombre_usuario,
          s.nombre AS nombre_sucursal
        FROM movimientos_inventario mi
        INNER JOIN productos p ON mi.id_producto = p.id_producto
        LEFT JOIN usuarios u ON mi.id_usuario = u.id_usuario
        LEFT JOIN sucursales s ON mi.id_sucursal = s.id_sucursal
        ${where}
        ORDER BY mi.fecha DESC
        LIMIT ${safeLimit}
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener movimientos de inventario:", error);
    res.json([]);
  }
});

export default router;
