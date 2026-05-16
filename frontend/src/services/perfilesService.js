import { apiFetch, apiJson } from "../api";
import { ensureOk } from "./responseUtils";

export const listarPerfiles = () => apiJson("/perfil");

export const obtenerPerfil = (id) => apiJson(`/perfil/${id}`);

export const crearPerfil = (perfil) =>
  apiJson("/perfil", {
    method: "POST",
    body: perfil instanceof FormData ? perfil : JSON.stringify(perfil),
  });

export const actualizarPerfil = (id, perfil) =>
  apiJson(`/perfil/${id}`, {
    method: "PUT",
    body: perfil instanceof FormData ? perfil : JSON.stringify(perfil),
  });

export const restablecerContrasenaPerfil = (id) =>
  apiJson(`/perfil/${id}/restablecer-contrasena`, {
    method: "POST",
  });

export const eliminarPerfil = async (id) => {
  const response = await apiFetch(`/perfil/${id}`, {
    method: "DELETE",
  });
  await ensureOk(response, "Error al eliminar usuario");
  return response;
};
