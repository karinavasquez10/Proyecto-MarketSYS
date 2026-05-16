import useAsyncData from "./useAsyncData";
import { listarClientes } from "../services/clientesService";

export const tipoClienteLabels = {
  persona: "Persona",
  empresa: "Empresa",
};

export const toClienteView = (cliente) => ({
  id: cliente.id,
  documento: cliente.identificacion || "",
  tipo: tipoClienteLabels[cliente.tipo] || cliente.tipo,
  nombre: cliente.nombre || "",
  telefono: cliente.telefono || "",
  email: cliente.correo || "",
  direccion: cliente.direccion || "",
});

const toClientesView = (clientes) => clientes.map(toClienteView);
const resetPageAfterSuccess = (_clientes, { resetPage } = {}) => {
  if (typeof resetPage === "function") resetPage();
};

export default function useClientes() {
  const {
    data: clientes,
    loading,
    error,
    setError,
    refetch: refetchClientes,
  } = useAsyncData({
    request: listarClientes,
    mapData: toClientesView,
    logMessage: "Error al cargar clientes:",
    onSuccess: resetPageAfterSuccess,
  });

  return {
    clientes,
    loading,
    error,
    setError,
    refetchClientes,
  };
}
