import React, { useState } from "react";
import {
  CloudRain,
  Droplets,
  Clock,
  Wind,
  Thermometer,
  Info,
  WifiOff,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";

export default function MonitoringView({
  weather,
  loading,
  error,
  forceOffline,
  onToggleOffline,
  onRefresh,
}) {
  const [windowHours, setWindowHours] = useState(24);
  const [onlyRainHours, setOnlyRainHours] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  if (loading && !weather) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-base font-semibold">No se pudo cargar el monitoreo meteorológico</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!weather) return null;

  const { summary, hourly, units } = weather;
  const sliced = hourly.slice(0, windowHours);
  const tableRows = onlyRainHours ? sliced.filter((h) => h.precipitation_mm >= 0.1) : sliced;
  const isLive = weather.data_status === "LIVE_API" && !forceOffline;

  return (
    <div className="space-y-6">
      {/* Encabezado humano */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 md:flex-row md:items-end">
        <div>
          <span
            className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
              isLive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
            }`}
          >
            {isLive ? "Pronóstico en línea (Open-Meteo)" : "Caché local sin internet"}
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Pronóstico del Tiempo en la UNT
          </h2>
          <p className="mt-1 text-[15px] text-[#64748B] dark:text-slate-300">
            {weather.observation_vs_forecast}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onToggleOffline(!forceOffline)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
              forceOffline
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                : "border-[#E2E8F0] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-200"
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            {forceOffline ? "Usando caché offline" : "Probar modo sin internet"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Guía breve para entender los datos (Human-Centered) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#2563EB]">
            <CloudRain className="h-4 w-4" />
            Intensidad ({summary.max_intensity_mm_h} {units.precipitation}/h máx.)
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
            Indica qué tan fuerte caería la lluvia en una sola hora. Valores menores a 2 mm/h suelen
            ser garúas o lluvias ligeras.
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0F766E] dark:text-teal-400">
            <Droplets className="h-4 w-4" />
            Acumulado ({summary.accumulated_24h_mm} {units.precipitation} en 24h)
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
            Es la suma total de agua que caería durante todo el día (48h:{" "}
            {summary.accumulated_48h_mm} {units.precipitation}).
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#111827] dark:text-white">
            <Clock className="h-4 w-4 text-amber-500" />
            Probabilidad ({summary.max_probability_pct ?? "N/D"}% máx.)
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
            Es la chance de que caiga al menos 0.1 mm de lluvia. No significa que vaya a ocurrir un
            huaico o inundación.
          </p>
        </div>
      </div>

      {/* Gráfica con control segmentado */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#111827] dark:text-white">
              Pronóstico por horas
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Fuente: {weather.source_name} · Actualizado: {weather.fetched_at_utc}
            </p>
          </div>
          <div
            role="group"
            aria-label="Ventana temporal del pronóstico"
            className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] p-1 dark:border-slate-700 dark:bg-slate-900"
          >
            {[24, 48].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setWindowHours(hrs)}
                aria-pressed={windowHours === hrs}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  windowHours === hrs
                    ? "bg-white text-[#111827] shadow-subtle dark:bg-[#2563EB] dark:text-white"
                    : "text-[#64748B] hover:text-[#111827] dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {hrs} horas
              </button>
            ))}
          </div>
        </div>
        <PrecipitationChart points={sliced} height={240} />
      </div>

      {/* Divulgación progresiva: Tabla horaria completa y detalles técnicos */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div>
            <div className="text-base font-bold text-[#111827] dark:text-white">
              Registro horario completo ({tableRows.length} horas)
            </div>
            <div className="text-xs text-[#64748B] dark:text-slate-400">
              Despliegue para consultar valores exactos de lluvia, humedad, viento y temperatura
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-[#64748B] transition-transform ${tableOpen ? "rotate-180" : ""}`}
          />
        </button>

        {tableOpen && (
          <div className="border-t border-[#E2E8F0] p-6 pt-4 dark:border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#64748B] dark:text-slate-400">
                Coordenadas: {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)} · Humedad
                promedio: {summary.avg_humidity_pct ?? "N/D"}%
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#111827] dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyRainHours}
                  onChange={(e) => setOnlyRainHours(e.target.checked)}
                  className="rounded accent-[#2563EB]"
                />
                Solo horas con lluvia (≥0.1 mm)
              </label>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border border-[#E2E8F0] dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#F6F8FC] text-xs uppercase tracking-wide text-[#64748B] dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                    <th className="px-4 py-3 font-semibold">Precipitación</th>
                    <th className="px-4 py-3 font-semibold">Probabilidad</th>
                    <th className="px-4 py-3 font-semibold">Humedad</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Wind className="h-3.5 w-3.5" /> Viento
                      </span>
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5" /> Temp.
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#64748B]">
                        Sin horas con precipitación ≥0.1 mm en esta ventana.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((pt) => (
                      <tr key={pt.time} className="hover:bg-[#F6F8FC] dark:hover:bg-slate-900/50">
                        <td className="px-4 py-2.5 font-medium text-[#111827] tabular-nums dark:text-slate-200">
                          {pt.time.replace("T", " ")}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[#2563EB] tabular-nums dark:text-blue-400">
                          {pt.precipitation_mm.toFixed(1)} {units.precipitation}
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums dark:text-slate-300">
                          {pt.precipitation_probability_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums dark:text-slate-300">
                          {pt.relative_humidity_2m_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums dark:text-slate-300">
                          {pt.wind_speed_10m_kmh ?? "N/D"} km/h
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B] tabular-nums dark:text-slate-300">
                          {pt.temperature_2m_c ?? "N/D"} °C
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Limitaciones */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 text-xs leading-relaxed text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33] dark:text-slate-400">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-white">
          <Info className="h-4 w-4 text-[#2563EB]" />
          ¿Qué debes tener en cuenta sobre estos datos?
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {weather.limitations.map((lim, i) => (
            <li key={i}>{lim}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
