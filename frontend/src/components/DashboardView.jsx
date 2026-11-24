import React from "react";
import {
  CloudRain,
  Droplets,
  Clock,
  Gauge,
  ArrowRight,
  Map as MapIcon,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";

export default function DashboardView({
  weather,
  weatherLoading,
  weatherError,
  liveEvaluation,
  simResult,
  onNavigate,
  onRefresh,
}) {
  if (weatherLoading && !weather) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (weatherError && !weather) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <div className="flex items-center gap-2 text-base font-semibold">
          <AlertCircle className="h-5 w-5" />
          No se pudo obtener el pronóstico meteorológico
        </div>
        <p className="mt-1 text-sm">{weatherError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  const summary = weather?.summary;
  const units = weather?.units || {};
  const next24 = weather?.hourly?.slice(0, 24) || [];
  const isLive = weather?.data_status === "LIVE_API";

  return (
    <div className="space-y-8">
      {/* Zona superior editorial */}
      <section className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 lg:flex-row lg:items-end">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] dark:text-blue-400">
            {isLive ? "Fuente: Open-Meteo Forecast API" : "Fuente: Caché Local Verificada"} ·{" "}
            {weather?.latitude?.toFixed(4)}, {weather?.longitude?.toFixed(4)}
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Centro de Monitoreo Preventivo — UNT
          </h2>
          <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-[#64748B] dark:text-slate-300">
            Seguimiento horario de precipitación, análisis espacial con Shapely y orientaciones
            preventivas explicables para la Ciudad Universitaria.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("map")}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-subtle transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0B1F33] dark:text-white dark:hover:bg-slate-800"
          >
            <MapIcon className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />
            Mapa UNT
          </button>
          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-subtle transition hover:bg-[#1D4ED8]"
          >
            <Sliders className="h-4 w-4" />
            Abrir Simulador
          </button>
        </div>
      </section>

      {/* Primera sección: 4 KPIs meteorológicos */}
      {summary && (
        <section
          aria-label="Indicadores meteorológicos clave"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            icon={<CloudRain className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />}
            label="Intensidad máxima (24h)"
            value={summary.max_intensity_mm_h}
            unit={`${units.precipitation}/h`}
            hint="Pronóstico horario numérico"
          />
          <KpiCard
            icon={<Droplets className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />}
            label="Acumulado previsto (24h)"
            value={summary.accumulated_24h_mm}
            unit={units.precipitation}
            hint={`Acumulado 48h: ${summary.accumulated_48h_mm} ${units.precipitation}`}
          />
          <KpiCard
            icon={<Clock className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />}
            label="Horas con lluvia (≥0.1 mm)"
            value={summary.estimated_event_duration_h}
            unit="horas"
            hint="Ventana próximas 24 horas"
          />
          <KpiCard
            icon={<Gauge className="h-4 w-4 text-[#1D4ED8] dark:text-blue-400" />}
            label="Probabilidad máx. / Humedad"
            value={`${summary.max_probability_pct ?? "N/D"}%`}
            unit={`· ${summary.avg_humidity_pct ?? "N/D"}% hum.`}
            hint="Prob. lluvia ≠ prob. huaico"
          />
        </section>
      )}

      {/* Segunda sección: Gráfica 24h protagonista */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#111827] dark:text-white">
              Evolución Horaria de Precipitación (24 horas)
            </h3>
            <p className="text-sm text-[#64748B] dark:text-slate-400">
              Intensidad estimada en mm/h y probabilidad porcentual de ocurrencia
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("monitoring")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
          >
            Ver monitoreo detallado <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <PrecipitationChart points={next24} height={260} />
      </section>

      {/* Tercera sección: Resumen preventivo y accesos rápidos */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#111827] dark:text-white">
              <ShieldCheck className="h-5 w-5 text-[#1D4ED8] dark:text-blue-400" />
              Estado Preventivo Actual
            </h3>
            {liveEvaluation && (
              <span
                className="rounded-md px-2.5 py-1 text-xs font-bold text-slate-950"
                style={{ backgroundColor: liveEvaluation.level_color }}
              >
                {liveEvaluation.preventive_level}
              </span>
            )}
          </div>

          {liveEvaluation ? (
            <div className="mt-4 space-y-4">
              <p className="text-base font-semibold text-[#111827] dark:text-white">
                {liveEvaluation.level_label}
              </p>
              <p className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 text-sm text-[#64748B] dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                {liveEvaluation.hazard_assessment}
              </p>
              <ul className="space-y-2 text-sm text-[#111827] dark:text-slate-200">
                {liveEvaluation.guidance.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#64748B]">Cargando evaluación preventiva...</p>
          )}
        </div>

        {/* Accesos rápidos al Mapa y Análisis */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#111827] dark:text-white">
              Accesos de Análisis y Respuesta
            </h3>
            <p className="text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              {simResult
                ? `Último escenario calculado (${simResult.simulation_id}): ${simResult.spatial_analysis.total_exposed_buildings} edificios y ${simResult.spatial_analysis.total_restricted_accesses} accesos intersectan la zona simulada.`
                : "Ejecute una simulación espacial o consulte la ficha preventiva explicable."}
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate("prevention")}
              className="flex w-full items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <span>Inspeccionar Ficha Preventiva Explicable</span>
              <ArrowRight className="h-4 w-4 text-[#2563EB]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("map")}
              className="flex w-full items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <span>Explorar Capas en Mapa Interactivo UNT</span>
              <ArrowRight className="h-4 w-4 text-[#2563EB]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("continuity")}
              className="flex w-full items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <span>Consultar Protocolos y Continuidad Académica</span>
              <ArrowRight className="h-4 w-4 text-[#2563EB]" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ icon, label, value, unit, hint }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle transition hover:shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-[#111827] tabular-nums dark:text-white">
          {value}
        </span>
        <span className="text-sm font-semibold text-[#64748B] dark:text-slate-400">{unit}</span>
      </div>
      <div className="mt-1.5 text-xs text-[#64748B] dark:text-slate-400">{hint}</div>
    </div>
  );
}
