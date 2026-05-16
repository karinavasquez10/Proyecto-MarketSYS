import useAsyncData from "./useAsyncData";
import { listarPerfiles } from "../services/perfilesService";

export default function usePerfiles() {
  const {
    data: perfiles,
    loading,
    error,
    setError,
    refetch: refetchPerfiles,
  } = useAsyncData({
    request: listarPerfiles,
    logMessage: "Error al cargar perfiles:",
  });

  return {
    perfiles,
    loading,
    error,
    setError,
    refetchPerfiles,
  };
}
