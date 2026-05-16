# MarketSYS POS

Sistema POS e inventario para minimercado, con módulos de cajero, administrador, inventario, facturación, finanzas, reportes, créditos y configuración de periféricos.

## Stack

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Base de datos: MySQL
- Periféricos: conectores locales para báscula RS232 e impresora térmica ESC/POS

## Carpetas Principales

- `frontend/`: interfaz del cajero y administrador.
- `backend/`: API, conexión a MySQL y rutas del sistema.
- `tools/scale-connector/`: conector local para báscula.
- `tools/print-connector/`: conector local para impresora térmica.
- `backend/db/migrations/`: migraciones SQL del sistema.

## Arranque en Desarrollo

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

Conector de báscula, si se va a probar:

```bash
cd tools/scale-connector
npm install
npm start
```

Conector de impresora, si se va a probar:

```bash
cd tools/print-connector
npm install
npm start
```

## Configuración

Los archivos `.env` reales no se versionan. Usa los `.env.example` como guía y llena los datos reales en el equipo donde quedará instalado el programa.

Antes de entregar o empaquetar, valida:

- Backend conectado a MySQL.
- Frontend apuntando al backend correcto con `VITE_API_URL`.
- `CORS_ORIGIN` coincide con la URL desde donde se abre el frontend.
- Caja abre y cierra correctamente.
- Facturación guarda ventas y reimprime ticket.
- Báscula lee peso desde el conector.
- Impresora imprime ticket desde el conector.
