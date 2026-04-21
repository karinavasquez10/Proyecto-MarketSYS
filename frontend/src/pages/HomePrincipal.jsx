import React from "react";
import { useNavigate } from "react-router-dom";

export default function HomePrincipal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-100 via-white to-rose-100 relative overflow-hidden px-70">
      {/* ==== Efectos decorativos de fondo ==== */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-[-80px] w-96 h-96 bg-orange-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-[-80px] w-[500px] h-[500px] bg-rose-300/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* ==== Header ==== */}
      <header className="relative z-10 flex justify-between items-center px-6 sm:px-12 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 text-white font-bold rounded-xl shadow-md">
            IN
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Invent<span className="text-orange-600">Net</span>
          </h1>
        </div>

        <button
          onClick={() => navigate("/LoginForm")}
          className="bg-gradient-to-r from-orange-500 to-fuchsia-500 hover:from-orange-600 hover:to-fuchsia-600 text-white font-medium px-5 py-2 rounded-lg text-sm sm:text-base shadow transition-all duration-200 active:scale-95"
        >
          Iniciar Sesión
        </button>
      </header>

      {/* ==== Hero principal ==== */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 sm:px-8">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-4 leading-tight drop-shadow-sm">
          Bienvenido a <span className="text-orange-600">InventNet</span>
        </h2>

        <p className="max-w-2xl text-slate-600 text-sm sm:text-base mb-8">
          Administra inventarios, controla ventas y gestiona tu negocio con una
          interfaz moderna, rápida y segura.  
          <br className="hidden sm:block" />
          <span className="text-orange-500 font-semibold">
            ¡Todo desde un solo lugar!
          </span>
        </p>

        <button
          onClick={() => navigate("/LoginForm")}
          className="bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-500 hover:brightness-110 text-white font-semibold px-8 py-3 rounded-full text-base shadow-lg transition-transform transform hover:scale-105"
        >
          Comenzar Ahora
        </button>
      </main>

      {/* ==== Footer ==== */}
      <footer className="relative z-10 py-4 text-center text-slate-500 text-xs sm:text-sm border-t border-slate-200 bg-white/70 backdrop-blur">
        © {new Date().getFullYear()} <span className="font-semibold">InventNet</span>  
      
      </footer>

      {/* ==== Estilos de animación ==== */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          .animate-pulse {
            animation: pulse 6s infinite ease-in-out;
          }

          @media (max-width: 640px) {
            h2 {
              font-size: 1.8rem;
            }
            p {
              font-size: 0.9rem;
            }
            button {
              width: 80%;
            }
          }
        `}
      </style>
    </div>
  );
}
