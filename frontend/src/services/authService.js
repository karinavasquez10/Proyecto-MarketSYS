import { apiJson } from "../api";

export const login = (credentials) =>
  apiJson("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

export const cambiarContrasenaObligatoria = (data) =>
  apiJson("/auth/cambiar-contrasena-obligatoria", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const solicitarRecuperacionContrasena = (data) =>
  apiJson("/auth/solicitar-recuperacion", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const listarSolicitudesRecuperacion = ({ estado = "pendiente" } = {}) => {
  const params = new URLSearchParams({ estado });
  return apiJson(`/auth/solicitudes-recuperacion?${params.toString()}`);
};

export const aprobarSolicitudRecuperacion = (id, data = {}) =>
  apiJson(`/auth/solicitudes-recuperacion/${id}/aprobar`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const rechazarSolicitudRecuperacion = (id, data = {}) =>
  apiJson(`/auth/solicitudes-recuperacion/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
