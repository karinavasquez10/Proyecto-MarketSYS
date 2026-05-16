# Empaquetado Electron - MarketSYS

Esta guia es para generar el ejecutable de MarketSYS en Windows.

## 1. Preparar el equipo

Instala Node.js LTS en Windows y verifica:

```cmd
node -v
npm -v
```

Abre CMD o PowerShell dentro de la carpeta del proyecto, por ejemplo:

```cmd
cd /d C:\MarketSYS_Pruebas\Proyecto-MarketSYS
```

Evita empaquetar desde rutas tipo `\\wsl.localhost\...`; usa una ruta normal de Windows como `C:\...`.

## 2. Configurar backend

Revisa `backend\.env` y deja los datos reales:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=marketsys
DB_PASS=tu_clave
DB_NAME=pos
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Electron levanta el backend local automáticamente al abrir MarketSYS.

## 3. Instalar dependencias

Desde la raíz del proyecto:

```cmd
npm install
npm --prefix frontend install
npm --prefix backend install
npm --prefix tools\scale-connector install
npm --prefix tools\print-connector install
```

## 4. Probar en desarrollo con Electron

```cmd
npm run electron:dev
```

Esto abre Vite y luego Electron.

## 5. Generar instalador

```cmd
npm run electron:dist:win
```

Los archivos quedan en:

```txt
release\
```

Normalmente se generan:

- Instalador `.exe`
- Portable `.exe`

## 6. Perifericos

Los conectores de bascula e impresora quedan incluidos como recursos, pero para pruebas reales puedes seguir ejecutandolos manualmente:

```cmd
cd /d C:\MarketSYS_Pruebas\Proyecto-MarketSYS\tools\scale-connector
set MARKETSYS_SCALE_MODE=rs232
set MARKETSYS_SCALE_PORT=COM3
npm start
```

```cmd
cd /d C:\MarketSYS_Pruebas\Proyecto-MarketSYS\tools\print-connector
npm start
```

La configuracion final de URLs se maneja desde MarketSYS:

- Bascula: `http://127.0.0.1:5123`
- Impresora: `http://127.0.0.1:5124`

