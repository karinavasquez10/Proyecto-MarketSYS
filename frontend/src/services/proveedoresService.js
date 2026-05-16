import { apiFetch, apiJson } from "../api";

export const listarProveedores = () => apiJson("/proveedores");

export const crearProveedor = (proveedor) =>
  apiFetch("/proveedores", {
    method: "POST",
    body: JSON.stringify(proveedor),
  });

export const actualizarProveedor = (id, proveedor) =>
  apiFetch(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(proveedor),
  });

export const eliminarProveedor = (id) =>
  apiFetch(`/proveedores/${id}`, {
    method: "DELETE",
  });
