import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
    accent: "text-[#059669] bg-[#ECFDF5] dark:bg-emerald-950/60 dark:text-emerald-300",
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
    accent: "text-[#DC2626] bg-[#FEF2F2] dark:bg-red-950/60 dark:text-red-300",
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
    accent: "text-[#0369A1] bg-[#F0F9FF] dark:bg-sky-950/60 dark:text-sky-300",
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
    accent: "text-[#B45309] bg-[#FFFBEB] dark:bg-amber-950/60 dark:text-amber-300",
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

  const totalCount = BACKPACK_ITEMS.length;

  const toggleItem = (id) => {
    setCheckedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length === totalCount && prev.length < totalCount) {
        toast.success("¡Mochila de emergencia completa al 100%!", {
          description: "Tu kit preventivo cumple con los artículos esenciales INDECI.",
        });
      }
      return next;
    });
  };

  const completedCount = checkedIds.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section aria-label="Acción comunitaria y mochila de emergencia" className="space-y-6">
      {/* Bloque 1: Brigadas Universitarias y Articulación Vecinal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0F172A] dark:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
                <Users className="h-4 w-4" />
              </span>
              <span>Brigadas Universitarias y Articulación Vecinal</span>
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              Roles prácticos de preparación comunitaria dentro de la Ciudad Universitaria UNT,
              articulados con los <strong className="text-[#0F172A] dark:text-white">territorios vecinales de Trujillo</strong> (Urb. San
              Andrés, El Porvenir, La Esperanza y sectores aledaños) en el marco del SINAGERD.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {BRIGADES.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 transition hover:border-[#00B4D8]/60 dark:border-slate-700/80 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex rounded-lg p-2 ${b.accent}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {b.title}
                  </h4>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                  {b.tasks.map((task, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bloque 2: Mochila de Emergencia (Checklist interactivo animado) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0F172A] dark:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                <Backpack className="h-4 w-4" />
              </span>
              <span>Mochila de Emergencia (Checklist interactivo)</span>
            </h3>
            <p className="mt-1 text-xs text-[#475569] dark:text-slate-300">
              Marca los artículos que ya tienes listos en casa o en tu facultad (referencia INDECI).
            </p>
          </div>

          {completedCount > 0 && (
            <button
              type="button"
              onClick={() => setCheckedIds([])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#475569] transition hover:bg-slate-50 hover:text-[#0F172A] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reiniciar lista</span>
            </button>
          )}
        </div>

        {/* Barra de progreso animada con framer-motion */}
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-4 dark:border-slate-700/80 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#0F172A] dark:text-slate-100">
              Avance de preparación:{" "}
              <span className="font-mono tabular-nums">
                {completedCount} / {totalCount}
              </span>{" "}
              artículos
            </span>
            <span
              className={`font-mono text-sm font-extrabold tabular-nums ${
                progressPct === 100
                  ? "text-[#059669] dark:text-emerald-400"
                  : "text-[#0369A1] dark:text-[#38BDF8]"
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
            className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <motion.div
              className={`h-full rounded-full ${
                progressPct === 100
                  ? "bg-gradient-to-r from-[#059669] to-emerald-400"
                  : "bg-gradient-to-r from-[#0B2545] to-[#00B4D8]"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {BACKPACK_ITEMS.map((item) => {
            const isChecked = checkedIds.includes(item.id);
            return (
              <motion.label
                key={item.id}
                whileTap={{ scale: 0.99 }}
                className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs transition ${
                  isChecked
                    ? "border-[#059669]/40 bg-[#ECFDF5]/80 text-[#065F46] dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
                    : "border-slate-200 bg-white text-[#0F172A] hover:border-[#00B4D8] dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 rounded accent-[#059669]"
                  />
                  <span className={isChecked ? "font-semibold line-through opacity-80" : "font-semibold"}>
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-[#475569] dark:bg-slate-800 dark:text-slate-300">
                  {item.tag}
                </span>
              </motion.label>
            );
          })}
        </div>

        <p className="mt-3.5 flex items-center gap-1.5 text-xs text-[#475569] dark:text-slate-400">
          <Lock className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
          <span>
            Checklist 100 % local en memoria del navegador: no recopila datos personales ni envía
            información al servidor (Ley N.° 29733).
          </span>
        </p>
      </div>
    </section>
  );
}
