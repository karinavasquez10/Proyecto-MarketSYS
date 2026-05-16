// routes/perfiles.js (corregido: env var backend + handling para cloud vacío)
import express from 'express';
import multer from "multer";
import cloudinary from "../config/cloudinaryConfig.js";
import pool from "../config/database.js";
import fs from "fs";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();
const upload = multer({ dest: "temp/" });

function generarContrasenaTemporal() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "MS-";
  for (let i = 0; i < 8; i += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

function normalizarFechaNacimiento(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return datePart ? datePart[1] : null;
}

// Helper para construir URL con versión dinámica
async function buildFotoUrl(foto_perfil, cloudName) {
  if (!foto_perfil || !cloudName) {
    return null; // No foto
  }
  try {
    const result = await cloudinary.api.resource(foto_perfil, {
      resource_type: "image",
      type: "upload"
    });
    const version = result?.version || '1';
    return `https://res.cloudinary.com/${cloudName}/image/upload/v${version}/${foto_perfil}.jpg`;
  } catch (e) {
    console.warn(`Error obteniendo versión para ${foto_perfil}:`, e);
    // Fallback sin versión (Cloudinary sirve la latest)
    return `https://res.cloudinary.com/${cloudName}/image/upload/${foto_perfil}.jpg`;
  }
}

// ==========================================================================
// GET /api/perfil - Listar todos los usuarios activos (con join a detalle y versión dinámica)
// ==========================================================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id_usuario,
        u.nombre,
        u.correo,
        u.rol,
        u.estado,
        u.id_sucursal,
        s.nombre as sucursal_nombre,
        d.documento_identidad,
        d.telefono,
        d.foto_perfil,
        d.cargo
      FROM usuarios u
      LEFT JOIN usuarios_detalle d ON u.id_usuario = d.id_usuario
      LEFT JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      WHERE u.is_deleted = 0
      ORDER BY u.nombre ASC
    `);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    if (!cloudName) {
      console.error("❌ CLOUDINARY_CLOUD_NAME no configurado en .env backend");
      return res.status(500).json({ error: 'Configuración de Cloudinary faltante' });
    }

    // Para cada usuario con foto, obtener versión dinámica (paralelo para eficiencia)
    const normalizedRows = await Promise.all(rows.map(async (user) => {
      if (user.foto_perfil) {
        user.foto_url = await buildFotoUrl(user.foto_perfil, cloudName);
      }
      return user;
    }));

    res.json(normalizedRows);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================================================
// GET /api/perfil/:id - Obtener datos del perfil
// ==========================================================================
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        u.id_usuario as id,
        u.nombre,
        u.correo,
        u.rol,
        u.estado,
        d.documento_identidad,
        d.direccion,
        d.telefono,
        d.fecha_nacimiento,
        d.genero,
        d.cargo,
        d.foto_perfil
      FROM usuarios u
      LEFT JOIN usuarios_detalle d ON u.id_usuario = d.id_usuario
      WHERE u.id_usuario = ?`,
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const user = rows[0];
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    if (!cloudName) {
      console.error("❌ CLOUDINARY_CLOUD_NAME no configurado en .env backend");
      return res.status(500).json({ error: 'Configuración de Cloudinary faltante' });
    }

    // Construir foto_url dinámica
    if (user.foto_perfil) {
      user.foto_url = await buildFotoUrl(user.foto_perfil, cloudName);
    }

    res.json(user);
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ==========================================================================
// POST /api/perfil - Crear nuevo usuario y detalle
// ==========================================================================
router.post("/", upload.single("foto"), async (req, res) => {
  let fotoPublicId = null;
  let fotoUrl = null;
  const {
    nombre, correo, contrasena, rol, documento_identidad, direccion, telefono,
    fecha_nacimiento, genero, cargo, estado = 1, id_sucursal = 1
  } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }

  try {
    const rolString = rol !== undefined && rol !== null && String(rol).trim()
      ? (Array.isArray(rol) ? rol.join(',') : rol)
      : 'cajero';

    // Normalizar datos antes de insertar
    const correoNormalizado = correo.toLowerCase().trim();
    const contrasenaNormalizada = contrasena.trim();

    const [userResult] = await pool.query(
      `INSERT INTO usuarios (nombre, correo, contrasena, rol, estado, id_sucursal) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, correoNormalizado, contrasenaNormalizada, rolString, estado, id_sucursal]
    );
    const id_usuario = userResult.insertId;

    if (req.file) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
      if (!cloudName) {
        return res.status(500).json({ error: 'Configuración de Cloudinary faltante' });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Perfiles",
        public_id: `usuario_${id_usuario}`, // Sin /Perfiles aquí, ya que folder lo maneja
        overwrite: true,
        format: "jpg",
      });

      fotoPublicId = result.public_id; // "Perfiles/usuario_x" (auto por folder)
      fotoUrl = `https://res.cloudinary.com/${result.cloud_name}/image/upload/v${result.version}/${result.public_id}.jpg`;
      fs.unlinkSync(req.file.path);
    }

    await pool.query(
      `INSERT INTO usuarios_detalle (id_usuario, documento_identidad, direccion, telefono, fecha_nacimiento, genero, foto_perfil, cargo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, documento_identidad || null, direccion || null, telefono || null,
        fecha_nacimiento || null, genero || 'otro', fotoPublicId, cargo || null]
    );

    // Registrar auditoría de creación de usuario
    await registrarAuditoria({
      id_usuario: id_usuario,
      accion: 'Creación de usuario',
      tabla_nombre: 'usuarios',
      registro_id: id_usuario,
      detalles: {
        nombre,
        correo,
        rol: rolString,
        id_sucursal,
        cargo: cargo || null
      },
      req
    });

    res.status(201).json({
      id: id_usuario,
      message: 'Usuario creado exitosamente',
      foto: fotoPublicId,
      foto_url: fotoUrl
    });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
});

// ==========================================================================
// PUT /api/perfil/:id - Actualizar perfil y subir imagen
// ==========================================================================
router.put("/:id", upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const {
    nombre, correo, contrasena, rol, direccion, telefono, cargo,
    documento_identidad, genero, fecha_nacimiento, estado, id_sucursal
  } = req.body;

  let fotoPublicId = null;
  let fotoUrl = null;

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    if (!cloudName) {
      return res.status(500).json({ error: 'Configuración de Cloudinary faltante' });
    }

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Perfiles",
        public_id: `usuario_${id}`,
        overwrite: true,
        format: "jpg",
      });

      fotoPublicId = result.public_id;
      fotoUrl = `https://res.cloudinary.com/${result.cloud_name}/image/upload/v${result.version}/${result.public_id}.jpg`;
      fs.unlinkSync(req.file.path);
    }

    const rolString = Array.isArray(rol) ? rol.join(',') : rol || 'cajero';

    // Normalizar correo
    const correoNormalizado = correo ? correo.toLowerCase().trim() : null;

    // Construir query de actualización dinámicamente
    let updateQuery = `UPDATE usuarios SET nombre = ?, correo = ?, rol = ?, estado = ?`;
    let updateParams = [nombre, correoNormalizado, rolString, estado || 1];

    // Solo actualizar contraseña si se proporciona
    if (contrasena && contrasena.trim()) {
      const contrasenaNormalizada = contrasena.trim();
      updateQuery += `, contrasena = ?`;
      updateParams.push(contrasenaNormalizada);
    }

    // Agregar id_sucursal si se proporciona
    if (id_sucursal) {
      updateQuery += `, id_sucursal = ?`;
      updateParams.push(id_sucursal);
    }

    updateQuery += ` WHERE id_usuario = ? AND is_deleted = 0`;
    updateParams.push(id);

    await pool.query(updateQuery, updateParams);

    const fechaNacimientoNormalizada = normalizarFechaNacimiento(fecha_nacimiento);

    const campos = [
      direccion || null,
      telefono || null,
      cargo || null,
      documento_identidad || null,
      genero || 'otro',
      fechaNacimientoNormalizada,
      fotoPublicId || null,
      id,
    ];
    await pool.query(
      `UPDATE usuarios_detalle 
       SET direccion=?, telefono=?, cargo=?, documento_identidad=?, genero=?, fecha_nacimiento=?, 
           foto_perfil = COALESCE(?, foto_perfil)
       WHERE id_usuario=?`,
      campos
    );

    // Registrar auditoría de actualización de perfil (sin req para evitar ECONNRESET)
    await registrarAuditoria({
      id_usuario: id,
      accion: 'Actualización de perfil',
      tabla_nombre: 'usuarios',
      registro_id: id,
      detalles: {
        nombre,
        correo: correoNormalizado,
        rol: rolString,
        estado: estado || 1,
        foto_actualizada: !!req.file,
        contrasena_actualizada: !!(contrasena && contrasena.trim())
      },
      req: null
    });

    res.json({
      message: "Perfil actualizado correctamente",
      foto: fotoPublicId,
      foto_url: fotoUrl,
    });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    res.status(500).json({ message: "Error al actualizar perfil" });
  }
});

