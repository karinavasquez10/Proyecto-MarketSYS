import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// ==========================================================================
// GET /api/sucursales - Obtener todas las sucursales (activas e inactivas)
// ==========================================================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id_sucursal, 
                nombre, 
                direccion,
                telefono,
                ciudad, 
                estado,
                fecha_creacion
            FROM sucursales 
            ORDER BY id_sucursal ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({ error: 'Error al obtener sucursales' });
    }
});

// ==========================================================================
// GET /api/sucursales/activas - Obtener solo sucursales activas
// ==========================================================================
router.get('/activas', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id_sucursal, nombre, ciudad 
            FROM sucursales 
            WHERE estado = 'activa' 
            ORDER BY id_sucursal ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener sucursales activas:', error);
        res.status(500).json({ error: 'Error al obtener sucursales activas' });
    }
});

// ==========================================================================
// GET /api/sucursales/:id - Obtener una sucursal específica
// ==========================================================================
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id_sucursal, 
                nombre, 
                direccion,
                telefono,
                ciudad, 
                estado,
                fecha_creacion
            FROM sucursales 
            WHERE id_sucursal = ?
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener sucursal:', error);
        res.status(500).json({ error: 'Error al obtener sucursal' });
    }
});

// ==========================================================================
// POST /api/sucursales - Crear nueva sucursal
// ==========================================================================
router.post('/', async (req, res) => {
    const { nombre, direccion, telefono, ciudad, estado = 'activa' } = req.body;

    if (!nombre || !ciudad) {
        return res.status(400).json({ error: 'Nombre y ciudad son obligatorios' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO sucursales (nombre, direccion, telefono, ciudad, estado) 
             VALUES (?, ?, ?, ?, ?)`,
            [nombre, direccion || null, telefono || null, ciudad, estado]
        );

        // Registrar auditoría de creación de sucursal
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Creación de sucursal',
            tabla_nombre: 'sucursales',
            registro_id: result.insertId,
            detalles: {
                nombre,
                direccion: direccion || null,
                telefono: telefono || null,
                ciudad,
                estado
            },
            req
        });

        res.status(201).json({
            id_sucursal: result.insertId,
            message: 'Sucursal creada exitosamente'
        });
    } catch (error) {
        console.error('Error al crear sucursal:', error);
        res.status(500).json({ error: 'Error al crear sucursal' });
    }
});

// ==========================================================================
// PUT /api/sucursales/:id - Actualizar sucursal
// ==========================================================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, direccion, telefono, ciudad, estado } = req.body;

    if (!nombre || !ciudad) {
        return res.status(400).json({ error: 'Nombre y ciudad son obligatorios' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE sucursales 
             SET nombre = ?, direccion = ?, telefono = ?, ciudad = ?, estado = ?
             WHERE id_sucursal = ?`,
            [nombre, direccion || null, telefono || null, ciudad, estado || 'activa', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        // Registrar auditoría de actualización de sucursal
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Actualización de sucursal',
            tabla_nombre: 'sucursales',
            registro_id: id,
            detalles: {
                nombre,
                direccion: direccion || null,
                telefono: telefono || null,
                ciudad,
                estado: estado || 'activa'
            },
            req
        });

        res.json({ message: 'Sucursal actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar sucursal:', error);
        res.status(500).json({ error: 'Error al actualizar sucursal' });
    }
});

// ==========================================================================
// DELETE /api/sucursales/:id - Eliminar sucursal (solo si no tiene usuarios)
// ==========================================================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si hay usuarios asociados a esta sucursal
        const [usuarios] = await pool.query(
            `SELECT COUNT(*) as count FROM usuarios WHERE id_sucursal = ? AND is_deleted = 0`,
            [id]
        );

        if (usuarios[0].count > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar la sucursal porque tiene usuarios asociados',
                usuariosCount: usuarios[0].count
            });
        }

        const [result] = await pool.query(
            `DELETE FROM sucursales WHERE id_sucursal = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }

        // Registrar auditoría de eliminación de sucursal
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Eliminación de sucursal (hard delete)',
            tabla_nombre: 'sucursales',
            registro_id: id,
            detalles: {
                id_sucursal: id,
                verificacion_usuarios: usuarios[0].count === 0
            },
            req
        });

        res.json({ message: 'Sucursal eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar sucursal:', error);
        res.status(500).json({ error: 'Error al eliminar sucursal' });
    }
});

// ==========================================================================
// GET /api/sucursales/:id/usuarios - Obtener usuarios de una sucursal
// ==========================================================================
router.get('/:id/usuarios', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.estado
            FROM usuarios u
            WHERE u.id_sucursal = ? AND u.is_deleted = 0
            ORDER BY u.nombre ASC
        `, [req.params.id]);

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener usuarios de sucursal:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

export default router;