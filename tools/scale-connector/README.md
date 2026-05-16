# MarketSYS Scale Connector

Conector local para que el POS pueda pedir el peso de una bascula conectada al computador de caja sin cambiar el codigo del frontend.

Estado actual:

- Expone endpoints HTTP locales para que el cajero consulte estado y peso.
- Soporta modo de prueba con `MARKETSYS_SCALE_MOCK_WEIGHT`.
- Deja preparado el perfil `moresco_hy_918` para la Moresco / Mavin HY-918 RS232.
- Lee peso desde RS232 cuando `MARKETSYS_SCALE_MODE=rs232` y la dependencia `serialport` esta instalada.

## Uso de prueba

En MarketSYS selecciona:

- URL del conector: `http://127.0.0.1:5123`
- Modo de báscula: `Simulación / peso de prueba`
- Unidad: `kg`

El conector devuelve `0.5 kg` por defecto en modo simulación:

```bash
npm install
npm start
```

Si quieres otro peso simulado:

```bash
MARKETSYS_SCALE_MOCK_WEIGHT=0.5 npm start
```

En Windows CMD:

```cmd
set MARKETSYS_SCALE_MOCK_WEIGHT=0.5
npm start
```

En PowerShell:

```powershell
$env:MARKETSYS_SCALE_MOCK_WEIGHT="0.5"
npm start
```

## Uso RS232

```bash
npm install
MARKETSYS_SCALE_MODE=rs232 MARKETSYS_SCALE_PORT=COM3 npm start
```

Parametros por defecto para la Moresco / Mavin HY-918:

- Puerto: `COM3`
- Baudios: `9600`
- Bits de datos: `8`
- Bits de parada: `1`
- Paridad: `none`
- Peso maximo: `30 kg`

Endpoints:

- `GET http://127.0.0.1:5123/health`
- `GET http://127.0.0.1:5123/scale/status`
- `GET http://127.0.0.1:5123/scale/read`

`/scale/read` acepta parametros por URL para que MarketSYS pueda enviar la configuracion guardada:

```text
profile=moresco_hy_918
mode=rs232
port=COM3
baudRate=9600
dataBits=8
stopBits=1
parity=none
unit=kg
timeoutMs=1800
maxWeight=30
```

## Variables

```bash
MARKETSYS_SCALE_CONNECTOR_PORT=5123
MARKETSYS_SCALE_CONNECTOR_HOST=127.0.0.1
MARKETSYS_SCALE_PROFILE=moresco_hy_918
MARKETSYS_SCALE_MODE=mock
MARKETSYS_SCALE_PORT=COM3
MARKETSYS_SCALE_BAUD_RATE=9600
MARKETSYS_SCALE_DATA_BITS=8
MARKETSYS_SCALE_STOP_BITS=1
MARKETSYS_SCALE_PARITY=none
MARKETSYS_SCALE_UNIT=kg
MARKETSYS_SCALE_TIMEOUT_MS=1800
MARKETSYS_SCALE_MAX_WEIGHT=30
MARKETSYS_SCALE_MOCK_WEIGHT=0.5
```
