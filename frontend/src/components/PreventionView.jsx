import React, { useState } from "react";
import { CheckCircle2, ChevronDown, AlertTriangle } from "lucide-react";
import { humanPreventiveTitle } from "../utils/formatters";

function humanExplanation(level) {
  switch (level) {
    case "INFORMATIVO":
      return "Las condiciones evaluadas no superan los umbrales experimentales de lluvia. Mantén atención a los avisos oficiales.";
    case "VIGILANCIA_PREVENTIVA":
      return "La evaluación alcanza vigilancia preventiva por umbrales experimentales de lluvia y/o exposición espacial puntual. Evita sectores bajos y consulta avisos oficiales.";
    case "ATENCION_PREVENTIVA":
      return "Las reglas alcanzan atención preventiva por umbrales experimentales de lluvia y/o exposición espacial. Consulta alternativas académicas y avisos oficiales.";
    case "PREPARACION_CRITICA":
      return "Las reglas alcanzan preparación crítica bajo los parámetros evaluados; esto no representa una inundación observada ni una alerta real. Sigue las indicaciones de Defensa Civil UNT.";
    default:
      return "Evaluación preventiva informativa basada en reglas transparentes.";
  }
}

export default function PreventionView({
  evaluation,
  evalSourceMode,
  onChangeEvalSource,
}) {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Análisis Preventivo
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Ficha explicable sobre qué significa el estado actual y qué datos lo respaldan.
          </p>
        </div>

        <div
          role="group"
          aria-label="Fuente evaluada"
          className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1 dark:border-slate-700 dark:bg-[#0B1F33]"
        >
          <button
            type="button"
            onClick={() => onChangeEvalSource("live")}
            aria-pressed={evalSourceMode === "live"}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "live"
                ? "bg-[#2563EB] text-white"
                : "text-[#475467] hover:text-[#101828] dark:text-slate-300"
            }`}
          >
            Pronóstico / Caché
          </button>
          <button
            type="button"
            onClick={() => onChangeEvalSource("simulated")}
            aria-pressed={evalSourceMode === "simulated"}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              evalSourceMode === "simulated"
                ? "bg-amber-400 text-slate-950"
                : "text-[#475467] hover:text-[#101828] dark:text-slate-300"
            }`}
          >
            Simulación
          </button>
        </div>
      </div>

      {!evaluation ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#475467] dark:border-slate-800 dark:bg-[#0B1F33]">
          Sin evaluación disponible.
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Qué significa el resultado */}
          <section
            className="rounded-xl border border-l-4 border-[#E2E8F0] bg-white p-6 dark:border-slate-800 dark:bg-[#0B1F33]"
            style={{ borderLeftColor: evaluation.level_color }}
          >
            <div className="text-xs font-medium text-[#475467] dark:text-slate-400">
              1. Qué significa el resultado
            </div>
            <h3 className="mt-1 text-2xl font-bold text-[#101828] dark:text-white">
              {humanPreventiveTitle(evaluation.preventive_level, evaluation.is_synthetic)}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#475467] dark:text-slate-300">
              {humanExplanation(evaluation.preventive_level)}
            </p>
          </section>

          {/* 2 y 3. Qué datos se utilizaron y qué instalaciones aparecen */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="text-xs font-semibold text-[#2563EB]">2. Qué datos se utilizaron</div>
              <p className="mt-2 text-sm leading-relaxed text-[#101828] dark:text-slate-200">
                {evaluation.hazard_assessment}
              </p>
            </section>

            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="text-xs font-semibold text-[#2563EB]">
                3. Qué instalaciones aparecen en el escenario
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#101828] dark:text-slate-200">
                {evaluation.exposure_assessment}
              </p>
            </section>
          </div>

          {/* 4 y 5. Orientaciones y Limitaciones */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
              <h3 className="text-base font-semibold text-[#101828] dark:text-white">
                4. Qué orientaciones consultar
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[#475467] dark:text-slate-300">
                {evaluation.guidance.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[#101828] dark:text-white">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                5. Fuentes y limitaciones
              </h3>
              <div className="mt-3 space-y-1.5 text-xs text-[#475467] dark:text-slate-400">
                {evaluation.sources_and_timestamps.map((src, i) => (
                  <div key={i}>• {src}</div>
                ))}
                {evaluation.uncertainty_and_limits.map((u, i) => (
                  <div key={`u-${i}`}>• {u}</div>
                ))}
              </div>
              <p className="mt-3 border-t border-[#E2E8F0] pt-2.5 text-xs font-medium text-[#101828] dark:border-slate-800 dark:text-slate-200">
                {evaluation.legal_disclaimer}
              </p>
            </section>
          </div>

          {/* 6. Reglas técnicas desplegables */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33]">
            <button
              type="button"
              onClick={() => setRulesOpen((v) => !v)}
              aria-expanded={rulesOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-[#101828] dark:text-white">
                6. Reglas técnicas activadas ({evaluation.rules_triggered.length}) · Código interno:{" "}
                <span className="font-mono text-xs text-[#475467]">{evaluation.preventive_level}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#475467] transition-transform ${rulesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {rulesOpen && (
              <div className="space-y-2 border-t border-[#E2E8F0] p-5 dark:border-slate-800">
                {evaluation.rules_triggered.map((rule) => (
                  <div
                    key={rule.rule_id}
                    className="flex flex-col justify-between gap-1 rounded-lg bg-[#F7F9FC] p-3 text-xs dark:bg-slate-900/60 sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="mr-2 font-mono font-bold text-[#2563EB]">{rule.rule_id}</span>
                      <span className="font-medium text-[#101828] dark:text-white">
                        {rule.description}
                      </span>
                      <div className="mt-0.5 text-[#475467] dark:text-slate-400">
                        {rule.threshold_note}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono font-semibold text-[#101828] dark:text-slate-200">
                      {rule.observed_value}
                    </span>
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
