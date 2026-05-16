import { apiJson } from "../api";

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const obtenerReporteResumen = (params = {}) =>
  apiJson(`/reportes/resumen${buildQuery(params)}`);
