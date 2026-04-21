// backend/src/utils/auditoria.js
import pool from '../config/database.js';

/**
 * Registrar una acción en la tabla de auditoría
 * @param {Object} params - Parámetros de auditoría
 * @param {number} params.id_usuario - ID del usuario que realizó la acción
 * @param {string} params.accion - Descripción de la acción
 * @param {string} params.tabla_nombre - Nombre de la tabla afectada
 * @param {number} params.registro_id - ID del registro afectado
 * @param {Object} params.detalles - Objeto con detalles adicionales (se convertirá a JSON)
 * @param {Object} params.req - Objeto request de Express (opcional, para obtener IP y user-agent)
 */
export async function registrarAuditoria({
  id_usuario,
  accion,
  tabla_nombre = null,
  registro_id = null,
  detalles = null,
  req = null
}) {
  try {
    // Obtener IP origen y dispositivo del request si está disponible
    let origen_ip = null;
    let dispositivo = null;

    if (req) {
      // Obtener IP real considerando proxies
      origen_ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
        || req.headers['x-real-ip'] 
        || req.connection.remoteAddress 
        || req.socket.remoteAddress
        || null;

      // Obtener user-agent (información del navegador/dispositivo)
      dispositivo = req.headers['user-agent'] || null;
      
      // Limitar longitud del dispositivo
      if (dispositivo && dispositivo.length > 150) {
        dispositivo = dispositivo.substring(0, 147) + '...';
      }
    }

    // Convertir detalles a JSON string si es un objeto
    const detallesJSON = detalles ? JSON.stringify(detalles) : null;

    const query = `
      INSERT INTO auditoria (
        id_usuario,
        accion,
        tabla_nombre,
        registro_id,
        detalles,
        origen_ip,
        dispositivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      id_usuario || null,
      accion,
      tabla_nombre,
      registro_id,
      detallesJSON,
      origen_ip,
      dispositivo
    ]);

    return {
      success: true,
      id_auditoria: result.insertId
    };
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
    // No lanzar error para evitar que falle la operación principal
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Registrar múltiples acciones de auditoría en batch
 * @param {Array} registros - Array de objetos con parámetros de auditoría
 */
export async function registrarAuditoriaBatch(registros) {
  try {
    const promises = registros.map(registro => registrarAuditoria(registro));
    const results = await Promise.all(promises);
    
    return {
      success: true,
      total: results.length,
      exitosos: results.filter(r => r.success).length,
      fallidos: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('Error al registrar auditoría en batch:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper para crear registro de INSERT
 */
export function auditarInsert(id_usuario, tabla, registro_id, datos, req = null) {
  return registrarAuditoria({
    id_usuario,
    accion: `INSERT en ${tabla}`,
    tabla_nombre: tabla,
    registro_id,
    detalles: { tipo: 'INSERT', datos },
    req
  });
}

/**
 * Helper para crear registro de UPDATE
 */
export function auditarUpdate(id_usuario, tabla, registro_id, datosAnteriores, datosNuevos, req = null) {
  return registrarAuditoria({
    id_usuario,
    accion: `UPDATE en ${tabla}`,
    tabla_nombre: tabla,
    registro_id,
    detalles: { 
      tipo: 'UPDATE', 
      anterior: datosAnteriores,
      nuevo: datosNuevos
    },
    req
  });
}

/**
 * Helper para crear registro de DELETE
 */
export function auditarDelete(id_usuario, tabla, registro_id, datos, req = null) {
  return registrarAuditoria({
    id_usuario,
    accion: `DELETE en ${tabla}`,
    tabla_nombre: tabla,
    registro_id,
    detalles: { tipo: 'DELETE', datos },
    req
  });
}

/**
 * Helper para crear registro de movimiento a papelera
 */
export function auditarPapelera(id_usuario, tabla, registro_id, accion, datos, req = null) {
  return registrarAuditoria({
    id_usuario,
    accion: `${accion} en papelera - ${tabla}`,
    tabla_nombre: 'papelera',
    registro_id,
    detalles: { 
      tipo: accion,
      tabla_origen: tabla,
      datos
    },
    req
  });
}

export default {
  registrarAuditoria,
  registrarAuditoriaBatch,
  auditarInsert,
  auditarUpdate,
  auditarDelete,
  auditarPapelera
};
