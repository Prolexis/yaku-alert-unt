import React, { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  MapPin,
  Mountain,
  AlertCircle,
  ExternalLink,
  Clock,
  ShieldAlert,
} from "lucide-react";

const PHASES = [
  {
    id: "antes",
    title: "Antes de lluvias intensas",
    badge: "Preparación",
    items: [
      "Revisa el pronóstico diario y verifica si existen avisos oficiales emitidos por SENAMHI.",
      "Identifica el punto de encuentro referencial más cercano a tu facultad o pabellón.",
      "Resguarda equipos electrónicos, trabajos y materiales en zonas elevadas si estudias o trabajas en primer nivel.",
    ],
  },
  {
    id: "durante",
    title: "Durante una emergencia",
    badge: "Respuesta",
    items: [
      "Evita cruzar corrientes de agua, zonas anegadas o cables eléctricos húmedos dentro o fuera del campus.",
      "Si el exterior del pabellón está anegado, permanece en pisos superiores seguros y sigue indicaciones de brigadistas.",
      "Prioriza la información de Defensa Civil UNT, COER La Libertad e INDECI sobre rumores en redes.",
    ],
  },
  {
    id: "despues",
    title: "Después del evento",
    badge: "Recuperación",
    items: [
      "No ingreses a aulas o laboratorios con daños estructurales o filtraciones eléctricas hasta su revisión técnica.",
      "Verifica los canales oficiales de tu facultad para confirmar la reanudación o reprogramación de actividades.",
      "Reporta accesos bloqueados o drenajes obstruidos al personal de seguridad o bienestar universitario.",
    ],
  },
];

export default function ContinuityView({ protocols, campusLayers }) {
  const [activeTab, setActiveTab] = useState("phases");

  const levels = protocols?.preventive_levels || [];
  const basins = protocols?.trujillo_basins_context || [];
  const features = campusLayers?.campus?.features || [];
  const accesses = features.filter((f) => f.properties.category === "acceso");
  const meetingPoints = features.filter((f) => f.properties.category === "punto_encuentro");

  return (
    <div className="space-y-6">
      {/* Encabezado y pestañas */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Orientaciones y Continuidad Académica
          </h2>
          <p className="mt-1 max-w-3xl text-[15px] text-[#64748B] dark:text-slate-300">
            Guía práctica para estudiantes, docentes y personal administrativo sobre qué hacer antes,
            durante y después de lluvias intensas.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Secciones de orientación"
          className="inline-flex flex-wrap rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] p-1 dark:border-slate-700 dark:bg-slate-900"
        >
          {[
            { id: "phases", label: "Antes, Durante y Después" },
            { id: "academic", label: "Actividades Académicas" },
            { id: "campus", label: "Accesos y Puntos Ref." },
            { id: "official", label: "Canales Oficiales y Quebradas" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-white text-[#111827] shadow-subtle dark:bg-[#2563EB] dark:text-white"
                  : "text-[#64748B] hover:text-[#111827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Antes, Durante y Después */}
      {activeTab === "phases" && (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PHASES.map((phase) => (
            <div
              key={phase.id}
              className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]"
            >
              <span className="inline-block rounded-md bg-[#2563EB]/10 px-2.5 py-0.5 text-xs font-bold text-[#2563EB] dark:bg-blue-950 dark:text-blue-300">
                {phase.badge}
              </span>
              <h3 className="mt-3 text-lg font-bold text-[#111827] dark:text-white">
                {phase.title}
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
                {phase.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Tab 2: Actividades Académicas */}
      {activeTab === "academic" && (
        <section className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Aviso importante:</strong> Las alternativas mostradas a continuación son
              propuestas referenciales de continuidad académica. No constituyen una suspensión ni
              reprogramación oficial si no han sido autorizadas y comunicadas por las autoridades de
              la UNT.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {levels.map((lvl) => (
              <div
                key={lvl.level}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">
                    {lvl.label}
                  </h3>
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-bold text-slate-950"
                    style={{ backgroundColor: lvl.color }}
                  >
                    {lvl.level}
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-slate-300">
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

      {/* Tab 3: Accesos y Puntos Referenciales */}
      {activeTab === "campus" && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
              <MapPin className="h-4 w-4 text-[#2563EB]" />
              Puntos de Encuentro Referenciales
            </h3>
            <div className="mt-4 space-y-3">
              {meetingPoints.map((mp) => (
                <div
                  key={mp.properties.id}
                  className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/20"
                >
                  <div className="text-sm font-semibold text-[#111827] dark:text-white">
                    {mp.properties.name}
                  </div>
                  <div className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
                    {mp.properties.note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
              <MapPin className="h-4 w-4 text-[#64748B]" />
              Accesos del Campus UNT
            </h3>
            <div className="mt-4 space-y-2.5">
              {accesses.map((acc) => (
                <div
                  key={acc.properties.id}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] px-4 py-3 text-sm font-medium text-[#111827] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  {acc.properties.name}
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Los puntos de encuentro y rutas mostrados son referenciales hasta su validación
              institucional oficial.
            </p>
          </div>
        </section>
      )}

      {/* Tab 4: Fuentes y Canales Oficiales + Quebradas */}
      {activeTab === "official" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
              <BookOpen className="h-4 w-4 text-[#2563EB]" />
              Fuentes y Canales Oficiales en el Perú (SINAGERD)
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  name: "SENAMHI",
                  desc: "Avisos meteorológicos e hidrológicos oficiales.",
                  url: "https://www.gob.pe/senamhi",
                },
                {
                  name: "INDECI / COEN",
                  desc: "Alertas y orientaciones ante emergencias y desastres.",
                  url: "https://www.gob.pe/indeci",
                },
                {
                  name: "UNT Oficial",
                  desc: "Comunicados institucionales y suspensión de actividades.",
                  url: "https://www.unitru.edu.pe",
                },
              ].map((ch) => (
                <a
                  key={ch.name}
                  href={ch.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] p-4 transition hover:border-[#2563EB] dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between text-sm font-bold text-[#2563EB] dark:text-blue-400">
                    <span>{ch.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">{ch.desc}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {basins.map((q) => (
              <div
                key={q.name}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <div className="flex items-center gap-2 text-base font-bold text-[#2563EB] dark:text-blue-400">
                  <Mountain className="h-4 w-4 shrink-0" />
                  <span>{q.name}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-[#111827] dark:text-white">
                  {q.role}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-slate-400">
                  {q.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
