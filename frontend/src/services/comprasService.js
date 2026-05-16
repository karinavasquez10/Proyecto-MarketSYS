import { apiFetch, apiJson } from "../api";

export const listarCompras = () => apiJson("/compras");

export const crearCompra = (compra) =>
  apiFetch("/compras", {
    method: "POST",
    body: JSON.stringify(compra),
  });

export const agregarDetalleCompra = (detalle) =>
  apiFetch("/compras/detalle", {
    method: "POST",
    body: JSON.stringify(detalle),
  });

export const eliminarDetalleCompra = (idDetalle) =>
  apiFetch(`/compras/detalle/${idDetalle}`, {
    method: "DELETE",
  });
