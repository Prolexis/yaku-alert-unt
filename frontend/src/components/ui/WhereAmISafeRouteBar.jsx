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
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
            <Compass className="h-4.5 w-4.5" />
          </span>
          <div>
            <label
              htmlFor="where-am-i-select"
              className="block text-sm font-bold text-[#0F172A] dark:text-white"
            >
              ¿En qué facultad o pabellón estás?
            </label>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-300">
              Elige tu ubicación para trazar la ruta hacia la zona alta más cercana.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2">
          <select
            id="where-am-i-select"
            value={selectedId}
            onChange={(e) => onSelectOrigin?.(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] outline-none transition focus:border-[#0369A1] focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#475569] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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
            className="mt-3.5 space-y-2.5 rounded-xl border border-emerald-200/90 bg-[#ECFDF5]/55 p-3.5 dark:border-emerald-800/70 dark:bg-emerald-950/35"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Punto seguro más cercano
                </div>
                <div className="break-words text-sm font-bold leading-snug text-[#0F172A] dark:text-white">
                  {safeRoute.safePoint.name}
                </div>
                <div className="mt-0.5 break-words text-[11px] text-[#64748B] dark:text-slate-300">
                  Desde {safeRoute.origin.name}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#0F172A] ring-1 ring-emerald-200/80 tabular-nums dark:bg-slate-900 dark:text-white dark:ring-emerald-800">
                ~{safeRoute.distanceM} m
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/80 tabular-nums dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-800">
                <Footprints className="h-3.5 w-3.5" />
                <span>~{safeRoute.walkMinutes} min a pie</span>
              </span>
            </div>

            <div className="flex items-start gap-2 border-t border-emerald-200/70 pt-2 text-xs leading-relaxed text-[#334155] dark:border-emerald-800/60 dark:text-slate-200">
              <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>{safeRoute.recommendation}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
