import React, { useState } from "react";
import {
  Users,
  HeartPulse,
  Megaphone,
  HardDrive,
  Backpack,
  CheckCircle2,
  RotateCcw,
  Lock,
  MapPin,
} from "lucide-react";

const BRIGADES = [
  {
    id: "evacuacion",
    title: "Evacuación y puntos seguros",
    icon: MapPin,
    accent: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300",
    tasks: [
      "Orientar el flujo ordenado hacia cotas altas (Explanada Sociales, Parque Max Díaz, Parque Economía).",
      "Señalizar desvíos si Puerta 4 (Av. Jesús de Nazareth) o Puerta 3 presentan anegamiento.",
      "Verificar el despeje de pasillos y escaleras en pabellones de mayor aforo.",
    ],
  },
  {
    id: "auxilios",
    title: "Primeros auxilios",
    icon: HeartPulse,
    accent: "text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300",
    tasks: [
      "Brindar atención básica ante caídas, cortes o estrés por lluvia intensa.",
      "Priorizar el acompañamiento de personas con movilidad reducida o adultos mayores.",
      "Coordinar derivación rápida con Bienestar Universitario y SAMU / Bomberos.",
    ],
  },
  {
    id: "comunicacion",
    title: "Comunicación verificada",
    icon: Megaphone,
    accent: "text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300",
    tasks: [
      "Replicar únicamente comunicados oficiales de UNT, SENAMHI, COER La Libertad y COEN.",
      "Evitar cadenas no verificadas que generen pánico o falsas alarmas en la comunidad.",
      "Reportar puntos de aniego observados a Defensa Civil UNT y delegados de facultad.",
    ],
  },
  {
    id: "resguardo",
    title: "Resguardo de laboratorios y equipos",
    icon: HardDrive,
    accent: "text-amber-800 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300",
    tasks: [
      "Elevar equipos de cómputo, reactivos y expedientes en oficinas y laboratorios de primer piso.",
      "Desconectar tableros o equipos eléctricos si se detectan filtraciones o humedad.",
      "Documentar incidencias de canaletas y drenajes para mantenimiento preventivo.",
    ],
  },
];

const BACKPACK_ITEMS = [
  { id: "agua", label: "Agua potable (mín. 2 litros por persona)", tag: "Esencial" },
  { id: "linterna", label: "Linterna con pilas de repuesto", tag: "Iluminación" },
  { id: "radio", label: "Radio portátil a pilas (para avisos sin internet)", tag: "Comunicación" },
  { id: "botiquin", label: "Botiquín básico de primeros auxilios y medicación personal", tag: "Salud" },
  { id: "documentos", label: "Documentos personales en bolsa hermética (DNI, carné UNT)", tag: "Identidad" },
  { id: "silbato", label: "Silbato de emergencia", tag: "Rescate" },
  { id: "powerbank", label: "Batería externa (powerbank) cargada y cable USB", tag: "Energía" },
  { id: "alimentos", label: "Alimentos no perecibles (enlatados, galletas, barras)", tag: "Alimentación" },
  { id: "mascarillas", label: "Mascarillas y alcohol en gel", tag: "Higiene" },
  { id: "manta", label: "Manta ligera o poncho impermeable", tag: "Abrigo" },
];

export default function CommunityPreparednessSection() {
  const [checkedIds, setCheckedIds] = useState([]);

  const toggleItem = (id) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const completedCount = checkedIds.length;
  const totalCount = BACKPACK_ITEMS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section aria-label="Acción comunitaria y mochila de emergencia" className="space-y-6">
      {/* Bloque 1: Brigadas Universitarias y Articulación Vecinal */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[#101828] dark:text-white">
              <Users className="h-4 w-4 text-[#2563EB]" />
              <span>Brigadas Universitarias y Articulación Vecinal</span>
            </h3>
            <p className="mt-1 text-xs text-[#475467] dark:text-slate-400">
              Roles prácticos de preparación comunitaria dentro de la Ciudad Universitaria UNT,
              articulados con los <strong>territorios vecinales de Trujillo</strong> (Urb. San
              Andrés, El Porvenir, La Esperanza y sectores aledaños) en el marco del SINAGERD.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {BRIGADES.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className="rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-lg p-1.5 ${b.accent}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-bold text-[#101828] dark:text-white">{b.title}</h4>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                  {b.tasks.map((task, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bloque 2: Mochila de Emergencia (Checklist interactivo local en memoria React) */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-[#101828] dark:text-white">
              <Backpack className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mochila de Emergencia (Checklist interactivo)</span>
            </h3>
            <p className="mt-0.5 text-xs text-[#475467] dark:text-slate-400">
              Marca los artículos que ya tienes listos en casa o en tu facultad (referencia INDECI).
            </p>
          </div>

          {completedCount > 0 && (
            <button
              type="button"
              onClick={() => setCheckedIds([])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-[#475467] hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reiniciar lista</span>
            </button>
          )}
        </div>

        {/* Barra de progreso en tiempo real */}
        <div className="mt-4 rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#101828] dark:text-slate-200">
              Avance de preparación: {completedCount} de {totalCount} artículos
            </span>
            <span
              className={`tabular-nums ${
                progressPct === 100
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-[#2563EB] dark:text-blue-400"
              }`}
            >
              {progressPct}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de mochila de emergencia"
            className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct === 100 ? "bg-emerald-600" : "bg-[#2563EB]"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BACKPACK_ITEMS.map((item) => {
            const isChecked = checkedIds.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition ${
                  isChecked
                    ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                    : "border-[#E2E8F0] bg-white text-[#101828] hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span className={isChecked ? "line-through opacity-80" : "font-medium"}>
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#475467] dark:bg-slate-800 dark:text-slate-400">
                  {item.tag}
                </span>
              </label>
            );
          })}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Checklist 100 % local en memoria del navegador: no recopila datos personales ni envía
            información al servidor (Ley N.° 29733).
          </span>
        </p>
      </div>
    </section>
  );
}
