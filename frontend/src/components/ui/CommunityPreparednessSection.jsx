import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Users,
  HeartPulse,
  Megaphone,
  HardDrive,
  Backpack,
  RotateCcw,
  Lock,
  MapPin,
} from "lucide-react";
import { BackpackItemIcon } from "./StudentIllustrations";

const BRIGADES = [
  {
    id: "evacuacion",
    title: "Evacuación",
    icon: MapPin,
    accent: "text-[#059669] bg-[#ECFDF5] dark:bg-emerald-950/60 dark:text-emerald-300",
    summary: "Te guían hacia las zonas altas y seguras.",
  },
  {
    id: "auxilios",
    title: "Primeros auxilios",
    icon: HeartPulse,
    accent: "text-[#DC2626] bg-[#FEF2F2] dark:bg-red-950/60 dark:text-red-300",
    summary: "Te atienden rápido ante caídas o golpes.",
  },
  {
    id: "comunicacion",
    title: "Avisos reales",
    icon: Megaphone,
    accent: "text-[#0369A1] bg-[#F0F9FF] dark:bg-sky-950/60 dark:text-sky-300",
    summary: "Comparten solo alertas verificadas de la UNT.",
  },
  {
    id: "resguardo",
    title: "Aulas seguras",
    icon: HardDrive,
    accent: "text-[#B45309] bg-[#FFFBEB] dark:bg-amber-950/60 dark:text-amber-300",
    summary: "Cortan la luz y cuidan equipos si entra agua.",
  },
];

const BACKPACK_ITEMS = [
  { id: "agua", label: "Agua (2 litros)" },
  { id: "linterna", label: "Linterna con pilas" },
  { id: "radio", label: "Radio a pilas" },
  { id: "botiquin", label: "Botiquín personal" },
  { id: "documentos", label: "DNI y carné en bolsa" },
  { id: "silbato", label: "Silbato de ayuda" },
  { id: "powerbank", label: "Batería portátil" },
  { id: "alimentos", label: "Comida no perecible" },
  { id: "mascarillas", label: "Alcohol y mascarilla" },
  { id: "manta", label: "Poncho para lluvia" },
];

export default function CommunityPreparednessSection() {
  const [checkedIds, setCheckedIds] = useState([]);

  const totalCount = BACKPACK_ITEMS.length;

  const toggleItem = (id) => {
    setCheckedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length === totalCount && prev.length < totalCount) {
        toast.success("¡Mochila lista al 100%!", {
          description: "Completaste todos los artículos recomendados por INDECI.",
        });
      }
      return next;
    });
  };

  const completedCount = checkedIds.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <section aria-label="Mochila de emergencia y brigadas UNT" className="space-y-5">
      {/* 1. PRIMERO LO INTERACTIVO Y VISUAL: Tu Mochila de Emergencia */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
              <Backpack className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                Arma tu mochila de emergencia (toca lo que ya tienes)
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-300">
                Marca cada dibujo para ver cuánto te falta completar:
              </p>
            </div>
          </div>

          {completedCount > 0 && (
            <button
              type="button"
              onClick={() => setCheckedIds([])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#475569] transition hover:bg-slate-50 hover:text-[#0F172A] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Empezar de cero</span>
            </button>
          )}
        </div>

        {/* Barra de progreso súper clara */}
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-3.5 dark:border-slate-700/80 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#0F172A] dark:text-slate-100">
              Tienes listos{" "}
              <span className="font-mono text-sm font-extrabold text-[#059669] tabular-nums">
                {completedCount}
              </span>{" "}
              de {totalCount} artículos
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
            className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <motion.div
              className={`h-full rounded-full ${
                progressPct === 100
                  ? "bg-gradient-to-r from-[#059669] to-emerald-400"
                  : "bg-gradient-to-r from-[#0369A1] to-[#00B4D8]"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {BACKPACK_ITEMS.map((item) => {
            const isChecked = checkedIds.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-3.5 text-center text-xs transition ${
                  isChecked
                    ? "border-[#059669] bg-[#ECFDF5] text-[#065F46] ring-1 ring-[#059669]/30 dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-100"
                    : "border-slate-200 bg-[#F8FAFC]/70 text-[#0F172A] hover:border-[#0369A1]/50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <BackpackItemIcon id={item.id} />
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 shrink-0 rounded accent-[#059669]"
                  />
                </div>
                <span className={`w-full text-left font-bold leading-snug ${isChecked ? "line-through opacity-80" : ""}`}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400">
          <Lock className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
          <span>Lista privada en tu pantalla: no guarda ni pide tus datos personales.</span>
        </p>
      </div>

      {/* 2. Brigadas explicadas en palabras sencillas (sin párrafos largos) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              ¿Quiénes ayudan dentro del campus? (Brigadas UNT)
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-300">
              Equipos de apoyo universitario coordinados con zonas vecinas de Trujillo (San Andrés, El Porvenir y La Esperanza):
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BRIGADES.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/80 p-4 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${b.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h4 className="mt-3 text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {b.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                  {b.summary}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
