// routes/categorias.js (actualizado con DELETE que envía a papelera e inhabilita productos)
import { Router } from "express";
import pool from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const router = Router();

// Obtener todas las categorías activas (is_deleted = 0)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_categoria, nombre, descripcion, impuesto, fecha_creacion FROM categorias WHERE is_deleted = 0 ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

// Obtener categoría por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id_categoria, nombre, descripcion, impuesto, fecha_creacion FROM categorias WHERE id_categoria = ? AND is_deleted = 0',
      [id]
    );
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: 'Categoría no encontrada' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener categoría' });
  }
});

// Obtener ID de categoría por nombre
router.get('/id/:nombre', async (req, res) => {
  const { nombre } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id_categoria, impuesto FROM categorias WHERE nombre = ? AND is_deleted = 0',
      [nombre]
    );
    if (rows.length > 0) {
      res.json(rows[0]); // Devuelve el primer resultado
    } else {
      res.status(404).json({ message: 'Categoría no encontrada' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener ID de categoría' });
  }
});

// Crear nueva categoría
router.post('/', async (req, res) => {
  const { nombre, descripcion, impuesto = 0.00 } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO categorias (nombre, descripcion, impuesto) VALUES (?, ?, ?)',
      [nombre, descripcion || null, parseFloat(impuesto)]
    );
    const nuevaCategoria = { id_categoria: result.insertId, nombre, descripcion: descripcion || null, impuesto: parseFloat(impuesto) };

    // Registrar auditoría de creación de categoría
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: 'Creación de categoría',
      tabla_nombre: 'categorias',
      registro_id: result.insertId,
      detalles: {
        nombre,
        descripcion: descripcion || null,
        impuesto: parseFloat(impuesto)
      },
      req
    });

    res.status(201).json(nuevaCategoria);
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'Ya existe una categoría con ese nombre' });
    } else {
      res.status(500).json({ message: 'Error al crear categoría' });
    }
  }
});

// Actualizar categoría
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, impuesto } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE categorias SET nombre = ?, descripcion = ?, impuesto = ? WHERE id_categoria = ? AND is_deleted = 0',
      [nombre, descripcion || null, parseFloat(impuesto || 0), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }

    // Registrar auditoría de actualización de categoría
    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: 'Actualización de categoría',
      tabla_nombre: 'categorias',
      registro_id: id,
      detalles: {
        nombre,
        descripcion: descripcion || null,
        impuesto: parseFloat(impuesto || 0)
      },
      req
    });

    res.json({ message: 'Categoría actualizada exitosamente' });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'Ya existe una categoría con ese nombre' });
    } else {
      res.status(500).json({ message: 'Error al actualizar categoría' });
    }
  }
});

// Eliminar categoría (soft delete + insertar en papelera + inhabilitar productos)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user?.id || 1; // Asumir ID de usuario si no hay auth
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Obtener datos de la categoría para papelera
    const [catRows] = await connection.query(
      'SELECT * FROM categorias WHERE id_categoria = ? AND is_deleted = 0',
      [id]
    );
    if (catRows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada' });
    }
    const categoria = catRows[0];

    // Insertar en papelera
    const [papeleraResult] = await connection.query(
      `INSERT INTO papelera (tabla, registro_id, contenido, id_usuario, fecha_eliminacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        'categorias',
        id,
        JSON.stringify(categoria),
        deletedBy
      ]
    );

    // Soft delete categoría
    await connection.query(
      'UPDATE categorias SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id_categoria = ?',
      [deletedBy, id]
    );

    // Inhabilitar productos asociados (set estado=0)
    const [prodResult] = await connection.query(
      'UPDATE productos SET estado = 0 WHERE id_categoria = ? AND is_deleted = 0',
      [id]
    );
    console.log(`Inhabilitados ${prodResult.affectedRows} productos.`);

    await connection.commit();

    // Registrar auditoría de eliminación de categoría
    await registrarAuditoria({
      id_usuario: deletedBy,
      accion: 'Eliminación de categoría (soft delete)',
      tabla_nombre: 'categorias',
      registro_id: id,
      detalles: {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        impuesto: categoria.impuesto,
        productos_inhabilitados: prodResult.affectedRows,
        movido_a_papelera: true
      },
      req
    });

    res.json({ 
      message: 'Categoría eliminada exitosamente', 
      papelera_id: papeleraResult.insertId,
      productos_inhabilitados: prodResult.affectedRows 
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar categoría' });
  } finally {
    connection.release();
  }
});

export default router;