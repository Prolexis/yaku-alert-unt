import React, { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import PreventiveMessageCard from "./ui/PreventiveMessageCard";
import OfficialChannelsSection from "./ui/OfficialChannelsSection";

export default function PreventionView({
  evaluation,
  weather,
  simResult,
  hydroResult,
  evalSourceMode,
  onChangeEvalSource,
  conditionsCatalog,
  declaredConditions = [],
  onToggleCondition,
  userRole = "student",
}) {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Análisis Preventivo y Avisos
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Mensaje accionable (qué, dónde, cuándo, qué hacer y quién informa) con boletín descargable.
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

      {/* Condiciones externas declarables (solo editables en modo Administrador) */}
      {userRole === "admin" && evalSourceMode === "live" && conditionsCatalog?.conditions?.length > 0 && (
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#101828] dark:text-white">
                Condiciones externas observadas (declaración manual sí/no)
              </h3>
              <p className="mt-0.5 text-xs text-[#475467] dark:text-slate-400">
                No provienen de sensores: marca una condición solo si existe reporte verificado en calles o quebradas.
              </p>
            </div>
            {declaredConditions.length > 0 && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {declaredConditions.length} activa(s)
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {conditionsCatalog.conditions.map((cond) => {
              const checked = declaredConditions.includes(cond.id);
              return (
                <label
                  key={cond.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition ${
                    checked
                      ? "border-[#2563EB] bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30"
                      : "border-[#E2E8F0] bg-[#F7F9FC] dark:border-slate-800 dark:bg-slate-900/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCondition && onToggleCondition(cond.id)}
                    className="mt-0.5 rounded accent-[#2563EB]"
                  />
                  <div>
                    <div className="font-semibold text-[#101828] dark:text-white">{cond.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#475467] dark:text-slate-400">
                      {cond.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {!evaluation ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#475467] dark:border-slate-800 dark:bg-[#0B1F33]">
          Sin evaluación disponible.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Mensaje preventivo estructurado + Boletín descargable/imprimible */}
          <PreventiveMessageCard
            evaluation={evaluation}
            weather={weather}
            simResult={simResult}
            hydroResult={hydroResult}
            userRole={userRole}
          />

          {/* Fuentes y limitaciones */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#101828] dark:text-white">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Fuentes, incertidumbre y límites
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

          {/* Canales Oficiales de Alerta diferenciados por competencia */}
          <OfficialChannelsSection />

          {/* Reglas técnicas desplegables */}
          <section className="rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33]">
            <button
              type="button"
              onClick={() => setRulesOpen((v) => !v)}
              aria-expanded={rulesOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-[#101828] dark:text-white">
                Reglas técnicas activadas ({evaluation.rules_triggered.length}) · Código interno:{" "}
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
