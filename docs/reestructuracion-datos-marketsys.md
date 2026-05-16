# Reestructuracion de datos MarketSYS

Fecha: 2026-04-30

Este documento organiza la ampliacion funcional del sistema usando la base actual como punto de partida. La idea principal es reutilizar lo que ya existe y crear tablas nuevas solo cuando el modulo necesita historial, trazabilidad o saldos propios.

## Estado actual

Tablas base detectadas:

- `productos`, `categorias`, `unidades_medida`
- `ventas`, `detalle_ventas`
- `caja`, `movimientos_caja`
- `compras`, `detalle_compras`
- `proveedores`, `clientes`
- `usuarios`, `usuarios_detalle`, `permisos_usuario`, `sucursales`
- `mermas`, `auditoria`, `papelera`

La base ya cubre productos, facturacion basica, compras, caja, usuarios y papelera. Lo que falta para crecer sin duplicar informacion es trazabilidad de inventario, estados documentales, configuracion central, movimientos financieros mas completos y credito/cartera.

## Modulos propuestos

### 1. Productos

Se mantiene sobre `productos`.

Cambios recomendados:

- Agregar `codigo_barras` para lectura en cajero y administrador.
- Agregar `codigo_interno` para codigos propios del negocio.
- Agregar indices para busqueda rapida por codigo de barras y codigo interno.
- Mantener `stock_actual`, pero dejar de depender solo de este campo para entender el historial.

No conviene crear otra tabla de productos.

### 2. Inventario

El modulo Bodegas debe evolucionar a Inventario.

Se debe crear `movimientos_inventario`, porque hoy las entradas y salidas quedan repartidas entre ventas, compras y mermas, pero no existe un historial unico.

Debe registrar:

- Producto
- Tipo de movimiento: compra, venta, ajuste, merma, devolucion, traslado
- Cantidad
- Stock anterior y stock nuevo
- Costo unitario cuando aplique
- Documento origen: venta, compra, merma, ajuste
- Usuario
- Caja o sucursal cuando aplique
- Observacion
- Fecha

Este modulo debe alimentar reportes de existencias, ajustes, kardex y trazabilidad.

### 3. Ingreso de compras

Se reutilizan `compras` y `detalle_compras`.

Cambios recomendados:

- Sacar visualmente compras del modulo Productos.
- Agregar a `compras` campos de estado, metodo de pago, numero de factura/proveedor y vencimiento si es credito.
- Cada compra aprobada debe crear movimientos de inventario.
- Si la compra es a credito, debe crear una cuenta por pagar en el modulo Creditos.

### 4. Facturacion

El modulo Ventas debe convertirse en Facturacion usando `ventas` y `detalle_ventas`.

Cambios recomendados:

- Agregar estado de factura: emitida, anulada, credito, pagada, pendiente.
- Agregar consecutivo/numero de factura.
- Agregar motivo, usuario y fecha de anulacion.
- Agregar soporte para reimpresion y descarga usando la informacion existente.
- Cuando una factura se anule, debe revertir inventario o crear un movimiento de ajuste/reversion.
- Si la venta es a credito, debe crear una cuenta por cobrar.

### 5. Caja y movimientos financieros

`caja` y `movimientos_caja` ya existen, pero `movimientos_caja` es muy simple para gastos, pagos a proveedores, compras y egresos generales.

Recomendacion:

- Mantener `movimientos_caja` para eventos directos de caja.
- Crear `movimientos_financieros` para ingresos/egresos administrativos con mas detalle.

`movimientos_financieros` debe poder guardar:

- Tipo: ingreso o egreso
- Categoria: venta, compra, gasto, abono_cliente, pago_proveedor, ajuste, otro
- Monto
- Metodo de pago
- Caja origen si aplica
- Usuario
- Cliente o proveedor si aplica
- Documento relacionado
- Soporte
- Observacion

### 6. Proveedores

Se mantiene `proveedores`, pero debe ampliarse.

Campos recomendados:

- `contacto_principal`
- `tipo_proveedor`
- `estado`
- `condiciones_pago`
- `plazo_credito_dias`
- `notas`

