import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Mountain,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import CommunityPreparednessSection from "./ui/CommunityPreparednessSection";
import OfficialChannelsSection from "./ui/OfficialChannelsSection";

const FALLBACK_PHASES = {
  antes: {
    title: "Antes",
    academic: [
      "Consultar el pronóstico diario y avisos oficiales de SENAMHI antes de iniciar la jornada lectiva.",
      "Ubicar el punto de encuentro y la ruta referencial cercana a tu pabellón o laboratorio.",
      "Mantener aulas virtuales UNT actualizadas y listas para transición rápida a modalidad remota.",
    ],
    administrative: [
      "Resguardar expedientes físicos, archivos documentarios y equipos de cómputo en oficinas de planta baja o zonas con exposición hídrica.",
      "Verificar la operatividad de la Mesa de Partes virtual UNT y canales digitales de atención.",
      "Identificar trámites críticos y asignar responsables de respaldo remoto.",
    ],
  },
  durante: {
    title: "Durante",
    academic: [
      "Migrar clases teóricas a modalidad virtual (aula virtual UNT) si existe disposición institucional.",
      "Reprogramar prácticas de laboratorio y evaluaciones presenciales sin penalización para estudiantes.",
      "Evitar cruzar zonas anegadas o instalaciones eléctricas húmedas y permanecer en pisos superiores si hay anegamiento exterior.",
    ],
    administrative: [
      "Activar la Mesa de Partes virtual UNT como canal preferente de ingreso y seguimiento documentario.",
      "Habilitar trabajo remoto temporal para oficinas en planta baja o sectores con exposición hídrica.",
      "Priorizar únicamente trámites críticos y suspender traslados físicos de legajos entre pabellones.",
    ],
  },
  despues: {
    title: "Después",
    academic: [
      "No ingresar a aulas ni laboratorios con filtraciones o tableros húmedos hasta la inspección técnica.",
      "Confirmar la reanudación de clases y el nuevo cronograma de laboratorios en los canales oficiales de cada facultad.",
      "Reportar accesos o drenajes obstruidos al personal de vigilancia y mantenimiento.",
    ],
    administrative: [
      "Inspeccionar oficinas de planta baja, archivos físicos y equipos de cómputo/laboratorios antes de reconectar energía eléctrica.",
      "Sincronizar los expedientes recibidos por Mesa de Partes virtual y reanudar gradualmente la atención presencial.",
      "Documentar incidencias de infraestructura para el reporte a Defensa Civil UNT.",
    ],
  },
};

export default function ContinuityView({ protocols }) {
  const [activeTab, setActiveTab] = useState("phases");
  const levels = protocols?.preventive_levels || [];
  const basins = protocols?.trujillo_basins_context || [];
  const phasesMap = protocols?.continuity_phases || FALLBACK_PHASES;
  const phaseOrder = ["antes", "durante", "despues"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Orientaciones y Continuidad
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Guía de continuidad académica y administrativa por fase y nivel preventivo, más canales oficiales.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Categorías de orientaciones"
          className="inline-flex flex-wrap rounded-lg border border-[#E2E8F0] bg-white p-1 dark:border-slate-700 dark:bg-[#0B1F33]"
        >
          {[
            { id: "phases", label: "Antes / Durante / Después" },
            { id: "levels", label: "Continuidad por nivel" },
            { id: "community", label: "Acción comunitaria y mochila" },
            { id: "official", label: "Canales oficiales" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#2563EB] text-white"
                  : "text-[#475467] hover:text-[#101828] dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "phases" && (
        <section className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Orientaciones referenciales (TRL 3–4) alineadas al PLANAGERD 2022–2030. Su aplicación operativa requiere autorización oficial de la UNT.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {phaseOrder.map((phaseKey) => {
              const phase = phasesMap[phaseKey] || FALLBACK_PHASES[phaseKey];
              return (
                <div
                  key={phaseKey}
                  className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
                >
                  <h3 className="text-lg font-bold text-[#101828] dark:text-white">
                    {phase.title}
                  </h3>

                  {/* Bloque Académico */}
                  <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#2563EB] dark:text-blue-400">
                      <GraduationCap className="h-4 w-4" />
                      <span>Actividades académicas</span>
                    </div>
                    <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                      {(phase.academic || []).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bloque Administrativo */}
                  <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                      <Briefcase className="h-4 w-4" />
                      <span>Actividades administrativas</span>
                    </div>
                    <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                      {(phase.administrative || []).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "levels" && (
        <section className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Nota: Estas pautas de continuidad académica y administrativa son referenciales. No representan decisiones oficiales si no son autorizadas por la UNT.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {levels.map((lvl) => (
              <div
                key={lvl.level}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: lvl.color }}
                  />
                  <h3 className="text-base font-bold text-[#101828] dark:text-white">
                    {lvl.label}
                  </h3>
                </div>

                <div className="mt-3.5 space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#2563EB] dark:text-blue-400">
                      <GraduationCap className="h-3.5 w-3.5" />
                      <span>Continuidad académica</span>
                    </div>
                    <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                      {(lvl.continuity || []).map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {lvl.administrative_continuity?.length > 0 && (
                    <div className="border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Continuidad administrativa</span>
                      </div>
                      <ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                        {lvl.administrative_continuity.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "community" && <CommunityPreparednessSection />}

      {activeTab === "official" && (
        <section className="space-y-5">
          <OfficialChannelsSection />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {basins.map((q) => (
              <div
                key={q.name}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[#101828] dark:text-white">
                  <Mountain className="h-4 w-4 text-[#2563EB]" />
                  <span>{q.name}</span>
                </div>
                {q.sector && (
                  <div className="mt-0.5 text-[11px] font-semibold text-[#2563EB] dark:text-blue-400">
                    {q.sector}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-[#475467] dark:text-slate-400">{q.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
