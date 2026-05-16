import { apiJson } from "../api";

export const listarUnidadesMedida = () => apiJson("/unidadesMedida");

export const listarUnidadesMedidaLegacy = () => apiJson("/unidades_medida");
