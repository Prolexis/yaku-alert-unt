import React from "react";
import { safeHttpsUrl } from "../../utils/conditions";

const TYPE_LABEL = { calle: "Calle", quebrada: "Quebrada" };

/**
 * Interruptores sí/no de condiciones externas (calle inundada, quebrada activa).
 * Son DECLARADAS por el usuario: no hay sensores en calles ni quebradas.
 */
export default function ExternalConditionsPanel({ catalog, active = [], onToggle, disabled = false }) {
  if (!catalog?.conditions?.length) return null;
  const activeSet = new Set(active);

  return (
    <fieldset
      className="space-y-2.5 rounded-lg border border-fuchsia-300/70 bg-fuchsia-50/50 p-3 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/20"
      disabled={disabled}
    >
      <legend className="px-1 text-xs font-bold text-fuchsia-900 dark:text-fuchsia-200">
        Condiciones externas declaradas (sí / no)
      </legend>
      <p className="text-[11px] leading-relaxed text-[#475467] dark:text-slate-400">
        Las declara usted; no hay sensores en calles ni quebradas. No se activan solas por la lluvia
        y la lluvia no cambia la zona que dibujan.
      </p>

      <div className="space-y-2">
        {catalog.conditions.map((condition) => {
          const isOn = activeSet.has(condition.id);
          const inputId = `cond-${condition.id}`;
          const link = (condition.evidence || []).map(safeHttpsUrl).find(Boolean);
          return (
            <div
              key={condition.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                isOn
                  ? "border-fuchsia-400 bg-white dark:border-fuchsia-700 dark:bg-slate-900"
                  : "border-[#E2E8F0] bg-white/70 dark:border-slate-800 dark:bg-slate-900/50"
              }`}
            >
              <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isOn}
                  onChange={() => onToggle(condition.id)}
                  className="mt-0.5 rounded accent-fuchsia-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[#101828] dark:text-slate-100">{condition.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {TYPE_LABEL[condition.type] || condition.type}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        isOn ? "text-fuchsia-700 dark:text-fuchsia-300" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isOn ? "SÍ" : "NO"}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#475467] dark:text-slate-400">
                    {condition.description}
                  </span>
                </span>
              </label>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-6 mt-1 inline-block text-[10px] text-[#2563EB] underline dark:text-blue-400"
                >
                  Fuente de referencia (prensa, por confirmar)
                </a>
              )}
            </div>
          );
        })}
      </div>

      {active.length === 0 && (
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Ninguna condición activa: no se marca ninguna zona.
        </p>
      )}
    </fieldset>
  );
}
