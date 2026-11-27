import React, { useState } from "react";
import {
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  HelpCircle,
} from "lucide-react";
import PreventiveMessageCard from "./ui/PreventiveMessageCard";
import OfficialChannelsSection from "./ui/OfficialChannelsSection";
import CommunityPreparednessSection from "./ui/CommunityPreparednessSection";
import ExplainabilityStrip from "./ui/ExplainabilityStrip";
import ActiveAlertsBanner from "./ui/ActiveAlertsBanner";
import { AdminReportsInbox } from "./ui/CampusReportModal";
import { downloadBulletin, printBulletin } from "../utils/bulletin";
import { formatLimaTime, humanPreventiveTitle } from "../utils/formatters";

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
  activeDemoRole = "estudiante",
  onIssueAlert,
  activeAlerts = [],
  onResolveAlert,
  onValidateAlert,
  onConfirmAlert,
  campusReports = [],
  onUpdateReportStatus,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);

  const isSim = Boolean(evaluation?.is_synthetic);
  const title = evaluation
    ? humanPreventiveTitle(evaluation.preventive_level, isSim)
    : "Evaluando...";
  const { local } = formatLimaTime(weather?.fetched_at_utc);
  const topGuidance = (evaluation?.guidance || []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#101828] dark:text-white sm:text-3xl">
            {userRole === "admin" ? "Análisis Preventivo y Avisos" : "Recomendaciones preventivas"}
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            {userRole === "admin"
              ? "Mensaje accionable (qué, dónde, cuándo, qué hacer y quién informa) con boletín descargable."
              : "Orientaciones claras según el pronóstico actual o escenario seleccionado."}
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
      ) : userRole !== "admin" ? (
        /* ===================================================================
           JERARQUÍA ESTUDIANTE: 1) Qué hacer ahora -> 2) Por qué -> 3) Detalles
           =================================================================== */
        <div className="space-y-5">
          {activeAlerts.length > 0 && (
            <ActiveAlertsBanner
              alerts={activeAlerts}
              canResolve={false}
              onResolveAlert={onResolveAlert}
              onValidateAlert={onValidateAlert}
              onConfirmAlert={onConfirmAlert}
              activeDemoRole={activeDemoRole}
            />
          )}

          {/* 1. PRIMERO: ¿Qué puedo hacer ahora? (máx. 3 recomendaciones iniciales) */}
          <section
            aria-label="¿Qué puedo hacer ahora?"
            className="rounded-2xl border border-l-4 border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
            style={{ borderLeftColor: evaluation.level_color }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isSim
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200"
                      : "bg-blue-50 text-[#0369A1] dark:bg-sky-950/70 dark:text-sky-200"
                  }`}
                >
                  {isSim ? "Simulación experimental" : `Pronóstico Open-Meteo · ${local}`}
                </span>
                <h3 className="mt-1.5 text-xl font-extrabold text-[#0F172A] dark:text-white">
                  ¿Qué puedo hacer ahora?
                </h3>
                <p className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                  Estado actual: {title}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadBulletin({ evaluation, weather, simResult, hydroResult })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-[#0369A1]" />
                  <span>Descargar boletín</span>
                </button>
                <button
                  type="button"
                  onClick={() => printBulletin({ evaluation, weather, simResult, hydroResult })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Printer className="h-3.5 w-3.5 text-[#0369A1]" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-2.5 text-sm text-[#0F172A] dark:text-slate-100">
              {topGuidance.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl bg-[#F8FAFC] p-3 dark:bg-slate-900/60"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 2. SEGUNDO: ¿Por qué aparece esta recomendación? */}
          <section
            aria-label="¿Por qué aparece esta recomendación?"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
          >
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#0F172A] dark:text-white">
              <HelpCircle className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
              <h3>¿Por qué aparece esta recomendación?</h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              {evaluation.hazard_assessment} {evaluation.exposure_assessment}
            </p>
            <p className="mt-2 text-[11px] text-[#64748B] dark:text-slate-400">
              {evaluation.legal_disclaimer}
            </p>
          </section>

          {/* 3. TERCERO: Ver detalles, 5 ejes, reglas y fuentes (bajo demanda) */}
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B2545]">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  Ver detalles, ficha completa (5 ejes) y fuentes
                </span>
                <p className="text-xs text-[#475569] dark:text-slate-300">
                  Qué ocurre, dónde, cuándo, quién informa, reglas aplicadas y limitaciones
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-[#475569] transition-transform ${
                  detailsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {detailsOpen && (
              <div className="space-y-4 border-t border-slate-200 p-5 dark:border-slate-800">
                <PreventiveMessageCard
                  evaluation={evaluation}
                  weather={weather}
                  simResult={simResult}
                  hydroResult={hydroResult}
                  userRole={userRole}
                  activeDemoRole={activeDemoRole}
                />
                <ExplainabilityStrip
                  evaluation={evaluation}
                  hydroEvaluation={hydroResult?.evaluation}
                  weather={weather}
                  evalSourceMode={evalSourceMode}
                  hasVirtualSensors={false}
                />
              </div>
            )}
          </section>

          {/* Mochila de emergencia y canales oficiales */}
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B2545]">
            <button
              type="button"
              onClick={() => setCommunityOpen((v) => !v)}
              aria-expanded={communityOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  Mochila de emergencia y brigadas universitarias
                </span>
                <p className="text-xs text-[#475569] dark:text-slate-300">
                  Checklist preventivo local y coordinación comunitaria
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-[#475569] transition-transform ${
                  communityOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {communityOpen && (
              <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                <CommunityPreparednessSection />
              </div>
            )}
          </section>

          <OfficialChannelsSection />
        </div>
      ) : (
        /* ===================================================================
           VISTA ADMINISTRADOR / GESTIÓN UNT (Conserva capacidad técnica total)
           =================================================================== */
        <div className="space-y-5">
          {activeAlerts.length > 0 && (
            <ActiveAlertsBanner
              alerts={activeAlerts}
              canResolve={true}
              onResolveAlert={onResolveAlert}
              onValidateAlert={onValidateAlert}
              onConfirmAlert={onConfirmAlert}
              activeDemoRole={activeDemoRole}
            />
          )}

          <PreventiveMessageCard
            evaluation={evaluation}
            weather={weather}
            simResult={simResult}
            hydroResult={hydroResult}
            userRole={userRole}
            activeDemoRole={activeDemoRole}
            onIssueAlert={onIssueAlert}
          />

          <AdminReportsInbox
            reports={campusReports}
            onUpdateStatus={onUpdateReportStatus}
          />

          <ExplainabilityStrip
            evaluation={evaluation}
            hydroEvaluation={hydroResult?.evaluation}
            weather={weather}
            evalSourceMode={evalSourceMode}
            hasVirtualSensors={true}
            defaultOpen
          />

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

          <OfficialChannelsSection />

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
