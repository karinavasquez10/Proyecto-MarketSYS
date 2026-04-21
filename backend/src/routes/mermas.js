// routes/mermas.js
import express from "express";
const router = express.Router();
import db from '../config/database.js';
import { registrarAuditoria } from "../utils/auditoria.js";

/**
 * Función helper para generar nombre de producto transformado
 * Ejemplos:
 * - "Plátano verde" → "Plátano maduro"
 * - "Tomate verde" → "Tomate maduro"
 * - "Pan fresco" → "Pan envejecido"
 */
function generarNombreTransformado(nombreOriginal) {
  const nombre = nombreOriginal.toLowerCase();
  
  // Reglas de transformación comunes
  if (nombre.includes('verde')) {
    return nombreOriginal.replace(/verde/gi, 'maduro');
  }
  if (nombre.includes('fresco')) {
    return nombreOriginal.replace(/fresco/gi, 'envejecido');
  }
  if (nombre.includes('crudo')) {
    return nombreOriginal.replace(/crudo/gi, 'cocido');
  }
  if (nombre.includes('nuevo')) {
    return nombreOriginal.replace(/nuevo/gi, 'usado');
  }
  
  // Si no hay patrón conocido, agregar sufijo
  return `${nombreOriginal} (transformado)`;
}

/**
 * GET /api/mermas
 * Obtener todas las mermas con información de producto y usuario
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id_merma,
        m.id_producto,
        m.cantidad,
        m.motivo,
        m.fecha,
        m.id_usuario,
        p.nombre as nombre_producto,
        p.id_producto as codigo,
        p.precio_venta,
        u.nombre as nombre_usuario,
        u.correo as correo_usuario
      FROM mermas m
      LEFT JOIN productos p ON m.id_producto = p.id_producto
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      ORDER BY m.fecha DESC
    `;
    
    const [mermas] = await db.query(query);
    res.json(mermas);
  } catch (error) {
    console.error('Error al obtener mermas:', error);
    res.status(500).json({ error: 'Error al obtener mermas' });
  }
});

/**
 * GET /api/mermas/rango
 * Obtener mermas por rango de fechas
 */
router.get('/rango', async (req, res) => {
  try {
    const { fechaInicial, fechaFinal } = req.query;
    
    if (!fechaInicial || !fechaFinal) {
      return res.status(400).json({ error: 'Se requieren fechaInicial y fechaFinal' });
    }

    const query = `
      SELECT 
        m.id_merma,
        m.id_producto,
        m.cantidad,
        m.motivo,
        m.fecha,
        m.id_usuario,
        p.nombre as nombre_producto,
        p.id_producto as codigo,
        p.precio_venta,
        p.stock_actual,
        u.nombre as nombre_usuario,
        u.correo as correo_usuario
      FROM mermas m
      LEFT JOIN productos p ON m.id_producto = p.id_producto
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      WHERE DATE(m.fecha) BETWEEN ? AND ?
      ORDER BY m.fecha DESC
    `;
    
    const [mermas] = await db.query(query, [fechaInicial, fechaFinal]);
    res.json(mermas);
  } catch (error) {
    console.error('Error al obtener mermas por rango:', error);
    res.status(500).json({ error: 'Error al obtener mermas por rango' });
  }
});

/**
 * GET /api/mermas/notificaciones
 * Obtener notificaciones automáticas del sistema
 * - Cambios automáticos de productos (vencimiento/transformación)
 * - Productos con stock bajo (≤ stock_minimo)
 * IMPORTANTE: Esta ruta DEBE estar ANTES de /:id para evitar conflictos
 */
