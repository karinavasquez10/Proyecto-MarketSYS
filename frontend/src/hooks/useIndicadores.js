import useAsyncData from "./useAsyncData";
import { listarIndicadores } from "../services/indicadoresService";

export const indicadoresIniciales = {
  totalClientes: 0,
  clientesFrecuentesCount: 0,
  visitasPromedio: 0,
  clientesFrecuentes: [],
  categoriasClientes: [],
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const listarIndicadoresConDelay = async () => {
  const [data] = await Promise.all([listarIndicadores(), delay(600)]);
  return data;
};

export default function useIndicadores() {
  const {
    data,
    loading,
    error,
    setError,
    refetch: refetchIndicadores,
  } = useAsyncData({
    request: listarIndicadoresConDelay,
    initialData: indicadoresIniciales,
    logMessage: "Error al cargar indicadores:",
  });

  return {
    data,
    loading,
    error,
    setError,
    refetchIndicadores,
  };
}
