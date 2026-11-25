import React from "react";
import { CheckCircle2, Download, Printer } from "lucide-react";
import { formatLimaTime, humanPreventiveTitle } from "../../utils/formatters";
import { downloadBulletin, printBulletin } from "../../utils/bulletin";

export default function PreventiveMessageCard({ evaluation, weather, simResult, hydroResult }) {
  if (!evaluation) return null;

  const isSim = Boolean(evaluation.is_synthetic);
  const title = humanPreventiveTitle(evaluation.preventive_level, isSim);
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);

  const badge = isSim
    ? { text: "Escenario simulado", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200" }
    : weather?.data_status === "LIVE_API"
    ? { text: "Evaluación experimental · Pronóstico", cls: "bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200" }
    : { text: "Evaluación sobre caché offline", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200" };

  return (
    <section
      aria-label="Mensaje preventivo estructurado"
      className="rounded-xl border border-l-4 border-[#E2E8F0] bg-white p-6 dark:border-slate-800 dark:bg-[#0B1F33]"
      style={{ borderLeftColor: evaluation.level_color }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
            {badge.text}
          </span>
          <h3 className="mt-2 text-2xl font-bold text-[#101828] dark:text-white">{title}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadBulletin({ evaluation, weather, simResult, hydroResult })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5 text-[#2563EB]" />
            Descargar boletín
          </button>
          <button
            type="button"
            onClick={() => printBulletin({ evaluation, weather, simResult, hydroResult })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Printer className="h-3.5 w-3.5 text-[#2563EB]" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Estructura QUÉ → DÓNDE → CUÁNDO → QUÉ HACER → QUIÉN INFORMA */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Qué ocurre</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            {evaluation.hazard_assessment}
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Dónde</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            Ciudad Universitaria UNT · {evaluation.exposure_assessment}
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Cuándo</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200" title={utc}>
            Referencia: {local}. Vigente hasta la próxima actualización de datos o cambio de escenario.
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Quién informa</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            Prototipo informativo YAKU ALERT — UNT (TRL 3–4). No sustituye avisos oficiales de
            SENAMHI, INDECI, COEN ni Defensa Civil UNT.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#E2E8F0] p-4 dark:border-slate-800">
        <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">
          Qué hacer (Orientaciones preventivas)
        </div>
        <ul className="mt-2 space-y-2 text-sm text-[#101828] dark:text-slate-200">
          {evaluation.guidance.map((g, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
