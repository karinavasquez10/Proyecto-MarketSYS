import useAsyncData from "./useAsyncData";
import { listarCompras } from "../services/comprasService";

export default function useCompras() {
  const {
    data: comprasDetalle,
    loading,
    error,
    setError,
    refetch: refetchCompras,
  } = useAsyncData({
    request: listarCompras,
    logMessage: "Error al cargar compras:",
  });

  return {
    comprasDetalle,
    loading,
    error,
    setError,
    refetchCompras,
  };
}
