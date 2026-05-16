// routes/proveedores.js
import express from 'express';
import db from '../config/database.js'; // Asumiendo que existe un archivo de configuración de base de datos (e.g., usando mysql2 pool). Ajusta la importación según tu setup.
import { registrarAuditoria } from '../utils/auditoria.js';

const router = express.Router();

// GET: Listar proveedores (solo no eliminados)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        id_proveedor, nombre, contacto_principal, identificacion, direccion,
        telefono, correo, tipo_proveedor, estado, condiciones_pago,
        plazo_credito_dias, notas, fecha_creacion
       FROM proveedores
       WHERE is_deleted = 0
       ORDER BY estado ASC, nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener proveedores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST: Crear proveedor
router.post('/', async (req, res) => {
  const {
    nombre,
    contacto_principal,
    identificacion,
    direccion,
    telefono,
    correo,
    tipo_proveedor,
    estado = 'activo',
    condiciones_pago,
    plazo_credito_dias,
    notas
  } = req.body;
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO proveedores (
        nombre, contacto_principal, identificacion, direccion, telefono, correo,
        tipo_proveedor, estado, condiciones_pago, plazo_credito_dias, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        contacto_principal || null,
        identificacion || null,
        direccion || null,
        telefono,
        correo || null,
        tipo_proveedor || null,
        estado || 'activo',
        condiciones_pago || null,
        plazo_credito_dias ? parseInt(plazo_credito_dias) : null,
        notas || null
      ]
    );

    // Registrar auditoría de creación de proveedor
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: 'Creación de proveedor',
      tabla_nombre: 'proveedores',
      registro_id: result.insertId,
      detalles: {
        nombre,
        contacto_principal: contacto_principal || null,
        identificacion: identificacion || null,
        direccion: direccion || null,
        telefono,
        correo: correo || null,
        tipo_proveedor: tipo_proveedor || null,
        estado: estado || 'activo',
        condiciones_pago: condiciones_pago || null,
        plazo_credito_dias: plazo_credito_dias ? parseInt(plazo_credito_dias) : null
      },
      req
    });

    res.status(201).json({ id: result.insertId, message: 'Proveedor creado exitosamente' });
  } catch (err) {
    console.error('Error al crear proveedor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT: Actualizar proveedor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    contacto_principal,
    identificacion,
    direccion,
    telefono,
    correo,
    tipo_proveedor,
    estado = 'activo',
    condiciones_pago,
    plazo_credito_dias,
    notas
  } = req.body;
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  }
  try {
    const [result] = await db.query(
      `UPDATE proveedores
       SET nombre = ?, contacto_principal = ?, identificacion = ?, direccion = ?,
           telefono = ?, correo = ?, tipo_proveedor = ?, estado = ?,
           condiciones_pago = ?, plazo_credito_dias = ?, notas = ?
       WHERE id_proveedor = ? AND is_deleted = 0`,
      [
        nombre,
        contacto_principal || null,
        identificacion || null,
        direccion || null,
        telefono,
        correo || null,
        tipo_proveedor || null,
        estado || 'activo',
        condiciones_pago || null,
        plazo_credito_dias ? parseInt(plazo_credito_dias) : null,
        notas || null,
        id
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    // Registrar auditoría de actualización de proveedor
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: 'Actualización de proveedor',
      tabla_nombre: 'proveedores',
      registro_id: id,
      detalles: {
        nombre,
        contacto_principal: contacto_principal || null,
        identificacion: identificacion || null,
        direccion: direccion || null,
        telefono,
        correo: correo || null,
        tipo_proveedor: tipo_proveedor || null,
        estado: estado || 'activo',
        condiciones_pago: condiciones_pago || null,
        plazo_credito_dias: plazo_credito_dias ? parseInt(plazo_credito_dias) : null
      },
      req
    });

    res.json({ message: 'Proveedor actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar proveedor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE: Soft delete + insertar en papelera
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const deletedBy = req.user?.id || 1; // Asumir middleware auth provee req.user.id
    try {
      // Primero, obtener el registro completo para papelera
      const [proveedorRows] = await db.query(
        'SELECT * FROM proveedores WHERE id_proveedor = ? AND is_deleted = 0',
        [id]
      );
      if (proveedorRows.length === 0) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      const proveedor = proveedorRows[0];
  
      // Insertar en papelera
      await db.query(
        'INSERT INTO papelera (tabla, registro_id, contenido, id_usuario) VALUES (?, ?, ?, ?)',
        [
          'proveedores',
          id,
          JSON.stringify(proveedor), // Almacenar todo el registro como JSON
          deletedBy
        ]
      );
  
      // Luego, soft delete
      const [result] = await db.query(
        'UPDATE proveedores SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id_proveedor = ?',
        [deletedBy, id]
      );

      // Registrar auditoría de eliminación de proveedor
      await registrarAuditoria({
        id_usuario: deletedBy,
        accion: 'Eliminación de proveedor (soft delete)',
        tabla_nombre: 'proveedores',
        registro_id: id,
        detalles: {
          nombre: proveedor.nombre,
          identificacion: proveedor.identificacion,
          telefono: proveedor.telefono,
          correo: proveedor.correo,
          movido_a_papelera: true
        },
        req
      });
  
      res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (err) {
      console.error('Error al eliminar proveedor:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  
  export default router;
