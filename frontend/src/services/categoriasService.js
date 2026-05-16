import { apiFetch, apiJson } from "../api";

export const listarCategorias = () => apiJson("/categorias");

export const crearCategoria = (categoria) =>
  apiFetch("/categorias", {
    method: "POST",
    body: JSON.stringify(categoria),
  });

export const actualizarCategoria = (id, categoria) =>
  apiFetch(`/categorias/${id}`, {
    method: "PUT",
    body: JSON.stringify(categoria),
  });

export const eliminarCategoria = (id) =>
  apiFetch(`/categorias/${id}`, {
    method: "DELETE",
  });
