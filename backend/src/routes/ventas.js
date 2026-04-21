import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// POST /api/ventas - Crear nueva venta con sus detalles y movimiento
router.post('/', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { 
            fecha, // opcional
            id_cliente, 
            id_usuario, 
            id_caja, // Opcional: permitir null
            subtotal, 
            impuesto, 
            total, 
            metodo_pago, 
            observaciones,
            items 
        } = req.body;

        console.log(`Procesando venta: id_caja=${id_caja}, items=${items?.length || 0}`); // Debug log

        // Validaciones básicas: id_caja opcional
        if (!id_usuario || !items || items.length === 0 || total < 0) {
            await connection.rollback();
            return res.status(400).send('Faltan datos requeridos: id_usuario, items, o total inválido');
        }
        for (const item of items) {
            if (!item.id_producto || item.cantidad <= 0 || item.precio_unitario <= 0) {
                await connection.rollback();
                return res.status(400).send('Items inválidos: cantidad y precio deben ser >0');
            }
        }

        // Si id_caja proporcionado, validar existencia
        if (id_caja) {
            const [cajaCheck] = await connection.query('SELECT id_caja FROM caja WHERE id_caja = ?', [id_caja]);
            if (cajaCheck.length === 0) {
                await connection.rollback();
                return res.status(400).send(`Caja con ID ${id_caja} no existe.`);
            }
        }

        // Verificar coherencia de total
        const sumDescuentos = items.reduce((acc, item) => acc + (item.descuento || 0), 0);
        const totalCalculado = subtotal + impuesto - sumDescuentos;
        const fechaToUse = fecha || null;
        if (Math.abs(total - totalCalculado) > 0.01) {
            console.warn(`Total ajustado: recibido ${total}, calculado ${totalCalculado}`);
        }

        // 1. Insertar en tabla ventas (con fecha opcional, id_caja null ok)
        const [ventaResult] = await connection.query(
            `INSERT INTO ventas 
            (id_cliente, id_usuario, id_caja, fecha, subtotal, impuesto, total, metodo_pago, observaciones) 
            VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?)` ,
            [
                id_cliente || null,
                id_usuario,
                id_caja || null, // Permitir null
                fechaToUse,
                subtotal,
                impuesto,
                total,
                metodo_pago || 'efectivo',
                observaciones || ''
            ]
        );

        const id_venta = ventaResult.insertId;
        console.log(`Venta insertada: ID ${id_venta}`);

        // 2. Insertar detalles de venta (siempre)
        for (const item of items) {
            await connection.query(
                `INSERT INTO detalle_ventas 
                (id_venta, id_producto, cantidad, precio_unitario, descuento) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    id_venta,
                    item.id_producto,
                    item.cantidad,
                    item.precio_unitario,
                    item.descuento || 0
                ]
            );
            console.log(`Detalle insertado para producto ${item.id_producto}`);
        }

        // 3. Actualización de stock (siempre, sin verificación estricta de cantidad)
        for (const item of items) {
            // Solo verificar existencia del producto
            const [stockCheck] = await connection.query(
                `SELECT stock_actual FROM productos WHERE id_producto = ?`,
                [item.id_producto]
            );
            if (stockCheck.length === 0) {
                await connection.rollback();
                return res.status(400).send(`Producto ID ${item.id_producto} no encontrado.`);
            }

            // Log stock actual para debug
            const stockAnterior = stockCheck[0].stock_actual;
            if (stockAnterior < item.cantidad) {
                console.warn(`Stock insuficiente para producto ${item.id_producto}: anterior ${stockAnterior}, vendiendo ${item.cantidad} (stock puede ser negativo)`);
            }

            // Siempre actualizar stock
            await connection.query(
                `UPDATE productos 
                SET stock_actual = stock_actual - ? 
                WHERE id_producto = ?`,
                [item.cantidad, item.id_producto]
            );
            console.log(`Stock actualizado para producto ${item.id_producto}: -${item.cantidad} (nuevo: ${stockAnterior - item.cantidad})`);
        }

        // 4. Solo si hay id_caja: Actualizar total_ventas en la caja
        if (id_caja) {
            await connection.query(
                `UPDATE caja 
                SET total_ventas = COALESCE(total_ventas, 0) + ? 
                WHERE id_caja = ?`,
                [total, id_caja]
            );
            console.log(`Caja ${id_caja} actualizada: +${total} en total_ventas`);

            // 5. Solo si hay id_caja: Registrar movimiento
            await connection.query(
                `INSERT INTO movimientos_caja 
                (id_caja, tipo, descripcion, monto, fecha) 
                VALUES (?, 'ingreso', ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                [
                    id_caja,
                    `Venta ID: ${id_venta}`,
                    total,
                    fechaToUse
                ]
            );
            console.log(`Movimiento registrado en caja ${id_caja}`);
        } else {
            console.log(`Venta ${id_venta} registrada manualmente sin caja asociada.`);
        }

        await connection.commit();

        // Registrar auditoría de creación de venta
        await registrarAuditoria({
            id_usuario: id_usuario,
            accion: 'Creación de venta',
            tabla_nombre: 'ventas',
            registro_id: id_venta,
            detalles: {
                id_venta,
                total,
                subtotal,
                impuesto,
                metodo_pago: metodo_pago || 'efectivo',
                cantidad_items: items.length,
                id_cliente: id_cliente || null,
                id_caja: id_caja || null,
                es_venta_manual: !id_caja
            },
            req
        });

        res.status(201).json({
            success: true,
            id_venta,
            message: `Venta registrada exitosamente${!id_caja ? ' (manual, sin caja)' : ''}`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar venta:', error);
        res.status(500).send('Error al registrar venta: ' + error.message);
    } finally {
        connection.release();
    }
});

// GET /api/ventas - Obtener todas las ventas
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                v.*,
                c.nombre as nombre_cliente,
                u.nombre as nombre_usuario,
                cj.id_caja as numero_caja
            FROM ventas v
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
            LEFT JOIN caja cj ON v.id_caja = cj.id_caja
            ORDER BY v.fecha DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).send('Error al obtener ventas');
    }
});

// GET /api/ventas/:id_venta - Obtener detalle de una venta
router.get('/:id_venta', async (req, res) => {
    try {
        const { id_venta } = req.params;
        
        // Obtener datos de la venta
        const [ventas] = await pool.query(`
            SELECT 
                v.*,
                c.nombre as nombre_cliente,
                c.identificacion,
                u.nombre as nombre_usuario
            FROM ventas v
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
            WHERE v.id_venta = ?
        `, [id_venta]);

        if (ventas.length === 0) {
            return res.status(404).send('Venta no encontrada');
        }

        // Obtener detalles de la venta
        const [detalles] = await pool.query(`
            SELECT 
                dv.*,
                p.nombre as nombre_producto
            FROM detalle_ventas dv
            LEFT JOIN productos p ON dv.id_producto = p.id_producto
            WHERE dv.id_venta = ?
        `, [id_venta]);

        res.json({
            venta: ventas[0],
            detalles
        });
    } catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).send('Error al obtener detalle de venta');
    }
});

export default router;