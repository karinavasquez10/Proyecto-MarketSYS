import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

/* =========================================================
   GET /api/clientes - Obtener todos los clientes activos
========================================================= */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id_cliente AS id,
        nombre,
        identificacion,
        direccion,
        telefono,
        correo,
        tipo,
        fecha_creacion
      FROM clientes
      WHERE is_deleted = 0
      ORDER BY id_cliente DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

/* =========================================================
   POST /api/clientes - Crear un nuevo cliente
========================================================= */
router.post("/", async (req, res) => {
  try {
    const { nombre, identificacion, direccion, telefono, correo, tipo } = req.body;

    if (!nombre || !identificacion) {
      return res.status(400).json({ error: "Nombre e identificación son obligatorios" });
    }

    const [result] = await pool.query(
      `INSERT INTO clientes (nombre, identificacion, direccion, telefono, correo, tipo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, identificacion, direccion || null, telefono || null, correo || null, tipo || "persona"]
    );

    const [rows] = await pool.query(
      `SELECT 
         id_cliente AS id,
         nombre,
         identificacion,
         direccion,
         telefono,
         correo,
         tipo,
         fecha_creacion
       FROM clientes
       WHERE id_cliente = ?`,
      [result.insertId]
    );

    // Registrar auditoría de creación de cliente (sin pasar req para evitar ECONNRESET)
    try {
      await registrarAuditoria({
        id_usuario: req.user?.id || 1,
        accion: 'Creación de cliente',
        tabla_nombre: 'clientes',
        registro_id: result.insertId,
        detalles: {
          nombre,
          identificacion,
          direccion: direccion || null,
          telefono: telefono || null,
          correo: correo || null,
          tipo: tipo || "persona"
        },
        req: null // No pasar req para evitar problemas de conexión
      });
    } catch (auditError) {
      console.error('Error en auditoría (no crítico):', auditError);
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error al crear cliente:", error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});
/* =========================================================
   PUT /api/clientes/:id - Actualizar cliente
========================================================= */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, identificacion, direccion, telefono, correo, tipo } = req.body;

  if (!nombre || !identificacion) {
    return res.status(400).json({ error: "Nombre e identificación son obligatorios" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE clientes 
       SET tipo = ?, nombre = ?, identificacion = ?, direccion = ?, telefono = ?, correo = ?
       WHERE id_cliente = ? AND is_deleted = 0`,
      [tipo || "persona", nombre, identificacion, direccion || null, telefono || null, correo || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const [rows] = await pool.query(
      `SELECT 
         id_cliente AS id,
         tipo,
         nombre,
         identificacion,
         direccion,
         telefono,
         correo,
         fecha_creacion
       FROM clientes
       WHERE id_cliente = ?`,
      [id]
    );

    // Registrar auditoría de actualización de cliente (sin pasar req)
    try {
      await registrarAuditoria({
        id_usuario: req.user?.id || 1,
        accion: 'Actualización de cliente',
        tabla_nombre: 'clientes',
        registro_id: id,
        detalles: {
          nombre,
          identificacion,
          direccion: direccion || null,
          telefono: telefono || null,
          correo: correo || null,
          tipo: tipo || "persona"
        },
        req: null // No pasar req para evitar problemas de conexión
      });
    } catch (auditError) {
      console.error('Error en auditoría (no crítico):', auditError);
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

/* =========================================================
   DELETE /api/clientes/:id - Soft delete + insertar en papelera
========================================================= */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user?.id || 1; // Asumir auth middleware
  try {
    // Obtener registro completo para papelera
    const [clienteRows] = await pool.query(
      `SELECT * FROM clientes WHERE id_cliente = ? AND is_deleted = 0`,
      [id]
    );
    if (clienteRows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }
    const cliente = clienteRows[0];

    // Insertar en papelera
    await pool.query(
      `INSERT INTO papelera (tabla, registro_id, contenido, id_usuario) VALUES (?, ?, ?, ?)`,
      [
        'clientes',
        id,
        JSON.stringify(cliente),
        deletedBy
      ]
    );

    // Soft delete
    const [result] = await pool.query(
      `UPDATE clientes SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id_cliente = ?`,
      [deletedBy, id]
    );

    // Registrar auditoría de eliminación de cliente (sin pasar req)
    try {
      await registrarAuditoria({
        id_usuario: deletedBy,
        accion: 'Eliminación de cliente (soft delete)',
        tabla_nombre: 'clientes',
        registro_id: id,
        detalles: {
          nombre: cliente.nombre,
          identificacion: cliente.identificacion,
          telefono: cliente.telefono || null,
          correo: cliente.correo || null,
          tipo: cliente.tipo,
          movido_a_papelera: true
        },
        req: null // No pasar req para evitar problemas de conexión
      });
    } catch (auditError) {
      console.error('Error en auditoría (no crítico):', auditError);
    }

    res.json({ message: "Cliente eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});

export default router;
