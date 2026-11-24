import React, { useState } from "react";
import { CheckCircle2, ExternalLink, Clock, Mountain } from "lucide-react";

const PHASES = [
  {
    id: "antes",
    title: "Antes",
    items: [
      "Consulta el pronóstico diario y avisos de SENAMHI.",
      "Ubica el punto de encuentro referencial cercano a tu pabellón.",
      "Protege equipos electrónicos si trabajas en primer nivel.",
    ],
  },
  {
    id: "durante",
    title: "Durante",
    items: [
      "Evita cruzar zonas anegadas o instalaciones eléctricas húmedas.",
      "Permanece en pisos superiores seguros si hay anegamiento exterior.",
      "Sigue únicamente comunicados oficiales de Defensa Civil UNT e INDECI.",
    ],
  },
  {
    id: "despues",
    title: "Después",
    items: [
      "No ingreses a aulas con filtraciones eléctricas hasta su revisión.",
      "Confirma la reanudación de actividades en canales de tu facultad.",
      "Reporta accesos o drenajes obstruidos al personal de seguridad.",
    ],
  },
];

export default function ContinuityView({ protocols }) {
  const [activeTab, setActiveTab] = useState("phases");
  const levels = protocols?.preventive_levels || [];
  const basins = protocols?.trujillo_basins_context || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Orientaciones y Continuidad
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Guía breve para la comunidad universitaria y enlaces oficiales.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Categorías de orientaciones"
          className="inline-flex flex-wrap rounded-lg border border-[#E2E8F0] bg-white p-1 dark:border-slate-700 dark:bg-[#0B1F33]"
        >
          {[
            { id: "phases", label: "Antes / Durante / Después" },
            { id: "academic", label: "Continuidad académica" },
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
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PHASES.map((phase) => (
            <div
              key={phase.id}
              className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
            >
              <h3 className="text-lg font-bold text-[#101828] dark:text-white">{phase.title}</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-[#475467] dark:text-slate-300">
                {phase.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {activeTab === "academic" && (
        <section className="space-y-4">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Nota: Estas alternativas son referenciales. No representan decisiones oficiales si no son
            autorizadas por la UNT.
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
                <ul className="mt-3 space-y-2 text-sm text-[#475467] dark:text-slate-300">
                  {lvl.continuity.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "official" && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { name: "SENAMHI", desc: "Avisos meteorológicos oficiales.", url: "https://www.gob.pe/senamhi" },
              { name: "INDECI / COEN", desc: "Alertas y emergencia nacional.", url: "https://www.gob.pe/indeci" },
              { name: "UNT Oficial", desc: "Comunicados universitarios.", url: "https://www.unitru.edu.pe" },
            ].map((ch) => (
              <a
                key={ch.name}
                href={ch.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:border-[#2563EB] dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center justify-between text-sm font-bold text-[#2563EB]">
                  <span>{ch.name}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
                <p className="mt-1 text-xs text-[#475467] dark:text-slate-400">{ch.desc}</p>
              </a>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {basins.map((q) => (
              <div
                key={q.name}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[#101828] dark:text-white">
                  <Mountain className="h-4 w-4 text-[#2563EB]" />
                  <span>{q.name}</span>
                </div>
                <p className="mt-1.5 text-xs text-[#475467] dark:text-slate-400">{q.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
