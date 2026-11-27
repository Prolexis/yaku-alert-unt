import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Footprints, ShieldCheck, Navigation, X } from "lucide-react";

export default function WhereAmISafeRouteBar({
  options = [],
  selectedId = "",
  onSelectOrigin,
  safeRoute = null,
  onClear,
}) {
  return (
    <section
      aria-label="Selector rápido ¿Dónde estoy en la UNT?"
      className="rounded-2xl border border-[#00B4D8]/35 bg-gradient-to-r from-[#F0F9FF] via-white to-[#ECFDF5]/60 p-4 shadow-panel dark:border-sky-800/80 dark:from-[#0B2545] dark:via-[#0E2D52] dark:to-[#0B2545]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B2545] text-[#38BDF8] shadow-sm dark:bg-[#0369A1] dark:text-white">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <label
              htmlFor="where-am-i-select"
              className="block text-sm font-extrabold text-[#0B2545] dark:text-white"
            >
              ¿En qué facultad o zona estás?
            </label>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Elige tu ubicación y trazaremos automáticamente tu ruta hacia el punto seguro más cercano.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[290px]">
          <select
            id="where-am-i-select"
            value={selectedId}
            onChange={(e) => onSelectOrigin?.(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0F172A] shadow-subtle focus:border-[#00B4D8] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Selecciona tu facultad o pabellón...</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.displayLabel}
              </option>
            ))}
          </select>

          {selectedId && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpiar ruta segura"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#475569] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {safeRoute && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-3.5 grid grid-cols-1 gap-3 rounded-xl border border-[#059669]/35 bg-white p-3.5 shadow-subtle dark:border-emerald-800/70 dark:bg-slate-900/80 md:grid-cols-12 md:items-center"
          >
            <div className="flex items-start gap-2.5 md:col-span-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-[#059669] dark:text-emerald-400">
                  Punto seguro destino
                </div>
                <div className="truncate text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {safeRoute.safePoint.name}
                </div>
                <div className="truncate text-xs text-[#475569] dark:text-slate-300">
                  Desde: {safeRoute.origin.name}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:col-span-3">
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-1.5 dark:bg-[#0B2545]">
                <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                  Distancia
                </div>
                <div className="font-mono text-sm font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                  ~{safeRoute.distanceM} m
                </div>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-1.5 dark:bg-[#0B2545]">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                  <Footprints className="h-3 w-3 text-[#0369A1]" />
                  <span>A pie</span>
                </div>
                <div className="font-mono text-sm font-extrabold text-[#059669] tabular-nums dark:text-emerald-400">
                  ~{safeRoute.walkMinutes} min
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs leading-snug text-[#0F172A] dark:text-slate-200 md:col-span-4">
              <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
              <span className="font-medium">{safeRoute.recommendation}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
