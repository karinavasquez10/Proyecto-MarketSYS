import { apiFetch, apiJson } from "../api";

export const listarMermas = () => apiJson("/mermas");

export const listarNotificacionesMermas = ({ horas = 24 } = {}) =>
  apiJson(`/mermas/notificaciones?horas=${horas}`);

export const listarMermasPorRango = ({ fechaInicial, fechaFinal }) =>
  apiJson(`/mermas/rango?fechaInicial=${fechaInicial}&fechaFinal=${fechaFinal}`);

export const crearMerma = (merma) =>
  apiFetch("/mermas", {
    method: "POST",
    body: JSON.stringify(merma),
  });

export const transformarMerma = (transformacion) =>
  apiFetch("/mermas/transformar", {
    method: "POST",
    body: JSON.stringify(transformacion),
  });

export const eliminarMerma = (idMerma, { id_usuario }) =>
  apiFetch(`/mermas/${idMerma}`, {
    method: "DELETE",
    body: JSON.stringify({ id_usuario }),
  });
