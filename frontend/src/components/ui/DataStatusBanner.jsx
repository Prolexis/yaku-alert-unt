import React from "react";
import { FlaskConical, Radio, Database } from "lucide-react";

export default function DataStatusBanner({ isSimulationContext, weatherStatus }) {
  if (isSimulationContext) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            MODO SIMULACIÓN — ESCENARIO SINTÉTICO: Los polígonos, exposiciones y avisos mostrados son
            demostrativos y NO representan una alerta real.
          </span>
        </span>
        <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          Datos Sintéticos
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
          ? "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200"
          : "border-sky-200 bg-sky-50/90 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200"
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
            ? "DATOS REALES DE PRONÓSTICO (Open-Meteo API): Serie horaria numérica, no observación de estación in situ."
            : "RESPALDO LOCAL SIN CONEXIÓN: Usando caché verificada de Open-Meteo para operación offline."}
        </span>
      </span>
      <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0F172A] shadow-sm dark:bg-slate-800 dark:text-slate-200">
        {isLive ? "Pronóstico Real" : "Caché Offline"}
      </span>
    </div>
  );
}
