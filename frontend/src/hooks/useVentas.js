import useAsyncData from "./useAsyncData";
import { listarVentas } from "../services/ventasService";

export default function useVentas() {
  const {
    data: ventas,
    setData: setVentas,
    loading,
    error,
    setError,
    refetch: refetchVentas,
  } = useAsyncData({
    request: listarVentas,
    logMessage: "Error al cargar ventas:",
  });

  return {
    ventas,
    setVentas,
    loading,
    error,
    setError,
    refetchVentas,
  };
}
