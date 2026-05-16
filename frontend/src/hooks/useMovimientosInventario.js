import { useCallback, useMemo } from "react";
import useAsyncData from "./useAsyncData";
import { listarMovimientosInventario } from "../services/movimientosInventarioService";

export default function useMovimientosInventario(params = {}) {
  const stableParams = useMemo(() => params, [JSON.stringify(params)]);
  const request = useCallback(() => listarMovimientosInventario(stableParams), [stableParams]);
  const {
    data: movimientos,
    setData: setMovimientos,
    loading,
    error,
    setError,
    refetch: refetchMovimientos,
  } = useAsyncData({
    request,
    logMessage: "Error al cargar movimientos de inventario:",
  });

  return {
    movimientos,
    setMovimientos,
    loading,
    error,
    setError,
    refetchMovimientos,
  };
}
