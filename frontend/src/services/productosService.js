import { apiFetch, apiJson } from "../api";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ).toString();
  return query ? `?${query}` : "";
};

export const listarProductos = (params = {}) => apiJson(`/products/productos${buildQuery(params)}`);

export const obtenerProducto = (id) => apiJson(`/products/productos/${id}`);

export const obtenerProductoPorCodigo = (codigo) =>
  apiJson(`/products/productos/codigo/${encodeURIComponent(codigo)}`);

export const crearProducto = (producto) =>
  apiFetch("/products/productos", {
    method: "POST",
    body: JSON.stringify(producto),
  });

export const actualizarProducto = (id, producto) =>
  apiFetch(`/products/productos/${id}`, {
    method: "PUT",
    body: JSON.stringify(producto),
  });

export const eliminarProducto = (id) =>
  apiFetch(`/products/productos/${id}`, {
    method: "DELETE",
  });

export const cambiarEstadoProducto = (id, data) =>
  apiFetch(`/products/productos/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const actualizarStocks = (updates) =>
  apiFetch("/products/update-stocks", {
    method: "POST",
    body: JSON.stringify(updates),
  });
