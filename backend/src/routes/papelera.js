// routes/papelera.js (actualizado: soporte para 'productos' en restore/delete)
import express from 'express';
import db from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const router = express.Router();

// GET: Listar elementos de la papelera (compras, productos, clientes)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id_papelera,
        p.tabla as tipo,
        p.registro_id,
        p.contenido,
        p.fecha_eliminacion as fecha,
        u.nombre as eliminadoPor
      FROM papelera p 
      LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario 
      WHERE p.tabla IN ('compras', 'productos', 'clientes')  -- Incluir clientes
      ORDER BY p.fecha_eliminacion DESC
    `);
    
    // Reconstruir nombre desde contenido JSON
    const items = rows.map(row => {
      try {
        const parsed = JSON.parse(row.contenido);
        let nombre = parsed.nombre || parsed.titulo || parsed.nombre_producto || parsed.proveedor_nombre || 'Sin nombre';
        if (row.tipo === 'compras') nombre = `Compra de ${parsed.proveedor_nombre || 'Proveedor'} (ID: ${row.registro_id})`;
        if (row.tipo === 'productos') nombre = `${parsed.nombre || 'Producto'} (ID: ${row.registro_id})`;
        if (row.tipo === 'clientes') nombre = `${parsed.nombre || 'Cliente'} - ${parsed.identificacion || 'Sin ID'} (ID: ${row.registro_id})`;
        return {
          ...row,
          nombre,
        };
      } catch (err) {
        console.error('Error parsing contenido:', err);
        return { ...row, nombre: 'Error al leer datos' };
      }
    });

    res.json(items);
  } catch (err) {
    console.error('Error al obtener papelera:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST: Restaurar elemento (actualizar tabla original y eliminar de papelera)
router.post('/restore/:id_papelera', async (req, res) => {
  const { id_papelera } = req.params;
  try {
    // Obtener el registro de papelera
    const [papeleraRows] = await db.query(
      'SELECT * FROM papelera WHERE id_papelera = ?',
      [id_papelera]
    );
    if (papeleraRows.length === 0) {
      return res.status(404).json({ error: 'Elemento no encontrado en papelera' });
    }
    const { tabla, registro_id, contenido } = papeleraRows[0];

    const parsed = JSON.parse(contenido);

    // Actualizar tabla original (asumir soft delete con is_deleted=0)
    let updateQuery;
    switch (tabla.toLowerCase()) {
      case 'categorias':
        updateQuery = `
          UPDATE categorias 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
          WHERE id_categoria = ?
        `;
        break;
      case 'proveedores':
        updateQuery = `
          UPDATE proveedores 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
          WHERE id_proveedor = ?
        `;
        break;
      case 'productos':
        updateQuery = `
          UPDATE productos 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL, estado = 1 
          WHERE id_producto = ?
        `;
        break;
      case 'clientes':
        updateQuery = `
          UPDATE clientes 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
          WHERE id_cliente = ?
        `;
        break;
      case 'compras':
        updateQuery = `
          UPDATE compras 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
          WHERE id_compra = ?
        `;
        break;
      case 'detalle_compras':
        updateQuery = `
          UPDATE detalle_compras 
          SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
          WHERE id_detalle = ?
        `;
        break;
      default:
        return res.status(400).json({ error: 'Tabla no soportada para restauración' });
    }

    const [updateResult] = await db.query(updateQuery, [registro_id]);
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo restaurar el registro original' });
    }

    // Para detalle_compras restore: Actualizar stock +cantidad y total de compra - Sin cambios
    if (tabla.toLowerCase() === 'detalle_compras') {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          [parsed.cantidad, parsed.id_producto]
        );
        await connection.query(
          'UPDATE compras SET total = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM detalle_compras WHERE id_compra = ? AND is_deleted = 0) WHERE id_compra = ?',
          [parsed.id_compra, parsed.id_compra]
        );
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // Para productos restore: No stock revert, ya que no hay "compra" asociada; solo undelete

    // Eliminar de papelera
    await db.query('DELETE FROM papelera WHERE id_papelera = ?', [id_papelera]);

    // Registrar auditoría de restauración desde papelera
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: `Restauración desde papelera`,
      tabla_nombre: tabla,
      registro_id: registro_id,
      detalles: {
        tabla_origen: tabla,
        id_papelera,
        contenido_restaurado: parsed
      },
      req
    });

    res.json({ message: 'Elemento restaurado exitosamente' });
  } catch (err) {
    console.error('Error al restaurar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /:id_papelera - Eliminación definitiva (hard delete de original y papelera)
router.delete('/:id_papelera', async (req, res) => {
  const { id_papelera } = req.params;
  try {
    // Obtener el registro de papelera
    const [papeleraRows] = await db.query(
      'SELECT * FROM papelera WHERE id_papelera = ?',
      [id_papelera]
    );
    if (papeleraRows.length === 0) {
      return res.status(404).json({ error: 'Elemento no encontrado en papelera' });
    }
    const { tabla, registro_id } = papeleraRows[0];

    // Borrar de tabla original
    let deleteQuery;
    switch (tabla.toLowerCase()) {
      case 'categorias':
        deleteQuery = 'DELETE FROM categorias WHERE id_categoria = ?';
        break;
      case 'proveedores':
        deleteQuery = 'DELETE FROM proveedores WHERE id_proveedor = ?';
        break;
      case 'productos':
        deleteQuery = 'DELETE FROM productos WHERE id_producto = ?';
        break;
      case 'clientes':
        deleteQuery = 'DELETE FROM clientes WHERE id_cliente = ?';
        break;
      case 'compras':
        deleteQuery = 'DELETE FROM compras WHERE id_compra = ?';  // Cascade a detalles si FK
        break;
      case 'detalle_compras':
        deleteQuery = 'DELETE FROM detalle_compras WHERE id_detalle = ?';
        break;
      default:
        return res.status(400).json({ error: 'Tabla no soportada para eliminación' });
    }

    const [deleteResult] = await db.query(deleteQuery, [registro_id]);
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: 'No se pudo eliminar el registro original' });
    }

    // Eliminar de papelera
    await db.query('DELETE FROM papelera WHERE id_papelera = ?', [id_papelera]);

    // Registrar auditoría de eliminación definitiva desde papelera
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: `Eliminación definitiva desde papelera`,
      tabla_nombre: tabla,
      registro_id: registro_id,
      detalles: {
        tabla_origen: tabla,
        id_papelera,
        eliminacion_permanente: true
      },
      req
    });

    res.json({ message: 'Elemento eliminado definitivamente' });
  } catch (err) {
    console.error('Error al eliminar definitivamente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;