import React, { useState } from "react";
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Database,
  Scale,
  ChevronDown,
} from "lucide-react";

export default function PreventionView({
  evaluation,
  evalSourceMode,
  onChangeEvalSource,
}) {
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Encabezado y selector de fuente */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Ficha Preventiva Explicable
          </h2>
          <p className="mt-1 text-[15px] text-[#64748B] dark:text-slate-300">
            Informe transparente de reglas activadas, fuentes verificables y límites científicos.
          </p>
        </div>

        <div
          role="group"
          aria-label="Fuente de evaluación"
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-1 dark:border-slate-700 dark:bg-slate-900"
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
        <div className="space-y-6">
          {/* 1 y 2. Estado, tipo de evaluación y resumen ejecutivo */}
          <section
            className="rounded-xl border-l-4 border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]"
            style={{ borderLeftColor: evaluation.level_color }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  1. Estado y Tipo ·{" "}
                  {evaluation.is_synthetic
                    ? "Evaluación Experimental sobre Escenario Sintético"
                    : "Evaluación Experimental sobre Pronóstico Real"}
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

            <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-4 text-sm leading-relaxed text-[#111827] dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              <strong className="font-semibold">2. Resumen ejecutivo:</strong>{" "}
              {evaluation.risk_distinction_note}
            </div>
          </section>

          {/* 3 y 4. Separación visual: Peligro Meteorológico vs Exposición Geográfica */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8] dark:text-blue-400">
                3. Factores Meteorológicos (Peligro)
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#111827] dark:text-slate-200">
                {evaluation.hazard_assessment}
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="text-xs font-bold uppercase tracking-wide text-[#0F766E] dark:text-teal-400">
                4. Exposición Geográfica (Shapely)
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#111827] dark:text-slate-200">
                {evaluation.exposure_assessment}
              </p>
            </div>
          </section>

          {/* 5. Reglas activadas con detalle técnico desplegable */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
                <FileText className="h-4 w-4 text-[#1D4ED8]" />
                5. Reglas Activadas ({evaluation.rules_triggered.length})
              </h3>
              <button
                type="button"
                onClick={() => setTechDetailsOpen((v) => !v)}
                aria-expanded={techDetailsOpen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#111827] dark:border-slate-700 dark:text-slate-300"
              >
                <span>{techDetailsOpen ? "Ocultar umbrales técnicos" : "Ver umbrales técnicos"}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${techDetailsOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {evaluation.rules_triggered.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-4 dark:border-slate-800 dark:bg-slate-900/60"
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
                    <span className="shrink-0 font-mono text-xs font-bold text-[#1D4ED8] dark:text-blue-400">
                      {rule.observed_value}
                    </span>
                  </div>
                  {techDetailsOpen && (
                    <p className="mt-2 border-t border-[#E2E8F0] pt-2 text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                      Criterio experimental: {rule.threshold_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 6 y 7. Orientaciones, Fuentes y Limitaciones */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                7. Orientación Preventiva Contextual
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
                6. Fuentes, Actualización y Limitaciones
              </h3>
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-amber-950/85 dark:text-amber-200/85">
                {evaluation.sources_and_timestamps.map((src, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{src}</span>
                  </div>
                ))}
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {evaluation.uncertainty_and_limits.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-start gap-2 border-t border-amber-200 pt-3 text-xs font-medium text-amber-950 dark:border-amber-800/60 dark:text-amber-200">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{evaluation.legal_disclaimer}</span>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
