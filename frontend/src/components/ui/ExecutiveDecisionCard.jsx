import React, { useMemo } from "react";
import { Send, Map as MapIcon, Clock, AlertTriangle, ShieldCheck, CloudRain } from "lucide-react";

const SEMAPHORE_CONFIG = {
  green: {
    label: "VERDE",
    decision: "Operación presencial normal",
    sublabel: "Sin restricciones operativas previstas. Mantener seguimiento rutinario del pronóstico.",
    border: "border-emerald-300 dark:border-emerald-800",
    bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
    badge: "bg-emerald-600 text-white",
    dotColor: "bg-emerald-500 ring-4 ring-emerald-500/25",
  },
  amber: {
    label: "ÁMBAR",
    decision: "Vigilancia activa y resguardo preventivo de laboratorios/planta baja",
    sublabel: "Preparar transición remota, proteger equipos en primer nivel y monitorear accesos.",
    border: "border-amber-300 dark:border-amber-800",
    bg: "bg-amber-50/70 dark:bg-amber-950/30",
    badge: "bg-amber-500 text-slate-950",
    dotColor: "bg-amber-500 ring-4 ring-amber-500/25",
  },
  red: {
    label: "ROJO",
    decision: "Activar virtualidad preventiva, reprogramar laboratorios y restringir accesos críticos",
    sublabel: "Priorizar continuidad remota integral y coordinar con Defensa Civil UNT / COER La Libertad.",
    border: "border-rose-300 dark:border-rose-800",
    bg: "bg-rose-50/70 dark:bg-rose-950/30",
    badge: "bg-rose-600 text-white",
    dotColor: "bg-rose-600 ring-4 ring-rose-500/25",
  },
};

function resolveSemaphoreKey(liveEvaluation, hydroResult) {
  const level = liveEvaluation?.preventive_level || "INFORMATIVO";
  const hidRules = (hydroResult?.evaluation?.rules_triggered || []).map((r) => r.rule_id);

  if (level === "PREPARACION_CRITICA" || level === "ATENCION_PREVENTIVA") {
    return "red";
  }
  if (
    level === "VIGILANCIA_PREVENTIVA" ||
    hidRules.includes("R-HID-01") ||
    hidRules.includes("R-HID-03")
  ) {
    return "amber";
  }
  return "green";
}

function resolveCriticalWindow(weather, hydroResult) {
  const actionWindow = hydroResult?.evaluation?.action_windows?.[0];
  if (actionWindow?.time_label) {
    return `Ventana modelada: ${actionWindow.time_label} (simulación)`;
  }
  const next24 = weather?.hourly?.slice(0, 24) || [];
  if (!next24.length) return "Sin datos horarios";

  let peakRain = next24[0];
  let peakProb = next24[0];
  for (const pt of next24) {
    if ((pt.precipitation_mm ?? 0) > (peakRain.precipitation_mm ?? 0)) peakRain = pt;
    if ((pt.precipitation_probability_pct ?? -1) > (peakProb.precipitation_probability_pct ?? -1)) {
      peakProb = pt;
    }
  }
  if ((peakRain.precipitation_mm ?? 0) >= 0.1) {
    const hh = String(peakRain.time || "").slice(11, 16);
    return `Pico lluvia: ${hh} h (${peakRain.precipitation_mm} mm/h)`;
  }
  if ((peakProb.precipitation_probability_pct ?? 0) >= 40) {
    const hh = String(peakProb.time || "").slice(11, 16);
    return `Mayor prob.: ${hh} h (${peakProb.precipitation_probability_pct}%)`;
  }
  return "Sin ventana crítica en próximas 24 h";
}

function resolveTopPriorities(simResult, hydroResult) {
  const items = [];
  if (hydroResult?.elements?.length) {
    const affected = hydroResult.elements
      .filter((e) => e.first_hour_affected !== null && e.first_hour_affected !== undefined)
      .sort((a, b) => (b.max_depth_cm ?? 0) - (a.max_depth_cm ?? 0));
    for (const el of affected) {
      if (items.length >= 3) break;
      items.push(`${el.name} (${el.max_depth_cm} cm)`);
    }
  }
  if (items.length < 3 && simResult?.spatial_analysis) {
    const accs = (simResult.spatial_analysis.restricted_accesses || []).filter(
      (a) => a.inside_hazard_zone
    );
    for (const a of accs) {
      if (items.length >= 3) break;
      if (!items.some((x) => x.startsWith(a.name))) items.push(a.name);
    }
    const blds = (simResult.spatial_analysis.exposed_buildings || [])
      .filter((b) => b.overlap_pct >= 5)
      .sort((a, b) => b.overlap_pct - a.overlap_pct);
    for (const b of blds) {
      if (items.length >= 3) break;
      if (!items.some((x) => x.startsWith(b.name))) items.push(`${b.name} (${b.overlap_pct}%)`);
    }
  }
  if (items.length === 0) {
    return [
      "Puerta 4 (Av. Jesús de Nazareth)",
      "Centro de Idiomas — CIDUNT",
      "Puerta 3 y Comedor Universitario",
    ];
  }
  return items.slice(0, 3);
}

