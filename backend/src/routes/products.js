// routes/products.js (actualizado: PUT editar, DELETE soft-delete con papelera)
import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// Obtener todos los productos activos con categorías, unidades e impuesto
router.get('/productos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id_producto, 
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
      WHERE p.estado = 1 AND p.is_deleted = 0
      ORDER BY p.nombre ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).send('Error al obtener productos');
  }
});

// Obtener producto por ID
router.get('/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        p.id_producto as codigo,
        c.nombre as nombre_categoria,
        c.id_categoria,
        c.impuesto,
        u.nombre as nombre_unidad,
        u.abreviatura as unidad_abrev,
        u.id_unidad
      FROM productos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN unidades_medida u ON p.id_unidad = u.id_unidad
      WHERE p.id_producto = ? AND p.estado = 1 AND p.is_deleted = 0
    `, [id]);
    if (rows.length === 0) {
      return res.status(404).send('Producto no encontrado');
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).send('Error al obtener producto');
  }
});

// PUT /api/products/productos/:id - Editar producto
router.put('/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, descripcion, id_categoria, id_unidad, precio_compra, precio_venta, 
    stock_actual, stock_minimo, stock_maximo, estado, cambia_estado, cambia_apariencia, tiempo_cambio 
  } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(`
      UPDATE productos 
      SET nombre = ?, descripcion = ?, id_categoria = ?, id_unidad = ?, 
          precio_compra = ?, precio_venta = ?, stock_actual = ?, 
          stock_minimo = ?, stock_maximo = ?, estado = ?,
          cambia_estado = ?, cambia_apariencia = ?, tiempo_cambio = ?
      WHERE id_producto = ? AND is_deleted = 0
    `, [
      nombre, descripcion, id_categoria, id_unidad, 
      parseFloat(precio_compra), parseFloat(precio_venta), parseFloat(stock_actual), 
      parseFloat(stock_minimo), parseFloat(stock_maximo), estado ? 1 : 0,
      cambia_estado !== undefined ? parseInt(cambia_estado) : 0,
      cambia_apariencia !== undefined ? parseInt(cambia_apariencia) : 0,
      tiempo_cambio !== undefined && tiempo_cambio !== null ? parseInt(tiempo_cambio) : null,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado o ya eliminado' });
    }

    await connection.commit();
    
    // Registrar auditoría de actualización de producto
    await registrarAuditoria({
      id_usuario: req.user?.id || null,
      accion: 'Actualización de producto',
      tabla_nombre: 'productos',
      registro_id: id,
      detalles: {
        nombre,
        id_categoria,
        precio_compra: parseFloat(precio_compra),
        precio_venta: parseFloat(precio_venta),
        stock_actual: parseFloat(stock_actual)
      },
      req
    });
    
    res.json({ message: 'Producto actualizado exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto' });
  } finally {
    connection.release();
  }
});

// DELETE /api/products/productos/:id - Soft delete producto (mover a papelera)
router.delete('/productos/:id', async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user?.id || 1;  // Asumir auth
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Obtener snapshot para papelera
    const [productoRows] = await connection.query(`
      SELECT p.*, c.nombre as nombre_categoria, u.nombre as nombre_unidad
      FROM productos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN unidades_medida u ON p.id_unidad = u.id_unidad
      WHERE p.id_producto = ?
    `, [id]);
    if (productoRows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    const producto = productoRows[0];

    // Soft delete
    await connection.query(
      'UPDATE productos SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id_producto = ?',
      [deletedBy, id]
    );

    // Insertar en papelera (JSON snapshot)
    const contenido = JSON.stringify({
      id_producto: producto.id_producto,
      codigo: producto.id_producto,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      id_categoria: producto.id_categoria,
      nombre_categoria: producto.nombre_categoria,
      id_unidad: producto.id_unidad,
      nombre_unidad: producto.nombre_unidad,
      precio_compra: producto.precio_compra,
      precio_venta: producto.precio_venta,
      stock_actual: producto.stock_actual,
      stock_minimo: producto.stock_minimo,
      stock_maximo: producto.stock_maximo,
      estado: producto.estado,
    });
    await connection.query(
      'INSERT INTO papelera (tabla, registro_id, contenido, fecha_eliminacion, id_usuario) VALUES (?, ?, ?, NOW(), ?)',
      ['productos', id, contenido, deletedBy]
    );

    await connection.commit();
    
    // Registrar auditoría de eliminación de producto
    await registrarAuditoria({
      id_usuario: deletedBy,
      accion: 'Eliminación de producto (soft delete)',
      tabla_nombre: 'productos',
      registro_id: id,
      detalles: {
        nombre: producto.nombre,
        categoria: producto.nombre_categoria,
        precio_venta: producto.precio_venta,
        stock_actual: producto.stock_actual,
        movido_a_papelera: true
      },
      req
    });
    
    res.json({ message: 'Producto eliminado y movido a papelera exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error al eliminar producto' });
  } finally {
    connection.release();
  }
});

// Actualizar stocks múltiples (usado después de una venta exitosa) - Sin cambios
router.post('/update-stocks', async (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: 'Debe proporcionar un array de actualizaciones de stock' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const update of updates) {
      const { id_producto, quantity } = update;
      if (!id_producto || typeof quantity !== 'number' || quantity <= 0) {
        throw new Error('Datos inválidos en actualizaciones de stock');
      }
      const [result] = await connection.query(
        'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ? AND stock_actual >= ?',
        [quantity, id_producto, quantity]
      );
      if (result.affectedRows === 0) {
        throw new Error(`No se pudo actualizar stock para producto ${id_producto} (stock insuficiente)`);
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Stocks actualizados exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar stocks:', error);
    res.status(500).json({ message: 'Error al actualizar stocks', error: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/products/productos - Crear nuevo producto
router.post('/productos', async (req, res) => {
  const { 
    nombre, descripcion, id_categoria, id_unidad, precio_compra, precio_venta, 
    stock_actual, stock_minimo, stock_maximo, estado, cambia_estado, cambia_apariencia, tiempo_cambio 
  } = req.body;
  
  // Validaciones básicas
  if (!nombre || !id_categoria || !id_unidad) {
    return res.status(400).json({ message: 'Nombre, categoría y unidad son obligatorios' });
  }
  if (isNaN(precio_compra) || isNaN(precio_venta) || precio_compra < 0 || precio_venta < 0) {
    return res.status(400).json({ message: 'Precios deben ser números positivos' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar existencia de categoría y unidad (activas)
    const [catCheck] = await connection.query(
      'SELECT id_categoria FROM categorias WHERE id_categoria = ? AND is_deleted = 0',
      [id_categoria]
    );
    const [unitCheck] = await connection.query(
      'SELECT id_unidad FROM unidades_medida WHERE id_unidad = ? AND is_deleted = 0',
      [id_unidad]
    );
    if (catCheck.length === 0) {
      return res.status(400).json({ message: 'Categoría inválida o eliminada' });
    }
    if (unitCheck.length === 0) {
      return res.status(400).json({ message: 'Unidad de medida inválida o eliminada' });
    }

    const [result] = await connection.query(`
      INSERT INTO productos (
        nombre, descripcion, id_categoria, id_unidad, 
        precio_compra, precio_venta, stock_actual, 
        stock_minimo, stock_maximo, estado,
        cambia_estado, cambia_apariencia, tiempo_cambio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre,
      descripcion || null,
      parseInt(id_categoria),
      parseInt(id_unidad),
      parseFloat(precio_compra),
      parseFloat(precio_venta),
      parseFloat(stock_actual || 0),
      parseFloat(stock_minimo || 0),
      parseFloat(stock_maximo || 0),
      estado ? 1 : 0,
      cambia_estado !== undefined ? parseInt(cambia_estado) : 0,
      cambia_apariencia !== undefined ? parseInt(cambia_apariencia) : 0,
      tiempo_cambio !== undefined && tiempo_cambio !== null ? parseInt(tiempo_cambio) : null
    ]);

    await connection.commit();
    
    // Registrar auditoría de creación de producto
    await registrarAuditoria({
      id_usuario: req.user?.id || null,
      accion: 'Creación de producto',
      tabla_nombre: 'productos',
      registro_id: result.insertId,
      detalles: {
        nombre,
        id_categoria,
        precio_compra: parseFloat(precio_compra),
        precio_venta: parseFloat(precio_venta),
        stock_actual: parseFloat(stock_actual || 0)
      },
      req
    });
    
    res.status(201).json({ 
      message: 'Producto creado exitosamente', 
      id_producto: result.insertId 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear producto:', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'FOREIGN KEY') {
      res.status(400).json({ message: 'Referencia inválida (categoría o unidad)' });
    } else if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'Ya existe un producto con ese nombre' });
    } else {
      res.status(500).json({ message: 'Error al crear producto' });
    }
  } finally {
    connection.release();
  }
});

export default router;