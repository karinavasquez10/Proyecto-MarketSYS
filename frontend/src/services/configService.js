import { apiFetch, apiJson } from "../api";

export const obtenerConfiguracionSistema = () => apiJson("/config");

export const guardarConfiguracionSistema = (configuraciones, idUsuario) =>
  apiFetch("/config", {
    method: "PUT",
    body: JSON.stringify({ configuraciones, id_usuario: idUsuario }),
  });
