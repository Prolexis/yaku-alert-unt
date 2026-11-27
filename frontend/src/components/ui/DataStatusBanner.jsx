import React from "react";
import { FlaskConical, Database } from "lucide-react";

export default function DataStatusBanner({ isSimulationContext, userRole = "student", weatherStatus, browserOffline }) {
  if (isSimulationContext && userRole === "admin") {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-[#D97706]/30 bg-[#FFFBEB] px-4 py-2 text-xs font-semibold text-[#92400E] dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="h-4 w-4 shrink-0 text-[#D97706] dark:text-amber-400" />
          <span>
            <strong className="font-extrabold">MODO SIMULACIÓN — DATOS SINTÉTICOS:</strong>{" "}
            Escenario demostrativo educativo; no representa una alerta oficial en curso.
          </span>
        </span>
      </div>
    );
  }

  if (weatherStatus !== "LIVE_API" || browserOffline) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 border-b border-[#0284C7]/25 bg-[#F0F9FF] px-4 py-2 text-xs font-semibold text-[#075985] dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 sm:px-6 lg:px-8"
      >
        <span className="inline-flex items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-sky-400" />
          <span>
            Respaldo Offline activo: operando con caché local verificada de Open-Meteo (100 % funcional sin internet).
          </span>
        </span>
      </div>
    );
  }

  return null;
}
