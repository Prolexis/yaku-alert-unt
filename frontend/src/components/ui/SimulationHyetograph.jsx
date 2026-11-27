import React from "react";
import { CloudRain, Droplets } from "lucide-react";

/**
 * Hietograma horario real (mm/h) sincronizado hora por hora con la simulación.
 * Permite visualizar cómo el pico de lluvia genera el desborde con retardo físico real.
 */
export default function SimulationHyetograph({
  rainfallSeries = [],
  frames = [],
  activeHour = 1,
  onSelectHour,
  compact = false,
}) {
  const rain = rainfallSeries.length
    ? rainfallSeries
    : frames.map((f) => Number(f.rain_mm ?? f.precipitation_mm ?? 0));

  if (!rain.length) return null;

  const depths = frames.map((f) => Number(f.max_depth_cm ?? 0));
  const maxRain = Math.max(1, ...rain);
  const maxDepth = Math.max(1, ...depths);

  const rainPeakIdx = rain.indexOf(Math.max(...rain));
  const depthPeakIdx = depths.length ? depths.indexOf(Math.max(...depths)) : -1;
  const lagHours =
    rainPeakIdx >= 0 && depthPeakIdx >= rainPeakIdx ? depthPeakIdx - rainPeakIdx : 0;

  const currentRain = Number(rain[Math.min(Math.max(activeHour - 1, 0), rain.length - 1)] || 0);
  const currentDepth = Number(
    depths[Math.min(Math.max(activeHour - 1, 0), Math.max(depths.length - 1, 0))] || 0
  );

  // Mostrar ventana útil si hay 48h con muchos ceros al final, o todas si <= 24h
  const lastNonZeroRain = rain.reduce((acc, v, i) => (v > 0 ? i : acc), 0);
  const visibleLen = Math.min(
    rain.length,
    Math.max(12, Math.min(24, Math.max(activeHour + 2, lastNonZeroRain + 8)))
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700/80 dark:bg-[#0B2545]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B2545] dark:text-white">
          <CloudRain className="h-3.5 w-3.5 text-[#0284C7]" />
          <span>Hietograma horario (mm/h) vs. lámina (cm)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
          <span className="rounded-md bg-[#F0F9FF] px-2 py-0.5 font-bold text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
            h+{activeHour}: {currentRain.toFixed(1)} mm/h
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Droplets className="h-3 w-3" />
            {currentDepth.toFixed(1)} cm
          </span>
          {lagHours > 0 && (
            <span className="text-[10px] font-semibold text-[#475569] dark:text-slate-300">
              Retardo pico: +{lagHours} h
            </span>
          )}
        </div>
      </div>

      <div
        className={`flex items-end gap-1 ${compact ? "h-16" : "h-20"} w-full rounded-lg bg-[#F8FAFC] px-1.5 pb-1 pt-2 dark:bg-slate-900/70`}
        role="group"
        aria-label="Hietograma horario interactivo"
      >
        {rain.slice(0, visibleLen).map((val, idx) => {
          const hr = idx + 1;
          const rainPct = Math.max(val > 0 ? 10 : 3, Math.round((val / maxRain) * 100));
          const depthVal = depths[idx] || 0;
          const depthPct = Math.max(depthVal > 0 ? 8 : 0, Math.round((depthVal / maxDepth) * 100));
          const isCurrent = hr === activeHour;
          return (
            <button
              key={hr}
              type="button"
              onClick={() => onSelectHour?.(hr)}
              title={`Hora ${hr}: lluvia ${val.toFixed(1)} mm/h · lámina máx. ${depthVal.toFixed(1)} cm`}
              className={`group relative flex h-full flex-1 flex-col items-center justify-end rounded-sm transition ${
                isCurrent ? "bg-[#00B4D8]/15 ring-1 ring-[#0284C7]" : "hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              {/* Indicador de lámina acumulada (punto ámbar/azul superior) */}
              {depthPct > 0 && (
                <span
                  className="pointer-events-none absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#D97706]"
                  style={{ bottom: `${Math.min(92, depthPct)}%` }}
                />
              )}
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isCurrent
                    ? "bg-[#0284C7]"
                    : val > 0
                    ? "bg-[#38BDF8]/80 group-hover:bg-[#0284C7]"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
                style={{ height: `${rainPct}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-[#475569] dark:text-slate-400">
        <span>h+1</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[#38BDF8]" /> Lluvia (mm/h)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#D97706]" /> Lámina máx. (cm)
          </span>
        </span>
        <span>h+{visibleLen}</span>
      </div>
    </div>
  );
}
