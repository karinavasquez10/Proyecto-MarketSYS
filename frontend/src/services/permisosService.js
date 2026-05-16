import { apiJson } from "../api";

export const listarPermisosUsuario = (idUsuario) => apiJson(`/permisos/${idUsuario}`);

export const listarModulosPermisos = () => apiJson("/permisos/modulos");

export const inicializarPermisosUsuario = (idUsuario) =>
  apiJson(`/permisos/${idUsuario}/inicializar`, {
    method: "POST",
  });

export const guardarPermisosUsuario = (idUsuario, permisos) =>
  apiJson(`/permisos/${idUsuario}`, {
    method: "POST",
    body: JSON.stringify({ permisos }),
  });
