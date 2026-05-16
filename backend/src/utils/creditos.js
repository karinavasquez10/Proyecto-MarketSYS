export async function crearCreditoVenta(connection, {
  id_venta,
  id_cliente,
  id_usuario,
  numero_factura,
  total,
  fecha_vencimiento = null,
  observacion = null,
}) {
  await connection.query(
    `
      INSERT INTO creditos
        (tipo, estado, id_cliente, id_venta, numero_documento, monto_total,
         saldo_pendiente, fecha_vencimiento, observacion, creado_por)
      VALUES ('por_cobrar', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id_cliente = VALUES(id_cliente),
        numero_documento = VALUES(numero_documento),
        monto_total = VALUES(monto_total),
        saldo_pendiente = GREATEST(VALUES(monto_total) - (
          SELECT COALESCE(SUM(ac.monto), 0)
          FROM abonos_credito ac
          WHERE ac.id_credito = creditos.id_credito
        ), 0),
        fecha_vencimiento = VALUES(fecha_vencimiento),
        observacion = VALUES(observacion),
        estado = CASE
          WHEN GREATEST(VALUES(monto_total) - (
            SELECT COALESCE(SUM(ac.monto), 0)
            FROM abonos_credito ac
            WHERE ac.id_credito = creditos.id_credito
          ), 0) = 0 THEN 'pagado'
          WHEN GREATEST(VALUES(monto_total) - (
            SELECT COALESCE(SUM(ac.monto), 0)
            FROM abonos_credito ac
            WHERE ac.id_credito = creditos.id_credito
          ), 0) < VALUES(monto_total) THEN 'parcial'
          ELSE 'pendiente'
        END
    `,
    [
      id_cliente,
      id_venta,
      numero_factura,
      total,
      total,
      fecha_vencimiento,
      observacion,
      id_usuario,
    ]
  );
}

export async function sincronizarCreditoCompra(connection, id_compra) {
  const [compras] = await connection.query(
    `
      SELECT
        c.id_compra,
        c.id_proveedor,
        c.id_usuario,
        c.numero_documento,
        c.total,
        c.estado,
        c.metodo_pago,
        c.fecha_vencimiento,
        c.observaciones,
        pr.plazo_credito_dias
      FROM compras c
      LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      WHERE c.id_compra = ?
    `,
    [id_compra]
  );

  if (compras.length === 0) return;
  const compra = compras[0];
  const esCredito = compra.metodo_pago === "credito" || compra.estado === "credito";

  if (!esCredito) {
    await connection.query(
      "UPDATE creditos SET estado = 'anulado', saldo_pendiente = 0 WHERE id_compra = ?",
      [id_compra]
    );
    return;
  }

  const total = Number(compra.total || 0);
  const fechaVencimiento = compra.fecha_vencimiento || null;
  if (total <= 0) return;

  await connection.query(
    `
      INSERT INTO creditos
        (tipo, estado, id_proveedor, id_compra, numero_documento, monto_total,
         saldo_pendiente, fecha_vencimiento, observacion, creado_por)
      VALUES ('por_pagar', 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id_proveedor = VALUES(id_proveedor),
        numero_documento = VALUES(numero_documento),
        monto_total = VALUES(monto_total),
        saldo_pendiente = GREATEST(VALUES(monto_total) - (
          SELECT COALESCE(SUM(ac.monto), 0)
          FROM abonos_credito ac
          WHERE ac.id_credito = creditos.id_credito
        ), 0),
        fecha_vencimiento = VALUES(fecha_vencimiento),
        observacion = VALUES(observacion),
        estado = CASE
          WHEN GREATEST(VALUES(monto_total) - (
            SELECT COALESCE(SUM(ac.monto), 0)
            FROM abonos_credito ac
            WHERE ac.id_credito = creditos.id_credito
          ), 0) = 0 THEN 'pagado'
          WHEN GREATEST(VALUES(monto_total) - (
            SELECT COALESCE(SUM(ac.monto), 0)
            FROM abonos_credito ac
            WHERE ac.id_credito = creditos.id_credito
          ), 0) < VALUES(monto_total) THEN 'parcial'
          ELSE 'pendiente'
        END
    `,
    [
      compra.id_proveedor,
      compra.id_compra,
      compra.numero_documento || `COMP-${String(compra.id_compra).padStart(6, "0")}`,
      total,
      total,
      fechaVencimiento,
      compra.observaciones,
      compra.id_usuario,
    ]
  );
}

export async function recalcularEstadoCredito(connection, id_credito) {
  const [rows] = await connection.query(
    `
      SELECT
        cr.id_credito,
        cr.monto_total,
        COALESCE(SUM(ac.monto), 0) AS total_abonado
      FROM creditos cr
      LEFT JOIN abonos_credito ac ON cr.id_credito = ac.id_credito
      WHERE cr.id_credito = ?
      GROUP BY cr.id_credito
    `,
    [id_credito]
  );

  if (rows.length === 0) return null;

  const montoTotal = Number(rows[0].monto_total || 0);
  const totalAbonado = Number(rows[0].total_abonado || 0);
  const saldo = Math.max(montoTotal - totalAbonado, 0);
  const estado = saldo === 0 ? "pagado" : totalAbonado > 0 ? "parcial" : "pendiente";

  await connection.query(
    "UPDATE creditos SET saldo_pendiente = ?, estado = ? WHERE id_credito = ?",
    [saldo, estado, id_credito]
  );

  return { saldo, estado, totalAbonado };
}
