import { apiJson } from "../api";

export const listarAuditoria = (params) => apiJson(`/auditoria?${params}`);

export const listarTablasAuditoria = () => apiJson("/auditoria/tablas");

export const listarAccionesAuditoria = () => apiJson("/auditoria/acciones");

export const listarUsuariosAuditoria = () => apiJson("/auditoria/usuarios");

export const obtenerResumenAuditoria = () => apiJson("/auditoria/estadisticas/resumen");
