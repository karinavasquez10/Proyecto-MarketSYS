import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { registrarMovimientoInventario } from "../utils/inventario.js";
import { crearCreditoVenta } from "../utils/creditos.js";

const router = express.Router();

const formatInvoiceNumber = (prefix, number) => `${prefix}-${String(number).padStart(6, '0')}`;

const DEFAULT_CLIENT = {
    nombre: 'Consumidor final',
    identificacion: '222222222222',
    tipo: 'persona'
};

const getOrCreateDefaultClient = async (connection) => {
    const [existing] = await connection.query(
        `SELECT id_cliente
         FROM clientes
         WHERE is_deleted = 0 AND identificacion = ?
         LIMIT 1`,
        [DEFAULT_CLIENT.identificacion]
    );

    if (existing.length > 0) {
        return existing[0].id_cliente;
    }

    const [result] = await connection.query(
        `INSERT INTO clientes (nombre, identificacion, tipo)
         VALUES (?, ?, ?)`,
        [DEFAULT_CLIENT.nombre, DEFAULT_CLIENT.identificacion, DEFAULT_CLIENT.tipo]
    );

    return result.insertId;
};

const getNextInvoiceNumber = async (connection) => {
    const [[prefixRow]] = await connection.query(
        'SELECT valor FROM configuracion_sistema WHERE clave = ? FOR UPDATE',
        ['facturacion.prefijo']
    );
    const [[counterRow]] = await connection.query(
        'SELECT valor FROM configuracion_sistema WHERE clave = ? FOR UPDATE',
        ['facturacion.consecutivo_actual']
    );

    const prefix = String(prefixRow?.valor || 'FV').trim() || 'FV';
    const current = Number(counterRow?.valor || 0);
    const next = current + 1;

    await connection.query(
        `
          INSERT INTO configuracion_sistema (clave, valor, tipo, grupo, descripcion)
          VALUES ('facturacion.consecutivo_actual', ?, 'numero', 'facturacion', 'Consecutivo actual de facturación')
          ON DUPLICATE KEY UPDATE valor = VALUES(valor), tipo = 'numero', grupo = 'facturacion'
        `,
        [String(next)]
    );

    return formatInvoiceNumber(prefix, next);
};

