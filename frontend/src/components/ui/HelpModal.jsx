import React from "react";
import { X, ShieldCheck, Scale, Cpu, AlertTriangle } from "lucide-react";
import { YakuAlertLogo, NexoRiskBadge } from "./BrandLogo";
import DataSourcesPanel from "./DataSourcesPanel";

export default function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071524]/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
          <div className="space-y-1.5">
            <YakuAlertLogo size="md" showSubtitle variant="light" />
            <h2 id="help-modal-title" className="sr-only">
              Acerca de Yaku Alert — UNT (TRL 3–4)
            </h2>
            <p className="text-xs font-medium text-[#475569] dark:text-slate-300">
              Hackathon Innova Norte 3G 2026 · Desafío 3: Fenómeno El Niño · TRL 3–4
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de ayuda"
            className="rounded-xl p-1.5 text-[#475569] hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#0F172A] dark:text-slate-200">
          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 font-bold text-[#0369A1] dark:text-[#38BDF8]">
              <Cpu className="h-4 w-4" />
              Motor de Decisiones Preventivas Explicables
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              Integra pronósticos horarios probabilísticos de Open-Meteo (con respaldo local offline),
              análisis espacial real mediante Shapely 2.x sobre capas GeoJSON de la Ciudad Universitaria UNT,
              y reglas transparentes (<span className="font-mono font-semibold">R-MET</span> /{" "}
              <span className="font-mono font-semibold">R-HID</span>) que explican qué datos sustentan
              cada orientación preventiva.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 font-bold text-[#059669] dark:text-emerald-400">
              <Scale className="h-4 w-4" />
              Cumplimiento Normativo (SINAGERD y Privacidad)
            </div>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              <li>
                <strong className="text-[#0F172A] dark:text-white">Ley N.° 29664 (SINAGERD):</strong>{" "}
                Apoyo informativo y preparación preventiva; no reemplaza alertas oficiales de SENAMHI,
                COER, COEN, INDECI ni Defensa Civil UNT.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-white">D.S. N.° 048-2011-PCM:</strong>{" "}
                Alineamiento con procesos de estimación, prevención y preparación ante lluvias intensas.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-white">D.S. N.° 115-2022-PCM (PLANAGERD 2022–2030):</strong>{" "}
                Contribución a la gestión prospectiva y reactiva y a la continuidad académica y administrativa.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-white">Ley N.° 29733 (Datos Personales):</strong>{" "}
                No recopila registro, PII, DNI, correo ni ubicación GPS del usuario.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#D97706]/35 bg-[#FFFBEB] p-4 text-[#92400E] dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-[#D97706]" />
              Límites Científicos Declarados
            </div>
            <p className="mt-1 text-xs leading-relaxed">
              Los umbrales de lluvia del motor son experimentales de demostración, la probabilidad de
              lluvia (%) no equivale a probabilidad de huaico, y las rutas o puntos seguros en mapa son
              referenciales para planificación preventiva.
            </p>
          </div>

          <DataSourcesPanel compact />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <NexoRiskBadge variant="light" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0369A1]"
          >
            <ShieldCheck className="h-4 w-4" />
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
