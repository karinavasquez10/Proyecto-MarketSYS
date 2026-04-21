import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import categoriasRoutes from "./routes/categorias.js";
import perfilRoutes from "./routes/perfiles.js";
import clientesRoutes from "./routes/clientes.js";
import configRoutes from "./routes/config.js";
import cajasRoutes from "./routes/cajas.js";
import sucursalesRoutes from "./routes/sucursales.js";
import ventasRoutes from "./routes/ventas.js";
import movimientosCajaRoutes from "./routes/movimientosCaja.js";
import proveedoresRoutes from "./routes/proveedores.js";
import papeleraRoutes from "./routes/papelera.js";
import indicadoresRoutes from "./routes/indicadores.js";
import comprasRoutes from "./routes/compras.js";
import unidadesmedidaRoutes from "./routes/unidadesMedida.js";
import permisosRoutes from "./routes/permisos.js";
import auditoriaRoutes from "./routes/auditoria.js";
import mermasRoutes from "./routes/mermas.js";
import { iniciarCronJobCambiosAutomaticos } from "./jobs/procesarCambiosAutomaticos.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors({ origin: "http://localhost:5173" }));

app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/perfil", perfilRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/config", configRoutes);
app.use("/api/cajas", cajasRoutes);
app.use("/api/sucursales", sucursalesRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/movimientosCaja", movimientosCajaRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/papelera", papeleraRoutes);
app.use("/api/indicadores", indicadoresRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/unidadesMedida", unidadesmedidaRoutes);
app.use("/api/permisos", permisosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/mermas", mermasRoutes);

// Añade un manejador de errores general
app.use((err, req, res, next) => {
  console.error('Error general:', err);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor backend en http://localhost:${PORT}`);
  
  // Iniciar cron job para procesamiento automático de cambios
  iniciarCronJobCambiosAutomaticos();
});
