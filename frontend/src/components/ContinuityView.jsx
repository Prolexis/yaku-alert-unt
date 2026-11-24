import React, { useState } from "react";
import {
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Mountain,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

export default function ContinuityView({ protocols, campusLayers }) {
  const [activeTab, setActiveTab] = useState("protocols");
  const [expandedLevel, setExpandedLevel] = useState("ATENCION_PREVENTIVA");

  const levels = protocols?.preventive_levels || [];
  const basins = protocols?.trujillo_basins_context || [];
  const features = campusLayers?.campus?.features || [];
  const accesses = features.filter((f) => f.properties.category === "acceso");
  const meetingPoints = features.filter((f) => f.properties.category === "punto_encuentro");

  return (
    <div className="space-y-6">
      {/* Encabezado y navegación por categorías */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 dark:border-slate-800 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Orientaciones y Continuidad Académica
          </h2>
          <p className="mt-1 max-w-3xl text-[15px] text-[#64748B] dark:text-slate-300">
            {protocols?.metadata?.disclaimer ||
              "Protocolos preventivos de apoyo informativo alineados con SINAGERD (Ley N.° 29664) y PLANAGERD 2022–2030."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Categorías de orientación"
          className="inline-flex flex-wrap rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-1 dark:border-slate-700 dark:bg-slate-900"
        >
          {[
            { id: "protocols", label: "Protocolos y Continuidad" },
            { id: "campus", label: "Accesos y Puntos Ref." },
            { id: "basins", label: "Quebradas de Trujillo" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
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

      {/* Tab 1: Protocolos por Nivel (Acordeón + Tarjetas) */}
      {activeTab === "protocols" && (
        <section className="space-y-3" aria-label="Protocolos preventivos por nivel">
          {levels.map((lvl) => {
            const isOpen = expandedLevel === lvl.level;
            return (
              <div
                key={lvl.level}
                className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedLevel(isOpen ? "" : lvl.level)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#F7F9FC] dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: lvl.color }}
                    />
                    <span className="text-base font-bold text-[#111827] dark:text-white">
                      {lvl.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="hidden rounded px-2 py-0.5 text-[11px] font-bold text-slate-950 sm:inline-block"
                      style={{ backgroundColor: lvl.color }}
                    >
                      {lvl.level}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[#64748B] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="grid grid-cols-1 gap-6 border-t border-[#E2E8F0] bg-[#F7F9FC]/60 p-5 dark:border-slate-800 dark:bg-slate-900/40 md:grid-cols-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#1D4ED8] dark:text-blue-400">
                        <ShieldCheck className="h-4 w-4" />
                        Orientaciones preventivas
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-[#111827] dark:text-slate-200">
                        {lvl.guidance.map((g, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0F766E] dark:text-teal-400">
                        <BookOpen className="h-4 w-4" />
                        Continuidad académica y administrativa
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-[#111827] dark:text-slate-200">
                        {lvl.continuity.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1D4ED8]" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Tab 2: Accesos y Puntos de Encuentro Referenciales */}
      {activeTab === "campus" && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-white">
              <MapPin className="h-4 w-4 text-[#1D4ED8]" />
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
              Accesos Perimetrales del Campus
            </h3>
            <div className="mt-4 space-y-2.5">
              {accesses.map((acc) => (
                <div
                  key={acc.properties.id}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-3 text-sm font-medium text-[#111827] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
                >
                  {acc.properties.name}
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Las rutas y puntos mostrados son referenciales; no garantizan transitabilidad ni
              reemplazan la señalización oficial de Defensa Civil UNT.
            </p>
          </div>
        </section>
      )}

      {/* Tab 3: Quebradas de Trujillo */}
      {activeTab === "basins" && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {basins.map((q) => (
            <div
              key={q.name}
              className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]"
            >
              <div className="flex items-center gap-2 text-base font-bold text-[#1D4ED8] dark:text-blue-400">
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
        </section>
      )}
    </div>
  );
}
