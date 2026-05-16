import useAsyncData from "./useAsyncData";
import { listarCategorias } from "../services/categoriasService";

const onlyActiveCategorias = (categorias) =>
  categorias.filter((categoria) => !categoria.is_deleted);

export default function useCategorias() {
  const {
    data: categorias,
    loading,
    error,
    setError,
    refetch: refetchCategorias,
  } = useAsyncData({
    request: listarCategorias,
    mapData: onlyActiveCategorias,
    logMessage: "Error al cargar categorías:",
  });

  return {
    categorias,
    loading,
    error,
    setError,
    refetchCategorias,
  };
}