router.get('/notificaciones', async (req, res) => {
  try {
    const horasAtras = req.query.horas || 24;
    
    // Obtener mermas AUTOMÁTICAS recientes (solo las que tienen "automático" en el motivo)
    const [mermasAutomaticas] = await db.query(`
      SELECT 
        m.id_merma,
        m.cantidad,
        m.motivo,
        m.fecha,
        p.nombre as producto,
        p.stock_actual
      FROM mermas m
      LEFT JOIN productos p ON m.id_producto = p.id_producto
      WHERE m.fecha >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND m.motivo LIKE '%automático%'
      ORDER BY m.fecha DESC
      LIMIT 20
    `, [horasAtras]);
    
    // Obtener productos que están por cambiar automáticamente (próximos 2 días)
    const [productosPorCambiar] = await db.query(`
      SELECT 
        id_producto,
        nombre,
        stock_actual,
        cambia_estado,
        cambia_apariencia,
        tiempo_cambio,
        DATEDIFF(NOW(), fecha_creacion) as dias_transcurridos,
        (tiempo_cambio - DATEDIFF(NOW(), fecha_creacion)) as dias_restantes
      FROM productos
      WHERE (cambia_estado = 1 OR cambia_apariencia = 1)
        AND tiempo_cambio IS NOT NULL
        AND stock_actual > 0
        AND is_deleted = 0
        AND DATEDIFF(NOW(), fecha_creacion) < tiempo_cambio
        AND (tiempo_cambio - DATEDIFF(NOW(), fecha_creacion)) <= 2
      ORDER BY dias_restantes ASC
      LIMIT 10
    `);
    
    // Obtener productos con stock BAJO o CRÍTICO (≤ stock_minimo)
    const [productosStockBajo] = await db.query(`
      SELECT 
        id_producto,
        nombre,
        stock_actual,
        stock_minimo,
        stock_maximo
      FROM productos
      WHERE stock_actual <= stock_minimo
        AND stock_minimo > 0
        AND is_deleted = 0
        AND estado = 1
      ORDER BY (stock_actual / stock_minimo) ASC
      LIMIT 15
    `);
    
    res.json({
      mermas_automaticas: mermasAutomaticas.map(m => ({
        tipo: 'merma_automatica',
        producto: m.producto,
        cantidad: parseFloat(m.cantidad),
        stock_actual: parseFloat(m.stock_actual),
        motivo: m.motivo,
        fecha: m.fecha,
        mensaje: `${m.producto}: -${parseFloat(m.cantidad).toFixed(2)} unidades (automático)`
      })),
      productos_por_cambiar: productosPorCambiar.map(p => ({
        tipo: 'alerta_cambio',
        producto: p.nombre,
        dias_restantes: p.dias_restantes,
        cambia_estado: p.cambia_estado === 1,
        cambia_apariencia: p.cambia_apariencia === 1,
        mensaje: `${p.nombre} cambiará automáticamente en ${p.dias_restantes} día(s)`
      })),
      productos_stock_bajo: productosStockBajo.map(p => ({
        tipo: 'stock_bajo',
        producto: p.nombre,
        stock_actual: parseFloat(p.stock_actual),
        stock_minimo: parseFloat(p.stock_minimo),
        porcentaje: Math.round((parseFloat(p.stock_actual) / parseFloat(p.stock_minimo)) * 100),
        mensaje: `${p.nombre}: Stock bajo (${parseFloat(p.stock_actual).toFixed(1)}/${parseFloat(p.stock_minimo).toFixed(1)})`
      })),
      total_notificaciones: mermasAutomaticas.length + productosPorCambiar.length + productosStockBajo.length
    });
    
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al cargar notificaciones' });
  }
});

/**
 * GET /api/mermas/:id
 * Obtener una merma específica por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        m.id_merma,
        m.id_producto,
        m.cantidad,
        m.motivo,
        m.fecha,
        m.id_usuario,
        p.nombre as nombre_producto,
        p.id_producto as codigo,
        p.precio_venta,
        u.nombre as nombre_usuario
      FROM mermas m
      LEFT JOIN productos p ON m.id_producto = p.id_producto
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      WHERE m.id_merma = ?
    `;
    
    const [mermas] = await db.query(query, [id]);
    
    if (mermas.length === 0) {
      return res.status(404).json({ error: 'Merma no encontrada' });
    }
    
    res.json(mermas[0]);
  } catch (error) {
    console.error('Error al obtener merma:', error);
    res.status(500).json({ error: 'Error al obtener merma' });
  }
});

/**
 * POST /api/mermas
 * Registrar una nueva merma
 */
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id_producto, cantidad, motivo, id_usuario } = req.body;
    
    // Validaciones
    if (!id_producto || !cantidad) {
      await connection.rollback();
      return res.status(400).json({ error: 'Faltan datos requeridos (id_producto, cantidad)' });
    }
    
    // Verificar que el producto existe
    const [producto] = await connection.query(
      'SELECT id_producto, nombre, stock_actual FROM productos WHERE id_producto = ?',
      [id_producto]
    );
    
    if (producto.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const stockActual = parseFloat(producto[0].stock_actual);
    const cantidadMerma = parseFloat(cantidad);
    
    // Verificar que hay suficiente stock
    if (stockActual < cantidadMerma) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        stockActual,
        cantidadSolicitada: cantidadMerma
      });
    }
    
    // Insertar la merma
    const [result] = await connection.query(
      'INSERT INTO mermas (id_producto, cantidad, motivo, id_usuario) VALUES (?, ?, ?, ?)',
      [id_producto, cantidadMerma, motivo || 'Producto vencido/podrido', id_usuario || null]
    );
    
    // Actualizar el stock del producto
    const nuevoStock = stockActual - cantidadMerma;
    await connection.query(
      'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
      [nuevoStock, id_producto]
    );
    
    await connection.commit();
    connection.release();
    
    // Registrar auditoría (DESPUÉS de liberar la conexión)
    if (id_usuario) {
      try {
        await registrarAuditoria({
          id_usuario,
          accion: 'Registro manual de merma',
          tabla_nombre: 'mermas',
          registro_id: result.insertId,
          detalles: { 
            id_producto, 
            producto: producto[0].nombre,
            cantidad: cantidadMerma, 
            motivo: motivo || 'Producto vencido/podrido',
            stockAnterior: stockActual,
            stockNuevo: nuevoStock 
          },
          req
        });
      } catch (auditError) {
        console.error('Error en auditoría (no crítico):', auditError);
      }
    }
    
    res.status(201).json({
      message: 'Merma registrada exitosamente',
      id_merma: result.insertId,
      stockAnterior: stockActual,
      stockNuevo: nuevoStock,
      cantidadMerma: cantidadMerma
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error('Error al registrar merma:', error);
    res.status(500).json({ error: 'Error al registrar merma', detalle: error.message });
  }
});

