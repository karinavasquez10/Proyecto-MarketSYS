import { useCallback, useMemo } from "react";
import useAsyncData from "./useAsyncData";
import { listarProductos } from "../services/productosService";

export default function useProductos(params = {}) {
  const stableParams = useMemo(() => params, [JSON.stringify(params)]);
  const request = useCallback(() => listarProductos(stableParams), [stableParams]);
  const {
    data: productos,
    setData: setProductos,
    loading,
    error,
    setError,
    refetch: refetchProductos,
  } = useAsyncData({
    request,
    logMessage: "Error al cargar productos:",
  });

  return {
    productos,
    setProductos,
    loading,
    error,
    setError,
    refetchProductos,
  };
}
