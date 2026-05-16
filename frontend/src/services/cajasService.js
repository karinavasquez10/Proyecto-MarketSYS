import { apiFetch, apiJson } from "../api";

export const listarCajas = () => apiJson("/cajas");

export const obtenerCaja = (idCaja) => apiJson(`/cajas/${idCaja}`);

export const obtenerCajaAbierta = (idUsuario) => apiJson(`/cajas/abierta/${idUsuario}`);

export const abrirCaja = (caja) =>
  apiFetch("/cajas", {
    method: "POST",
    body: JSON.stringify(caja),
  });

export const actualizarCaja = (idCaja, caja) =>
  apiFetch(`/cajas/${idCaja}`, {
    method: "PUT",
    body: JSON.stringify(caja),
  });

export const cerrarCaja = (idCaja, cierre) =>
  apiFetch(`/cajas/${idCaja}/cerrar`, {
    method: "PUT",
    body: JSON.stringify(cierre),
  });
