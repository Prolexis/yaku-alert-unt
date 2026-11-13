import React from "react";
import { BookOpen, ShieldCheck, CheckCircle2, MapPin, Mountain, AlertCircle } from "lucide-react";

export default function ContinuityView({ protocols, campusLayers }) {
  const levels = protocols?.preventive_levels || [];
  const basins = protocols?.trujillo_basins_context || [];
  const features = campusLayers?.campus?.features || [];
  const accesses = features.filter((f) => f.properties.category === "acceso");
  const meetingPoints = features.filter((f) => f.properties.category === "punto_encuentro");

  return (
    <div className="space-y-6">
      {/* Encabezado normativo */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#14B8A6]/15 p-2.5">
            <BookOpen className="h-5 w-5 text-[#14B8A6]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
              Protocolos Preventivos y Continuidad Académica UNT
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
              {protocols?.metadata?.disclaimer ||
                "Orientaciones preventivas de apoyo informativo alineadas con SINAGERD (Ley N.° 29664) y PLANAGERD 2022–2030."}
            </p>
          </div>
        </div>
      </section>

      {/* Protocolos por nivel */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {levels.map((lvl) => (
          <div
            key={lvl.level}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">{lvl.label}</h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-950"
                style={{ backgroundColor: lvl.color }}
              >
                {lvl.level}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] dark:text-sky-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Orientaciones para la comunidad
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-[#64748B] dark:text-slate-300">
                {lvl.guidance.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14B8A6]" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
              <div className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                Continuidad académica y administrativa
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-[#64748B] dark:text-slate-400">
                {lvl.continuity.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* Accesos y Puntos de Encuentro Referenciales */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <MapPin className="h-4 w-4 text-[#2563EB]" />
            Accesos y Puntos de Encuentro Referenciales UNT
          </h3>
          <div className="mt-3 space-y-2.5 text-xs">
            {meetingPoints.map((mp) => (
              <div
                key={mp.properties.id}
                className="rounded-xl border border-tealbrand-500/30 bg-tealbrand-500/5 p-3"
              >
                <div className="font-semibold text-[#0F172A] dark:text-white">
                  {mp.properties.name}
                </div>
                <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400">
                  {mp.properties.note}
                </div>
              </div>
            ))}
            {accesses.map((acc) => (
              <div
                key={acc.properties.id}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="font-medium text-[#0F172A] dark:text-slate-200">
                  {acc.properties.name}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Las rutas y puntos mostrados son referenciales de demostración; no garantizan transitabilidad
            ni reemplazan la señalización oficial de Defensa Civil UNT.
          </p>
        </div>

        {/* Contexto Quebradas Trujillo */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Mountain className="h-4 w-4 text-[#14B8A6]" />
            Contexto Regional: Quebradas de Trujillo (Informativo)
          </h3>
          <div className="mt-3 space-y-3">
            {basins.map((q) => (
              <div
                key={q.name}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="font-bold text-[#2563EB] dark:text-tealbrand-400">{q.name}</div>
                <div className="mt-0.5 font-medium text-[#0F172A] dark:text-slate-200">{q.role}</div>
                <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">{q.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
