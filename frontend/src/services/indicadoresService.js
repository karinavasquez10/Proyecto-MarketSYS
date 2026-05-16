import { apiJson } from "../api";

export const listarIndicadores = () => apiJson("/indicadores");
