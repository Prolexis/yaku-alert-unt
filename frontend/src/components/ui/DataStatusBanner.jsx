import React from "react";
import { FlaskConical, Radio, Database } from "lucide-react";

export default function DataStatusBanner({ isSimulationContext, weatherStatus }) {
  if (isSimulationContext) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            <strong className="font-bold">MODO SIMULACIÓN — DATOS SINTÉTICOS:</strong> Los
            escenarios, polígonos y exposiciones mostrados son demostrativos y no representan una
            alerta real.
          </span>
        </span>
        <span className="rounded border border-amber-300 bg-white/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100">
          Simulación
        </span>
      </div>
    );
  }

  const isLive = weatherStatus === "LIVE_API";
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs font-medium sm:px-6 lg:px-8 ${
        isLive
          ? "border-[#E2E8F0] bg-white text-[#111827] dark:border-slate-800 dark:bg-[#0B1F33]/60 dark:text-slate-200"
          : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {isLive ? (
          <Radio className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Database className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        )}
        <span>
          {isLive
            ? "Datos reales de pronóstico horario (Open-Meteo API). No corresponde a mediciones de pluviómetro in situ."
            : "Modo sin conexión: operando con caché local verificada de Open-Meteo."}
        </span>
      </span>
      <span
        className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
          isLive
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-sky-300 bg-white text-sky-900 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-100"
        }`}
      >
        {isLive ? "Pronóstico Real" : "Caché Offline"}
      </span>
    </div>
  );
}
