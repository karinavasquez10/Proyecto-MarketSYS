import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Edit2,
  FileText,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import useProveedores from "../../hooks/useProveedores";
import {
  actualizarProveedor,
  crearProveedor,
  eliminarProveedor,
} from "../../services/proveedoresService";
import { ensureOk } from "../../services/responseUtils";

export default function GestionProveedores() {
  const { proveedores, loading, error, setError, refetchProveedores } = useProveedores();
  const [filtro, setFiltro] = useState("");
  const [formData, setFormData] = useState({
    id: null,
    nombre: "",
    contacto_principal: "",
    identificacion: "",
    telefono: "",
    email: "",
    direccion: "",
    tipo_proveedor: "",
    estado: "activo",
    condiciones_pago: "",
    plazo_credito_dias: "",
    notas: "",
  });
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [proveedorEliminar, setProveedorEliminar] = useState(null);

  // 🔍 Filtrado
  const proveedoresFiltrados = useMemo(() => {
    const filtroNormalizado = filtro.toLowerCase();
    return proveedores.filter((prov) => {
      const contenido = [
        prov.nombre,
        prov.contacto_principal,
        prov.identificacion,
        prov.telefono,
        prov.email,
        prov.tipo_proveedor,
        prov.estado,
      ].join(" ").toLowerCase();

      return contenido.includes(filtroNormalizado);
    });
  }, [proveedores, filtro]);

  const resumen = useMemo(() => {
    const activos = proveedores.filter((prov) => prov.estado === "activo").length;
    const inactivos = proveedores.length - activos;
    const conCredito = proveedores.filter((prov) => Number(prov.plazo_credito_dias) > 0).length;

    return [
      { label: "Proveedores", value: proveedores.length, icon: Truck },
      { label: "Activos", value: activos, icon: Building2 },
      { label: "Inactivos", value: inactivos, icon: X },
      { label: "Con crédito", value: conCredito, icon: CreditCard },
    ];
  }, [proveedores]);

  // ✏️ Manejadores
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validarProveedor = (data) => {
    if (!data.nombre?.trim() || !data.telefono?.trim()) {
      return "Nombre y teléfono son obligatorios.";
    }
    if (data.telefono && !/^[0-9+\s()-]{7,20}$/.test(data.telefono.trim())) {
      return "El teléfono debe contener solo números y signos habituales como +, espacios o guiones.";
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      return "Ingresa un correo válido o deja el campo vacío.";
    }
    if (data.plazo_credito_dias !== "" && Number(data.plazo_credito_dias) < 0) {
      return "El plazo de crédito no puede ser negativo.";
    }
    return "";
  };

  const handleAgregar = async () => {
    const validationError = validarProveedor(formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setError(null);
      const res = await crearProveedor({
        nombre: formData.nombre,
        contacto_principal: formData.contacto_principal,
        identificacion: formData.identificacion,
        direccion: formData.direccion,
        telefono: formData.telefono,
        correo: formData.email,
        tipo_proveedor: formData.tipo_proveedor,
        estado: formData.estado,
        condiciones_pago: formData.condiciones_pago,
        plazo_credito_dias: formData.plazo_credito_dias,
        notas: formData.notas,
      });
      await ensureOk(res, "Error al agregar proveedor");
      resetForm();
      await refetchProveedores();
    } catch (err) {
      console.error("Error al agregar:", err);
      setError(err.message);
    }
  };

  const handleEditar = (prov) => {
    setProveedorEditando({
      ...prov,
      email: prov.email,
    });
    setError(null);
  };

  const handleGuardarEdicion = async (data) => {
    const validationError = validarProveedor(data);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setError(null);
      const res = await actualizarProveedor(data.id, {
        nombre: data.nombre,
        contacto_principal: data.contacto_principal,
        identificacion: data.identificacion,
        direccion: data.direccion,
        telefono: data.telefono,
        correo: data.email,
        tipo_proveedor: data.tipo_proveedor,
        estado: data.estado,
        condiciones_pago: data.condiciones_pago,
        plazo_credito_dias: data.plazo_credito_dias,
        notas: data.notas,
      });
      await ensureOk(res, "Error al actualizar proveedor");
      setProveedorEditando(null);
      await refetchProveedores();
    } catch (err) {
      console.error("Error al guardar:", err);
      setError(err.message);
    }
  };

  const confirmarEliminar = async () => {
    if (!proveedorEliminar?.id) return;
    try {
      setError(null);
      const res = await eliminarProveedor(proveedorEliminar.id);
      await ensureOk(res, "Error al eliminar proveedor");
      setProveedorEliminar(null);
      await refetchProveedores();
    } catch (err) {
      console.error("Error al eliminar:", err);
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      nombre: "",
      contacto_principal: "",
      identificacion: "",
      telefono: "",
      email: "",
      direccion: "",
      tipo_proveedor: "",
      estado: "activo",
      condiciones_pago: "",
      plazo_credito_dias: "",
      notas: "",
    });
    setError(null);
  };

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div className="admin-module-heading">
          <div className="admin-module-icon">
            <Truck size={22} />
          </div>
          <div>
            <h1 className="admin-module-title">Gestión de Proveedores</h1>
            <p className="admin-module-subtitle">
              Administra datos comerciales, contacto, condiciones de pago y estado.
            </p>
          </div>
        </div>
        <button
          onClick={refetchProveedores}
          className="inline-flex items-center gap-2 rounded-sm border border-[#9eb8ff] bg-white px-4 py-2 text-sm font-black text-[#152b73] shadow-sm transition hover:bg-[#f0f5ff]"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {resumen.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-sm border border-[#c8d7ff] bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#152b73]">{label}</p>
              <Icon size={17} className="text-[#3157d5]" />
            </div>
            <p className="mt-1 text-2xl font-black text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-5 rounded-sm border border-[#c8d7ff] bg-white/95 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#d9e3ff] bg-[#eef4ff] px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
            <PlusCircle size={18} className="text-[#3157d5]" />
            Registrar proveedor
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Nombre
            </label>
            <input
              type="text"
              name="nombre"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Proveedor S.A."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Contacto principal
            </label>
            <input
              type="text"
              name="contacto_principal"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.contacto_principal}
              onChange={handleChange}
              placeholder="Ej: Karina Audoro"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Identificación
            </label>
            <input
              type="text"
              name="identificacion"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.identificacion}
              onChange={handleChange}
              placeholder="Ej: NIT o CC"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Teléfono
            </label>
            <input
              type="text"
              name="telefono"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="Ej: 3001234567"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.email}
              onChange={handleChange}
              placeholder="Ej: proveedor@gmail.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Tipo de proveedor
            </label>
            <input
              type="text"
              name="tipo_proveedor"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.tipo_proveedor}
              onChange={handleChange}
              placeholder="Ej: Fruver, aseo, lácteos"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Estado
            </label>
            <select
              name="estado"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.estado}
              onChange={handleChange}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Plazo crédito
            </label>
            <input
              type="number"
              min="0"
              name="plazo_credito_dias"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.plazo_credito_dias}
              onChange={handleChange}
              placeholder="Días"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Dirección
            </label>
            <input
              type="text"
              name="direccion"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Ej: Calle 10 #45-23"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Condiciones de pago
            </label>
            <input
              type="text"
              name="condiciones_pago"
              className="h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.condiciones_pago}
              onChange={handleChange}
              placeholder="Ej: contado, crédito, contra entrega"
            />
          </div>
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-black uppercase text-[#152b73]">
              Notas
            </label>
            <textarea
              name="notas"
              rows="2"
              className="w-full resize-none rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
              value={formData.notas}
              onChange={handleChange}
              placeholder="Observaciones comerciales, horarios de entrega o acuerdos."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[#d9e3ff] bg-[#f8fbf7] px-4 py-4">
          <button
            onClick={handleAgregar}
            className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-110"
          >
            <PlusCircle size={16} /> Agregar Proveedor
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-sm border border-[#c8d7ff] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#d9e3ff] bg-white px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-[#111827]">
              <Truck size={18} className="text-[#3157d5]" />
              Lista de Proveedores
            </h2>
            <p className="text-xs font-bold text-[#47524e]">
              {proveedoresFiltrados.length} resultado(s)
            </p>
          </div>
          <label className="block w-full lg:max-w-xl">
            <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">Buscar proveedor</span>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3157d5]" />
              <input
                type="text"
                placeholder="Proveedor, contacto, identificación, tipo o estado"
                className="h-11 w-full rounded-sm border border-[#b9caff] bg-white pl-10 pr-3 text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#64748b] focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          </label>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-bold text-[#152b73]">
            Cargando proveedores...
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-rose-600 mb-2">Error al cargar datos</div>
            <div className="text-slate-500 text-sm">{error}</div>
            <button
              onClick={refetchProveedores}
              className="mt-4 rounded-sm bg-[#3157d5] px-4 py-2 text-sm font-black text-white hover:brightness-110"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead className="bg-[#eef4ff] text-[#152b73]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Proveedor</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Comercial</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase">Estado</th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {proveedoresFiltrados.length > 0 ? (
                  proveedoresFiltrados.map((prov) => (
                    <tr
                      key={prov.id}
                      className="transition hover:bg-[#f7fbf3]"
                    >
                      <td className="px-4 py-3">
                        <p className="truncate font-black text-[#111827]" title={prov.nombre}>
                          {prov.nombre}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]" title={prov.identificacion}>
                          <FileText size={13} className="shrink-0 text-[#3157d5]" />
                          {prov.identificacion || "Sin identificación"}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]" title={prov.direccion}>
                          <MapPin size={13} className="shrink-0 text-[#3157d5]" />
                          {prov.direccion || "Sin dirección"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex min-w-0 items-center gap-1 truncate font-bold text-[#111827]" title={prov.contacto_principal}>
                          <UserRound size={14} className="shrink-0 text-[#3157d5]" />
                          {prov.contacto_principal || "Sin contacto"}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]" title={prov.telefono}>
                          <Phone size={13} className="shrink-0 text-[#3157d5]" />
                          {prov.telefono || "Sin teléfono"}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]" title={prov.email}>
                          <Mail size={13} className="shrink-0 text-[#3157d5]" />
                          {prov.email || "Sin correo"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate font-bold text-[#111827]" title={prov.tipo_proveedor}>
                          {prov.tipo_proveedor || "Sin tipo"}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-[#47524e]" title={prov.condiciones_pago}>
                          <CreditCard size={13} className="shrink-0 text-[#3157d5]" />
                          {prov.condiciones_pago || "Sin condición de pago"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#47524e]">
                          {prov.plazo_credito_dias ? `${prov.plazo_credito_dias} días de crédito` : "Sin plazo de crédito"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-sm px-2 py-1 text-xs font-black uppercase ${
                          prov.estado === "activo"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {prov.estado || "inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditar(prov)}
                            className="rounded-sm border border-amber-300 bg-white p-2 text-amber-800 shadow-sm transition hover:bg-amber-50 [&_svg]:stroke-[2.8]"
                            title="Editar proveedor"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setProveedorEliminar(prov)}
                            className="rounded-sm border border-rose-300 bg-white p-2 text-[#7f1d1d] shadow-sm transition hover:bg-rose-50 [&_svg]:stroke-[2.8]"
                            title="Eliminar proveedor"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-10 text-center text-sm font-bold text-[#47524e]"
                    >
                      No se encontraron proveedores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {proveedorEliminar && (
        <ConfirmDialog
          title="Eliminar proveedor"
          message="Esta acción quitará el proveedor de la gestión activa."
          details={[
            { label: "Proveedor", value: proveedorEliminar.nombre || "Sin nombre" },
            { label: "Identificación", value: proveedorEliminar.identificacion || "Sin identificación" },
          ]}
          onCancel={() => setProveedorEliminar(null)}
          onConfirm={confirmarEliminar}
        />
      )}
      {proveedorEditando && (
        <ProveedorEditDialog
          proveedor={proveedorEditando}
          onCancel={() => setProveedorEditando(null)}
          onSave={handleGuardarEdicion}
        />
      )}
    </div>
  );
}

function ProveedorEditDialog({ proveedor, onCancel, onSave }) {
  const [draft, setDraft] = useState(proveedor);
  const [saving, setSaving] = useState(false);
  const modalInputClass = "h-10 w-full rounded-sm border border-[#b9caff] bg-white px-3 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]";
  const modalTextareaClass = "w-full resize-none rounded-sm border border-[#b9caff] bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#dbe6ff]";

  const updateField = (name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-4xl overflow-hidden rounded-md border border-[#c7d2fe] bg-white text-[#111827] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#dbe4ff] bg-[#eef4ff] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#3157d5]">Proveedor</p>
            <h3 className="text-lg font-black">Editar datos comerciales</h3>
          </div>
          <button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-sm border border-[#c7d2fe] bg-white text-[#233876] transition hover:bg-[#f8f9ff]">
            <X size={18} />
          </button>
        </div>

        <div className="grid max-h-[72vh] gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <ModalField label="Nombre">
            <input value={draft.nombre || ""} onChange={(e) => updateField("nombre", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Contacto principal">
            <input value={draft.contacto_principal || ""} onChange={(e) => updateField("contacto_principal", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Identificación">
            <input value={draft.identificacion || ""} onChange={(e) => updateField("identificacion", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Teléfono">
            <input value={draft.telefono || ""} onChange={(e) => updateField("telefono", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Email">
            <input type="email" value={draft.email || ""} onChange={(e) => updateField("email", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Tipo de proveedor">
            <input value={draft.tipo_proveedor || ""} onChange={(e) => updateField("tipo_proveedor", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Estado">
            <select value={draft.estado || "activo"} onChange={(e) => updateField("estado", e.target.value)} className={modalInputClass}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </ModalField>
          <ModalField label="Plazo crédito">
            <input type="number" min="0" value={draft.plazo_credito_dias || ""} onChange={(e) => updateField("plazo_credito_dias", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Dirección" wide>
            <input value={draft.direccion || ""} onChange={(e) => updateField("direccion", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Condiciones de pago" wide>
            <input value={draft.condiciones_pago || ""} onChange={(e) => updateField("condiciones_pago", e.target.value)} className={modalInputClass} />
          </ModalField>
          <ModalField label="Notas" wide>
            <textarea rows="3" value={draft.notas || ""} onChange={(e) => updateField("notas", e.target.value)} className={modalTextareaClass} />
          </ModalField>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#dbe4ff] bg-[#f8fbf7] px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff] disabled:opacity-60">
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving} className="rounded-sm bg-gradient-to-r from-[#3157d5] to-[#18a36b] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children, wide = false }) {
  return (
    <label className={wide ? "block md:col-span-2" : "block"}>
      <span className="mb-1 block text-xs font-black uppercase text-[#152b73]">{label}</span>
      {children}
    </label>
  );
}

function ConfirmDialog({ title, message, details = [], onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[430px] rounded-md border border-[#c7d2fe] bg-white p-5 text-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-100 text-rose-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3 className="text-lg font-black leading-tight">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#47524e]">{message}</p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-4 grid gap-2 rounded-sm border border-[#dbe4ff] bg-[#f8fbf7] p-3">
            {details.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-black uppercase tracking-wide text-[#47524e]">{item.label}</span>
                <span className="max-w-[220px] truncate text-right font-black text-[#111827]">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-black text-[#152b73] transition hover:bg-[#eef2ff]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm bg-[#b91c1c] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
