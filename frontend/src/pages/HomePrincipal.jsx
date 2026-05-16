import React from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Boxes, ChevronRight, ReceiptText, ShieldCheck, ShoppingCart } from "lucide-react";

export default function HomePrincipal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#edf3f1] text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-left"
          aria-label="Ir al inicio"
        >
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-700 text-sm font-black text-white shadow-sm">
            MS
          </span>
          <span>
            <span className="block text-lg font-black leading-tight tracking-tight">MARKETSYS</span>
            <span className="block text-xs font-semibold uppercase text-emerald-800">MarketSYS</span>
          </span>
        </button>

        <button
          onClick={() => navigate("/LoginForm")}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
        >
          Iniciar sesión
          <ChevronRight size={16} />
        </button>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-164px)] max-w-7xl grid-cols-1 items-center gap-8 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold uppercase text-emerald-800 shadow-sm">
            <ShieldCheck size={14} />
            Sistema POS e inventario
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Control claro para tiendas que venden todo el dia.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            MARKETSYS centraliza caja, productos, clientes, compras y reportes en una experiencia pensada para operar rapido en mostrador y revisar el negocio con calma.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/LoginForm")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
            >
              Entrar al sistema
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => navigate("/Home")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800"
            >
              Ver POS
              <ShoppingCart size={17} />
            </button>
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/5">
          <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-700 px-4 py-3 text-white">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-100">Documento actual</p>
              <p className="text-2xl font-black">$ 74.340</p>
            </div>
            <ReceiptText size={32} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Ventas hoy", "$1.280.000", BarChart3],
              ["Productos", "348", Boxes],
              ["Items", "12", ShoppingCart],
              ["Stock bajo", "8", ShieldCheck],
            ].map(([label, value, Icon]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-[#f8faf9] p-4">
                <Icon size={19} className="mb-3 text-emerald-700" />
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid grid-cols-2 gap-2">
              {["Manzana roja", "Pera", "Tomate", "Papaya", "Pepino", "Sandia"].map((product, index) => (
                <div key={product} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 h-16 rounded-md bg-gradient-to-br from-emerald-50 to-lime-100" />
                  <p className="truncate text-xs font-black uppercase text-slate-700">{product}</p>
                  <p className="mt-1 text-sm font-black text-emerald-700">${(2500 + index * 650).toLocaleString("es-CO")}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col rounded-lg border border-slate-200 bg-[#f8faf9]">
              <div className="border-b border-slate-200 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Resumen de venta</p>
                <p className="mt-1 text-lg font-black text-slate-950">Lista para facturar</p>
              </div>
              <div className="flex-1 space-y-3 p-4">
                {["Manzana roja x2", "Pepino x1", "Papaya x1"].map((item) => (
                  <div key={item} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{item}</span>
                    <span className="font-black text-slate-950">$8.400</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 p-4">
                <button className="w-full rounded-lg bg-slate-900 py-3 text-sm font-black text-white">
                  Facturar
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/70 px-5 py-4 text-center text-xs font-semibold text-slate-500">
        MARKETSYS MarketSYS
      </footer>
    </div>
  );
}
