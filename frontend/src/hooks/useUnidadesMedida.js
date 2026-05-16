import useAsyncData from "./useAsyncData";
import { listarUnidadesMedida } from "../services/unidadesMedidaService";

export default function useUnidadesMedida() {
  const {
    data: unidades,
    loading,
    error,
    setError,
    refetch: refetchUnidades,
  } = useAsyncData({
    request: listarUnidadesMedida,
    logMessage: "Error al cargar unidades de medida:",
  });

  return {
    unidades,
    loading,
    error,
    setError,
    refetchUnidades,
  };
}
