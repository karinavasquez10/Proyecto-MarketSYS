// Indicadores.jsx con efecto de carga animado personalizado
import React, { useState, useEffect } from "react";
import { BarChart3, PieChart as PieIcon, Users } from "lucide-react";

// ===== Skeleton Loader para la sesión de indicadores =====
function IndicadoresSkeleton() {
  return (
    <>
      {/* KPIs Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 mx-6 animate-pulse">
        {[1, 2, 3].map((_, i) => (
          <div
            key={i}
            className="bg-white/90 backdrop-blur border border-orange-100 rounded-2xl shadow p-5 text-center"
          >
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto mb-2"></div>
            <div className="h-10 bg-orange-200 rounded w-1/3 mx-auto"></div>
          </div>
        ))}
      </div>

      {/* Gráficos Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 mx-6 animate-pulse">
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6">
          <div className="h-5 w-1/2 bg-slate-200 rounded mb-4"></div>
          {/* bars skeleton */}
          {[...Array(5)].map((_, i) => (
            <div className="mb-4" key={i}>
              <div className="flex justify-between text-sm mb-1">
                <div className="h-3 w-24 bg-slate-200 rounded"></div>
                <div className="h-3 w-8 bg-slate-200 rounded"></div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full bg-orange-200"
                  style={{
                    width: `${30 + i * 10}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6 flex flex-col items-center">
          <div className="h-5 w-1/2 bg-slate-200 rounded mb-4"></div>
          <div className="w-44 h-44 bg-orange-100 rounded-full mb-7"></div>
          <ul className="mt-4 space-y-2 text-sm w-full max-w-xs">
            {[1, 2, 3, 4].map((_, i) => (
              <li key={i} className="flex justify-between items-center">
                <span className="h-3 w-24 bg-slate-200 rounded"></span>
                <span className="h-3 w-8 bg-slate-200 rounded"></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tabla Skeleton */}
      <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6 overflow-x-auto mx-6 animate-pulse">
        <div className="h-5 w-1/3 bg-slate-200 rounded mb-4"></div>
        <table className="min-w-full text-sm border border-orange-100 rounded-lg overflow-hidden">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left h-5 bg-slate-200"></th>
              <th className="px-4 py-2 text-left h-5 bg-slate-200"></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <span className="h-3 bg-slate-200 rounded block w-36"></span>
                </td>
                <td className="px-4 py-3">
                  <span className="h-3 bg-slate-200 rounded block w-12"></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===== Gráfico de barras mejorado =====
function BarChart({ data }) {
  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-4">Sin datos disponibles</div>;
  }
  const maxVal = Math.max(...data.map((d) => d.visitas));
  const colors = ["#fb923c", "#f97316", "#f43f5e", "#ec4899", "#a855f7"];

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-slate-700">{d.nombre}</span>
            <span className="text-slate-500">{d.visitas}</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{
                width: `${(d.visitas / maxVal) * 100}%`,
                backgroundColor: colors[i % colors.length],
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Gráfico de pastel mejorado =====
function PieChart({ data }) {
  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-4">Sin datos disponibles</div>;
  }
  const total = data.reduce((acc, d) => acc + d.valor, 0);
  let acumulado = 0;
  const colors = ["#fb923c", "#f97316", "#ec4899", "#a855f7", "#10b981"];

  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 32 32" className="w-44 h-44 drop-shadow-sm">
        {data.map((d, i) => {
          const start = (acumulado / total) * 100;
          const end = ((acumulado + d.valor) / total) * 100;
          acumulado += d.valor;
          const largeArc = end - start > 50 ? 1 : 0;
          const startAngle = (start / 100) * 2 * Math.PI;
          const endAngle = (end / 100) * 2 * Math.PI;
          const x1 = 16 + 16 * Math.cos(startAngle);
          const y1 = 16 + 16 * Math.sin(startAngle);
          const x2 = 16 + 16 * Math.cos(endAngle);
          const y2 = 16 + 16 * Math.sin(endAngle);

          return (
            <path
              key={i}
              d={`M16 16 L${x1} ${y1} A16 16 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={colors[i % colors.length]}
              opacity="0.9"
            />
          );
        })}
      </svg>

      {/* Leyenda */}
      <ul className="mt-4 space-y-1 text-sm w-full max-w-xs">
        {data.map((c, i) => (
          <li key={i} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: colors[i % colors.length] }}
              ></span>
              <span className="text-slate-700">{c.categoria}</span>
            </div>
            <span className="font-medium text-slate-600">{c.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Indicadores() {
  const [data, setData] = useState({
    totalClientes: 0,
    clientesFrecuentesCount: 0,
    visitasPromedio: 0,
    clientesFrecuentes: [],
    categoriasClientes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch inicial de indicadores con delay de efecto de carga
  useEffect(() => {
    const fetchIndicadores = async () => {
      try {
        setLoading(true);
        setError(null);
        // Aumenta el tiempo para mostrar bien la animación de carga
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const res = await fetch("http://localhost:5000/api/indicadores");
        if (!res.ok) {
          throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
        }
        const fetchedData = await res.json();
        // Simula que la carga tarda al menos 600ms, para que el loading sea visible
        await delay(600);
        setData(fetchedData);
      } catch (err) {
        console.error("Error al fetch indicadores:", err);
        setError(err.message || "Error de conexión al servidor");
        setData({
          totalClientes: 0,
          clientesFrecuentesCount: 0,
          visitasPromedio: 0,
          clientesFrecuentes: [],
          categoriasClientes: [],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchIndicadores();
  }, []);

  // Refetch helper
  const refetchIndicadores = async () => {
    try {
      setError(null);
      setLoading(true);
      // Efecto animado también al recargar manualmente
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const res = await fetch("http://localhost:5000/api/indicadores");
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status} - ${res.statusText}`);
      }
      const fetchedData = await res.json();
      await delay(600);
      setData(fetchedData);
    } catch (err) {
      console.error("Error al refetch:", err);
      setError(err.message || "Error al recargar datos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-4 pb-6 sm:pt-2 sm:pb-8 px-50 bg-gradient-to-br from-orange-50 via-white to-pink-50 min-h-screen rounded-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-8 flex items-center justify-center gap-2">
        <Users size={24} className="text-orange-500" />
        Indicadores de Clientes
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm mx-6">
          {error}
          <button
            onClick={refetchIndicadores}
            className="ml-2 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Efecto animado de carga durante loading */}
      {loading ? (
        <IndicadoresSkeleton />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 mx-6">
            {[
              { title: "Total Clientes", value: data.totalClientes },
              { title: "Clientes Frecuentes", value: data.clientesFrecuentesCount },
              { title: "Visitas Promedio", value: data.visitasPromedio },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/90 backdrop-blur border border-orange-100 rounded-2xl shadow p-5 text-center hover:shadow-md transition"
              >
                <h3 className="text-sm text-slate-500 mb-1">{item.title}</h3>
                <p className="text-3xl font-bold text-orange-600">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 mx-6">
            <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
                <BarChart3 size={18} className="text-orange-500" /> Clientes más frecuentes
              </h2>
              <BarChart data={data.clientesFrecuentes} />
            </div>

            <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
                <PieIcon size={18} className="text-orange-500" /> Distribución de clientes
              </h2>
              <PieChart data={data.categoriasClientes} />
            </div>
          </div>

          {/* Tabla de clientes frecuentes */}
          <div className="bg-white/90 border border-orange-100 rounded-2xl shadow p-6 overflow-x-auto mx-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-700 flex items-center gap-2">
              <Users size={18} className="text-orange-500" /> Top Clientes
            </h2>
            {data.clientesFrecuentes.length > 0 ? (
              <table className="min-w-full text-sm border border-orange-100 rounded-lg overflow-hidden">
                <thead className="bg-gradient-to-r from-orange-400/80 to-fuchsia-400/80 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-left">Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clientesFrecuentes.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-orange-100 hover:bg-orange-50 transition"
                    >
                      <td className="px-4 py-2 text-slate-700 max-w-[200px] truncate">{c.nombre}</td>
                      <td className="px-4 py-2 text-slate-600">{c.visitas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-slate-400 py-4">No hay clientes frecuentes</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}