router.get('/proxima-factura', async (_req, res) => {
    try {
        const [[prefixRow]] = await pool.query(
            'SELECT valor FROM configuracion_sistema WHERE clave = ?',
            ['facturacion.prefijo']
        );
        const [[counterRow]] = await pool.query(
            'SELECT valor FROM configuracion_sistema WHERE clave = ?',
            ['facturacion.consecutivo_actual']
        );
        const prefix = String(prefixRow?.valor || 'FV').trim() || 'FV';
        const current = Number(counterRow?.valor || 0);
        const next = current + 1;
        res.json({
            prefijo: prefix,
            consecutivo_actual: current,
            proximo_consecutivo: next,
            numero_factura: formatInvoiceNumber(prefix, next)
        });
    } catch (error) {
        console.error('Error consultando próxima factura:', error);
        res.status(500).json({ message: 'Error consultando próxima factura' });
    }
});

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
            valor_recibido = 0,
            cambio = 0,
            cambio_devuelto = cambio,
            fecha_vencimiento,
            observaciones,
            items
        } = req.body;
        const esCredito = metodo_pago === 'credito';

        // Validaciones básicas: id_caja opcional
        if (!id_usuario || !items || items.length === 0 || total < 0) {
            await connection.rollback();
            return res.status(400).send('Faltan datos requeridos: id_usuario, items, o total inválido');
        }
        if (esCredito && !id_cliente) {
            await connection.rollback();
            return res.status(400).send('Las ventas a crédito requieren un cliente asociado');
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

        // Verificar coherencia de total. El precio de venta ya incluye impuesto:
        // impuesto se registra informativo, no se suma encima del total.
        const sumDescuentos = items.reduce((acc, item) => acc + (item.descuento || 0), 0);
        const totalCalculado = subtotal - sumDescuentos;
        const fechaToUse = fecha || null;
        if (Math.abs(total - totalCalculado) > 0.01) {
            console.warn(`Total ajustado: recibido ${total}, calculado ${totalCalculado}`);
        }
        const idClienteFinal = id_cliente || (!esCredito ? await getOrCreateDefaultClient(connection) : null);

        // 1. Insertar en tabla ventas (con fecha opcional, id_caja null ok)
        const [ventaResult] = await connection.query(
            `INSERT INTO ventas
            (id_cliente, id_usuario, id_caja, fecha, subtotal, impuesto, total, valor_recibido, cambio_devuelto, metodo_pago, estado, fecha_vencimiento, observaciones)
            VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
                idClienteFinal,
                id_usuario,
                esCredito ? null : (id_caja || null),
                fechaToUse,
                subtotal,
                impuesto,
                total,
                esCredito ? 0 : Math.max(0, Number(valor_recibido || 0)),
                esCredito ? 0 : Math.max(0, Number(cambio_devuelto ?? cambio ?? 0)),
                metodo_pago || 'efectivo',
                esCredito ? 'credito' : 'emitida',
                fecha_vencimiento || null,
                observaciones || ''
            ]
        );

        const id_venta = ventaResult.insertId;
        const numero_factura = await getNextInvoiceNumber(connection);
        await connection.query(
            'UPDATE ventas SET numero_factura = ? WHERE id_venta = ?',
            [numero_factura, id_venta]
        );

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
        }

        // 3. Actualización de stock (siempre, sin verificación estricta de cantidad)
        for (const item of items) {
            const [stockCheck] = await connection.query(
                `SELECT nombre, stock_actual, estado, is_deleted FROM productos WHERE id_producto = ? FOR UPDATE`,
                [item.id_producto]
            );
            if (stockCheck.length === 0) {
                await connection.rollback();
                return res.status(400).send(`Producto ID ${item.id_producto} no encontrado.`);
            }
            if (Number(stockCheck[0].estado) !== 1 || Number(stockCheck[0].is_deleted || 0) === 1) {
                await connection.rollback();
                return res.status(400).send(`El producto ${stockCheck[0].nombre || item.id_producto} está inactivo y no se puede facturar.`);
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
                WHERE id_producto = ? AND estado = 1 AND is_deleted = 0`,
                [item.cantidad, item.id_producto]
            );
            const stockNuevo = parseFloat(stockAnterior) - parseFloat(item.cantidad);
            await registrarMovimientoInventario(connection, {
                id_producto: item.id_producto,
                id_usuario,
                tipo: 'venta',
                cantidad: parseFloat(item.cantidad) * -1,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                referencia_tabla: 'ventas',
                referencia_id: id_venta,
                observacion: `Venta ID: ${id_venta}`,
                fecha: fechaToUse
            });
        }

        // 4. Solo si hay id_caja: Actualizar total_ventas en la caja
        if (!esCredito && id_caja) {
            const [cajaRows] = await connection.query(
                `SELECT id_caja, estado, monto_inicial, monto_final, total_ventas
                 FROM caja
                 WHERE id_caja = ?
                 FOR UPDATE`,
                [id_caja]
            );
            if (cajaRows.length === 0) {
                await connection.rollback();
                return res.status(400).send(`Caja con ID ${id_caja} no existe.`);
            }
            if (cajaRows[0].estado !== 'abierta') {
                await connection.rollback();
                return res.status(400).send(`La caja ${id_caja} no está abierta.`);
            }

            const caja = cajaRows[0];
            const montoActual = Number(caja.monto_final || caja.monto_inicial || 0);
            const salidaCambio = ['efectivo', 'mixto'].includes(String(metodo_pago || 'efectivo').toLowerCase())
                ? Math.max(0, Number(cambio_devuelto ?? cambio ?? 0))
                : 0;

            await connection.query(
                `UPDATE caja
                SET total_ventas = COALESCE(total_ventas, 0) + ?,
                    monto_final = ?
                WHERE id_caja = ?`,
                [total, montoActual + Number(total || 0) - salidaCambio, id_caja]
            );

            // 5. Solo si hay id_caja: Registrar movimiento
            await connection.query(
                `INSERT INTO movimientos_caja
                (id_caja, tipo, descripcion, monto, fecha)
                VALUES (?, 'ingreso', ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                [
                    id_caja,
                    `Venta ${numero_factura}${salidaCambio > 0 ? ` (cambio: $${salidaCambio.toLocaleString()})` : ''}`,
                    total,
                    fechaToUse
                ]
            );
        } else if (!esCredito) {
            await connection.query(
                `INSERT INTO movimientos_financieros
                (tipo, categoria, monto, metodo_pago, id_caja, id_usuario, id_cliente,
                 referencia_tabla, referencia_id, observacion, fecha)
                VALUES ('ingreso', 'venta_manual', ?, ?, NULL, ?, ?, 'ventas', ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
                [
                    total,
                    metodo_pago || 'efectivo',
                    id_usuario,
                    idClienteFinal,
                    id_venta,
                    `Venta manual sin caja ${numero_factura}`,
                    fechaToUse
                ]
            );
        }

        if (esCredito) {
            await crearCreditoVenta(connection, {
                id_venta,
                id_cliente,
                id_usuario,
                numero_factura,
                total,
                fecha_vencimiento: fecha_vencimiento || null,
                observacion: observaciones || `Factura a crédito ${numero_factura}`
            });
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
                valor_recibido: esCredito ? 0 : Math.max(0, Number(valor_recibido || 0)),
                cambio_devuelto: esCredito ? 0 : Math.max(0, Number(cambio_devuelto ?? cambio ?? 0)),
                cantidad_items: items.length,
                id_cliente: idClienteFinal,
                id_caja: esCredito ? null : (id_caja || null),
                es_venta_manual: !id_caja,
                es_credito: esCredito,
                fecha_vencimiento: fecha_vencimiento || null
            },
            req
        });

        res.status(201).json({
            success: true,
            id_venta,
            numero_factura,
            es_credito: esCredito,
            message: `Venta registrada exitosamente${esCredito ? ' (a crédito)' : !id_caja ? ' (manual, sin caja)' : ''}`
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
                ua.nombre as nombre_usuario_anulacion,
                cj.id_caja as numero_caja
            FROM ventas v
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
            LEFT JOIN usuarios ua ON v.anulada_por = ua.id_usuario
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
                u.nombre as nombre_usuario,
                ua.nombre as nombre_usuario_anulacion
            FROM ventas v
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
            LEFT JOIN usuarios ua ON v.anulada_por = ua.id_usuario
            WHERE v.id_venta = ?
        `, [id_venta]);

        if (ventas.length === 0) {
            return res.status(404).send('Venta no encontrada');
        }

        // Obtener detalles de la venta
        const [detalles] = await pool.query(`
            SELECT
                dv.*,
                p.nombre as nombre_producto,
                p.codigo_interno,
                p.codigo_barras
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

// PUT /api/ventas/:id_venta/anular - Anular factura y revertir inventario/caja
router.put('/:id_venta/anular', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id_venta } = req.params;
        const { id_usuario, motivo = 'Anulación de factura' } = req.body;

        if (!id_usuario) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe indicar el usuario que anula la factura' });
        }

        const [ventasRows] = await connection.query(
            'SELECT * FROM ventas WHERE id_venta = ? FOR UPDATE',
            [id_venta]
        );

        if (ventasRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Factura no encontrada' });
        }

        const venta = ventasRows[0];
        if (venta.estado === 'anulada') {
            await connection.rollback();
            return res.status(409).json({ message: 'La factura ya está anulada' });
        }

        const [detalles] = await connection.query(
            'SELECT * FROM detalle_ventas WHERE id_venta = ?',
            [id_venta]
        );

        for (const detalle of detalles) {
            const [stockRows] = await connection.query(
                'SELECT stock_actual FROM productos WHERE id_producto = ? FOR UPDATE',
                [detalle.id_producto]
            );
            const stockAnterior = stockRows.length ? parseFloat(stockRows[0].stock_actual) : null;
            const cantidad = parseFloat(detalle.cantidad);
            const stockNuevo = stockAnterior !== null ? stockAnterior + cantidad : null;

            await connection.query(
                'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                [cantidad, detalle.id_producto]
            );

            await registrarMovimientoInventario(connection, {
                id_producto: detalle.id_producto,
                id_usuario,
                tipo: 'anulacion',
                cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                referencia_tabla: 'ventas',
                referencia_id: id_venta,
                observacion: `Anulación factura ${venta.numero_factura || id_venta}`
            });
        }

        await connection.query(
            `UPDATE ventas
             SET estado = 'anulada',
                 motivo_anulacion = ?,
                 fecha_anulacion = NOW(),
                 anulada_por = ?
             WHERE id_venta = ?`,
            [motivo, id_usuario, id_venta]
        );

        if (venta.id_caja) {
            await connection.query(
                'UPDATE caja SET total_ventas = GREATEST(COALESCE(total_ventas, 0) - ?, 0) WHERE id_caja = ?',
                [venta.total, venta.id_caja]
            );
            await connection.query(
                `INSERT INTO movimientos_caja (id_caja, tipo, descripcion, monto)
                 VALUES (?, 'egreso', ?, ?)`,
                [
                    venta.id_caja,
                    `Anulación factura ${venta.numero_factura || id_venta}`,
                    venta.total
                ]
            );
        }

        await connection.query(
            "UPDATE creditos SET estado = 'anulado', saldo_pendiente = 0 WHERE id_venta = ?",
            [id_venta]
        );

        await connection.commit();

        await registrarAuditoria({
            id_usuario,
            accion: 'Anulación de factura',
            tabla_nombre: 'ventas',
            registro_id: id_venta,
            detalles: {
                id_venta,
                numero_factura: venta.numero_factura,
                total: venta.total,
                motivo,
                items_revertidos: detalles.length
            },
            req
        });

        res.json({
            success: true,
            message: 'Factura anulada correctamente',
            id_venta,
            numero_factura: venta.numero_factura
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al anular factura:', error);
        res.status(500).json({ message: 'Error al anular factura: ' + error.message });
    } finally {
        connection.release();
    }
});

export default router;