/**
 * DELETE /api/mermas/:id
 * Eliminar una merma (restaurar stock)
 */
router.delete('/:id', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { id_usuario } = req.body;
    
    // Obtener información de la merma
    const [merma] = await connection.query(
      'SELECT m.id_merma, m.id_producto, m.cantidad, p.nombre as nombre_producto FROM mermas m LEFT JOIN productos p ON m.id_producto = p.id_producto WHERE m.id_merma = ?',
      [id]
    );
    
    if (merma.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Merma no encontrada' });
    }
    
    const { id_producto, cantidad, nombre_producto } = merma[0];
    
    // Restaurar el stock
    await connection.query(
      'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
      [cantidad, id_producto]
    );
    
    // Eliminar la merma
    await connection.query('DELETE FROM mermas WHERE id_merma = ?', [id]);
    
    await connection.commit();
    connection.release();
    
    // Registrar auditoría (DESPUÉS de liberar la conexión)
    if (id_usuario) {
      try {
        await registrarAuditoria({
          id_usuario,
          accion: 'Eliminación de merma y restauración de stock',
          tabla_nombre: 'mermas',
          registro_id: id,
          detalles: { 
            id_producto, 
            producto: nombre_producto,
            cantidadRestaurada: cantidad,
            operacion: 'RESTORE_STOCK'
          },
          req
        });
      } catch (auditError) {
        console.error('Error en auditoría (no crítico):', auditError);
      }
    }
    
    res.json({
      message: 'Merma eliminada y stock restaurado',
      cantidadRestaurada: cantidad
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error('Error al eliminar merma:', error);
    res.status(500).json({ error: 'Error al eliminar merma' });
  }
});

/**
 * POST /api/mermas/procesar-cambios
 * Procesar cambios de estado/apariencia de productos automáticamente
 * Este endpoint será llamado por un cron job o manualmente
 */
