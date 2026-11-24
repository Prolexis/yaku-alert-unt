import React, { useState } from "react";
import { ArrowRight, Map as MapIcon, BookOpen, Sliders, AlertCircle, Info } from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";
import { formatLimaTime, humanPreventiveTitle } from "../utils/formatters";

function buildWeatherPhrase(summary) {
  if (!summary) return "Consultando condiciones para la Ciudad Universitaria UNT...";
  const acc = summary.accumulated_24h_mm ?? 0;
  const maxI = summary.max_intensity_mm_h ?? 0;
  if (acc < 0.5 && maxI < 0.5) {
    return "No se prevén acumulados significativos en las próximas 24 horas.";
  }
  if (maxI >= 10 || acc >= 20) {
    return "Se pronostican lluvias moderadas a fuertes en las próximas 24 horas.";
  }
  return "Se prevén lluvias ligeras o intermitentes en las próximas 24 horas.";
}

export default function DashboardView({
  weather,
  weatherLoading,
  weatherError,
  liveEvaluation,
  onNavigate,
  onRefresh,
}) {
  const [limitsOpen, setLimitsOpen] = useState(false);

  if (weatherLoading && !weather) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (weatherError && !weather) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <div className="flex items-center gap-2 text-base font-semibold">
          <AlertCircle className="h-5 w-5" />
          No se pudo obtener el pronóstico
        </div>
        <p className="mt-1 text-sm">{weatherError}</p>
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

  const summary = weather?.summary;
  const units = weather?.units || {};
  const next24 = weather?.hourly?.slice(0, 24) || [];
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);
  const statusTitle = liveEvaluation
    ? humanPreventiveTitle(liveEvaluation.preventive_level, false).split(" — ")[0]
    : "Evaluando";

  return (
    <div className="space-y-7">
      {/* 1. Resumen meteorológico */}
      <section className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
          Condiciones en la UNT
        </h2>
        <p className="text-base text-[#475467] dark:text-slate-300">
          {buildWeatherPhrase(summary)}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475467] dark:text-slate-400">
          <span title={utc}>
            Fuente: Open-Meteo · Pronóstico, no medición local · {local}
          </span>
          <button
            type="button"
            onClick={() => setLimitsOpen((v) => !v)}
            className="inline-flex items-center gap-1 font-medium text-[#2563EB] hover:underline dark:text-blue-400"
          >
            <Info className="h-3.5 w-3.5" />
            {limitsOpen ? "Ocultar limitaciones" : "Ver limitaciones"}
          </button>
        </div>

        {limitsOpen && weather?.limitations && (
          <ul className="mt-2 list-disc space-y-1 rounded-lg border border-[#E2E8F0] bg-white px-6 py-3 text-xs text-[#475467] dark:border-slate-800 dark:bg-[#0B1F33] dark:text-slate-300">
            {weather.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Indicadores principales compactos */}
      {summary && (
        <section
          aria-label="Indicadores principales"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Lluvia acumulada (24h)"
            value={`${summary.accumulated_24h_mm}`}
            unit={units.precipitation}
            note={`48h: ${summary.accumulated_48h_mm} ${units.precipitation}`}
          />
          <KpiCard
            label="Intensidad prevista"
            value={`${summary.max_intensity_mm_h}`}
            unit={`${units.precipitation}/h`}
            note="Pico horario máximo"
          />
          <KpiCard
            label="Probabilidad de lluvia"
            value={`${summary.max_probability_pct ?? "N/D"}`}
            unit="%"
            note="Chance de ≥0.1 mm en 1h"
          />
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="text-xs font-medium text-[#475467] dark:text-slate-400">
              Estado informativo
            </div>
            <div className="mt-2 flex items-center gap-2">
              {liveEvaluation && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: liveEvaluation.level_color }}
                />
              )}
              <span className="text-lg font-bold text-[#101828] dark:text-white">
                {statusTitle}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("prevention")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline dark:text-blue-400"
            >
              Ver ficha explicable <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>
      )}

      {/* 3. Evolución del pronóstico */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-[#101828] dark:text-white">
            Evolución próximas 24 horas
          </h3>
          <button
            type="button"
            onClick={() => onNavigate("monitoring")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
          >
            Monitoreo 24h / 48h <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <PrecipitationChart points={next24} height={200} />
      </section>

      {/* 4. Acciones claras */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionLink
          icon={<MapIcon className="h-4 w-4 text-[#2563EB]" />}
          title="Ver mapa del campus"
          desc="Ubica facultades, accesos y puntos referenciales."
          onClick={() => onNavigate("map")}
        />
        <ActionLink
          icon={<BookOpen className="h-4 w-4 text-[#2563EB]" />}
          title="Consultar orientaciones"
          desc="Medidas antes, durante y después de lluvias."
          onClick={() => onNavigate("continuity")}
        />
        <ActionLink
          icon={<Sliders className="h-4 w-4 text-[#2563EB]" />}
          title="Explorar simulaciones"
          desc="Ensaya escenarios sintéticos sin conexión."
          onClick={() => onNavigate("simulator")}
        />
      </section>
    </div>
  );
}

function KpiCard({ label, value, unit, note }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
      <div className="text-xs font-medium text-[#475467] dark:text-slate-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-[#101828] tabular-nums dark:text-white">
          {value}
        </span>
        <span className="text-sm font-medium text-[#475467] dark:text-slate-400">{unit}</span>
      </div>
      <div className="mt-1 text-xs text-[#475467] dark:text-slate-400">{note}</div>
    </div>
  );
}

function ActionLink({ icon, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5 text-left transition hover:border-[#2563EB] dark:border-slate-800 dark:bg-[#0B1F33] dark:hover:border-blue-500"
    >
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#101828] dark:text-white">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-1 text-xs text-[#475467] dark:text-slate-400">{desc}</p>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#475467] transition group-hover:translate-x-0.5 group-hover:text-[#2563EB] dark:text-slate-400" />
    </button>
  );
}
