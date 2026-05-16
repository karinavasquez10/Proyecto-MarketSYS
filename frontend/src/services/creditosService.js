import { apiFetch, apiJson } from "../api";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const listarCreditos = (params = {}) => apiJson(`/creditos${buildQuery(params)}`);

export const listarAbonosCredito = (idCredito) => apiJson(`/creditos/${idCredito}/abonos`);

export const crearAbonoCredito = (idCredito, abono) =>
  apiFetch(`/creditos/${idCredito}/abonos`, {
    method: "POST",
    body: JSON.stringify(abono),
  });
