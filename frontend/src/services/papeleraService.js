import { apiFetch, apiJson } from "../api";

export const listarPapelera = () => apiJson("/papelera");

export const restaurarPapelera = (id) =>
  apiFetch(`/papelera/restore/${id}`, {
    method: "POST",
  });

export const eliminarDefinitivoPapelera = (id) =>
  apiFetch(`/papelera/${id}`, {
    method: "DELETE",
  });
