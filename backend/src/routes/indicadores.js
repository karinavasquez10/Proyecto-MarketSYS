// routes/indicadores.js (versión corregida - query fija para GROUP BY con subquery)
import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// GET /api/indicadores - Obtener datos para indicadores de clientes
router.get('/', async (req, res) => {
  try {
    // Total clientes activos
    const [totalClientesResult] = await db.query(
      'SELECT COUNT(*) as total FROM clientes WHERE is_deleted = 0'
    );
    const totalClientes = totalClientesResult[0].total;

    // Top 5 clientes por número de ventas (visitas)
    const [topClientesResult] = await db.query(`
      SELECT 
        c.id_cliente,
        c.nombre,
        COUNT(v.id_venta) as visitas
      FROM clientes c
      LEFT JOIN ventas v ON c.id_cliente = v.id_cliente
      WHERE c.is_deleted = 0
      GROUP BY c.id_cliente, c.nombre
      ORDER BY visitas DESC
      LIMIT 5
    `);
    const clientesFrecuentes = topClientesResult.map(row => ({
      nombre: row.nombre,
      visitas: parseInt(row.visitas) || 0,
    }));

    // Distribución de clientes por frecuencia de ventas (usando subquery para evitar error GROUP BY)
    const [distribucionResult] = await db.query(`
      SELECT 
        categoria,
        COUNT(*) as valor
      FROM (
        SELECT 
          c.id_cliente,
          CASE 
            WHEN COUNT(v.id_venta) > 5 THEN 'Frecuentes'
            WHEN COUNT(v.id_venta) BETWEEN 1 AND 5 THEN 'Ocasionales'
            ELSE 'Nuevos'
          END as categoria
        FROM clientes c
        LEFT JOIN ventas v ON c.id_cliente = v.id_cliente
        WHERE c.is_deleted = 0
        GROUP BY c.id_cliente
      ) as subquery
      GROUP BY categoria
    `);
    const categoriasClientes = distribucionResult.map(row => ({
      categoria: row.categoria || 'Nuevos', // Default si no hay ventas
      valor: parseInt(row.valor),
    }));

    // Asegurar que siempre haya al menos 'Nuevos' si no hay categorías
    if (categoriasClientes.length === 0) {
      categoriasClientes.push({ categoria: 'Nuevos', valor: totalClientes });
    }

    // Clientes frecuentes (e.g., top 20% o > media visitas)
    const mediaVisitas = topClientesResult.reduce((sum, row) => sum + (parseInt(row.visitas) || 0), 0) / Math.max(topClientesResult.length, 1);
    const clientesFrecuentesCount = topClientesResult.filter(row => (parseInt(row.visitas) || 0) > mediaVisitas).length;

    // Visitas promedio (ventas promedio por cliente)
    const [avgVentasResult] = await db.query(`
      SELECT AVG(visitas) as avg_visitas
      FROM (
        SELECT COUNT(v.id_venta) as visitas
        FROM clientes c
        LEFT JOIN ventas v ON c.id_cliente = v.id_cliente
        WHERE c.is_deleted = 0
        GROUP BY c.id_cliente
      ) as sub
    `);
    const visitasPromedio = Math.round(avgVentasResult[0].avg_visitas || 0);

    res.json({
      totalClientes,
      clientesFrecuentesCount,
      visitasPromedio,
      clientesFrecuentes,
      categoriasClientes,
    });
  } catch (err) {
    console.error('Error al obtener indicadores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;