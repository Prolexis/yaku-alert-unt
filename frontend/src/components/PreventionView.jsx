import React from "react";
import { ShieldCheck, FileText, AlertTriangle, CheckCircle2, Database, Scale } from "lucide-react";

export default function PreventionView({
  evaluation,
  evalSourceMode,
  onChangeEvalSource,
}) {
  return (
    <div className="space-y-6">
      {/* Selector de fuente evaluada */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33] sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
            Motor de Decisiones Preventivas Explicables
          </h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Cada resultado detalla qué reglas se activaron, qué datos lo sustentan y qué incertidumbre presenta.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onChangeEvalSource("live")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "live"
                ? "bg-[#2563EB] text-white"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
            }`}
          >
            Pronóstico Real / Caché
          </button>
          <button
            type="button"
            onClick={() => onChangeEvalSource("simulated")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "simulated"
                ? "bg-amber-500 text-slate-950"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-slate-400"
            }`}
          >
            Último Escenario Simulado
          </button>
        </div>
      </div>

      {!evaluation ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33]">
          No hay evaluación preventiva disponible aún.
        </div>
      ) : (
        <>
          {/* Ficha Preventiva Principal */}
          <section
            className="rounded-2xl border-2 bg-white p-6 shadow-card dark:bg-[#0B1F33]"
            style={{ borderColor: evaluation.level_color }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Ficha Preventiva · {evaluation.is_synthetic ? "Escenario Sintético" : "Sobre Pronóstico Real"}
                </span>
                <h3 className="mt-1 text-xl font-bold text-[#0F172A] dark:text-white">
                  {evaluation.level_label}
                </h3>
              </div>
              <span
                className="rounded-full px-3.5 py-1 text-xs font-bold text-slate-950 shadow-sm"
                style={{ backgroundColor: evaluation.level_color }}
              >
                {evaluation.preventive_level}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-xs font-bold text-[#2563EB] dark:text-sky-400">
                  1. Condición de Peligro
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#0F172A] dark:text-slate-200">
                  {evaluation.hazard_assessment}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-xs font-bold text-[#14B8A6]">
                  2. Exposición Espacial (Shapely)
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#0F172A] dark:text-slate-200">
                  {evaluation.exposure_assessment}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-[#64748B] dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              <strong className="text-[#0F172A] dark:text-white">Rigor científico:</strong>{" "}
              {evaluation.risk_distinction_note}
            </div>
          </section>

          {/* Reglas activadas */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
              <FileText className="h-4 w-4 text-[#2563EB]" />
              Reglas Transparentes Activadas ({evaluation.rules_triggered.length})
            </h3>
            <div className="mt-4 space-y-2.5">
              {evaluation.rules_triggered.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#0B1F33] px-2 py-0.5 font-mono text-[11px] font-semibold text-white dark:bg-[#2563EB]">
                        {rule.rule_id}
                      </span>
                      <span className="font-semibold text-[#0F172A] dark:text-white">
                        {rule.description}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">
                      {rule.threshold_note}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 font-bold text-[#2563EB] shadow-sm dark:bg-slate-800 dark:text-tealbrand-400">
                    {rule.observed_value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Orientaciones y Fuentes/Incertidumbre */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                <ShieldCheck className="h-4 w-4 text-[#14B8A6]" />
                Orientaciones Contextuales
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs text-[#64748B] dark:text-slate-300">
                {evaluation.guidance.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14B8A6]" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:bg-amber-950/25">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Fuentes, Incertidumbre y Límites
              </h3>
              <div className="mt-3 space-y-2 text-xs text-amber-900/85 dark:text-amber-200/85">
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
              <div className="mt-4 flex items-start gap-2 border-t border-amber-200 pt-3 text-[11px] font-medium text-amber-900 dark:border-amber-800/60 dark:text-amber-200">
                <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{evaluation.legal_disclaimer}</span>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
