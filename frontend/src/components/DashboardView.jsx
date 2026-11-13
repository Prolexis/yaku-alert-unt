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
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Error al cargar el panel principal
        </div>
        <p className="mt-1 text-sm">{weatherError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  const summary = weather?.summary;
  const units = weather?.units || {};
  const next24 = weather?.hourly?.slice(0, 24) || [];

  return (
    <div className="space-y-6">
      {/* Encabezado de bienvenida */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-card dark:border-slate-800 dark:bg-[#0B1F33] lg:flex-row lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-semibold text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-sky-300">
            Monitoreo y Prevención Explicable · UNT
          </span>
          <h2 className="mt-2.5 text-xl font-bold tracking-tight text-[#0F172A] dark:text-white sm:text-2xl">
            Estado preventivo de la Ciudad Universitaria
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#64748B] dark:text-slate-300">
            Integración en tiempo real de pronóstico horario Open-Meteo, análisis espacial con Shapely
            y orientaciones preventivas transparentes para la comunidad universitaria.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("map")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F172A] shadow-soft transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            <MapIcon className="h-4 w-4 text-[#2563EB]" />
            Explorar Mapa
          </button>
          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:bg-[#1D4ED8]"
          >
            <Sliders className="h-4 w-4" />
            Abrir Simulador
          </button>
        </div>
      </section>

      {/* KPIs meteorológicos */}
      {summary && (
        <section aria-label="Indicadores meteorológicos clave" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<CloudRain className="h-5 w-5 text-[#2563EB]" />}
            label="Intensidad máxima (24h)"
            value={`${summary.max_intensity_mm_h} ${units.precipitation}/h`}
            hint="Pronóstico numérico horario"
          />
          <KpiCard
            icon={<Droplets className="h-5 w-5 text-[#14B8A6]" />}
            label="Acumulado previsto (24h)"
            value={`${summary.accumulated_24h_mm} ${units.precipitation}`}
            hint={`48h: ${summary.accumulated_48h_mm} ${units.precipitation}`}
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            label="Horas con lluvia (≥0.1 mm)"
            value={`${summary.estimated_event_duration_h} h`}
            hint="Ventana próximas 24 horas"
          />
          <KpiCard
            icon={<Gauge className="h-5 w-5 text-indigo-500" />}
            label="Probabilidad máx. / Humedad"
            value={`${summary.max_probability_pct ?? "N/D"}% · ${summary.avg_humidity_pct ?? "N/D"}%`}
            hint="Prob. lluvia ≠ prob. huaico"
          />
        </section>
      )}

      {/* Gráfica + Estado Preventivo */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                Evolución horaria de precipitación (24h)
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Pase el cursor sobre cada barra para inspeccionar valores exactos
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("monitoring")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline dark:text-tealbrand-400"
            >
              Detalle completo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <PrecipitationChart points={next24} height={220} />
        </div>

        {/* Estado Preventivo Actual */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                <ShieldCheck className="h-4 w-4 text-[#14B8A6]" />
                Condición Preventiva Actual (Pronóstico)
              </h3>
              {liveEvaluation && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-950"
                  style={{ backgroundColor: liveEvaluation.level_color }}
                >
                  {liveEvaluation.preventive_level}
                </span>
              )}
            </div>

            {liveEvaluation ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  {liveEvaluation.level_label}
                </p>
                <p className="rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#64748B] dark:bg-slate-900/70 dark:text-slate-300">
                  {liveEvaluation.hazard_assessment}
                </p>

                <div>
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    Orientaciones clave:
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-[#64748B] dark:text-slate-300">
                    {liveEvaluation.guidance.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14B8A6]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#64748B]">Cargando evaluación preventiva...</p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
            <span className="text-[11px] text-[#64748B] dark:text-slate-400">
              {simResult
                ? `Última simulación: ${simResult.spatial_analysis.total_exposed_buildings} edificios expuestos`
                : "Motor explicable listo"}
            </span>
            <button
              type="button"
              onClick={() => onNavigate("prevention")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline dark:text-tealbrand-400"
            >
              Ver ficha explicable <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-150 hover:shadow-card dark:border-slate-800 dark:bg-[#0B1F33]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748B] dark:text-slate-400">{label}</span>
        <div className="rounded-xl bg-[#F8FAFC] p-2 dark:bg-slate-800">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">{hint}</div>
    </div>
  );
}
