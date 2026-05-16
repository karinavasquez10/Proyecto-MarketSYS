# Guia Rapida de Instalacion y Pruebas - MarketSYS

Esta guia es para probar MarketSYS en modo desarrollo en el equipo donde quedara instalado.

## 1. Configurar Variables

Backend:

1. Copia `backend/.env.example` como `backend/.env`.
2. Ajusta los datos de MySQL, Cloudinary, `PORT` y `CORS_ORIGIN`.

Frontend:

1. Copia `frontend/.env.example` como `frontend/.env`.
2. Ajusta `VITE_API_URL` con la URL del backend.

Ejemplo local en el mismo equipo:

```env
VITE_API_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173
```

## 2. Iniciar Sistema

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## 3. Probar Bascula

Sin bascula fisica:

```bash
cd tools/scale-connector
npm install
set MARKETSYS_SCALE_MOCK_WEIGHT=0.5
npm start
```

Con bascula real en Windows CMD:

```bash
cd tools/scale-connector
set MARKETSYS_SCALE_MODE=rs232
set MARKETSYS_SCALE_PORT=COM3
npm start
```

Cambia `COM3` por el puerto real.

## 4. Probar Impresora

```bash
cd tools/print-connector
npm install
set MARKETSYS_PRINT_MODE=windows
set MARKETSYS_PRINT_NAME=Nombre exacto de la impresora
npm start
```

El nombre exacto se revisa en Windows en:

Panel de control > Dispositivos e impresoras > nombre de la impresora.

## 5. Pruebas Minimas Antes de Entregar

- Iniciar sesion como administrador.
- Iniciar sesion como cajero.
- Abrir caja.
- Escanear o buscar producto.
- Facturar producto normal.
- Facturar producto por peso.
- Cobrar con efectivo y revisar cambio.
- Reimprimir factura.
- Imprimir ticket.
- Cerrar caja.
- Revisar historial de facturas.
- Revisar inventario actualizado.
