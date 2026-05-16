import useAsyncData from "./useAsyncData";
import { listarPapelera } from "../services/papeleraService";

export const toPapeleraView = (item) => ({
  id: item.id_papelera,
  tipo: item.tipo,
  registroId: item.registro_id,
  nombre: item.nombre,
  eliminadoPor: item.eliminadoPor || "Usuario desconocido",
  fecha: item.fecha ? new Date(item.fecha).toISOString().split("T")[0] : "",
});

const toPapeleraItemsView = (items) => items.map(toPapeleraView);

export default function usePapelera() {
  const {
    data: items,
    loading,
    error,
    setError,
    refetch: refetchPapelera,
  } = useAsyncData({
    request: listarPapelera,
    mapData: toPapeleraItemsView,
    logMessage: "Error al cargar papelera:",
  });

  return {
    items,
    loading,
    error,
    setError,
    refetchPapelera,
  };
}
