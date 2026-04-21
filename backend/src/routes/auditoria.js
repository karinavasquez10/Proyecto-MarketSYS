// backend/src/routes/auditoria.js
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/auditoria
 * Obtener registros de auditoría con paginación y filtros
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      usuario = '',
      accion = '',
      tabla = '',
      fecha_inicio = '',
      fecha_fin = '',
      sort_by = 'fecha',
      sort_order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir consulta dinámica con filtros
    let whereConditions = [];
    let queryParams = [];

    if (usuario) {
      whereConditions.push('u.nombre LIKE ?');
      queryParams.push(`%${usuario}%`);
    }

    if (accion) {
      whereConditions.push('a.accion LIKE ?');
      queryParams.push(`%${accion}%`);
    }

    if (tabla) {
      whereConditions.push('a.tabla_nombre = ?');
      queryParams.push(tabla);
    }

    if (fecha_inicio) {
      whereConditions.push('DATE(a.fecha) >= ?');
      queryParams.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditions.push('DATE(a.fecha) <= ?');
      queryParams.push(fecha_fin);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Validar columna de ordenamiento
    const validSortColumns = ['fecha', 'accion', 'tabla_nombre', 'nombre_usuario'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'fecha';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Consulta para obtener registros
    const query = `
      SELECT 
        a.id_auditoria,
        a.id_usuario,
        u.nombre as nombre_usuario,
        u.correo as correo_usuario,
        u.rol as rol_usuario,
        a.accion,
        a.tabla_nombre,
        a.registro_id,
        a.detalles,
        a.origen_ip,
        a.dispositivo,
        a.fecha
      FROM auditoria a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      ${whereClause}
      ORDER BY ${sortColumn === 'nombre_usuario' ? 'u.nombre' : 'a.' + sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);

    const [registros] = await pool.query(query, queryParams);

    // Consulta para contar total de registros (sin paginación)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM auditoria a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      ${whereClause}
    `;

    const [countResult] = await pool.query(
      countQuery, 
      queryParams.slice(0, -2) // Remover limit y offset
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      registros,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        records_per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    res.status(500).json({ error: 'Error al obtener registros de auditoría' });
  }
});

/**
 * GET /api/auditoria/tablas
 * Obtener lista de tablas únicas registradas en auditoría
 */
router.get('/tablas', async (req, res) => {
  try {
    const [tablas] = await pool.query(`
      SELECT DISTINCT tabla_nombre 
      FROM auditoria 
      WHERE tabla_nombre IS NOT NULL
      ORDER BY tabla_nombre
    `);
    res.json(tablas.map(t => t.tabla_nombre));
  } catch (error) {
    console.error('Error al obtener tablas:', error);
    res.status(500).json({ error: 'Error al obtener tablas' });
  }
});

/**
 * GET /api/auditoria/acciones
 * Obtener lista de acciones únicas registradas
 */
router.get('/acciones', async (req, res) => {
  try {
    const [acciones] = await pool.query(`
      SELECT DISTINCT accion 
      FROM auditoria 
      ORDER BY accion
    `);
    res.json(acciones.map(a => a.accion));
  } catch (error) {
    console.error('Error al obtener acciones:', error);
    res.status(500).json({ error: 'Error al obtener acciones' });
  }
});

/**
 * GET /api/auditoria/usuarios
 * Obtener lista de usuarios que han realizado acciones
 */
router.get('/usuarios', async (req, res) => {
  try {
    const [usuarios] = await pool.query(`
      SELECT DISTINCT u.id_usuario, u.nombre, u.correo, u.rol
      FROM auditoria a
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      ORDER BY u.nombre
    `);
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

/**
 * GET /api/auditoria/:id
 * Obtener detalle de un registro específico de auditoría
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [registros] = await pool.query(`
      SELECT 
        a.*,
        u.nombre as nombre_usuario,
        u.correo as correo_usuario,
        u.rol as rol_usuario
      FROM auditoria a
      LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
      WHERE a.id_auditoria = ?
    `, [id]);

    if (registros.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json(registros[0]);
  } catch (error) {
    console.error('Error al obtener registro:', error);
    res.status(500).json({ error: 'Error al obtener registro de auditoría' });
  }
});

/**
 * POST /api/auditoria
 * Crear un nuevo registro de auditoría (uso interno del sistema)
 */
router.post('/', async (req, res) => {
  try {
    const {
      id_usuario,
      accion,
      tabla_nombre,
      registro_id,
      detalles,
      origen_ip,
      dispositivo
    } = req.body;

    if (!accion) {
      return res.status(400).json({ error: 'La acción es obligatoria' });
    }

    const [result] = await pool.query(`
      INSERT INTO auditoria (
        id_usuario, 
        accion, 
        tabla_nombre, 
        registro_id, 
        detalles, 
        origen_ip, 
        dispositivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id_usuario || null,
      accion,
      tabla_nombre || null,
      registro_id || null,
      detalles ? JSON.stringify(detalles) : null,
      origen_ip || null,
      dispositivo || null
    ]);

    res.status(201).json({
      message: 'Registro de auditoría creado',
      id_auditoria: result.insertId
    });
  } catch (error) {
    console.error('Error al crear registro de auditoría:', error);
    res.status(500).json({ error: 'Error al crear registro de auditoría' });
  }
});

/**
 * GET /api/auditoria/estadisticas/resumen
 * Obtener estadísticas generales de auditoría
 */
router.get('/estadisticas/resumen', async (req, res) => {
  try {
    // Total de registros
    const [[totalRegistros]] = await pool.query('SELECT COUNT(*) as total FROM auditoria');
    
    // Acciones más frecuentes
    const [accionesFrecuentes] = await pool.query(`
      SELECT accion, COUNT(*) as cantidad
      FROM auditoria
      GROUP BY accion
      ORDER BY cantidad DESC
      LIMIT 5
    `);

    // Usuarios más activos
    const [usuariosActivos] = await pool.query(`
      SELECT u.nombre, u.rol, COUNT(*) as acciones
      FROM auditoria a
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      GROUP BY u.id_usuario
      ORDER BY acciones DESC
      LIMIT 5
    `);

    // Actividad por día (últimos 7 días)
    const [actividadDiaria] = await pool.query(`
      SELECT DATE(fecha) as dia, COUNT(*) as cantidad
      FROM auditoria
      WHERE fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(fecha)
      ORDER BY dia DESC
    `);

    res.json({
      total_registros: totalRegistros.total,
      acciones_frecuentes: accionesFrecuentes,
      usuarios_activos: usuariosActivos,
      actividad_diaria: actividadDiaria
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
