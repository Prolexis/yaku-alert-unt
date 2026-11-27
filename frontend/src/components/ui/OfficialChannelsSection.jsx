import React from "react";
import { ExternalLink, ShieldCheck, Radio, CloudRain, Waves } from "lucide-react";

export const OFFICIAL_CHANNELS = [
  {
    id: "senamhi",
    name: "SENAMHI",
    competence: "Mira el pronóstico oficial de lluvias para hoy en Trujillo",
    url: "https://www.senamhi.gob.pe/",
    badge: "Clima y lluvias",
    icon: CloudRain,
    accent: "text-[#0369A1] bg-[#F0F9FF] dark:bg-sky-950/60 dark:text-sky-300",
  },
  {
    id: "coer_coen",
    name: "COER La Libertad / COEN",
    competence: "Reportes de quebradas, calles cerradas y emergencias en vivo",
    url: "https://coen.indeci.gob.pe/",
    badge: "Emergencias",
    icon: Radio,
    accent: "text-[#DC2626] bg-[#FEF2F2] dark:bg-red-950/60 dark:text-red-300",
  },
  {
    id: "indeci",
    name: "INDECI",
    competence: "Guías fáciles para cuidar a tu familia, casa y mochila de emergencia",
    url: "https://www.gob.pe/indeci",
    badge: "Consejos prácticos",
    icon: ShieldCheck,
    accent: "text-[#059669] bg-[#ECFDF5] dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  {
    id: "enfen",
    name: "ENFEN",
    competence: "Avisos oficiales sobre la llegada del Fenómeno El Niño en el Perú",
    url: "https://enfen.imarpe.gob.pe/",
    badge: "El Niño",
    icon: Waves,
    accent: "text-[#00B4D8] bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-300",
  },
];

export default function OfficialChannelsSection({ compact = false }) {
  if (compact) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {OFFICIAL_CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <a
              key={ch.id}
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-3 text-xs transition hover:border-[#0369A1] dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ch.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-[#0F172A] dark:text-white">{ch.name}</div>
                  <div className="truncate text-[11px] text-[#64748B] dark:text-slate-400">
                    {ch.competence}
                  </div>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <section
      aria-label="Canales Oficiales de Alerta"
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
            Páginas oficiales del Estado (sin rumores ni noticias falsas)
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-300">
            Toca cualquiera para abrir su portal oficial en una pestaña nueva:
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OFFICIAL_CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <a
              key={ch.id}
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/80 p-4 transition hover:border-[#0369A1] hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-[#38BDF8]"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ch.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#0369A1] dark:text-white dark:group-hover:text-[#38BDF8]">
                      {ch.name}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                      {ch.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                    {ch.competence}
                  </p>
                </div>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[#0369A1] transition group-hover:translate-x-0.5 dark:text-[#38BDF8]" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
