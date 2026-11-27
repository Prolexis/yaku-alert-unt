import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Sparkles,
  ArrowRight,
  CloudRain,
  Database,
  FlaskConical,
  Radio,
  CheckCircle2,
} from "lucide-react";

const RULE_ACTION_MAP = {
  "R-MET-01": "Mantener operación normal y seguimiento preventivo del pronóstico 48 h.",
  "R-MET-02": "Activar vigilancia de drenajes y recordar rutas seguras a estudiantes y brigadas.",
  "R-MET-03": "Preparar transición a virtualidad preventiva y resguardar equipos en planta baja.",
  "R-HID-01": "Restringir o desviar tránsito en accesos comprometidos (Puerta 4 / Puerta 3).",
  "R-HID-02": "Priorizar rutas alternas hacia puntos seguros elevados y señalizar sectores bajos.",
  "R-HID-03": "Resguardar laboratorios, archivos y equipos eléctricos en primeros niveles.",
  "R-HID-04": "Activar protocolo de continuidad remota y coordinación directa con Defensa Civil UNT / COER.",
};

function getRecommendedAction(rule) {
  if (!rule) return "Seguir orientaciones preventivas y comunicados oficiales UNT / SENAMHI.";
  const exact = RULE_ACTION_MAP[rule.rule_id];
  if (exact) return exact;
  if (String(rule.rule_id || "").startsWith("R-HID")) {
    return "Evitar sectores con acumulación modelada y priorizar rutas hacia puntos seguros.";
  }
  if (String(rule.rule_id || "").startsWith("R-MET")) {
    return "Monitorear evolución horaria y preparar medidas preventivas académicas.";
  }
  return "Verificar comunicados oficiales de Defensa Civil UNT, SENAMHI y COER La Libertad.";
}

export default function ExplainabilityStrip({
  evaluation,
  hydroEvaluation,
  weather,
  evalSourceMode = "live",
  hasVirtualSensors = false,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const combinedRules = useMemo(() => {
    const met = evaluation?.rules_triggered || [];
    const hid = hydroEvaluation?.rules_triggered || [];
    const seen = new Set();
    const out = [];
    for (const r of [...met, ...hid]) {
      if (!r?.rule_id || seen.has(r.rule_id)) continue;
      seen.add(r.rule_id);
      out.push(r);
    }
    return out;
  }, [evaluation, hydroEvaluation]);

  const sourceBadges = useMemo(() => {
    const badges = [];
    const isOffline = weather?.data_status && weather.data_status !== "LIVE_API";

    if (evalSourceMode === "simulated" || hydroEvaluation) {
      badges.push({
        id: "hist",
        label: "Escenario histórico referencial",
        icon: FlaskConical,
        tone: "border-[#D97706]/35 bg-[#FFFBEB] text-[#B45309] dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
      });
    }
    if (evalSourceMode === "live") {
      if (isOffline) {
        badges.push({
          id: "offline",
          label: "Respaldo Offline",
          icon: Database,
          tone: "border-[#0284C7]/30 bg-[#F0F9FF] text-[#0369A1] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
        });
      } else {
        badges.push({
          id: "live",
          label: "Pronóstico Open-Meteo (48 h)",
          icon: CloudRain,
          tone: "border-[#059669]/30 bg-[#ECFDF5] text-[#059669] dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
        });
      }
    }
    if (hasVirtualSensors) {
      badges.push({
        id: "virtual",
        label: "Telemetría Virtual TRL 3–4 (PROPUESTA_FUTURA_NO_OPERATIVA)",
        icon: Radio,
        tone: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200",
      });
    }
    return badges;
  }, [weather, evalSourceMode, hydroEvaluation, hasVirtualSensors]);

  const levelCode = evaluation?.preventive_level || hydroEvaluation?.preventive_level || "INFORMATIVO";

  return (
    <section
      aria-label="Explicabilidad del motor preventivo"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[#F8FAFC] dark:hover:bg-slate-900/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                ¿Por qué este nivel?
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-[#0B2545] dark:bg-slate-800 dark:text-[#38BDF8]">
                {levelCode}
              </span>
              <span className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                · {combinedRules.length || 1} regla(s) explicables
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#475569] dark:text-slate-300">
              Traza transparente paso a paso: Señal detectada → Regla aplicada → Acción recomendada.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0369A1] dark:text-[#38BDF8]">
          <span>{open ? "Ocultar traza" : "Ver explicación"}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-4 p-5">
              {/* Badges de origen de datos */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                  Origen de datos:
                </span>
                {sourceBadges.map((b) => {
                  const Icon = b.icon;
                  return (
                    <span
                      key={b.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${b.tone}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{b.label}</span>
                    </span>
                  );
                })}
              </div>

              {/* Tarjetas paso a paso en lenguaje humano */}
              {combinedRules.length > 0 ? (
                <div className="space-y-3">
                  {combinedRules.map((rule) => (
                    <div
                      key={rule.rule_id}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-3.5 dark:border-slate-700/80 dark:bg-slate-900/60 md:grid-cols-3 md:items-center"
                    >
                      {/* Paso 1: Señal detectada */}
                      <div className="space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-400">
                          1. Señal detectada
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                          {rule.observed_value || "Condición base verificada"}
                        </div>
                        {rule.threshold_note && (
                          <div className="text-xs text-[#475569] dark:text-slate-300">
                            {rule.threshold_note}
                          </div>
                        )}
                      </div>

                      {/* Paso 2: Regla aplicada */}
                      <div className="space-y-1 border-slate-200 dark:border-slate-700 md:border-x md:px-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                          <ArrowRight className="h-3.5 w-3.5" />
                          <span>2. Regla aplicada</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#0B2545] px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-[#0369A1]">
                            {rule.rule_id}
                          </span>
                          <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                            {rule.description}
                          </span>
                        </div>
                      </div>

                      {/* Paso 3: Acción recomendada */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#059669] dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>3. Acción recomendada</span>
                        </div>
                        <p className="text-xs font-semibold leading-snug text-[#0F172A] dark:text-slate-100">
                          {getRecommendedAction(rule)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#059669]/25 bg-[#ECFDF5]/70 p-4 text-xs font-semibold text-[#065F46] dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  No se superaron umbrales preventivos en las próximas 24–48 h (regla base{" "}
                  <span className="font-mono font-bold">R-MET-00</span>). Se recomienda mantener
                  operación normal y revisar el pronóstico ante cambios de presión (&lt;1000 hPa).
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
