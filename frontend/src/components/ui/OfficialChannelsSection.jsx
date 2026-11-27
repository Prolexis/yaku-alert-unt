import React from "react";
import { ExternalLink, ShieldCheck, Radio, CloudRain, Waves } from "lucide-react";

export const OFFICIAL_CHANNELS = [
  {
    id: "coer_coen",
    name: "COER La Libertad / COEN",
    competence: "Activación de quebradas y operaciones de emergencia",
    url: "https://coen.indeci.gob.pe/",
    badge: "Emergencias y quebradas",
    icon: Radio,
    accent: "text-[#DC2626] bg-[#FEF2F2] dark:bg-red-950/60 dark:text-red-300",
  },
  {
    id: "senamhi",
    name: "SENAMHI",
    competence: "Avisos y pronósticos meteorológicos oficiales",
    url: "https://www.senamhi.gob.pe/",
    badge: "Meteorología oficial",
    icon: CloudRain,
    accent: "text-[#0369A1] bg-[#F0F9FF] dark:bg-sky-950/60 dark:text-sky-300",
  },
  {
    id: "enfen",
    name: "ENFEN",
    competence: "Comunicados oficiales del Fenómeno El Niño y TSM",
    url: "https://enfen.imarpe.gob.pe/",
    badge: "FEN y TSM",
    icon: Waves,
    accent: "text-[#00B4D8] bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-300",
  },
  {
    id: "indeci",
    name: "INDECI",
    competence: "Marco normativo y lineamientos de preparación comunitaria",
    url: "https://www.gob.pe/indeci",
    badge: "Preparación SINAGERD",
    icon: ShieldCheck,
    accent: "text-[#059669] bg-[#ECFDF5] dark:bg-emerald-950/60 dark:text-emerald-300",
  },
];

export default function OfficialChannelsSection({ compact = false }) {
  if (compact) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white/95 p-3 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-slate-100">
          <ShieldCheck className="h-3.5 w-3.5 text-[#0369A1]" />
          <span>Canales Oficiales de Alerta (por competencia)</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {OFFICIAL_CHANNELS.map((ch) => (
            <li
              key={ch.id}
              className="flex items-start justify-between gap-2 text-xs leading-snug"
            >
              <div className="min-w-0">
                <span className="font-bold text-[#0F172A] dark:text-slate-100">{ch.name}</span>
                <span className="text-[#475569] dark:text-slate-300"> — {ch.competence}.</span>
              </div>
              <a
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
              >
                <span>Abrir</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section
      aria-label="Canales Oficiales de Alerta"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0F172A] dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>Canales Oficiales de Alerta</span>
          </h3>
          <p className="mt-1 text-xs text-[#475569] dark:text-slate-300">
            Consulta directa según competencia institucional del SINAGERD. Yaku Alert UNT no emite
            alertas oficiales.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {OFFICIAL_CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <a
              key={ch.id}
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 transition hover:border-[#00B4D8] hover:bg-[#F0F9FF]/60 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-[#00B4D8]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ch.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#0369A1] dark:text-white dark:group-hover:text-[#38BDF8]">
                      {ch.name}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                      {ch.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-[#475569] dark:text-slate-300">
                    {ch.competence}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] dark:text-[#38BDF8]">
                    <span>Portal oficial</span>
                    <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
