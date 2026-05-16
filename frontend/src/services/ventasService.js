import { apiFetch, apiJson } from "../api";

export const listarVentas = () => apiJson("/ventas");

export const obtenerVenta = (id) => apiJson(`/ventas/${id}`);

export const obtenerProximaFactura = () => apiJson("/ventas/proxima-factura");

export const crearVenta = (venta) =>
  apiFetch("/ventas", {
    method: "POST",
    body: JSON.stringify(venta),
  });

export const anularVenta = (id, data) =>
  apiFetch(`/ventas/${id}/anular`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
