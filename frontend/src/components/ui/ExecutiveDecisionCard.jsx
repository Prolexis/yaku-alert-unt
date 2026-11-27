import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Map as MapIcon,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CloudRain,
} from "lucide-react";

const SEMAPHORE_CONFIG = {
  green: {
    label: "VERDE",
    decision: "Operación normal",
    sublabel:
      "Sin restricciones operativas previstas en el campus. Mantener vigilancia rutinaria del pronóstico.",
    border: "border-[#059669]/35 dark:border-emerald-800",
    bg: "bg-[#ECFDF5]/75 dark:bg-emerald-950/25",
    badge: "bg-[#059669] text-white",
    dotColor: "bg-[#059669]",
    pulseColor: "bg-[#059669]",
    shouldPulse: false,
  },
  amber: {
    label: "ÁMBAR",
    decision: "Vigilancia y resguardo",
    sublabel:
      "Resguardar laboratorios en planta baja, preparar transición remota y monitorear accesos.",
    border: "border-[#D97706]/40 dark:border-amber-700",
    bg: "bg-[#FFFBEB]/85 dark:bg-amber-950/30",
    badge: "bg-[#D97706] text-white",
    dotColor: "bg-[#F59E0B]",
    pulseColor: "bg-[#F59E0B]",
    shouldPulse: true,
  },
  red: {
    label: "ROJO",
    decision: "Activar virtualidad y cerrar accesos",
    sublabel:
      "Reprogramar laboratorios, restringir accesos críticos y coordinar con Defensa Civil UNT / COER.",
    border: "border-[#DC2626]/40 dark:border-red-700",
    bg: "bg-[#FEF2F2]/85 dark:bg-red-950/30",
    badge: "bg-[#DC2626] text-white",
    dotColor: "bg-[#DC2626]",
    pulseColor: "bg-[#DC2626]",
    shouldPulse: true,
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

function TrafficLightDot({ active, colorClass, pulseClass, shouldPulse, offClass }) {
  return (
    <span className="relative flex h-4 w-4 items-center justify-center">
      {active && shouldPulse && (
        <motion.span
          animate={{ scale: [1, 1.8, 1], opacity: [0.65, 0, 0.65] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute inline-flex h-full w-full rounded-full ${pulseClass}`}
        />
      )}
      <span
        className={`relative inline-flex h-3.5 w-3.5 rounded-full transition-colors ${
          active ? `${colorClass} shadow-sm` : offClass
        }`}
      />
    </span>
  );
}

export default function ExecutiveDecisionCard({
  weather,
  liveEvaluation,
  simResult,
  hydroResult,
  activeAlerts = [],
  activeDemoRole = "directivo",
  onPrepareNotice,
  onOpenMap,
  onOpenContinuity,
  onOpenHydro,
}) {
  const isDirectivo = activeDemoRole === "directivo";
  const confirmationCounts = useMemo(() => {
    const counts = { estudiante: 0, docente: 0, administrativo: 0, total: 0 };
    (activeAlerts || []).forEach((a) => {
      if (a.status !== "emitida") return;
      const byRole = a.confirmations?.by_role || {};
      counts.estudiante += Number(byRole.estudiante?.total || 0);
      counts.docente += Number(byRole.docente?.total || 0);
      counts.administrativo += Number(byRole.administrativo?.total || 0);
      counts.total += Number(a.confirmations?.total || 0);
    });
    return counts;
  }, [activeAlerts]);
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
      className={`rounded-2xl border p-4 shadow-panel sm:p-5 ${cfg.border} ${cfg.bg}`}
    >
      {/* Cabecera ejecutiva */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0B2545] text-white dark:bg-[#0369A1]">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-slate-100">
            {isDirectivo
              ? "Semáforo Ejecutivo · Decisión Directivo UNT"
              : "Panel Operativo · Operador de Gestión de Riesgos"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeRuleIds.length > 0 ? (
            activeRuleIds.map((id) => (
              <span
                key={id}
                className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#0F172A] shadow-subtle ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
              >
                {id}
              </span>
            ))
          ) : (
            <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#475569] shadow-subtle ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              R-MET-00
            </span>
          )}
        </div>
      </div>

      {/* 3 bloques de lectura en < 3 segundos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        {/* Bloque 1: Semáforo luminoso + recomendación directa */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-700/80 dark:bg-[#0B2545]/95 lg:col-span-5">
          <div
            aria-hidden="true"
            className="flex shrink-0 flex-col items-center gap-2 rounded-full bg-[#0B2545] px-2 py-2.5 shadow-inner ring-1 ring-slate-700 dark:bg-[#071524]"
          >
            <TrafficLightDot
              active={semaphoreKey === "red"}
              colorClass={cfg.dotColor}
              pulseClass={cfg.pulseColor}
              shouldPulse={cfg.shouldPulse}
              offClass="bg-red-950/80"
            />
            <TrafficLightDot
              active={semaphoreKey === "amber"}
              colorClass={cfg.dotColor}
              pulseClass={cfg.pulseColor}
              shouldPulse={cfg.shouldPulse}
              offClass="bg-amber-950/80"
            />
            <TrafficLightDot
              active={semaphoreKey === "green"}
              colorClass={cfg.dotColor}
              pulseClass={cfg.pulseColor}
              shouldPulse={false}
              offClass="bg-emerald-950/80"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2.5 py-0.5 text-xs font-extrabold tracking-wide ${cfg.badge}`}>
                SEMÁFORO {cfg.label}
              </span>
              <span className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                Decisión sugerida
              </span>
            </div>
            <h3 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight text-[#0F172A] dark:text-white">
              {cfg.decision}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              {cfg.sublabel}
            </p>
          </div>
        </div>

        {/* Bloque 2: Probabilidad máxima + ventana + Top 3 prioritarios */}
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-700/80 dark:bg-[#0B2545]/95 lg:col-span-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
                <CloudRain className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                  Prob. máx. lluvia
                </div>
                {maxProb48 !== null && maxProb48 !== undefined && (
                  <div className="font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
                    48 h: {maxProb48}%
                  </div>
                )}
              </div>
            </div>
            <div className="font-mono text-2xl font-extrabold text-[#0B2545] tabular-nums dark:text-white">
              {maxProb24 !== null && maxProb24 !== undefined ? `${maxProb24}%` : "N/D"}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100">
            <Clock className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span className="tabular-nums">{criticalWindow}</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#475569] dark:text-slate-300">
              <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
              <span>Top 3 sectores / accesos prioritarios</span>
            </div>
            <ul className="mt-1.5 space-y-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">
              {topPriorities.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 truncate">
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-xs font-bold text-[#0B2545] dark:bg-slate-800 dark:text-[#38BDF8]">
                    {idx + 1}
                  </span>
                  <span className="truncate">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bloque 3: Acciones en 1 clic */}
        <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-700/80 dark:bg-[#0B2545]/95 lg:col-span-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
            {isDirectivo ? "Decisiones Directivo" : "Operación Técnica"}
          </div>
          <div className="space-y-2">
            {isDirectivo ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onPrepareNotice}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1] dark:hover:bg-[#00B4D8]"
                >
                  <Send className="h-4 w-4" />
                  <span>Validar alertas CAP / WhatsApp</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onOpenContinuity || onOpenMap}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#0369A1]/35 bg-[#F0F9FF] px-3.5 text-xs font-bold text-[#0369A1] transition hover:bg-[#E0F2FE] dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/60"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Registrar medida de continuidad</span>
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onOpenHydro || onPrepareNotice}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#059669] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <CloudRain className="h-4 w-4" />
                  <span>Abrir Simulación en vivo (10 m)</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onOpenMap}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#0369A1]/35 bg-[#F0F9FF] px-3.5 text-xs font-bold text-[#0369A1] transition hover:bg-[#E0F2FE] dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/60"
                >
                  <MapIcon className="h-4 w-4" />
                  <span>Mapa técnico + YAKU SENSE</span>
                </motion.button>
              </>
            )}
          </div>
          <p className="text-xs leading-snug text-[#475569] dark:text-slate-400">
            Apoyo ejecutivo TRL 3–4; medidas oficiales requieren validación UNT / SINAGERD.
          </p>
        </div>
      </div>

      {/* Contador en vivo de confirmaciones de recepción segmentado por perfil */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs dark:border-slate-700/80 dark:bg-[#0B2545]/90">
        <span className="font-extrabold text-[#0B2545] dark:text-white">
          Confirmaciones CAP en vivo ({confirmationCounts.total}):
        </span>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          <span className="rounded-lg bg-[#F0F9FF] px-2.5 py-0.5 font-bold text-[#0369A1] dark:bg-sky-950 dark:text-sky-300">
            Estudiantes: {confirmationCounts.estudiante}
          </span>
          <span className="rounded-lg bg-[#ECFDF5] px-2.5 py-0.5 font-bold text-[#059669] dark:bg-emerald-950 dark:text-emerald-300">
            Docentes: {confirmationCounts.docente}
          </span>
          <span className="rounded-lg bg-[#FFFBEB] px-2.5 py-0.5 font-bold text-[#B45309] dark:bg-amber-950 dark:text-amber-300">
            Administrativos: {confirmationCounts.administrativo}
          </span>
        </div>
      </div>
    </section>
  );
}
