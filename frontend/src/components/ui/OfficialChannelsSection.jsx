import React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";

export const OFFICIAL_CHANNELS = [
  {
    id: "coer_coen",
    name: "COER La Libertad / COEN",
    competence: "Activación de quebradas y operaciones de emergencia",
    url: "https://coen.indeci.gob.pe/",
    badge: "Emergencias y quebradas",
  },
  {
    id: "senamhi",
    name: "SENAMHI",
    competence: "Avisos y pronósticos meteorológicos oficiales",
    url: "https://www.senamhi.gob.pe/",
    badge: "Meteorología oficial",
  },
  {
    id: "enfen",
    name: "ENFEN",
    competence: "Comunicados oficiales del Fenómeno El Niño y TSM",
    url: "https://enfen.imarpe.gob.pe/",
    badge: "FEN y TSM",
  },
  {
    id: "indeci",
    name: "INDECI",
    competence: "Marco normativo y lineamientos de preparación comunitaria",
    url: "https://www.gob.pe/indeci",
    badge: "Preparación SINAGERD",
  },
];

export default function OfficialChannelsSection({ compact = false }) {
  if (compact) {
    return (
      <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-white/90 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#101828] dark:text-slate-100">
          <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
          <span>Canales Oficiales de Alerta (por competencia)</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {OFFICIAL_CHANNELS.map((ch) => (
            <li
              key={ch.id}
              className="flex items-start justify-between gap-2 text-[11px] leading-snug"
            >
              <div className="min-w-0">
                <span className="font-semibold text-[#101828] dark:text-slate-100">{ch.name}</span>
                <span className="text-[#475467] dark:text-slate-400"> — {ch.competence}.</span>
              </div>
              <a
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
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
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-[#101828] dark:text-white">
            <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
            Canales Oficiales de Alerta
          </h3>
          <p className="mt-0.5 text-xs text-[#475467] dark:text-slate-400">
            Consulta directa según competencia institucional del SINAGERD. YAKU ALERT UNT no emite
            alertas oficiales.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OFFICIAL_CHANNELS.map((ch) => (
          <a
            key={ch.id}
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 transition hover:border-[#2563EB] hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-500"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#101828] group-hover:text-[#2563EB] dark:text-white dark:group-hover:text-blue-400">
                  {ch.name}
                </span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                  {ch.badge}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-[#475467] dark:text-slate-300">
                {ch.competence}
              </p>
            </div>
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#475467] group-hover:text-[#2563EB] dark:text-slate-400" />
          </a>
        ))}
      </div>
    </section>
  );
}
