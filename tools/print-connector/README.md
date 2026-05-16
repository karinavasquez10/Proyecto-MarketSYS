# MarketSYS Print Connector

Conector local para impresoras termicas POS. Esta pensado para impresoras USB 80mm compatibles con Epson ESC/POS, como la JALTECH POS indicada para el minimercado.

Estado actual:

- Expone endpoints HTTP locales para recibir tickets desde MarketSYS.
- Soporta modo simulacion sin dependencias, util para probar que el POS se comunica con el conector.
- Genera comandos Epson ESC/POS para tickets de 80mm.
- En Windows puede enviar RAW a una impresora instalada por nombre.
- Incluye corte automatico y pulso para cajon RJ11 cuando estan activados en configuracion.

## Uso de prueba

```bash
npm start
```

## Uso real con JALTECH POS USB 80mm

1. Instalar la impresora en Windows y confirmar el nombre exacto en:

```text
Configuracion de Windows > Bluetooth y dispositivos > Impresoras y escaneres
```

2. En MarketSYS, configurar:

```text
Impresion > Tipo de impresora: ESC/POS USB
Impresion > Modelo: JALTECH POS 80mm ESC/POS
Impresion > Impresora: nombre exacto de Windows
Impresion > Corte automatico: Activo
Impresion > Abrir cajon: segun necesidad
```

3. Ejecutar el conector:

```bash
npm start
```

4. Probar desde MarketSYS:

```text
Admin > Configuracion > Impresion > Probar conexion
Admin > Configuracion > Impresion > Enviar ticket prueba
```

Endpoints:

- `GET http://127.0.0.1:5124/health`
- `GET http://127.0.0.1:5124/print/status`
- `POST http://127.0.0.1:5124/print/ticket`

## Variables

```bash
MARKETSYS_PRINT_CONNECTOR_PORT=5124
MARKETSYS_PRINT_CONNECTOR_HOST=127.0.0.1
MARKETSYS_PRINT_MODE=mock
MARKETSYS_PRINT_PROFILE=jaltech_pos_80
MARKETSYS_PRINT_NAME="JALTECH POS"
MARKETSYS_PRINT_WIDTH_MM=80
```

Nota: en modo `escpos_usb`, el nombre usado para imprimir viene principalmente de la configuracion `impresion.impresora` enviada por MarketSYS. Si esta vacia, usa `MARKETSYS_PRINT_NAME`.
