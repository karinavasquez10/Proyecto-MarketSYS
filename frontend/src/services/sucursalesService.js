import { apiFetch, apiJson } from "../api";
import { ensureOk } from "./responseUtils";

export const listarSucursales = () => apiJson("/sucursales");

export const listarSucursalesActivas = () => apiJson("/sucursales/activas");

export const listarUsuariosSucursal = (idSucursal) =>
  apiJson(`/sucursales/${idSucursal}/usuarios`);

export const crearSucursal = (sucursal) =>
  apiJson("/sucursales", {
    method: "POST",
    body: JSON.stringify(sucursal),
  });

export const actualizarSucursal = (idSucursal, sucursal) =>
  apiJson(`/sucursales/${idSucursal}`, {
    method: "PUT",
    body: JSON.stringify(sucursal),
  });

export const eliminarSucursal = async (idSucursal) => {
  const response = await apiFetch(`/sucursales/${idSucursal}`, {
    method: "DELETE",
  });
  await ensureOk(response, "Error al eliminar la sucursal");
  return response;
};