Esto permite filtrar proveedores activos, proveedores con credito y proveedores visibles.

### 7. Reportes

No se recomienda crear tablas de reportes al inicio.

Los reportes deben salir de:

- `ventas`, `detalle_ventas`
- `compras`, `detalle_compras`
- `caja`, `movimientos_caja`
- `movimientos_financieros`
- `movimientos_inventario`
- `creditos`, `abonos_credito`

Solo conviene guardar reportes si luego se necesitan cierres historicos bloqueados, snapshots contables o exportaciones auditables.

### 8. Configuracion

Conviene crear `configuracion_sistema`.

Debe guardar configuraciones por clave/valor, por ejemplo:

- Datos del negocio
- Impresion
- Consecutivos de factura
- Impuestos
- Codigo de barras
- Decimales y moneda
- Caja
- Parametros contables

Esto evita quemar configuraciones en codigo.

### 9. Creditos

Debe ser modulo independiente.

No conviene meterlo dentro de ingresos y egresos, porque credito necesita estados, saldos, vencimientos, abonos y documentos relacionados.

Tablas recomendadas:

- `creditos`
- `abonos_credito`

`creditos` debe manejar dos naturalezas:

- `por_cobrar`: clientes que deben al negocio.
- `por_pagar`: deudas del negocio con proveedores.

Al facturar, el cajero debe poder elegir venta a credito. Esa venta se guarda en `ventas`, pero tambien crea un credito por cobrar.

Al registrar una compra, el administrador debe poder elegir compra a credito. Esa compra se guarda en `compras`, pero tambien crea un credito por pagar.

## Cambios de base recomendados

### Modificar tablas existentes

- `productos`: codigo de barras y codigo interno.
- `ventas`: numero de factura, estado, anulacion, fecha vencimiento para credito.
- `compras`: numero de documento, estado, metodo de pago, vencimiento para credito.
- `proveedores`: informacion comercial adicional y estado.
- `movimientos_caja`: opcionalmente metodo de pago, usuario y referencia.

### Crear tablas nuevas

- `movimientos_inventario`
- `movimientos_financieros`
- `creditos`
- `abonos_credito`
- `configuracion_sistema`

## Orden recomendado de implementacion

1. Agregar `codigo_barras` a productos y crear busqueda por codigo.
2. Crear `movimientos_inventario` y empezar a registrar movimientos en ventas, compras y mermas. Estado: implementado en desarrollo local.
3. Separar visualmente Compras como modulo propio, reutilizando las tablas actuales. Estado: implementado como `Ingreso Compras`.
4. Convertir Ventas en Facturacion: historial, anulacion, reimpresion y descarga. Estado: implementado como modulo `Facturación` con estado de factura, numero de factura y anulacion con reversion de inventario.
5. Ampliar proveedores. Estado: implementado con contacto, tipo, estado, condiciones de pago, plazo de credito y notas.
6. Crear movimientos financieros para ingresos/egresos. Estado: implementado con tabla `movimientos_financieros`, API `/api/movimientos-financieros` y vista administrativa `Ingresos y Egresos`.
7. Crear creditos y abonos. Estado: implementado con tablas `creditos` y `abonos_credito`, API `/api/creditos`, módulo admin `Créditos`, ventas a crédito y compras a crédito vinculadas.
8. Crear reportes con consultas sobre datos reales. Estado: implementado con API `/api/reportes/resumen`, módulo admin `Reportes`, exportación a Excel y permiso `reportes`.
9. Expandir configuracion del sistema. Estado: implementado con tabla `configuracion_sistema`, API `/api/config` y vista admin con secciones de empresa, facturacion, impresion, codigos de barras, caja, impuestos y contabilidad.

## Reglas importantes

- No duplicar productos, ventas ni compras.
- Todo cambio de stock debe dejar movimiento en `movimientos_inventario`.
- Toda anulacion debe quedar auditada.
- Las ventas a credito no deben entrar como efectivo recibido en caja.
- Los abonos de credito si deben crear movimiento financiero y, si aplica, movimiento de caja.
- Las compras a credito no deben descontar caja hasta que se registre un pago.
