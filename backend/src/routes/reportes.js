import express from "express";
import pool from "../config/database.js";

const router = express.Router();

const dateRange = (query) => {
  const desde = query.desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const hasta = query.hasta || new Date().toISOString().slice(0, 10);
  return { desde, hasta };
};

router.get("/resumen", async (req, res) => {
  try {
    const { desde, hasta } = dateRange(req.query);
    const params = [desde, hasta];

    const [
      [ventasRows],
      [comprasRows],
      [financierosRows],
      [inventarioRows],
      [creditosRows],
      [topProductos],
      [existencias],
      [movimientosInventario],
      [cajasRows],
      [impuestosRows],
      [ventasPorMetodo],
      [ventasPorCategoria],
      [ventasRecientes],
      [existenciasProductos],
      [resumenDiario],
      [cierresCajaDetalle],
      [deudasClientes],
      [pagosProveedores],
      [facturasImpuestos],
      [facturasDetalle],
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*) AS cantidad,
            COALESCE(SUM(total), 0) AS total,
            COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(impuesto), 0) AS impuesto
          FROM ventas
          WHERE DATE(fecha) BETWEEN ? AND ?
            AND estado <> 'anulada'
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COUNT(DISTINCT id_compra) AS cantidad,
            COALESCE(SUM(total), 0) AS total
          FROM compras
          WHERE DATE(fecha) BETWEEN ? AND ?
            AND is_deleted = 0
            AND estado <> 'anulada'
        `,
        params
      ),
      pool.query(
        `
          SELECT
            tipo,
            categoria,
            COUNT(*) AS cantidad,
            COALESCE(SUM(monto), 0) AS total
          FROM movimientos_financieros
          WHERE DATE(fecha) BETWEEN ? AND ?
          GROUP BY tipo, categoria
        `,
        params
      ),
      pool.query(
        `
          SELECT
            tipo,
            COUNT(*) AS cantidad,
            COALESCE(SUM(ABS(cantidad)), 0) AS unidades
          FROM movimientos_inventario
          WHERE DATE(fecha) BETWEEN ? AND ?
          GROUP BY tipo
        `,
        params
      ),
      pool.query(
        `
          SELECT
            tipo,
            estado,
            COUNT(*) AS cantidad,
            COALESCE(SUM(saldo_pendiente), 0) AS saldo
          FROM creditos
          GROUP BY tipo, estado
        `
      ),
      pool.query(
        `
          SELECT
            p.id_producto,
            p.nombre,
            p.codigo_barras,
            COALESCE(SUM(dv.cantidad), 0) AS cantidad_vendida,
            COALESCE(SUM(dv.total), 0) AS total_vendido,
            COALESCE(SUM(dv.cantidad * p.precio_compra), 0) AS costo_estimado,
            COALESCE(SUM(dv.total - (dv.cantidad * p.precio_compra)), 0) AS utilidad_estimada
          FROM detalle_ventas dv
          INNER JOIN ventas v ON dv.id_venta = v.id_venta
          INNER JOIN productos p ON dv.id_producto = p.id_producto
          WHERE DATE(v.fecha) BETWEEN ? AND ?
            AND v.estado <> 'anulada'
          GROUP BY p.id_producto, p.nombre, p.codigo_barras
          ORDER BY total_vendido DESC
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COUNT(*) AS productos,
            COALESCE(SUM(stock_actual), 0) AS unidades,
            COALESCE(SUM(stock_actual * precio_compra), 0) AS costo_inventario,
            COALESCE(SUM(stock_actual * precio_venta), 0) AS valor_venta_inventario,
            COALESCE(SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo_stock
          FROM productos
          WHERE is_deleted = 0 AND estado = 1
        `
      ),
      pool.query(
        `
          SELECT
            mi.*,
            p.nombre AS nombre_producto,
            u.nombre AS nombre_usuario
          FROM movimientos_inventario mi
          INNER JOIN productos p ON mi.id_producto = p.id_producto
          LEFT JOIN usuarios u ON mi.id_usuario = u.id_usuario
          WHERE DATE(mi.fecha) BETWEEN ? AND ?
          ORDER BY mi.fecha DESC, mi.id_movimiento_inventario DESC
          LIMIT 12
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COUNT(*) AS cierres,
            COALESCE(SUM(total_ventas), 0) AS total_ventas_caja,
            COALESCE(SUM(diferencia), 0) AS diferencia_total
          FROM caja
          WHERE estado = 'cerrada'
            AND fecha_cierre IS NOT NULL
            AND DATE(fecha_cierre) BETWEEN ? AND ?
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COALESCE(SUM(impuesto), 0) AS impuesto_ventas
          FROM ventas
          WHERE DATE(fecha) BETWEEN ? AND ?
            AND estado <> 'anulada'
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COALESCE(NULLIF(TRIM(metodo_pago), ''), 'Sin método') AS metodo_pago,
            COUNT(*) AS cantidad,
            COALESCE(SUM(total), 0) AS total
          FROM ventas
          WHERE DATE(fecha) BETWEEN ? AND ?
            AND estado <> 'anulada'
          GROUP BY COALESCE(NULLIF(TRIM(metodo_pago), ''), 'Sin método')
          ORDER BY total DESC
        `,
        params
      ),
      pool.query(
        `
          SELECT
            COALESCE(c.nombre, 'Sin categoría') AS categoria,
            COUNT(DISTINCT v.id_venta) AS facturas,
            COALESCE(SUM(dv.cantidad), 0) AS unidades,
            COALESCE(SUM(dv.total), 0) AS total
          FROM detalle_ventas dv
          INNER JOIN ventas v ON dv.id_venta = v.id_venta
          INNER JOIN productos p ON dv.id_producto = p.id_producto
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
          WHERE DATE(v.fecha) BETWEEN ? AND ?
            AND v.estado <> 'anulada'
          GROUP BY COALESCE(c.nombre, 'Sin categoría')
          ORDER BY total DESC
        `,
        params
      ),
      pool.query(
        `
          SELECT
            v.id_venta,
            v.numero_factura,
            v.fecha,
            v.total,
            v.metodo_pago,
            v.estado,
            COALESCE(c.nombre, 'Consumidor final') AS cliente,
            COALESCE(u.nombre, 'Sin responsable') AS responsable
          FROM ventas v
          LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
          LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
          WHERE DATE(v.fecha) BETWEEN ? AND ?
          ORDER BY v.fecha DESC, v.id_venta DESC
          LIMIT 12
        `,
        params
      ),
      pool.query(
        `
          SELECT
            p.id_producto,
            p.codigo_barras,
            p.codigo_interno,
            p.nombre,
            COALESCE(c.nombre, 'Sin categoría') AS categoria,
            COALESCE(u.abreviatura, '') AS unidad,
            p.stock_actual,
            p.stock_minimo,
            p.precio_compra,
            p.precio_venta,
            (p.stock_actual * p.precio_compra) AS costo_inventario,
            (p.stock_actual * p.precio_venta) AS valor_venta
          FROM productos p
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
          LEFT JOIN unidades_medida u ON p.id_unidad = u.id_unidad
          WHERE p.is_deleted = 0 AND p.estado = 1
          ORDER BY p.nombre ASC
        `
      ),
      pool.query(
        `
          SELECT
            DATE(fecha) AS fecha,
            COUNT(*) AS facturas,
            COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(impuesto), 0) AS impuesto,
            COALESCE(SUM(total), 0) AS total
          FROM ventas
          WHERE DATE(fecha) BETWEEN ? AND ?
            AND estado <> 'anulada'
          GROUP BY DATE(fecha)
          ORDER BY fecha DESC
        `,
        params
      ),
      pool.query(
        `
          SELECT
            c.id_caja,
            c.fecha_apertura,
            c.fecha_cierre,
            c.monto_inicial,
            c.total_ventas,
            c.monto_final,
            c.diferencia,
            c.estado,
            COALESCE(u.nombre, 'Sin responsable') AS responsable,
            COALESCE(s.nombre, 'Sin sede') AS sede
          FROM caja c
          LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
          LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
          WHERE DATE(COALESCE(c.fecha_cierre, c.fecha_apertura)) BETWEEN ? AND ?
          ORDER BY COALESCE(c.fecha_cierre, c.fecha_apertura) DESC
          LIMIT 80
        `,
        params
      ),
      pool.query(
        `
          SELECT
            cr.id_credito,
            cr.numero_documento,
            cr.estado,
            cr.monto_total,
            cr.saldo_pendiente,
            cr.fecha_emision,
            cr.fecha_vencimiento,
            COALESCE(cl.nombre, 'Cliente sin nombre') AS cliente,
            v.numero_factura
          FROM creditos cr
          LEFT JOIN clientes cl ON cr.id_cliente = cl.id_cliente
          LEFT JOIN ventas v ON cr.id_venta = v.id_venta
          WHERE cr.tipo = 'por_cobrar'
            AND cr.estado NOT IN ('pagado', 'anulado')
          ORDER BY cr.fecha_vencimiento IS NULL, cr.fecha_vencimiento ASC, cr.fecha_emision DESC
          LIMIT 100
        `
      ),
      pool.query(
        `
          SELECT
            mf.id_movimiento_financiero,
            mf.fecha,
            mf.monto,
            mf.metodo_pago,
            mf.observacion,
            COALESCE(pr.nombre, 'Proveedor sin nombre') AS proveedor,
            COALESCE(u.nombre, 'Sin usuario') AS usuario
          FROM movimientos_financieros mf
          LEFT JOIN proveedores pr ON mf.id_proveedor = pr.id_proveedor
          LEFT JOIN usuarios u ON mf.id_usuario = u.id_usuario
          WHERE mf.tipo = 'egreso'
            AND mf.categoria = 'pago_proveedor'
            AND DATE(mf.fecha) BETWEEN ? AND ?
          ORDER BY mf.fecha DESC
          LIMIT 100
        `,
        params
      ),
      pool.query(
        `
          SELECT
            v.id_venta,
            v.numero_factura,
            v.fecha,
            v.subtotal,
            v.impuesto,
            v.total,
            v.metodo_pago,
            COALESCE(c.nombre, 'Consumidor final') AS cliente,
            COALESCE(u.nombre, 'Sin responsable') AS responsable
          FROM ventas v
          LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
          LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
          WHERE DATE(v.fecha) BETWEEN ? AND ?
            AND v.estado <> 'anulada'
            AND COALESCE(v.impuesto, 0) > 0
          ORDER BY v.fecha DESC
          LIMIT 120
        `,
        params
      ),
      pool.query(
        `
          SELECT
            v.id_venta,
            v.numero_factura,
            v.fecha,
            v.subtotal,
            v.impuesto,
            v.total,
            v.metodo_pago,
            v.estado,
            COALESCE(c.nombre, 'Consumidor final') AS cliente,
            COALESCE(u.nombre, 'Sin responsable') AS responsable
          FROM ventas v
          LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
          LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
          WHERE DATE(v.fecha) BETWEEN ? AND ?
          ORDER BY v.fecha DESC, v.id_venta DESC
          LIMIT 160
        `,
        params
      ),
    ]);

    const ventas = ventasRows[0] || {};
    const compras = comprasRows[0] || {};
    const existenciasResumen = existencias[0] || {};
    const cajas = cajasRows[0] || {};
    const impuestos = impuestosRows[0] || {};

    const ingresosFinancieros = financierosRows
      .filter((row) => row.tipo === "ingreso")
      .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const egresosFinancieros = financierosRows
      .filter((row) => row.tipo === "egreso")
      .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const gastos = financierosRows
      .filter((row) => row.tipo === "egreso" && row.categoria === "gasto")
      .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const utilidadProductos = topProductos.reduce((sum, row) => sum + Number(row.utilidad_estimada || 0), 0);
    const totalTopVentas = topProductos.reduce((sum, row) => sum + Number(row.total_vendido || 0), 0);
    const utilidadEstimada = Number(ventas.total || 0) > 0
      ? (Number(ventas.total || 0) * (totalTopVentas > 0 ? utilidadProductos / totalTopVentas : 0)) - gastos
      : 0;

    res.json({
      filtros: { desde, hasta },
      resumen: {
        ventas_total: Number(ventas.total || 0),
        ventas_cantidad: Number(ventas.cantidad || 0),
        compras_total: Number(compras.total || 0),
        compras_cantidad: Number(compras.cantidad || 0),
        ingresos_financieros: ingresosFinancieros,
        egresos_financieros: egresosFinancieros,
        gastos,
        utilidad_estimada: utilidadEstimada,
        impuesto_ventas: Number(impuestos.impuesto_ventas || 0),
        cierres_caja: Number(cajas.cierres || 0),
        diferencia_caja: Number(cajas.diferencia_total || 0),
        productos_activos: Number(existenciasResumen.productos || 0),
        unidades_inventario: Number(existenciasResumen.unidades || 0),
        costo_inventario: Number(existenciasResumen.costo_inventario || 0),
        valor_venta_inventario: Number(existenciasResumen.valor_venta_inventario || 0),
        productos_bajo_stock: Number(existenciasResumen.bajo_stock || 0),
      },
      movimientos_financieros: financierosRows,
      movimientos_inventario: movimientosInventario,
      inventario_por_tipo: inventarioRows,
      creditos: creditosRows,
      top_productos: topProductos,
      ventas_por_metodo: ventasPorMetodo,
      ventas_por_categoria: ventasPorCategoria,
      ventas_recientes: ventasRecientes,
      existencias_productos: existenciasProductos,
      resumen_diario: resumenDiario,
      cierres_caja_detalle: cierresCajaDetalle,
      deudas_clientes: deudasClientes,
      pagos_proveedores: pagosProveedores,
      facturas_impuestos: facturasImpuestos,
      facturas_detalle: facturasDetalle,
    });
  } catch (error) {
    console.error("Error al generar reporte:", error);
    res.status(500).json({ message: "Error al generar reporte" });
  }
});

export default router;
