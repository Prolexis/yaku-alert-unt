import React, { useState } from "react";
import { CloudRain, Droplets, Clock, Wind, Thermometer, Info, WifiOff, RefreshCw } from "lucide-react";
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
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="font-semibold">No se pudo cargar el monitoreo meteorológico</p>
        <p className="mt-1 text-xs">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
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

  return (
    <div className="space-y-6">
      {/* Cabecera de Fuente y Control Offline */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33] md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
              {weather.location_name}
            </h2>
            <span className="rounded-md bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB] dark:text-sky-300">
              {weather.data_status === "LIVE_API" ? "Pronóstico Open-Meteo" : "Caché Offline"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            Lat: {weather.latitude.toFixed(4)} · Lon: {weather.longitude.toFixed(4)} ·{" "}
            {weather.observation_vs_forecast}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onToggleOffline(!forceOffline)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              forceOffline
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            {forceOffline ? "Caché offline activada" : "Simular sin conexión"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MiniStat
          icon={<CloudRain className="h-4 w-4 text-[#2563EB]" />}
          label="Intensidad máx."
          value={`${summary.max_intensity_mm_h} ${units.precipitation}/h`}
        />
        <MiniStat
          icon={<Droplets className="h-4 w-4 text-[#14B8A6]" />}
          label="Acumulado 24h"
          value={`${summary.accumulated_24h_mm} ${units.precipitation}`}
        />
        <MiniStat
          icon={<Droplets className="h-4 w-4 text-indigo-500" />}
          label="Acumulado 48h"
          value={`${summary.accumulated_48h_mm} ${units.precipitation}`}
        />
        <MiniStat
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label="Duración evento"
          value={`${summary.estimated_event_duration_h} h`}
        />
        <MiniStat
          icon={<Info className="h-4 w-4 text-emerald-500" />}
          label="Prob. máx. / Humedad"
          value={`${summary.max_probability_pct ?? "N/D"}% / ${summary.avg_humidity_pct ?? "N/D"}%`}
        />
      </div>

      {/* Gráfica con selector 24h / 48h */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Serie horaria de precipitación y probabilidad
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Fuente: {weather.source_name} · Actualizado: {weather.fetched_at_utc}
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-slate-700 dark:bg-slate-900">
            {[24, 48].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setWindowHours(hrs)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  windowHours === hrs
                    ? "bg-[#2563EB] text-white"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {hrs}h
              </button>
            ))}
          </div>
        </div>
        <PrecipitationChart points={sliced} height={235} />
      </div>

      {/* Tabla detallada */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
            Detalle horario ({tableRows.length} registros)
          </h3>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#64748B] dark:text-slate-300">
            <input
              type="checkbox"
              checked={onlyRainHours}
              onChange={(e) => setOnlyRainHours(e.target.checked)}
              className="rounded accent-[#2563EB]"
            />
            Mostrar solo horas con precipitación (≥0.1 mm)
          </label>
        </div>

        <div className="max-h-72 overflow-auto rounded-xl border border-[#E2E8F0] dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#F8FAFC] text-[#64748B] dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Fecha y hora</th>
                <th className="px-4 py-2.5 font-semibold">Precipitación</th>
                <th className="px-4 py-2.5 font-semibold">Probabilidad</th>
                <th className="px-4 py-2.5 font-semibold">Humedad</th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Wind className="h-3.5 w-3.5" /> Viento
                  </span>
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5" /> Temp.
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#64748B]">
                    Sin horas con precipitación ≥0.1 mm en la ventana seleccionada.
                  </td>
                </tr>
              ) : (
                tableRows.map((pt) => (
                  <tr key={pt.time} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-900/50">
                    <td className="px-4 py-2 font-medium text-[#0F172A] dark:text-slate-200">
                      {pt.time.replace("T", " ")}
                    </td>
                    <td className="px-4 py-2 font-semibold text-[#2563EB] dark:text-sky-400">
                      {pt.precipitation_mm.toFixed(1)} {units.precipitation}
                    </td>
                    <td className="px-4 py-2 text-[#64748B] dark:text-slate-300">
                      {pt.precipitation_probability_pct ?? "N/D"}%
                    </td>
                    <td className="px-4 py-2 text-[#64748B] dark:text-slate-300">
                      {pt.relative_humidity_2m_pct ?? "N/D"}%
                    </td>
                    <td className="px-4 py-2 text-[#64748B] dark:text-slate-300">
                      {pt.wind_speed_10m_kmh ?? "N/D"} km/h
                    </td>
                    <td className="px-4 py-2 text-[#64748B] dark:text-slate-300">
                      {pt.temperature_2m_c ?? "N/D"} °C
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limitaciones */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-xs dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="font-semibold text-[#0F172A] dark:text-white">
          Trazabilidad y limitaciones científicas
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[#64748B] dark:text-slate-400">
          {weather.limitations.map((lim, i) => (
            <li key={i}>{lim}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
      <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-lg font-bold text-[#0F172A] dark:text-white">{value}</div>
    </div>
  );
}
