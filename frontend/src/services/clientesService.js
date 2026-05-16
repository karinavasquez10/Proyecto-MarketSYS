import { apiFetch, apiJson } from "../api";

export const listarClientes = () => apiJson("/clientes");

export const crearCliente = (cliente) =>
  apiFetch("/clientes", {
    method: "POST",
    body: JSON.stringify(cliente),
  });

export const actualizarCliente = (id, cliente) =>
  apiFetch(`/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(cliente),
  });

export const eliminarCliente = (id) =>
  apiFetch(`/clientes/${id}`, {
    method: "DELETE",
  });