export default function ExecutiveDecisionCard({
  weather,
  liveEvaluation,
  simResult,
  hydroResult,
  onPrepareNotice,
  onOpenMap,
}) {
  const semaphoreKey = useMemo(
    () => resolveSemaphoreKey(liveEvaluation, hydroResult),
    [liveEvaluation, hydroResult]
  );
  const cfg = SEMAPHORE_CONFIG[semaphoreKey];

  const activeRuleIds = useMemo(() => {
    const met = (liveEvaluation?.rules_triggered || []).map((r) => r.rule_id);
    const hid = (hydroResult?.evaluation?.rules_triggered || []).map((r) => r.rule_id);
    return Array.from(new Set([...met, ...hid])).slice(0, 5);
  }, [liveEvaluation, hydroResult]);

  const criticalWindow = useMemo(
    () => resolveCriticalWindow(weather, hydroResult),
    [weather, hydroResult]
  );

  const topPriorities = useMemo(
    () => resolveTopPriorities(simResult, hydroResult),
    [simResult, hydroResult]
  );

  const maxProb24 =
    weather?.summary?.max_probability_24h_pct ?? weather?.summary?.max_probability_pct;
  const maxProb48 = weather?.summary?.max_probability_48h_pct;

  return (
    <section
      aria-label="Semáforo Ejecutivo para Directivos"
      className={`rounded-2xl border-2 p-4 shadow-sm sm:p-5 ${cfg.border} ${cfg.bg}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0B1F33] dark:text-blue-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#0B1F33] dark:text-slate-200">
            Semáforo Ejecutivo para Directivos · Gestión UNT / Municipal
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {activeRuleIds.length > 0 ? (
            activeRuleIds.map((id) => (
              <span
                key={id}
                className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#101828] ring-1 ring-slate-200 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-slate-700"
              >
                {id}
              </span>
            ))
          ) : (
            <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
              R-MET-00
            </span>
          )}
        </div>
      </div>

      {/* 3 bloques visuales de lectura rápida (<5 s) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        {/* Bloque 1: Semáforo de Decisión Académica y Operativa */}
        <div className="flex items-start gap-3.5 rounded-xl border border-white/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-[#0B1F33]/90 lg:col-span-5">
          {/* Indicador vertical de semáforo */}
          <div
            aria-hidden="true"
            className="flex shrink-0 flex-col items-center gap-1.5 rounded-full bg-slate-900 px-1.5 py-2 dark:bg-slate-950"
          >
            <span
              className={`h-3.5 w-3.5 rounded-full ${
                semaphoreKey === "red" ? cfg.dotColor : "bg-rose-950/70"
              }`}
            />
            <span
              className={`h-3.5 w-3.5 rounded-full ${
                semaphoreKey === "amber" ? cfg.dotColor : "bg-amber-950/70"
              }`}
            />
            <span
              className={`h-3.5 w-3.5 rounded-full ${
                semaphoreKey === "green" ? cfg.dotColor : "bg-emerald-950/70"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${cfg.badge}`}>
                SEMÁFORO {cfg.label}
              </span>
              <span className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
                Decisión sugerida
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-bold leading-snug text-[#101828] dark:text-white">
              {cfg.decision}
            </h3>
            <p className="mt-1 text-xs leading-snug text-[#475467] dark:text-slate-300">
              {cfg.sublabel}
            </p>
          </div>
        </div>

        {/* Bloque 2: Resumen de riesgo */}
        <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-white/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-[#0B1F33]/90 lg:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475467] dark:text-slate-300">
              <CloudRain className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Prob. máx. lluvia:</span>
              <span className="text-sm font-extrabold text-[#101828] tabular-nums dark:text-white">
                {maxProb24 !== null && maxProb24 !== undefined ? `${maxProb24}%` : "N/D"}
              </span>
              {maxProb48 !== null && maxProb48 !== undefined && (
                <span className="text-[11px] font-normal text-[#64748B] dark:text-slate-400">
                  (48 h: {maxProb48}%)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-[#101828] dark:text-slate-200">
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{criticalWindow}</span>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#475467] dark:text-slate-400">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span>Top 3 sectores / accesos prioritarios</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-[#101828] dark:text-slate-200">
              {topPriorities.map((item, idx) => (
                <li key={idx} className="truncate">
                  {idx + 1}. {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bloque 3: Acciones en 1 clic */}
        <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-white/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-[#0B1F33]/90 lg:col-span-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#475467] dark:text-slate-400">
            Acciones rápidas
          </div>
          <button
            type="button"
            onClick={onPrepareNotice}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1D4ED8]"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Preparar aviso institucional</span>
          </button>
          <button
            type="button"
            onClick={onOpenMap}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#0B1F33]/20 bg-[#0B1F33] px-3.5 text-xs font-bold text-white transition hover:bg-[#122C46] dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Ver mapa y rutas seguras</span>
          </button>
          <p className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
            Apoyo ejecutivo TRL 3–4; decisiones operativas requieren autorización UNT / SINAGERD.
          </p>
        </div>
      </div>
    </section>
  );
}
