import React, { useState } from "react";
import {
  WifiOff,
  RefreshCw,
  ChevronDown,
  HelpCircle,
  Gauge,
  Wind,
  Thermometer,
  Waves,
  ExternalLink,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";
import { formatLimaTime } from "../utils/formatters";

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
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-base font-semibold">No se pudo cargar el monitoreo</p>
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
  const { local, utc } = formatLimaTime(weather.fetched_at_utc);

  return (
    <div className="space-y-6">
      {/* 1. Pronóstico principal y controles */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Monitoreo Meteorológico
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400" title={utc}>
            Pronóstico para Ciudad Universitaria UNT · Fuente: Open-Meteo · {local}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Ventana temporal"
            className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1 dark:border-slate-700 dark:bg-[#0B1F33]"
          >
            {[24, 48].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setWindowHours(hrs)}
                aria-pressed={windowHours === hrs}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  windowHours === hrs
                    ? "bg-[#2563EB] text-white"
                    : "text-[#475467] hover:text-[#101828] dark:text-slate-300"
                }`}
              >
                {hrs}h
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleOffline(!forceOffline)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${
              forceOffline
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                : "border-[#E2E8F0] bg-white text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-200"
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            {forceOffline ? "Caché activa" : "Modo offline"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-3.5 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* 2. Indicadores relevantes con tooltips explicativos */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricWithTooltip
          label="Intensidad máxima"
          value={`${summary.max_intensity_mm_h} ${units.precipitation}/h`}
          tooltip="Cantidad máxima de lluvia prevista en una sola hora. <2 mm/h es lluvia ligera."
        />
        <MetricWithTooltip
          label={`Acumulado (${windowHours}h)`}
          value={`${windowHours === 24 ? summary.accumulated_24h_mm : summary.accumulated_48h_mm} ${units.precipitation}`}
          tooltip="Suma total de agua prevista en el periodo seleccionado."
        />
        <MetricWithTooltip
          label={`Probabilidad máxima (${windowHours}h)`}
          value={`${
            windowHours === 24
              ? summary.max_probability_24h_pct ?? summary.max_probability_pct ?? "N/D"
              : summary.max_probability_48h_pct ?? summary.max_probability_pct ?? "N/D"
          }%`}
          tooltip="Probabilidad horaria de precipitación ≥0.1 mm (modelo probabilístico Open-Meteo). No equivale a confirmación determinista de lluvia ni de activación de quebradas."
        />
        <MetricWithTooltip
          label="Humedad promedio"
          value={`${summary.avg_humidity_pct ?? "N/D"}%`}
          tooltip={`Horas con lluvia ≥0.1 mm en 24h: ${summary.estimated_event_duration_h} h.`}
        />
      </div>

      {/* 2b. Variables sinópticas locales (referencia de campo anti-falsas alarmas) */}
      <section
        aria-label="Variables sinópticas locales"
        className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#101828] dark:text-white">
              Variables sinópticas locales
            </h3>
            <p className="text-xs text-[#475467] dark:text-slate-400">
              Indicadores complementarios de campo para reducir falsas alarmas ·{" "}
              {summary.forecast_confidence_label || "Pronóstico probabilístico 48 h — Open-Meteo"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Presión atmosférica */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475467] dark:text-slate-300">
              <Gauge className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Presión atmosférica</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#101828] tabular-nums dark:text-white">
                {summary.current_surface_pressure_hpa !== null &&
                summary.current_surface_pressure_hpa !== undefined
                  ? `${summary.current_surface_pressure_hpa} ${units.surface_pressure || "hPa"}`
                  : "N/D"}
              </span>
              {summary.min_surface_pressure_24h_hpa !== null &&
                summary.min_surface_pressure_24h_hpa !== undefined && (
                  <span className="text-[11px] text-[#64748B] tabular-nums dark:text-slate-400">
                    mín. 24h: {summary.min_surface_pressure_24h_hpa} hPa
                  </span>
                )}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#475467] dark:text-slate-400">
              Referencia local: una caída por debajo de{" "}
              <strong className="text-[#101828] dark:text-slate-200">1000 hPa</strong> con calma de
              viento se asocia localmente a mayor probabilidad de lluvia.
            </p>
          </div>

          {/* Velocidad y dirección del viento */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475467] dark:text-slate-300">
              <Wind className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Viento (10 m)</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#101828] tabular-nums dark:text-white">
                {summary.current_wind_speed_kmh !== null &&
                summary.current_wind_speed_kmh !== undefined
                  ? `${summary.current_wind_speed_kmh} ${units.wind_speed_10m || "km/h"}`
                  : "N/D"}
              </span>
              {summary.current_wind_direction_cardinal && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                  {summary.current_wind_direction_cardinal}
                  {summary.current_wind_direction_deg !== null &&
                  summary.current_wind_direction_deg !== undefined
                    ? ` (${summary.current_wind_direction_deg}°)`
                    : ""}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#475467] dark:text-slate-400">
              Brisa costera habitual del sector S/SO en Trujillo; vientos en calma junto a baja
              presión requieren mayor vigilancia.
            </p>
          </div>

          {/* Sensación térmica */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475467] dark:text-slate-300">
              <Thermometer className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Sensación térmica</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#101828] tabular-nums dark:text-white">
                {summary.current_apparent_temperature_c !== null &&
                summary.current_apparent_temperature_c !== undefined
                  ? `${summary.current_apparent_temperature_c} ${units.apparent_temperature || "°C"}`
                  : "N/D"}
              </span>
              {hourly?.[0]?.temperature_2m_c !== null && hourly?.[0]?.temperature_2m_c !== undefined && (
                <span className="text-[11px] text-[#64748B] tabular-nums dark:text-slate-400">
                  aire: {hourly[0].temperature_2m_c} °C
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#475467] dark:text-slate-400">
              Bochorno combinado con alta humedad relativa suele preceder episodios convectivos
              costeros durante verano o FEN.
            </p>
          </div>

          {/* Tarjeta referencial TSM — ENFEN */}
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3.5 dark:border-cyan-900/60 dark:bg-cyan-950/25">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-900 dark:text-cyan-200">
              <Waves className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
              <span>TSM — ENFEN (Referencial)</span>
            </div>
            <div className="mt-1.5 text-sm font-bold text-[#101828] dark:text-white">
              Temperatura Superficial del Mar
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#475467] dark:text-slate-300">
              El calentamiento costero (región Niño 1+2) es monitoreado oficialmente por el ENFEN
              como indicador clave del Fenómeno El Niño.
            </p>
            <a
              href="https://enfen.imarpe.gob.pe/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 hover:underline dark:text-cyan-300"
            >
              <span>Consultar comunicado ENFEN</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* 3. Gráfico */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
        <h3 className="mb-3 text-lg font-semibold text-[#101828] dark:text-white">
          Pronóstico horario ({windowHours} horas)
        </h3>
        <PrecipitationChart points={sliced} height={220} />
      </div>

      {/* 4. Tabla detallada desplegable */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33]">
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-[#101828] dark:text-white">
            Tabla horaria detallada y limitaciones ({tableRows.length} registros)
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#475467] transition-transform ${tableOpen ? "rotate-180" : ""}`}
          />
        </button>

        {tableOpen && (
          <div className="space-y-4 border-t border-[#E2E8F0] p-5 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475467] dark:text-slate-400">
              <span>
                Coordenadas: {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)} ·
                Pronóstico numérico, no estación local.
              </span>
              <label className="flex cursor-pointer items-center gap-2 font-medium text-[#101828] dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={onlyRainHours}
                  onChange={(e) => setOnlyRainHours(e.target.checked)}
                  className="rounded accent-[#2563EB]"
                />
                Solo horas con lluvia (≥0.1 mm)
              </label>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-[#E2E8F0] dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#F7F9FC] text-xs uppercase text-[#475467] dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Hora</th>
                    <th className="px-4 py-2.5 font-semibold">Lluvia</th>
                    <th className="px-4 py-2.5 font-semibold">Prob.</th>
                    <th className="px-4 py-2.5 font-semibold">Presión</th>
                    <th className="px-4 py-2.5 font-semibold">Humedad</th>
                    <th className="px-4 py-2.5 font-semibold">Viento</th>
                    <th className="px-4 py-2.5 font-semibold">Temp. / Sens.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#475467]">
                        Sin horas con precipitación ≥0.1 mm en este periodo.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((pt) => (
                      <tr key={pt.time} className="hover:bg-[#F7F9FC] dark:hover:bg-slate-900/50">
                        <td className="px-4 py-2 font-medium text-[#101828] tabular-nums dark:text-slate-200">
                          {pt.time.replace("T", " ")}
                        </td>
                        <td className="px-4 py-2 font-semibold text-[#2563EB] tabular-nums dark:text-blue-400">
                          {pt.precipitation_mm.toFixed(1)} {units.precipitation}
                        </td>
                        <td className="px-4 py-2 text-[#475467] tabular-nums dark:text-slate-300">
                          {pt.precipitation_probability_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2 text-[#475467] tabular-nums dark:text-slate-300">
                          {pt.surface_pressure_hpa !== null && pt.surface_pressure_hpa !== undefined
                            ? `${pt.surface_pressure_hpa} hPa`
                            : "N/D"}
                        </td>
                        <td className="px-4 py-2 text-[#475467] tabular-nums dark:text-slate-300">
                          {pt.relative_humidity_2m_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2 text-[#475467] tabular-nums dark:text-slate-300">
                          {pt.wind_speed_10m_kmh ?? "N/D"} km/h
                          {pt.wind_direction_cardinal ? ` · ${pt.wind_direction_cardinal}` : ""}
                        </td>
                        <td className="px-4 py-2 text-[#475467] tabular-nums dark:text-slate-300">
                          {pt.temperature_2m_c ?? "N/D"} °C
                          {pt.apparent_temperature_c !== null && pt.apparent_temperature_c !== undefined
                            ? ` (${pt.apparent_temperature_c}°)`
                            : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <ul className="list-disc space-y-1 pl-5 text-xs text-[#475467] dark:text-slate-400">
              {weather.limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricWithTooltip({ label, value, tooltip }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
      <div className="flex items-center justify-between gap-1 text-xs font-medium text-[#475467] dark:text-slate-400">
        <span>{label}</span>
        <span title={tooltip} aria-label={tooltip} className="cursor-help text-[#475467] hover:text-[#2563EB]">
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-[#101828] tabular-nums dark:text-white sm:text-3xl">
        {value}
      </div>
    </div>
  );
}
