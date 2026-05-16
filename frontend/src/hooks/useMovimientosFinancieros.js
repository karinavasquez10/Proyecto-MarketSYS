import useAsyncData from "./useAsyncData";
import { listarMovimientosFinancieros } from "../services/movimientosService";

export default function useMovimientosFinancieros() {
  const {
    data: movimientos,
    loading,
    error,
    setError,
    refetch: refetchMovimientos,
  } = useAsyncData({
    request: listarMovimientosFinancieros,
    logMessage: "Error al cargar movimientos:",
  });

  return {
    movimientos,
    loading,
    error,
    setError,
    refetchMovimientos,
  };
}
