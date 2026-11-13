import React from "react";
import { X, ShieldCheck, Scale, Cpu, AlertTriangle } from "lucide-react";

export default function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-[#0B1F33]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4 dark:border-slate-800">
          <div>
            <h2 id="help-modal-title" className="text-lg font-bold text-[#0F172A] dark:text-white">
              Acerca de YAKU ALERT — UNT (TRL 3–4)
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
              Hackathon Innova Norte 3G 2026 · Desafío 3: Fenómeno El Niño
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de ayuda"
            className="rounded-xl p-1.5 text-[#64748B] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-xs leading-relaxed text-[#0F172A] dark:text-slate-200">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 font-semibold text-[#2563EB] dark:text-tealbrand-400">
              <Cpu className="h-4 w-4" />
              Motor de Decisiones Preventivas Explicables
            </div>
            <p className="mt-1.5 text-[#64748B] dark:text-slate-300">
              Integra pronósticos horarios de Open-Meteo (con respaldo local offline), análisis espacial
              real mediante Shapely 2.x sobre capas GeoJSON referenciales de la Ciudad Universitaria UNT,
              y reglas transparentes que explican qué datos sustentan cada orientación preventiva.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
              <Scale className="h-4 w-4" />
              Cumplimiento Normativo (SINAGERD y Privacidad)
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[#64748B] dark:text-slate-300">
              <li>
                <strong>Ley N.° 29664 (SINAGERD) y D.S. N.° 048-2011-PCM:</strong> Apoyo informativo y
                preparación preventiva; no reemplaza alertas oficiales de SENAMHI, COEN, INDECI ni
                Defensa Civil UNT.
              </li>
              <li>
                <strong>Ley N.° 29733 (Datos Personales):</strong> No recopila registro, DNI, correo ni
                ubicación GPS del usuario.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Límites Científicos Declarados
            </div>
            <p className="mt-1">
              Los umbrales de lluvia del motor son experimentales de demostración, la probabilidad de
              lluvia no equivale a probabilidad de huaico, y las rutas o puntos de encuentro en mapa son
              referenciales (no garantizan seguridad operativa).
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
          >
            <ShieldCheck className="h-4 w-4" />
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
