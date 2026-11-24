import React, { useState } from "react";
import {
  CloudRain,
  Clock,
  ArrowRight,
  Map as MapIcon,
  ShieldCheck,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Info,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";

function buildHumanWeatherHeadline(summary) {
  if (!summary) return "Consultando las condiciones meteorológicas para la UNT...";
  const acc = summary.accumulated_24h_mm ?? 0;
  const maxI = summary.max_intensity_mm_h ?? 0;

  if (acc < 0.5 && maxI < 0.5) {
    return "No se prevé precipitación acumulada significativa durante las próximas 24 horas.";
  }
  if (maxI >= 10 || acc >= 20) {
    return "Se pronostican lluvias de intensidad moderada a fuerte en las próximas 24 horas.";
  }
  return "Se prevén lluvias ligeras o intermitentes durante las próximas 24 horas.";
}

export default function DashboardView({
  weather,
  weatherLoading,
  weatherError,
  liveEvaluation,
  simResult,
  onNavigate,
  onRefresh,
}) {
  const [techOpen, setTechOpen] = useState(false);

  if (weatherLoading && !weather) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={3} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (weatherError && !weather) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <div className="flex items-center gap-2 text-base font-semibold">
          <AlertCircle className="h-5 w-5" />
          No pudimos consultar el pronóstico en este momento
        </div>
        <p className="mt-1 text-sm">{weatherError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Intentar nuevamente
        </button>
      </div>
    );
  }

  const summary = weather?.summary;
  const units = weather?.units || {};
  const next24 = weather?.hourly?.slice(0, 24) || [];
  const isLive = weather?.data_status === "LIVE_API";
  const headline = buildHumanWeatherHeadline(summary);
  const updatedText = weather?.fetched_at_utc
    ? weather.fetched_at_utc.slice(0, 16).replace("T", " ") + " UTC"
    : "Reciente";

  return (
    <div className="space-y-6">
      {/* 1. Resumen claro de lo que está pasando y qué significa para ti */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2563EB] dark:text-blue-400">
              <span>{isLive ? "Información real (Open-Meteo)" : "Respaldo local sin internet"}</span>
              <span className="text-[#64748B] dark:text-slate-400">· Actualizado: {updatedText}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
              {headline}
            </h2>
            <p className="max-w-3xl text-[15px] leading-relaxed text-[#64748B] dark:text-slate-300">
              Este resumen describe únicamente el pronóstico de lluvia para la Ciudad Universitaria
              UNT. No descarta otros riesgos ni reemplaza los avisos oficiales de Defensa Civil o
              SENAMHI.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate("map")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
            >
              <MapIcon className="h-4 w-4" />
              Ver mapa de la UNT
            </button>
            <button
              type="button"
              onClick={() => onNavigate("continuity")}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <BookOpen className="h-4 w-4 text-[#2563EB]" />
              Qué hacer y canales
            </button>
          </div>
        </div>
      </section>

      {/* 2. Información esencial en lenguaje sencillo */}
      {summary && (
        <section
          aria-label="Resumen de condiciones para la comunidad"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
              <CloudRain className="h-4 w-4 text-[#2563EB]" />
              Lluvia prevista (24 horas)
            </div>
            <div className="mt-2.5 text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
              {summary.accumulated_24h_mm} {units.precipitation} acumulados
            </div>
            <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
              Pico máximo estimado: {summary.max_intensity_mm_h} {units.precipitation}/h
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
              <Clock className="h-4 w-4 text-[#2563EB]" />
              Duración estimada
            </div>
            <div className="mt-2.5 text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
              {summary.estimated_event_duration_h} horas con lluvia
            </div>
            <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
              Probabilidad máx. de lluvia: {summary.max_probability_pct ?? "N/D"}%
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                Estado informativo
              </span>
              {liveEvaluation && (
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold text-slate-950"
                  style={{ backgroundColor: liveEvaluation.level_color }}
                >
                  {liveEvaluation.preventive_level}
                </span>
              )}
            </div>
            <div className="mt-2.5 text-lg font-bold text-[#111827] dark:text-white">
              {liveEvaluation?.level_label || "Evaluando..."}
            </div>
            <button
              type="button"
              onClick={() => onNavigate("prevention")}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
            >
              Entender este resultado <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* 3. Gráfica fácil de interpretar */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#111827] dark:text-white">
              ¿Cómo evolucionará la lluvia en las próximas 24 horas?
            </h3>
            <p className="text-sm text-[#64748B] dark:text-slate-400">
              Las barras indican cuánta lluvia caerá por hora y la línea verde la probabilidad.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("monitoring")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
          >
            Ver detalle completo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <PrecipitationChart points={next24} height={240} />
      </section>

      {/* 4. Orientaciones rápidas + Simulador */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-7">
          <h3 className="text-base font-bold text-[#111827] dark:text-white">
            ¿Qué puedo hacer preventivamente hoy?
          </h3>
          {liveEvaluation ? (
            <ul className="mt-3 space-y-2.5 text-sm text-[#111827] dark:text-slate-200">
              {liveEvaluation.guidance.map((g, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#64748B]">Cargando orientaciones...</p>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
          <div>
            <h3 className="text-base font-bold text-[#111827] dark:text-white">
              ¿Quieres ensayar un escenario de lluvia fuerte?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              Usa el simulador educativo offline para ver qué pabellones y accesos de la UNT
              quedarían expuestos si ocurriera una lluvia intensa (datos sintéticos).
            </p>
            {simResult && (
              <p className="mt-2 text-xs font-medium text-[#64748B] dark:text-slate-400">
                Último ensayo: {simResult.spatial_analysis.total_exposed_buildings} edificios en zona
                simulada.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#122C46] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
          >
            Probar Simulador Educativo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* 5. Divulgación progresiva: Detalles técnicos secundarios */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
        <button
          type="button"
          onClick={() => setTechOpen((v) => !v)}
          aria-expanded={techOpen}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold text-[#64748B] hover:text-[#111827] dark:text-slate-300 dark:hover:text-white"
        >
          <span className="inline-flex items-center gap-2">
            <Info className="h-4 w-4 text-[#2563EB]" />
            Detalles técnicos de la fuente y ubicación (para especialistas)
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${techOpen ? "rotate-180" : ""}`} />
        </button>
        {techOpen && (
          <div className="border-t border-[#E2E8F0] px-5 py-4 text-xs leading-relaxed text-[#64748B] dark:border-slate-800 dark:text-slate-400">
            <p>
              <strong>Fuente:</strong> {weather?.source_name} ({weather?.source_url}) ·{" "}
              <strong>Coordenadas UNT:</strong> {weather?.latitude}, {weather?.longitude} ·{" "}
              <strong>Zona horaria:</strong> {weather?.timezone}
            </p>
            <p className="mt-1">
              <strong>Naturaleza de datos:</strong> {weather?.data_nature} —{" "}
              {weather?.observation_vs_forecast}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
