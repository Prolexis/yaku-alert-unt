import React, { useState } from "react";
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Database,
  Scale,
  ChevronDown,
  MapPin,
} from "lucide-react";

function humanLevelSummary(level) {
  switch (level) {
    case "INFORMATIVO":
      return "Condiciones tranquilas en el escenario analizado. No se requieren medidas extraordinarias, solo mantener atención a los canales oficiales.";
    case "VIGILANCIA_PREVENTIVA":
      return "Se observa lluvia moderada o exposición puntual. Conviene evitar zonas bajas con posible acumulación de agua y revisar tus rutas habituales.";
    case "ATENCION_PREVENTIVA":
      return "El escenario muestra lluvia intensa y/o varios pabellones o accesos expuestos. Se recomienda extremar precauciones y consultar alternativas académicas.";
    case "PREPARACION_CRITICA":
      return "Escenario extremo de demostración: alta intensidad y amplia exposición en el campus. En una situación real equivalente, sigue estrictamente las disposiciones de Defensa Civil UNT.";
    default:
      return "Evaluación preventiva informativa basada en reglas transparentes.";
  }
}

export default function PreventionView({
  evaluation,
  evalSourceMode,
  onChangeEvalSource,
}) {
  const [howCalculatedOpen, setHowCalculatedOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Encabezado y selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Ficha Preventiva Explicable
          </h2>
          <p className="mt-1 text-[15px] text-[#64748B] dark:text-slate-300">
            Explicación clara de qué significa el estado actual, qué datos se usaron y qué puedes hacer.
          </p>
        </div>

        <div
          role="group"
          aria-label="Fuente de evaluación"
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] p-1 dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => onChangeEvalSource("live")}
            aria-pressed={evalSourceMode === "live"}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "live"
                ? "bg-white text-[#111827] shadow-subtle dark:bg-[#2563EB] dark:text-white"
                : "text-[#64748B] hover:text-[#111827] dark:text-slate-400"
            }`}
          >
            Pronóstico Real / Caché
          </button>
          <button
            type="button"
            onClick={() => onChangeEvalSource("simulated")}
            aria-pressed={evalSourceMode === "simulated"}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "simulated"
                ? "bg-amber-400 text-slate-950 shadow-subtle"
                : "text-[#64748B] hover:text-[#111827] dark:text-slate-400"
            }`}
          >
            Último Escenario Simulado
          </button>
        </div>
      </div>

      {!evaluation ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33]">
          No hay evaluación preventiva disponible aún.
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. ¿Qué significa el resultado? */}
          <section
            className="rounded-xl border border-l-4 border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]"
            style={{ borderLeftColor: evaluation.level_color }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                  1. ¿Qué significa este resultado? ·{" "}
                  {evaluation.is_synthetic ? "Escenario Simulado" : "Pronóstico Real / Caché"}
                </div>
                <h3 className="mt-1.5 text-2xl font-bold text-[#111827] dark:text-white">
                  {evaluation.level_label}
                </h3>
              </div>
              <span
                className="rounded-md px-3 py-1 text-xs font-bold text-slate-950"
                style={{ backgroundColor: evaluation.level_color }}
              >
                {evaluation.preventive_level}
              </span>
            </div>

            <p className="mt-3 text-[15px] leading-relaxed text-[#111827] dark:text-slate-200">
              {humanLevelSummary(evaluation.preventive_level)}
            </p>
          </section>

          {/* 2 y 3. ¿Qué información se utilizó? / ¿Qué zonas aparecen? */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#2563EB] dark:text-blue-400">
                <Database className="h-4 w-4" />
                2. ¿Qué información se utilizó?
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#111827] dark:text-slate-200">
                {evaluation.hazard_assessment}
              </p>
              <div className="mt-3 space-y-1 border-t border-[#E2E8F0] pt-2.5 text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                {evaluation.sources_and_timestamps.map((src, i) => (
                  <div key={i}>• {src}</div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0F766E] dark:text-teal-400">
                <MapPin className="h-4 w-4" />
                3. ¿Qué zonas aparecen en el escenario?
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#111827] dark:text-slate-200">
                {evaluation.exposure_assessment}
              </p>
              <p className="mt-3 border-t border-[#E2E8F0] pt-2.5 text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                {evaluation.risk_distinction_note}
              </p>
            </div>
          </section>

          {/* 4 y 5. ¿Qué orientaciones puedo consultar? y ¿Cuáles son las limitaciones? */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                4. ¿Qué orientaciones puedo consultar?
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm text-[#111827] dark:text-slate-200">
                {evaluation.guidance.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-900/50 dark:bg-amber-950/25">
              <h3 className="flex items-center gap-2 text-base font-bold text-amber-950 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                5. ¿Cuáles son las limitaciones?
              </h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-amber-950/90 dark:text-amber-200/90">
                {evaluation.uncertainty_and_limits.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
              <div className="mt-4 flex items-start gap-2 border-t border-amber-200 pt-3 text-xs font-medium text-amber-950 dark:border-amber-800/60 dark:text-amber-200">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{evaluation.legal_disclaimer}</span>
              </div>
            </section>
          </div>

          {/* 6. ¿Cómo se calculó? — detalles técnicos desplegables */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <button
              type="button"
              onClick={() => setHowCalculatedOpen((v) => !v)}
              aria-expanded={howCalculatedOpen}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  6. ¿Cómo se calculó? — Detalles técnicos ({evaluation.rules_triggered.length} reglas)
                </div>
                <div className="text-xs text-[#64748B] dark:text-slate-400">
                  Despliegue para inspeccionar las reglas exactas (R-MET, R-ACU, R-COND, R-ESP) y umbrales experimentales
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-[#64748B] transition-transform ${
                  howCalculatedOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {howCalculatedOpen && (
              <div className="space-y-2.5 border-t border-[#E2E8F0] p-6 pt-4 dark:border-slate-800">
                {evaluation.rules_triggered.map((rule) => (
                  <div
                    key={rule.rule_id}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] p-4 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-[#0B1F33] px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-[#2563EB]">
                          {rule.rule_id}
                        </span>
                        <span className="text-sm font-semibold text-[#111827] dark:text-white">
                          {rule.description}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-[#2563EB] dark:text-blue-400">
                        {rule.observed_value}
                      </span>
                    </div>
                    <p className="mt-2 border-t border-[#E2E8F0] pt-2 text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                      Criterio experimental: {rule.threshold_note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
