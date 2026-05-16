import { useCallback } from "react";
import useAsyncData from "./useAsyncData";
import { obtenerReporteResumen } from "../services/reportesService";

export default function useReportes(params = {}) {
  const request = useCallback(() => obtenerReporteResumen(params), [params]);
  const {
    data,
    loading,
    error,
    setError,
    refetch: refetchReportes,
  } = useAsyncData({
    request,
    initialData: null,
    logMessage: "Error al cargar reportes:",
  });

  return {
    data,
    loading,
    error,
    setError,
    refetchReportes,
  };
}
