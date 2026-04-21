// cajas.js (actualizado para inicializar monto_final = monto_inicial al abrir caja)
import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// Función helper para validar sucursal
async function validarSucursal(id_sucursal) {
    const [sucursales] = await pool.query('SELECT id_sucursal FROM sucursales WHERE id_sucursal = ?', [id_sucursal]);
    if (sucursales.length === 0) {
        throw new Error(`Sucursal con ID ${id_sucursal} no existe. Verifica las sucursales en la DB.`);
    }
}

// POST /api/cajas - Abrir nueva caja
router.post('/', async (req, res) => {
    try {
        const { 
            id_usuario, 
            id_sucursal, 
            fecha_apertura, 
            monto_inicial, 
            monto_final,  // Nuevo: Aceptar monto_final (inicialmente igual a monto_inicial)
            estado 
        } = req.body;

        if (!id_usuario || !monto_inicial) {
            return res.status(400).send('Faltan datos requeridos: id_usuario, monto_inicial');
        }

        let idSucursalFinal = id_sucursal || 1;
        await validarSucursal(idSucursalFinal);

        const montoFinalInicial = monto_final !== undefined ? monto_final : monto_inicial;

        const [result] = await pool.query(
            `INSERT INTO caja 
            (id_usuario, id_sucursal, fecha_apertura, monto_inicial, monto_final, estado, total_ventas) 
            VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                id_usuario, 
                idSucursalFinal, 
                fecha_apertura || new Date().toISOString(), 
                monto_inicial, 
                montoFinalInicial,
                estado || 'abierta'
            ]
        );

        const [rows] = await pool.query('SELECT * FROM caja WHERE id_caja = ?', [result.insertId]);

        // Registrar auditoría de apertura de caja
        await registrarAuditoria({
            id_usuario,
            accion: 'Apertura de caja',
            tabla_nombre: 'caja',
            registro_id: result.insertId,
            detalles: {
                id_caja: result.insertId,
                id_sucursal: idSucursalFinal,
                monto_inicial,
                monto_final: montoFinalInicial,
                estado: estado || 'abierta',
                fecha_apertura: fecha_apertura || new Date().toISOString()
            },
            req
        });

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al abrir caja:', error);
        if (error.message.includes('Sucursal')) {
            return res.status(400).send(error.message);
        }
        res.status(500).send('Error al abrir caja: ' + error.message);
    }
});

// PUT /api/cajas/:id_caja - Actualizar caja (CORREGIDO COMPLETAMENTE)
router.put('/:id_caja', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id_caja } = req.params;
        const { total_venta, cambio = 0, metodo_pago = "efectivo" } = req.body;

        if (total_venta === undefined) {
            await connection.rollback();
            return res.status(400).send('Debe proporcionar "total_venta"');
        }

        const [cajas] = await connection.query('SELECT * FROM caja WHERE id_caja = ?', [id_caja]);
        
        if (cajas.length === 0) {
            await connection.rollback();
            return res.status(404).send('Caja no encontrada');
        }

        const caja = cajas[0];

        const montoInicialOriginal = caja.monto_inicial;
        
        if (!montoInicialOriginal || montoInicialOriginal <= 0) {
            await connection.rollback();
            return res.status(500).send('Error: monto_inicial de la caja está corrupto o es inválido');
        }

        const ingresoVenta = total_venta;
        const salidaCambio = (metodo_pago === "efectivo" && cambio > 0) ? cambio : 0;
        
        const montoFinalAnterior = caja.monto_final || montoInicialOriginal;
        const nuevoMontoFinal = montoFinalAnterior + ingresoVenta - salidaCambio;
        const nuevoTotalVentas = (caja.total_ventas || 0) + total_venta;

        if (nuevoMontoFinal < 0) {
            await connection.rollback();
            return res.status(400).send(
                `Operación rechazada: el monto final no puede ser negativo.\n` +
                `Monto actual: ${montoFinalAnterior}, Ingreso: ${ingresoVenta}, Cambio: ${salidaCambio}`
            );
        }

        await connection.query(
            `UPDATE caja 
            SET monto_final = ?,
                total_ventas = ?
            WHERE id_caja = ?`,
            [nuevoMontoFinal, nuevoTotalVentas, id_caja]
        );

        await connection.query(
            `INSERT INTO movimientos_caja 
            (id_caja, tipo, descripcion, monto) 
            VALUES (?, 'ingreso', ?, ?)`,
            [
                id_caja, 
                `Venta - Total: $${total_venta.toLocaleString()}${salidaCambio > 0 ? ` (Cambio: $${salidaCambio.toLocaleString()})` : ''}`, 
                ingresoVenta
            ]
        );

        await connection.commit();

        const [updated] = await connection.query('SELECT * FROM caja WHERE id_caja = ?', [id_caja]);
        
        if (updated[0].monto_inicial !== montoInicialOriginal) {
            // 
        }
        
        res.json(updated[0]);
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al actualizar caja:', error);
        res.status(500).send('Error al actualizar caja: ' + error.message);
    } finally {
        connection.release();
    }
});

// PUT /api/cajas/:id_caja/cerrar - Cerrar caja
router.put('/:id_caja/cerrar', async (req, res) => {
    try {
        const { id_caja } = req.params;
        const { 
            fecha_cierre, 
            monto_final,
            diferencia,
            observaciones 
        } = req.body;

        const [cajas] = await pool.query('SELECT * FROM caja WHERE id_caja = ?', [id_caja]);
        
        if (cajas.length === 0) {
            return res.status(404).send('Caja no encontrada');
        }

        const caja = cajas[0];

        const montoInicialOriginal = caja.monto_inicial;
        
        if (!montoInicialOriginal || montoInicialOriginal <= 0) {
            return res.status(500).send('Error: monto_inicial de la caja está corrupto');
        }

        const montoFinalCierre = monto_final !== undefined 
            ? monto_final 
            : caja.monto_final;

        const esperado = caja.monto_final;
        const diferenciaCalculada = diferencia !== undefined 
            ? diferencia 
            : montoFinalCierre - esperado;

        await pool.query(
            `UPDATE caja 
            SET fecha_cierre = ?, 
                monto_final = ?, 
                diferencia = ?, 
                estado = 'cerrada',
                observaciones = CONCAT(COALESCE(observaciones, ''), ?, ?)
            WHERE id_caja = ?`,
            [
                fecha_cierre || new Date().toISOString(),
                montoFinalCierre,
                diferenciaCalculada,
                observaciones ? '\n--- CIERRE ---\n' : '',
                observaciones || '',
                id_caja
            ]
        );

        const [updated] = await pool.query('SELECT * FROM caja WHERE id_caja = ?', [id_caja]);
        
        if (updated[0].monto_inicial !== montoInicialOriginal) {
            // 
        }

        // Registrar auditoría de cierre de caja
        await registrarAuditoria({
            id_usuario: caja.id_usuario,
            accion: 'Cierre de caja',
            tabla_nombre: 'caja',
            registro_id: id_caja,
            detalles: {
                id_caja,
                monto_inicial: montoInicialOriginal,
                monto_final: montoFinalCierre,
                diferencia: diferenciaCalculada,
                total_ventas: caja.total_ventas,
                fecha_cierre: fecha_cierre || new Date().toISOString(),
                observaciones
            },
            req
        });
        
        res.json(updated[0]);
    } catch (error) {
        console.error('❌ Error al cerrar caja:', error);
        res.status(500).send('Error al cerrar caja: ' + error.message);
    }
});

// GET /api/cajas - Obtener todas las cajas
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                c.*,
                u.nombre as nombre_usuario,
                u.correo as email_usuario,
                s.nombre as nombre_sucursal
            FROM caja c
            LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
            LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
            ORDER BY c.fecha_apertura DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener cajas:', error);
        if (error.sqlMessage) ;
        res.status(500).send('Error al obtener cajas: ' + error.message);
    }
});

// GET /api/cajas/:id_caja - Obtener detalle de una caja
router.get('/:id_caja', async (req, res) => {
    try {
        const { id_caja } = req.params;
        
        const [cajas] = await pool.query(`
            SELECT 
                c.*,
                u.nombre as nombre_usuario,
                u.correo as email_usuario,
                s.nombre as nombre_sucursal
            FROM caja c
            LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
            LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
            WHERE c.id_caja = ?
        `, [id_caja]);

        if (cajas.length === 0) {
            return res.status(404).send('Caja no encontrada');
        }

        const [ventas] = await pool.query(`
            SELECT 
                v.*,
                cl.nombre as nombre_cliente
            FROM ventas v
            LEFT JOIN clientes cl ON v.id_cliente = cl.id_cliente
            WHERE v.id_caja = ?
            ORDER BY v.fecha DESC
        `, [id_caja]);

        res.json({
            caja: cajas[0],
            ventas
        });
    } catch (error) {
        console.error('Error al obtener detalle de caja:', error);
        if (error.sqlMessage) ;
        res.status(500).send('Error al obtener detalle de caja: ' + error.message);
    }
});

// GET /api/cajas/abierta/:id_usuario - Obtener caja abierta de un usuario
router.get('/abierta/:id_usuario', async (req, res) => {
    try {
        const { id_usuario } = req.params;
        
        const [cajas] = await pool.query(`
            SELECT 
                c.*,
                s.nombre as nombre_sucursal
            FROM caja c
            LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
            WHERE id_usuario = ? AND estado = 'abierta'
            ORDER BY fecha_apertura DESC
            LIMIT 1
        `, [id_usuario]);

        if (cajas.length === 0) {
            return res.status(404).json({ message: 'No hay caja abierta para este usuario' });
        }

        res.json(cajas[0]);
    } catch (error) {
        console.error('Error al buscar caja abierta:', error);
        if (error.sqlMessage) ;
        res.status(500).send('Error al buscar caja abierta: ' + error.message);
    }
});

export default router;