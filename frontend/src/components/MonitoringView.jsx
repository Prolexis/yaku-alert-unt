import React, { useState } from "react";
import { motion } from "framer-motion";
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
  AlertTriangle,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";
import { formatLimaTime } from "../utils/formatters";

function PressureReferenceBar({ pressureHpa }) {
  if (pressureHpa === null || pressureHpa === undefined) return null;
  const minScale = 990;
  const maxScale = 1025;
  const threshold = 1000;
  const clamped = Math.max(minScale, Math.min(maxScale, pressureHpa));
  const pct = ((clamped - minScale) / (maxScale - minScale)) * 100;
  const thresholdPct = ((threshold - minScale) / (maxScale - minScale)) * 100;
  const isLow = pressureHpa < threshold;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
        <span>990</span>
        <span className={isLow ? "font-bold text-[#D97706]" : "font-semibold"}>
          1000 hPa
        </span>
        <span>1025</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {/* Zona de baja presión (<1000 hPa) */}
        <div
          className="absolute inset-y-0 left-0 bg-[#F59E0B]/30"
          style={{ width: `${thresholdPct}%` }}
        />
        {/* Marcador 1000 hPa */}
        <div
          className="absolute inset-y-0 w-0.5 bg-[#D97706]"
          style={{ left: `${thresholdPct}%` }}
        />
        {/* Indicador de lectura actual */}
        <motion.div
          initial={{ left: "50%" }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ${
            isLow ? "bg-[#DC2626]" : "bg-[#0369A1]"
          }`}
        />
      </div>
    </div>
  );
}

function WindCompass({ degrees }) {
  const angle = typeof degrees === "number" && !Number.isNaN(degrees) ? degrees : 0;
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-subtle dark:border-slate-700 dark:bg-slate-900"
      title={`Dirección del viento: ${angle}°`}
      aria-hidden="true"
    >
      <span className="absolute top-0.5 font-mono text-[9px] font-bold text-[#475569] dark:text-slate-400">
        N
      </span>
      <span className="absolute bottom-0.5 font-mono text-[9px] font-semibold text-slate-400">
        S
      </span>
      <span className="absolute left-1 font-mono text-[9px] font-semibold text-slate-400">
        O
      </span>
      <span className="absolute right-1 font-mono text-[9px] font-semibold text-slate-400">
        E
      </span>
      <motion.svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-[#0369A1] dark:text-[#38BDF8]"
        animate={{ rotate: angle }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <path
          d="M12 3L16.5 18L12 14.8L7.5 18L12 3Z"
          fill="currentColor"
        />
      </motion.svg>
    </div>
  );
}

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
      <div className="rounded-2xl border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B] dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="text-base font-bold">No se pudo cargar el monitoreo</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-bold text-white"
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
  const isLowPressure =
    summary.current_surface_pressure_hpa !== null &&
    summary.current_surface_pressure_hpa !== undefined &&
    summary.current_surface_pressure_hpa < 1000;

  return (
    <div className="space-y-6">
      {/* 1. Cabecera y controles */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
            Monitoreo Meteorológico y Sinóptico
          </h2>
          <p className="mt-1 text-sm text-[#475569] dark:text-slate-300" title={utc}>
            Pronóstico para Ciudad Universitaria UNT · Fuente: Open-Meteo ·{" "}
            <span className="font-mono tabular-nums">{local}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Ventana temporal"
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#0B2545]"
          >
            {[24, 48].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setWindowHours(hrs)}
                aria-pressed={windowHours === hrs}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                  windowHours === hrs
                    ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                    : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300"
                }`}
              >
                {hrs}h
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleOffline(!forceOffline)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition ${
              forceOffline
                ? "border-[#D97706]/40 bg-[#FFFBEB] text-[#B45309] dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                : "border-slate-200 bg-white text-[#0F172A] hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-200"
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            {forceOffline ? "Respaldo Offline" : "Modo offline"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-bold text-white transition hover:bg-[#0369A1] disabled:opacity-50 dark:bg-[#0369A1]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* 2. Indicadores principales */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricWithTooltip
          label="Intensidad máxima"
          value={`${summary.max_intensity_mm_h} ${units.precipitation || "mm"}/h`}
          tooltip="Cantidad máxima de lluvia prevista en una sola hora. <2 mm/h es lluvia ligera."
        />
        <MetricWithTooltip
          label={`Acumulado (${windowHours}h)`}
          value={`${
            windowHours === 24 ? summary.accumulated_24h_mm : summary.accumulated_48h_mm
          } ${units.precipitation || "mm"}`}
          tooltip="Suma total de agua prevista en el periodo seleccionado."
        />
        <MetricWithTooltip
          label={`Probabilidad máx. (${windowHours}h)`}
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

      {/* 2b. Variables sinópticas visuales (instrumentos de campo anti-falsas alarmas) */}
      <section
        aria-label="Variables sinópticas locales"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              Variables sinópticas locales
            </h3>
            <p className="text-xs font-medium text-[#475569] dark:text-slate-300">
              Indicadores complementarios de campo para evitar falsas alarmas ·{" "}
              {summary.forecast_confidence_label || "Pronóstico probabilístico 48 h — Open-Meteo"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Presión atmosférica con barra de referencia 1000 hPa */}
          <div
            className={`rounded-xl border p-4 transition ${
              isLowPressure
                ? "border-[#D97706]/45 bg-[#FFFBEB]/70 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-slate-200/90 bg-[#F8FAFC] dark:border-slate-700/80 dark:bg-slate-900/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#475569] dark:text-slate-300">
                <Gauge className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
                <span>Presión atmosférica</span>
              </div>
              {isLowPressure && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#D97706] px-2 py-0.5 text-xs font-bold text-white">
                  <AlertTriangle className="h-3 w-3" /> Baja
                </span>
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-[#0F172A] tabular-nums dark:text-white">
                {summary.current_surface_pressure_hpa !== null &&
                summary.current_surface_pressure_hpa !== undefined
                  ? summary.current_surface_pressure_hpa
                  : "N/D"}
              </span>
              <span className="font-mono text-xs font-bold text-[#475569] dark:text-slate-300">
                {units.surface_pressure || "hPa"}
              </span>
              {summary.min_surface_pressure_24h_hpa !== null &&
                summary.min_surface_pressure_24h_hpa !== undefined && (
                  <span className="ml-auto font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
                    mín. {summary.min_surface_pressure_24h_hpa}
                  </span>
                )}
            </div>

            <PressureReferenceBar pressureHpa={summary.current_surface_pressure_hpa} />

            <p className="mt-2.5 text-xs leading-snug text-[#475569] dark:text-slate-300">
              Caída por debajo de{" "}
              <strong className="font-mono text-[#0F172A] dark:text-white">1000 hPa</strong> con
              calma de viento eleva la probabilidad local de lluvia.
            </p>
          </div>

          {/* Viento (10 m) con brújula SVG rotada dinámicamente */}
          <div className="rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 dark:border-slate-700/80 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-xs font-bold text-[#475569] dark:text-slate-300">
              <Wind className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
              <span>Viento (10 m)</span>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-extrabold text-[#0F172A] tabular-nums dark:text-white">
                    {summary.current_wind_speed_kmh !== null &&
                    summary.current_wind_speed_kmh !== undefined
                      ? summary.current_wind_speed_kmh
                      : "N/D"}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#475569] dark:text-slate-300">
                    {units.wind_speed_10m || "km/h"}
                  </span>
                </div>
                {summary.current_wind_direction_cardinal && (
                  <span className="mt-1.5 inline-flex items-center rounded-md bg-[#F0F9FF] px-2 py-0.5 font-mono text-xs font-bold text-[#0369A1] ring-1 ring-[#0284C7]/25 dark:bg-sky-950/70 dark:text-sky-200">
                    {summary.current_wind_direction_cardinal}
                    {summary.current_wind_direction_deg !== null &&
                    summary.current_wind_direction_deg !== undefined
                      ? ` · ${summary.current_wind_direction_deg}°`
                      : ""}
                  </span>
                )}
              </div>

              <WindCompass degrees={summary.current_wind_direction_deg} />
            </div>

            <p className="mt-2.5 text-xs leading-snug text-[#475569] dark:text-slate-300">
              Brisa costera habitual del S/SO en Trujillo; vientos en calma junto a baja presión
              requieren vigilancia.
            </p>
          </div>

          {/* Sensación térmica */}
          <div className="rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 dark:border-slate-700/80 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 text-xs font-bold text-[#475569] dark:text-slate-300">
              <Thermometer className="h-4 w-4 text-[#D97706]" />
              <span>Sensación térmica</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-[#0F172A] tabular-nums dark:text-white">
                {summary.current_apparent_temperature_c !== null &&
                summary.current_apparent_temperature_c !== undefined
                  ? summary.current_apparent_temperature_c
                  : "N/D"}
              </span>
              <span className="font-mono text-xs font-bold text-[#475569] dark:text-slate-300">
                {units.apparent_temperature || "°C"}
              </span>
              {hourly?.[0]?.temperature_2m_c !== null &&
                hourly?.[0]?.temperature_2m_c !== undefined && (
                  <span className="ml-auto font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
                    aire {hourly[0].temperature_2m_c}°C
                  </span>
                )}
            </div>
            <p className="mt-3 text-xs leading-snug text-[#475569] dark:text-slate-300">
              Bochorno combinado con alta humedad relativa suele preceder episodios convectivos
              costeros durante verano o FEN.
            </p>
          </div>

          {/* Tarjeta referencial TSM — ENFEN */}
          <div className="flex flex-col justify-between rounded-xl border border-[#00B4D8]/35 bg-[#F0F9FF]/75 p-4 dark:border-cyan-900/70 dark:bg-cyan-950/30">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#0369A1] dark:text-[#38BDF8]">
                <Waves className="h-4 w-4" />
                <span>TSM — ENFEN (Referencial)</span>
              </div>
              <div className="mt-2 text-sm font-extrabold text-[#0F172A] dark:text-white">
                Temperatura Superficial del Mar
              </div>
              <p className="mt-1.5 text-xs leading-snug text-[#475569] dark:text-slate-300">
                El calentamiento costero (región Niño 1+2) es monitoreado oficialmente por ENFEN
                como indicador clave del Fenómeno El Niño.
              </p>
            </div>
            <a
              href="https://enfen.imarpe.gob.pe/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
            >
              <span>Consultar comunicado ENFEN</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* 3. Gráfico horario */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
        <h3 className="mb-3 text-lg font-extrabold text-[#0F172A] dark:text-white">
          Pronóstico horario ({windowHours} horas)
        </h3>
        <PrecipitationChart points={sliced} height={235} />
      </div>

      {/* 4. Tabla detallada desplegable */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-bold text-[#0F172A] dark:text-white">
            Tabla horaria detallada y limitaciones ({tableRows.length} registros)
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#475569] transition-transform ${tableOpen ? "rotate-180" : ""}`}
          />
        </button>

        {tableOpen && (
          <div className="space-y-4 border-t border-slate-200 p-5 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] dark:text-slate-300">
              <span className="font-mono tabular-nums">
                Coordenadas: {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)} ·
                Pronóstico numérico, no estación local.
              </span>
              <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#0F172A] dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={onlyRainHours}
                  onChange={(e) => setOnlyRainHours(e.target.checked)}
                  className="rounded accent-[#0369A1]"
                />
                Solo horas con lluvia (≥0.1 mm)
              </label>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#F8FAFC] text-xs uppercase text-[#475569] dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Hora</th>
                    <th className="px-4 py-2.5 font-bold">Lluvia</th>
                    <th className="px-4 py-2.5 font-bold">Prob.</th>
                    <th className="px-4 py-2.5 font-bold">Presión</th>
                    <th className="px-4 py-2.5 font-bold">Humedad</th>
                    <th className="px-4 py-2.5 font-bold">Viento</th>
                    <th className="px-4 py-2.5 font-bold">Temp. / Sens.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-xs dark:divide-slate-800">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center font-sans text-sm text-[#475569]"
                      >
                        Sin horas con precipitación ≥0.1 mm en este periodo.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((pt) => (
                      <tr
                        key={pt.time}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-slate-900/50"
                      >
                        <td className="px-4 py-2.5 font-semibold text-[#0F172A] tabular-nums dark:text-slate-200">
                          {pt.time.replace("T", " ")}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                          {pt.precipitation_mm.toFixed(1)} {units.precipitation}
                        </td>
                        <td className="px-4 py-2.5 text-[#475569] tabular-nums dark:text-slate-300">
                          {pt.precipitation_probability_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2.5 text-[#475569] tabular-nums dark:text-slate-300">
                          {pt.surface_pressure_hpa !== null && pt.surface_pressure_hpa !== undefined
                            ? `${pt.surface_pressure_hpa} hPa`
                            : "N/D"}
                        </td>
                        <td className="px-4 py-2.5 text-[#475569] tabular-nums dark:text-slate-300">
                          {pt.relative_humidity_2m_pct ?? "N/D"}%
                        </td>
                        <td className="px-4 py-2.5 text-[#475569] tabular-nums dark:text-slate-300">
                          {pt.wind_speed_10m_kmh ?? "N/D"} km/h
                          {pt.wind_direction_cardinal ? ` · ${pt.wind_direction_cardinal}` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-[#475569] tabular-nums dark:text-slate-300">
                          {pt.temperature_2m_c ?? "N/D"} °C
                          {pt.apparent_temperature_c !== null &&
                          pt.apparent_temperature_c !== undefined
                            ? ` (${pt.apparent_temperature_c}°)`
                            : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <ul className="list-disc space-y-1 pl-5 text-xs text-[#475569] dark:text-slate-300">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
      <div className="flex items-center justify-between gap-1 text-xs font-bold text-[#475569] dark:text-slate-300">
        <span>{label}</span>
        <span
          title={tooltip}
          aria-label={tooltip}
          className="cursor-help text-[#475569] hover:text-[#0369A1]"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 font-mono text-2xl font-extrabold text-[#0F172A] tabular-nums dark:text-white sm:text-3xl">
        {value}
      </div>
    </div>
  );
}
