export async function registrarMovimientoInventario(connection, {
  id_producto,
  id_usuario = null,
  id_sucursal = null,
  tipo,
  cantidad,
  stock_anterior = null,
  stock_nuevo = null,
  costo_unitario = null,
  referencia_tabla = null,
  referencia_id = null,
  observacion = null,
  fecha = null,
}) {
  await connection.query(
    `INSERT INTO movimientos_inventario (
      id_producto, id_usuario, id_sucursal, tipo, cantidad,
      stock_anterior, stock_nuevo, costo_unitario,
      referencia_tabla, referencia_id, observacion, fecha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [
      id_producto,
      id_usuario,
      id_sucursal,
      tipo,
      parseFloat(cantidad),
      stock_anterior !== null && stock_anterior !== undefined ? parseFloat(stock_anterior) : null,
      stock_nuevo !== null && stock_nuevo !== undefined ? parseFloat(stock_nuevo) : null,
      costo_unitario !== null && costo_unitario !== undefined ? parseFloat(costo_unitario) : null,
      referencia_tabla,
      referencia_id,
      observacion,
      fecha,
    ]
  );
}
