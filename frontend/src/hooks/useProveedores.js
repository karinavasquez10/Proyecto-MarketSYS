import useAsyncData from "./useAsyncData";
import { listarProveedores } from "../services/proveedoresService";

export const toProveedorView = (proveedor) => ({
  id: proveedor.id_proveedor,
  nombre: proveedor.nombre,
  contacto_principal: proveedor.contacto_principal || "",
  identificacion: proveedor.identificacion || "",
  telefono: proveedor.telefono || "",
  email: proveedor.correo || "",
  direccion: proveedor.direccion || "",
  tipo_proveedor: proveedor.tipo_proveedor || "",
  estado: proveedor.estado || "activo",
  condiciones_pago: proveedor.condiciones_pago || "",
  plazo_credito_dias: proveedor.plazo_credito_dias ?? "",
  notas: proveedor.notas || "",
});

const toProveedoresView = (proveedores) => proveedores.map(toProveedorView);

export default function useProveedores() {
  const {
    data: proveedores,
    loading,
    error,
    setError,
    refetch: refetchProveedores,
  } = useAsyncData({
    request: listarProveedores,
    mapData: toProveedoresView,
    logMessage: "Error al cargar proveedores:",
  });

  return {
    proveedores,
    loading,
    error,
    setError,
    refetchProveedores,
  };
}
