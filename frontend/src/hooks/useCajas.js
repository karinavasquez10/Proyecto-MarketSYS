import useAsyncData from "./useAsyncData";
import { listarCajas } from "../services/cajasService";

export default function useCajas() {
  const {
    data: cajas,
    loading,
    error,
    setError,
    refetch: refetchCajas,
  } = useAsyncData({
    request: listarCajas,
    logMessage: "Error al cargar cajas:",
  });

  return {
    cajas,
    loading,
    error,
    setError,
    refetchCajas,
  };
}