// ==========================================================================
// POST /api/perfil/:id/restablecer-contrasena - Contraseña temporal
// ==========================================================================
router.post("/:id/restablecer-contrasena", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, correo, rol
       FROM usuarios
       WHERE id_usuario = ? AND is_deleted = 0`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const usuario = rows[0];
    const contrasenaTemporal = generarContrasenaTemporal();

    await pool.query(
      `UPDATE usuarios
       SET contrasena = ?, debe_cambiar_contrasena = 1, password_reset_token = NULL, password_reset_expires = NULL
       WHERE id_usuario = ?`,
      [contrasenaTemporal, id]
    );

    await registrarAuditoria({
      id_usuario: req.user?.id || 1,
      accion: "Restablecimiento de contraseña de usuario",
      tabla_nombre: "usuarios",
      registro_id: id,
      detalles: {
        usuario_afectado: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        requiere_cambio: true
      },
      req
    });

    res.json({
      message: "Contraseña restablecida correctamente",
      contrasena_temporal: contrasenaTemporal,
      debe_cambiar_contrasena: true
    });
  } catch (err) {
    console.error("Error al restablecer contraseña:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ==========================================================================
// DELETE /api/perfil/:id - Soft delete + insertar en papelera
// ==========================================================================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const deletedBy = req.user?.id || 1;

  try {
    const [userRows] = await pool.query(
      `SELECT * FROM usuarios WHERE id_usuario = ? AND is_deleted = 0`,
      [id]
    );
    if (userRows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    const usuario = userRows[0];
    const [detailRows] = await pool.query(
      `SELECT * FROM usuarios_detalle WHERE id_usuario = ?`,
      [id]
    );
    const detalle = detailRows[0] || {};

    await pool.query(
      `INSERT INTO papelera (tabla, registro_id, contenido, id_usuario) VALUES (?, ?, ?, ?)`,
      ['usuarios', id, JSON.stringify({ ...usuario, detalle }), deletedBy]
    );

    const [result] = await pool.query(
      `UPDATE usuarios SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id_usuario = ?`,
      [deletedBy, id]
    );

    // Registrar auditoría de eliminación (soft delete)
    await registrarAuditoria({
      id_usuario: deletedBy,
      accion: 'Eliminación de usuario (soft delete)',
      tabla_nombre: 'usuarios',
      registro_id: id,
      detalles: {
        usuario_eliminado: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        movido_a_papelera: true
      },
      req
    });

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
