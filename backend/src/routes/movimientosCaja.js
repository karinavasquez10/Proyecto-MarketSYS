import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// POST /api/movimientos-caja - Registrar movimiento en caja
router.post('/', async (req, res) => {
    try {
        const { 
            id_caja, 
            tipo, 
            descripcion, 
            monto 
        } = req.body;

        if (!id_caja || !tipo || monto <= 0) {
            return res.status(400).send('Faltan datos requeridos: id_caja, tipo, monto > 0');
        }

        // Validar que caja existe
        const [cajaCheck] = await pool.query('SELECT id_caja FROM caja WHERE id_caja = ?', [id_caja]);
        if (cajaCheck.length === 0) {
            return res.status(404).send('Caja no encontrada');
        }

        const [result] = await pool.query(
            `INSERT INTO movimientos_caja 
            (id_caja, tipo, descripcion, monto) 
            VALUES (?, ?, ?, ?)`,
            [
                id_caja,
                tipo,
                descripcion || '',
                monto
            ]
        );

        const [rows] = await pool.query('SELECT * FROM movimientos_caja WHERE id_movimiento = ?', [result.insertId]);
        console.log(`Movimiento registrado: ID ${result.insertId}, tipo ${tipo}, monto ${monto}`);

        // Registrar auditoría de movimiento de caja
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Registro de movimiento de caja',
            tabla_nombre: 'movimientos_caja',
            registro_id: result.insertId,
            detalles: {
                id_movimiento: result.insertId,
                id_caja,
                tipo,
                descripcion: descripcion || '',
                monto
            },
            req
        });

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        res.status(500).send('Error al registrar movimiento: ' + error.message);
    }
});

// GET /api/movimientos-caja - Obtener movimientos de una caja
router.get('/caja/:id_caja', async (req, res) => {
    try {
        const { id_caja } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                m.*,
                c.id_usuario as usuario_id
            FROM movimientos_caja m
            LEFT JOIN caja c ON m.id_caja = c.id_caja
            WHERE m.id_caja = ?
            ORDER BY m.fecha DESC
        `, [id_caja]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).send('Error al obtener movimientos');
    }
});

export default router;