import React from "react";
import { FlaskConical, Database } from "lucide-react";

export default function DataStatusBanner({ isSimulationContext, weatherStatus, browserOffline }) {
  if (isSimulationContext) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            <strong>MODO SIMULACIÓN — DATOS SINTÉTICOS:</strong> Escenario demostrativo; no
            representa una alerta real.
          </span>
        </span>
      </div>
    );
  }

  if (weatherStatus !== "LIVE_API" || browserOffline) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <Database className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span>Modo sin conexión: operando con caché local verificada de Open-Meteo.</span>
        </span>
      </div>
    );
  }

  return null;
}
