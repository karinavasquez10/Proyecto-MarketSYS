// auth.js (versión corregida - mejor manejo de errores de conexión DB, logging detallado, validación adicional)
import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../config/database.js"; // conexión MySQL
import { registrarAuditoria } from "../utils/auditoria.js";

const router = Router();

function generarContrasenaTemporal() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "MS-";
  for (let i = 0; i < 8; i += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

async function ensurePasswordResetRequestsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NULL,
      correo VARCHAR(255) NOT NULL,
      nombre VARCHAR(255) NULL,
      mensaje TEXT NULL,
      estado ENUM('pendiente', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente',
      fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_resolucion DATETIME NULL,
      resuelto_por INT NULL,
      observacion_admin TEXT NULL,
      INDEX idx_password_reset_requests_estado (estado),
      INDEX idx_password_reset_requests_usuario (id_usuario),
      INDEX idx_password_reset_requests_correo (correo)
    )
  `);
}

async function registrarAuditoriaSegura(payload) {
  try {
    await registrarAuditoria(payload);
  } catch (error) {
    console.warn("No se pudo registrar auditoria de recuperacion:", error.message);
  }
}

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
      `SELECT u.id_usuario, u.correo, u.contrasena, u.rol, u.nombre, u.debe_cambiar_contrasena, d.cargo
       FROM usuarios u
       LEFT JOIN usuarios_detalle d ON d.id_usuario = u.id_usuario
       WHERE u.correo = ? AND u.is_deleted = 0 AND u.estado = 1
       LIMIT 1`,
      [email.toLowerCase().trim()] // Normalizar email para comparación
    );

    if (rows.length === 0) {
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

    // Comparación de contraseña con trim para evitar espacios
    if (password.trim() !== (user.contrasena || '').trim()) {
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
        debe_cambiar_contrasena: Boolean(Number(user.debe_cambiar_contrasena || 0)),
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

// Ruta publica: POST /api/auth/solicitar-recuperacion
router.post("/solicitar-recuperacion", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const mensaje = String(req.body?.mensaje || "").trim() || null;

  if (!email) {
    return res.status(400).json({ error: "El correo es obligatorio" });
  }

  try {
    await ensurePasswordResetRequestsTable();

    const [users] = await pool.query(
      `SELECT id_usuario, nombre, correo, rol
       FROM usuarios
       WHERE correo = ? AND is_deleted = 0 AND estado = 1
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: "No encontramos un usuario activo con ese correo. Verifica el dato o habla con el administrador.",
      });
    }

    const usuario = users[0];
    const [pending] = await pool.query(
      `SELECT id_solicitud
       FROM password_reset_requests
       WHERE id_usuario = ? AND estado = 'pendiente'
       ORDER BY fecha_solicitud DESC
       LIMIT 1`,
      [usuario.id_usuario]
    );

    if (pending.length > 0) {
      return res.status(409).json({
        error: "Ya existe una solicitud pendiente para este usuario. Espera a que el administrador la revise.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO password_reset_requests (id_usuario, correo, nombre, mensaje)
       VALUES (?, ?, ?, ?)`,
      [usuario.id_usuario, usuario.correo, usuario.nombre, mensaje]
    );

    await registrarAuditoriaSegura({
      id_usuario: usuario.id_usuario,
      accion: "Solicitud de recuperacion de contraseña",
      tabla_nombre: "password_reset_requests",
      registro_id: result.insertId,
      detalles: { correo: usuario.correo, rol: usuario.rol },
      req: null,
    });

    res.status(201).json({
      message: "Solicitud enviada correctamente. El administrador revisará tu caso y te entregará una contraseña temporal si la aprueba.",
    });
  } catch (error) {
    console.error("Error al solicitar recuperacion de contraseña:", error);
    res.status(500).json({ error: "No se pudo registrar la solicitud" });
  }
});

// Ruta admin: GET /api/auth/solicitudes-recuperacion
router.get("/solicitudes-recuperacion", async (req, res) => {
  const estado = String(req.query?.estado || "pendiente").trim().toLowerCase();
  const estadosPermitidos = ["pendiente", "aprobada", "rechazada", "todas"];

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ error: "Estado de solicitud no válido" });
  }

  try {
    await ensurePasswordResetRequestsTable();
    const params = [];
    let where = "";

    if (estado !== "todas") {
      where = "WHERE r.estado = ?";
      params.push(estado);
    }

    const [rows] = await pool.query(
      `SELECT
          r.id_solicitud,
          r.id_usuario,
          r.correo,
          r.nombre,
          r.mensaje,
          r.estado,
          r.fecha_solicitud,
          r.fecha_resolucion,
          r.resuelto_por,
          r.observacion_admin,
          u.rol,
          u.estado AS usuario_estado,
          admin.nombre AS resuelto_por_nombre
       FROM password_reset_requests r
       LEFT JOIN usuarios u ON u.id_usuario = r.id_usuario
       LEFT JOIN usuarios admin ON admin.id_usuario = r.resuelto_por
       ${where}
       ORDER BY r.fecha_solicitud DESC
       LIMIT 100`,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Error al listar solicitudes de recuperacion:", error);
    res.status(500).json({ error: "No se pudieron cargar las solicitudes" });
  }
});

// Ruta admin: POST /api/auth/solicitudes-recuperacion/:id/aprobar
router.post("/solicitudes-recuperacion/:id/aprobar", async (req, res) => {
  const { id } = req.params;
  const idAdmin = Number(req.body?.id_admin || req.user?.id || 1);
  const observacion = String(req.body?.observacion || "").trim() || null;
  const contrasenaTemporal = generarContrasenaTemporal();

  let connection;
  try {
    await ensurePasswordResetRequestsTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT r.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo, u.rol, u.estado AS usuario_estado, u.is_deleted
       FROM password_reset_requests r
       INNER JOIN usuarios u ON u.id_usuario = r.id_usuario
       WHERE r.id_solicitud = ?
       LIMIT 1`,
      [id]
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const solicitud = requests[0];
    if (solicitud.estado !== "pendiente") {
      await connection.rollback();
      return res.status(409).json({ error: "Esta solicitud ya fue gestionada" });
    }

    if (Number(solicitud.is_deleted) === 1 || Number(solicitud.usuario_estado) !== 1) {
      await connection.rollback();
      return res.status(400).json({ error: "El usuario está eliminado o inactivo" });
    }

    await connection.query(
      `UPDATE usuarios
       SET contrasena = ?, debe_cambiar_contrasena = 1, password_reset_token = NULL, password_reset_expires = NULL
       WHERE id_usuario = ?`,
      [contrasenaTemporal, solicitud.id_usuario]
    );

    await connection.query(
      `UPDATE password_reset_requests
       SET estado = 'aprobada', fecha_resolucion = NOW(), resuelto_por = ?, observacion_admin = ?
       WHERE id_solicitud = ?`,
      [idAdmin, observacion, id]
    );

    await connection.commit();

    await registrarAuditoriaSegura({
      id_usuario: idAdmin,
      accion: "Aprobacion de solicitud de recuperacion de contraseña",
      tabla_nombre: "password_reset_requests",
      registro_id: Number(id),
      detalles: {
        usuario_afectado: solicitud.usuario_nombre,
        correo: solicitud.usuario_correo,
        rol: solicitud.rol,
        requiere_cambio: true,
      },
      req,
    });

    res.json({
      message: "Solicitud aprobada. Contraseña temporal generada.",
      contrasena_temporal: contrasenaTemporal,
      usuario: {
        id_usuario: solicitud.id_usuario,
        nombre: solicitud.usuario_nombre,
        correo: solicitud.usuario_correo,
        rol: solicitud.rol,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error al aprobar solicitud de recuperacion:", error);
    res.status(500).json({ error: "No se pudo aprobar la solicitud" });
  } finally {
    if (connection) connection.release();
  }
});

// Ruta admin: POST /api/auth/solicitudes-recuperacion/:id/rechazar
router.post("/solicitudes-recuperacion/:id/rechazar", async (req, res) => {
  const { id } = req.params;
  const idAdmin = Number(req.body?.id_admin || req.user?.id || 1);
  const observacion = String(req.body?.observacion || "").trim() || null;

  try {
    await ensurePasswordResetRequestsTable();
    const [result] = await pool.query(
      `UPDATE password_reset_requests
       SET estado = 'rechazada', fecha_resolucion = NOW(), resuelto_por = ?, observacion_admin = ?
       WHERE id_solicitud = ? AND estado = 'pendiente'`,
      [idAdmin, observacion, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada o ya gestionada" });
    }

    await registrarAuditoriaSegura({
      id_usuario: idAdmin,
      accion: "Rechazo de solicitud de recuperacion de contraseña",
      tabla_nombre: "password_reset_requests",
      registro_id: Number(id),
      detalles: { observacion },
      req,
    });

    res.json({ message: "Solicitud rechazada correctamente" });
  } catch (error) {
    console.error("Error al rechazar solicitud de recuperacion:", error);
    res.status(500).json({ error: "No se pudo rechazar la solicitud" });
  }
});

// Ruta: POST /api/auth/cambiar-contrasena-obligatoria
router.post("/cambiar-contrasena-obligatoria", async (req, res) => {
  const { email, password_actual, nueva_contrasena } = req.body;

  if (!email || !password_actual || !nueva_contrasena) {
    return res.status(400).json({ error: "Correo, contraseña actual y nueva contraseña son obligatorios" });
  }

  if (String(nueva_contrasena).trim().length < 6) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, correo, contrasena, nombre, rol
       FROM usuarios
       WHERE correo = ? AND is_deleted = 0 AND estado = 1
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado o inactivo" });
    }

    const user = rows[0];
    if (String(password_actual).trim() !== String(user.contrasena || "").trim()) {
      return res.status(401).json({ error: "La contraseña actual no coincide" });
    }

    await pool.query(
      `UPDATE usuarios
       SET contrasena = ?, debe_cambiar_contrasena = 0, password_reset_token = NULL, password_reset_expires = NULL
       WHERE id_usuario = ?`,
      [String(nueva_contrasena).trim(), user.id_usuario]
    );

    await registrarAuditoria({
      id_usuario: user.id_usuario,
      accion: "Cambio obligatorio de contraseña",
      tabla_nombre: "usuarios",
      registro_id: user.id_usuario,
      detalles: { email: user.correo, rol: user.rol },
      req: null
    });

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error al cambiar contraseña obligatoria:", error);
    res.status(500).json({ error: "Error en servidor" });
  }
});

export default router;