router.post('/procesar-cambios', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id_usuario } = req.body;
    let productosAfectados = [];
    let mermasGeneradas = [];
    let transformaciones = [];
    
    // Obtener productos con cambio de estado o apariencia (CON TODOS LOS CAMPOS necesarios)
    const [productos] = await connection.query(`
      SELECT 
        p.id_producto,
        p.nombre,
        p.stock_actual,
        p.cambia_estado,
        p.cambia_apariencia,
        p.tiempo_cambio,
        p.fecha_creacion,
        p.descripcion,
        p.id_categoria,
        p.id_unidad,
        p.precio_compra,
        p.precio_venta,
        p.stock_minimo,
        p.stock_maximo,
        DATEDIFF(NOW(), p.fecha_creacion) as dias_transcurridos
      FROM productos p
      WHERE (p.cambia_estado = 1 OR p.cambia_apariencia = 1)
        AND p.tiempo_cambio IS NOT NULL
        AND p.stock_actual > 0
        AND p.is_deleted = 0
        AND DATEDIFF(NOW(), p.fecha_creacion) >= p.tiempo_cambio
    `);
    
    for (const producto of productos) {
      const stockActual = parseFloat(producto.stock_actual);
      
      // Calcular cantidad aleatoria que cambia (entre 3 y 10, o menos si no hay suficiente stock)
      const cantidadMaxima = Math.min(10, Math.floor(stockActual));
      const cantidadMinima = Math.min(3, cantidadMaxima);
      const cantidadCambio = Math.floor(Math.random() * (cantidadMaxima - cantidadMinima + 1)) + cantidadMinima;
      
      if (cantidadCambio <= 0) continue;
      
      // CASO 1: Producto se vence/pudre (cambia_estado = 1)
      if (producto.cambia_estado === 1) {
        // Registrar merma
        const [resultMerma] = await connection.query(
          'INSERT INTO mermas (id_producto, cantidad, motivo, id_usuario) VALUES (?, ?, ?, ?)',
          [
            producto.id_producto,
            cantidadCambio,
            `Cambio de estado automático después de ${producto.dias_transcurridos} días`,
            id_usuario || null
          ]
        );
        
        // Reducir stock
        const nuevoStock = stockActual - cantidadCambio;
        await connection.query(
          'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
          [nuevoStock, producto.id_producto]
        );
        
        mermasGeneradas.push({
          id_merma: resultMerma.insertId,
          producto: producto.nombre,
          cantidad: cantidadCambio,
          tipo: 'vencimiento',
          stock_anterior: stockActual,
          stock_nuevo: nuevoStock
        });
      }
      
      // CASO 2: Producto cambia de apariencia (transformación automática)
      if (producto.cambia_apariencia === 1) {
        // Generar nombre del producto transformado automáticamente
        const nombreTransformado = generarNombreTransformado(producto.nombre);
        
        // Buscar si ya existe el producto transformado
        const [productoExistente] = await connection.query(
          'SELECT id_producto, stock_actual FROM productos WHERE nombre = ? AND is_deleted = 0',
          [nombreTransformado]
        );
        
        let id_producto_destino;
        let accion;
        
        if (productoExistente.length > 0) {
          // Producto destino EXISTE: actualizar stock
          const stockDestinoActual = parseFloat(productoExistente[0].stock_actual);
          const nuevoStockDestino = stockDestinoActual + cantidadCambio;
          
          await connection.query(
            'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
            [nuevoStockDestino, productoExistente[0].id_producto]
          );
          
          id_producto_destino = productoExistente[0].id_producto;
          accion = 'actualizado';
        } else {
          // Producto destino NO existe: crear nuevo automáticamente
          const [resultInsert] = await connection.query(`
            INSERT INTO productos (
              nombre, descripcion, id_categoria, id_unidad,
              precio_compra, precio_venta, stock_actual,
              stock_minimo, stock_maximo, estado,
              cambia_estado, cambia_apariencia, tiempo_cambio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            nombreTransformado,
            `Transformado automáticamente de ${producto.nombre}`,
            producto.id_categoria,
            producto.id_unidad,
            producto.precio_compra,
            producto.precio_venta,
            cantidadCambio,
            producto.stock_minimo || 0,
            producto.stock_maximo || 0,
            1, // activo
            0, // no cambia estado (producto final)
            0, // no cambia apariencia
            null // sin tiempo de cambio
          ]);
          
          id_producto_destino = resultInsert.insertId;
          accion = 'creado';
        }
        
        // Reducir stock del producto origen
        const nuevoStockOrigen = stockActual - cantidadCambio;
        await connection.query(
          'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
          [nuevoStockOrigen, producto.id_producto]
        );
        
        transformaciones.push({
          producto_origen: producto.nombre,
          producto_destino: nombreTransformado,
          cantidad: cantidadCambio,
          tipo: 'transformacion',
          accion: accion,
          stock_origen_anterior: stockActual,
          stock_origen_nuevo: nuevoStockOrigen,
          id_producto_destino: id_producto_destino
        });
      }
      
      productosAfectados.push({
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        cantidad_afectada: cantidadCambio,
        stock_anterior: stockActual,
        stock_nuevo: stockActual - cantidadCambio
      });
    }
    
    await connection.commit();
    connection.release();
    
    // Registrar auditoría del proceso (DESPUÉS de liberar la conexión)
    if (id_usuario) {
      try {
        await registrarAuditoria({
          id_usuario,
          accion: 'Proceso automático de cambios de estado/apariencia',
          tabla_nombre: 'mermas',
          registro_id: null,
          detalles: {
            productos_afectados: productosAfectados.length,
            mermas_generadas: mermasGeneradas.length,
            transformaciones: transformaciones.length,
            detalles_mermas: mermasGeneradas,
            detalles_transformaciones: transformaciones
          },
          req
        });
      } catch (auditError) {
        console.error('Error en auditoría (no crítico):', auditError);
      }
    }
    
    res.json({
      message: 'Proceso de cambios ejecutado exitosamente',
      productosAfectados,
      mermasGeneradas,
      transformaciones,
      estadisticas: {
        total_productos_procesados: productosAfectados.length,
        total_mermas: mermasGeneradas.length,
        total_transformaciones: transformaciones.length
      }
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error('Error al procesar cambios:', error);
    res.status(500).json({ error: 'Error al procesar cambios de estado' });
  }
});

/**
 * POST /api/mermas/transformar
 * Transformar un producto a otro (cambio de apariencia)
 * Ejemplo: Plátano verde → Plátano maduro
 */
router.post('/transformar', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      id_producto_origen,
      nombre_producto_destino,
      cantidad,
      id_usuario,
      crear_nuevo // boolean: true si no existe el producto destino
    } = req.body;
    
    // Validaciones
    if (!id_producto_origen || !nombre_producto_destino || !cantidad) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Faltan datos requeridos (id_producto_origen, nombre_producto_destino, cantidad)' 
      });
    }
    
    // Obtener producto origen
    const [productoOrigen] = await connection.query(
      'SELECT * FROM productos WHERE id_producto = ?',
      [id_producto_origen]
    );
    
    if (productoOrigen.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Producto origen no encontrado' });
    }
    
    const origen = productoOrigen[0];
    const stockOrigenActual = parseFloat(origen.stock_actual);
    const cantidadTransformar = parseFloat(cantidad);
    
    if (stockOrigenActual < cantidadTransformar) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Stock insuficiente en producto origen',
        stockActual: stockOrigenActual,
        cantidadSolicitada: cantidadTransformar
      });
    }
    
    // Buscar si existe el producto destino
    const [productoDestino] = await connection.query(
      'SELECT * FROM productos WHERE nombre = ?',
      [nombre_producto_destino]
    );
    
    let id_producto_destino;
    let operacion;
    
    if (productoDestino.length > 0) {
      // El producto destino ya existe: UPDATE stock
      id_producto_destino = productoDestino[0].id_producto;
      const stockDestinoActual = parseFloat(productoDestino[0].stock_actual);
      const nuevoStockDestino = stockDestinoActual + cantidadTransformar;
      
      await connection.query(
        'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
        [nuevoStockDestino, id_producto_destino]
      );
      
      operacion = 'UPDATE';
      
    } else if (crear_nuevo) {
      // Crear nuevo producto basado en el origen
      const [result] = await connection.query(
        `INSERT INTO productos (
          nombre, descripcion, precio_compra, precio_venta, stock_actual, stock_minimo,
          id_categoria, id_unidad, cambia_estado, cambia_apariencia
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          nombre_producto_destino,
          `Transformado de ${origen.nombre}`,
          origen.precio_compra,
          origen.precio_venta,
          cantidadTransformar,
          origen.stock_minimo,
          origen.id_categoria,
          origen.id_unidad
        ]
      );
      
      id_producto_destino = result.insertId;
      operacion = 'INSERT';
      
    } else {
      await connection.rollback();
      return res.status(404).json({ 
        error: 'Producto destino no existe. Use crear_nuevo=true para crearlo automáticamente' 
      });
    }
    
    // Reducir stock del producto origen
    const nuevoStockOrigen = stockOrigenActual - cantidadTransformar;
    await connection.query(
      'UPDATE productos SET stock_actual = ? WHERE id_producto = ?',
      [nuevoStockOrigen, id_producto_origen]
    );
    
    await connection.commit();
    connection.release();
    
    // Registrar auditoría (DESPUÉS de liberar la conexión)
    if (id_usuario) {
      try {
        await registrarAuditoria({
          id_usuario,
          accion: 'Transformación manual de producto',
          tabla_nombre: 'productos',
          registro_id: id_producto_destino,
          detalles: {
            producto_origen: origen.nombre,
            id_producto_origen,
            producto_destino: nombre_producto_destino,
            id_producto_destino,
            cantidad: cantidadTransformar,
            operacion,
            stockOrigenAnterior: stockOrigenActual,
            stockOrigenNuevo: nuevoStockOrigen
          },
          req
        });
      } catch (auditError) {
        console.error('Error en auditoría (no crítico):', auditError);
      }
    }
    
    res.json({
      message: 'Transformación realizada exitosamente',
      operacion,
      id_producto_origen,
      id_producto_destino,
      nombre_origen: origen.nombre,
      nombre_destino: nombre_producto_destino,
      cantidad_transformada: cantidadTransformar,
      stock_origen_anterior: stockOrigenActual,
      stock_origen_nuevo: nuevoStockOrigen
    });
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error('Error al transformar producto:', error);
    res.status(500).json({ error: 'Error al transformar producto', detalle: error.message });
  }
});

export default router;