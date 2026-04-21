// auth.js (versión corregida - mejor manejo de errores de conexión DB, logging detallado, validación adicional)
import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../config/database.js"; // conexión MySQL
import { registrarAuditoria } from "../utils/auditoria.js";

const router = Router();

// Ruta: POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validación básica de input
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son obligatorios" });
  }

  let connection;
  try {
    // Intentar obtener conexión explícita para mejor manejo de errores
    connection = await pool.getConnection();
    
    // Buscar usuario y su detalle (para obtener cargo), con filtros para activo y no eliminado
    const [rows] = await connection.query(
      `SELECT u.id_usuario, u.correo, u.contrasena, u.rol, u.nombre, d.cargo
       FROM usuarios u
       LEFT JOIN usuarios_detalle d ON d.id_usuario = u.id_usuario
       WHERE u.correo = ? AND u.is_deleted = 0 AND u.estado = 1
       LIMIT 1`,
      [email.toLowerCase().trim()] // Normalizar email para comparación
    );

    if (rows.length === 0) {
      console.log(`Login fallido: Usuario no encontrado para email ${email}`);
      
      // Registrar intento fallido de login (sin req para evitar ECONNRESET)
      await registrarAuditoria({
        id_usuario: null,
        accion: 'LOGIN fallido - Usuario no encontrado',
        tabla_nombre: 'usuarios',
        registro_id: null,
        detalles: { email_intentado: email },
        req: null
      });
      
      return res.status(401).json({ error: "Usuario no encontrado o inactivo" });
    }

    const user = rows[0];

    // Debug: Mostrar valores para diagnóstico
    console.log(`[DEBUG] Contraseña recibida (length: ${password.length}):`, JSON.stringify(password));
    console.log(`[DEBUG] Contraseña en BD (length: ${user.contrasena?.length || 0}):`, JSON.stringify(user.contrasena));
    console.log(`[DEBUG] ¿Son iguales?`, password === user.contrasena);

    // Comparación de contraseña con trim para evitar espacios
    if (password.trim() !== (user.contrasena || '').trim()) {
      console.log(`Login fallido: Contraseña incorrecta para email ${email}`);
      
      // Registrar intento fallido por contraseña incorrecta
      await registrarAuditoria({
        id_usuario: user.id_usuario,
        accion: 'LOGIN fallido - Contraseña incorrecta',
        tabla_nombre: 'usuarios',
        registro_id: user.id_usuario,
        detalles: { email: user.correo },
        req: null
      });
      
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Crear token JWT
    const secret = process.env.JWT_SECRET || "dev_secret_fallback"; // Asegura secret por defecto
    const token = jwt.sign(
      { 
        id: user.id_usuario, 
        email: user.correo,
        rol: user.rol // Incluir rol en payload para verificación futura
      },
      secret,
      { expiresIn: "1h" }
    );

    console.log(`Login exitoso para usuario ${user.nombre} (${user.rol})`);

    // Registrar auditoría de login exitoso (sin req para evitar ECONNRESET)
    await registrarAuditoria({
      id_usuario: user.id_usuario,
      accion: 'LOGIN exitoso',
      tabla_nombre: 'usuarios',
      registro_id: user.id_usuario,
      detalles: {
        email: user.correo,
        rol: user.rol,
        nombre: user.nombre
      },
      req: null
    });

    res.json({
      token,
      user: {
        id: user.id_usuario,
        email: user.correo,
        rol: user.rol, // Retorna rol en lowercase como en DB
        nombre: user.nombre || null,
        cargo: user.cargo || null,
      },
    });
  } catch (error) {
    // Manejo específico de errores de conexión DB
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error("Error de conexión DB (ECONNRESET): Verifica config/database.js y conexión MySQL");
      return res.status(500).json({ error: "Error de conexión al servidor. Intenta más tarde." });
    }
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en servidor" });
  } finally {
    if (connection) {
      connection.release(); // Liberar conexión siempre
    }
  }
});

export default router;