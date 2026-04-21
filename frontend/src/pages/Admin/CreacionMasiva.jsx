import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function CreacionMasiva({ onClose, onGuardar }) {
  const [dataPreview, setDataPreview] = useState([]);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setDataPreview(data);
    };
    reader.readAsBinaryString(file);
  };

  const handleGuardar = () => {
    if (dataPreview.length === 0) {
      alert("No se ha cargado ningún archivo válido.");
      return;
    }
    onGuardar(dataPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-3 backdrop-blur-md">
      <div className="bg-white/80 backdrop-blur-lg border border-white/30 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] w-full max-w-4xl p-8 relative overflow-y-auto max-h-[90vh] animate-fadeIn">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-red-500 text-xl font-bold transition"
        >
          ✕
        </button>

        {/* Encabezado */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 drop-shadow-sm">
            Creación Masiva de Clientes
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Cargue un archivo Excel o CSV con la información de los clientes.
          </p>
          <div className="mt-4 w-28 h-1 bg-gradient-to-r from-orange-400 to-pink-400 mx-auto rounded-full" />
        </div>

        {/* Subida de archivo */}
        <div className="border-2 border-dashed border-orange-300 rounded-2xl p-6 text-center bg-orange-50/30 hover:bg-orange-100/40 transition cursor-pointer mb-6">
          <label className="cursor-pointer text-slate-700 font-medium">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            {fileName ? (
              <span className="text-orange-600 font-semibold">
                Archivo cargado: {fileName}
              </span>
            ) : (
              <>
                <span className="text-orange-600">📁 </span>
                Haga clic aquí para seleccionar un archivo
              </>
            )}
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Formatos aceptados: .xlsx, .xls, .csv
          </p>
        </div>

        {/* Vista previa */}
        {dataPreview.length > 0 && (
          <div className="overflow-x-auto bg-white/90 border border-orange-100 rounded-xl shadow-inner p-3 mb-6">
            <h3 className="font-semibold text-slate-700 mb-2 text-sm">
              Vista previa de registros ({dataPreview.length})
            </h3>
            <table className="min-w-full text-xs border border-slate-200">
              <thead className="bg-gradient-to-r from-orange-300/60 to-pink-300/60 text-white">
                <tr>
                  {Object.keys(dataPreview[0]).map((key, idx) => (
                    <th key={idx} className="px-2 py-1 border text-left">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataPreview.slice(0, 6).map((row, i) => (
                  <tr key={i} className="hover:bg-orange-50 transition">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-2 py-1 border">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {dataPreview.length > 6 && (
              <p className="text-xs text-slate-500 mt-1">
                Mostrando los primeros 6 registros...
              </p>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-slate-400/90 hover:bg-slate-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-110 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md transition"
          >
            Importar Clientes
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.96) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
}
