import { useCallback } from "react";
import useAsyncData from "./useAsyncData";
import { listarCreditos } from "../services/creditosService";

export default function useCreditos(params = {}) {
  const request = useCallback(() => listarCreditos(params), [params]);
  const {
    data: creditos,
    loading,
    error,
    setError,
    refetch: refetchCreditos,
  } = useAsyncData({
    request,
    logMessage: "Error al cargar créditos:",
  });

  return {
    creditos,
    loading,
    error,
    setError,
    refetchCreditos,
  };
}
