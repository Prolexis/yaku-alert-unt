import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * 1. Ilustración dinámica de estado climático (100 % SVG offline)
 */
export function WeatherStateIllustration({ intensityMmH = 0, probabilityPct = 0 }) {
  const mode =
    intensityMmH >= 5 || probabilityPct >= 75
      ? "heavy"
      : intensityMmH >= 0.2 || probabilityPct >= 40
      ? "light"
      : "clear";

  return (
    <div
      className="relative flex h-24 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#F0F9FF] via-white to-[#F8FAFC] p-2 shadow-subtle dark:border-slate-700 dark:from-[#0B2545] dark:via-[#12325A] dark:to-[#071524]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 112 96" className="h-full w-full overflow-visible">
        {/* Sol para clima despejado o lluvia ligera */}
        {mode !== "heavy" && (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "76px 28px" }}
          >
            <circle cx="76" cy="28" r="13" fill="#F59E0B" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="76"
                y1="9"
                x2="76"
                y2="12.5"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
                transform={`rotate(${deg} 76 28)`}
              />
            ))}
          </motion.g>
        )}

        {/* Nube principal */}
        <motion.g
          animate={{ y: [0, -2.5, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M28 58h48a14 14 0 0 0 2-27.8A19 19 0 0 0 41 26a15 15 0 0 0-13 32Z"
            fill={mode === "heavy" ? "#0B2545" : mode === "light" ? "#0369A1" : "#FFFFFF"}
            stroke={mode === "clear" ? "#00B4D8" : "#00B4D8"}
            strokeWidth="2.2"
          />
          {mode === "clear" && (
            <path
              d="M34 52h36"
              stroke="#E0F2FE"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
        </motion.g>

        {/* Gotas animadas para lluvia ligera o intensa */}
        {mode !== "clear" &&
          (mode === "heavy" ? [34, 48, 62, 74] : [40, 56, 70]).map((x, idx) => (
            <motion.line
              key={x}
              x1={x}
              y1={64}
              x2={x - 3}
              y2={mode === "heavy" ? 78 : 73}
              stroke="#00B4D8"
              strokeWidth={mode === "heavy" ? "3" : "2.5"}
              strokeLinecap="round"
              initial={{ y: 0, opacity: 0.2 }}
              animate={{ y: [0, 10, 0], opacity: [0.25, 1, 0.25] }}
              transition={{
                duration: mode === "heavy" ? 0.9 : 1.4,
                delay: idx * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

        {/* Rayo sutil solo en lluvia intensa */}
        {mode === "heavy" && (
          <motion.path
            d="M56 58l-5 11h6l-4 11 11-14h-6l4-8z"
            fill="#F59E0B"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </svg>
    </div>
  );
}

/**
 * 2. Tarjetas visuales de estado de accesos (P1, P2, P3, P4)
 */
const UNT_GATES = [
  { code: "P1", label: "Puerta 1", street: "Av. Juan Pablo II (Principal)", match: ["puerta 1", "p1"] },
  { code: "P2", label: "Puerta 2", street: "Av. Juan Pablo II / Derecho", match: ["puerta 2", "p2", "derecho"] },
  { code: "P3", label: "Puerta 3", street: "Comedor / Bienestar", match: ["puerta 3", "p3", "comedor"] },
  { code: "P4", label: "Puerta 4", street: "Av. Jesús de Nazareth / CIDUNT", match: ["puerta 4", "p4", "nazareth", "cidunt"] },
];

function resolveGateState(gate, { simResult, hydroResult, campusReports = [] }) {
  // 1. Revisar reportes anónimos activos de la comunidad
  const matchingReport = campusReports.find((r) => {
    if (r.status === "atendido") return false;
    const z = String(r.zone_name || "").toLowerCase();
    return gate.match.some((kw) => z.includes(kw));
  });
  if (matchingReport) {
    if (matchingReport.category === "acceso_bloqueado" || matchingReport.severity === "alta") {
      return {
        key: "avoid",
        label: "Evitar por aniego",
        tone: "border-[#DC2626]/35 bg-[#FEF2F2] text-[#991B1B] dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
        dot: "#DC2626",
      };
    }
    if (matchingReport.category !== "zona_segura_ok") {
      return {
        key: "caution",
        label: "Precaución",
        tone: "border-[#D97706]/35 bg-[#FFFBEB] text-[#92400E] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        dot: "#D97706",
      };
    }
  }

  // 2. Revisar simulación hidrológica activa si existe
  if (hydroResult?.elements?.length) {
    const affected = hydroResult.elements.find((e) => {
      if (e.first_hour_affected === null || e.first_hour_affected === undefined) return false;
      const nm = String(e.name || "").toLowerCase();
      return gate.match.some((kw) => nm.includes(kw));
    });
    if (affected) {
      return (affected.max_depth_cm ?? 0) >= 10
        ? {
            key: "avoid",
            label: "Evitar por aniego",
            tone: "border-[#DC2626]/35 bg-[#FEF2F2] text-[#991B1B] dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
            dot: "#DC2626",
          }
        : {
            key: "caution",
            label: "Precaución",
            tone: "border-[#D97706]/35 bg-[#FFFBEB] text-[#92400E] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
            dot: "#D97706",
          };
    }
  }

  // 3. Revisar exposición espacial de referencia (solo precaución, no alerta real)
  if (simResult?.spatial_analysis?.restricted_accesses?.length) {
    const restricted = simResult.spatial_analysis.restricted_accesses.find((a) => {
      if (!a.inside_hazard_zone) return false;
      const nm = String(a.name || "").toLowerCase();
      return gate.match.some((kw) => nm.includes(kw));
    });
    if (restricted) {
      return {
        key: "caution",
        label: "Precaución",
        tone: "border-[#D97706]/35 bg-[#FFFBEB] text-[#92400E] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        dot: "#D97706",
      };
    }
  }

  return {
    key: "free",
    label: "Libre",
    tone: "border-[#059669]/30 bg-[#ECFDF5] text-[#065F46] dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
    dot: "#059669",
  };
}

export function CampusAccessStatusStrip({
  simResult,
  hydroResult,
  campusReports = [],
  onOpenMap,
}) {
  return (
    <section
      aria-label="Estado referencial de accesos UNT"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-[#0B2545] sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
            Estado referencial de puertas UNT (P1 – P4)
          </h3>
          <p className="text-xs text-[#475569] dark:text-slate-300">
            Cruce en vivo con reportes anónimos y zonas históricas de anegamiento.
          </p>
        </div>
        {onOpenMap && (
          <button
            type="button"
            onClick={onOpenMap}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
          >
            <span>Ver en mapa</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {UNT_GATES.map((gate) => {
          const st = resolveGateState(gate, { simResult, hydroResult, campusReports });
          return (
            <button
              key={gate.code}
              type="button"
              onClick={() => onOpenMap?.()}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition hover:shadow-sm ${st.tone}`}
            >
              {/* Mini SVG de puerta / arco */}
              <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
                <rect x="4" y="6" width="24" height="20" rx="5" fill="#0B2545" opacity="0.1" />
                <path
                  d="M9 24V12a7 7 0 0 1 14 0v12"
                  fill="none"
                  stroke={st.dot}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="18" r="3.2" fill={st.dot} />
              </svg>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-extrabold">{gate.code}</span>
                  <span className="truncate text-xs font-bold">{gate.label}</span>
                </div>
                <div className="mt-0.5 text-xs font-extrabold">{st.label}</div>
                <div className="mt-0.5 truncate text-[11px] opacity-80">{gate.street}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 3. Tres pasos ilustrados de acción inmediata para Estudiantes
 */
export function StudentThreeStepsStrip({ onNavigate }) {
  const steps = [
    {
      num: "01",
      title: "Infórmate",
      desc: "Revisa la probabilidad de lluvia (%) y avisos UNT antes de salir.",
      target: "student_map",
      cta: "Abrir mapa",
      color: "#00B4D8",
      svg: (
        <svg viewBox="0 0 44 44" className="h-10 w-10 shrink-0" aria-hidden="true">
          <rect width="44" height="44" rx="12" fill="#F0F9FF" />
          <circle cx="22" cy="18" r="7" fill="#00B4D8" />
          <path d="M13 31c2-4 6-6 9-6s7 2 9 6" stroke="#0B2545" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
    {
      num: "02",
      title: "Evacúa por ruta segura",
      desc: "Ubica tu facultad y sigue la ruta verde hacia el punto seguro más cercano.",
      target: "student_sim",
      cta: "Ver simulación",
      color: "#059669",
      svg: (
        <svg viewBox="0 0 44 44" className="h-10 w-10 shrink-0" aria-hidden="true">
          <rect width="44" height="44" rx="12" fill="#ECFDF5" />
          <path d="M12 31l8-11 6 5 7-12" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="33" cy="13" r="4" fill="#059669" />
        </svg>
      ),
    },
    {
      num: "03",
      title: "Continúa tus clases",
      desc: "Consulta pautas de virtualidad, brigadas y tu mochila de emergencia.",
      target: "continuity",
      cta: "Ver continuidad",
      color: "#F59E0B",
      svg: (
        <svg viewBox="0 0 44 44" className="h-10 w-10 shrink-0" aria-hidden="true">
          <rect width="44" height="44" rx="12" fill="#FFFBEB" />
          <rect x="11" y="13" width="22" height="15" rx="3" fill="#0B2545" />
          <path d="M16 20h12M16 24h7" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 31h26" stroke="#0B2545" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <section
      aria-label="Tres pasos de acción inmediata"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-3"
    >
      {steps.map((s) => (
        <button
          key={s.num}
          type="button"
          onClick={() => onNavigate?.(s.target)}
          className="group flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-subtle transition hover:border-[#00B4D8] hover:shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
        >
          {s.svg}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs font-extrabold"
                style={{ color: s.color }}
              >
                PASO {s.num}
              </span>
              <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                {s.title}
              </span>
            </div>
            <p className="mt-1 text-xs leading-snug text-[#475569] dark:text-slate-300">
              {s.desc}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] group-hover:underline dark:text-[#38BDF8]">
              {s.cta} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>
      ))}
    </section>
  );
}

/**
 * 4. Íconos ilustrados coloridos para los 10 artículos de la Mochila de Emergencia
 */
export function BackpackItemIcon({ id }) {
  const icons = {
    agua: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#E0F2FE" />
        <path d="M14 6c0 0-5.5 6.8-5.5 10.5a5.5 5.5 0 0 0 11 0C19.5 12.8 14 6 14 6Z" fill="#00B4D8" />
      </svg>
    ),
    linterna: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#FEF3C7" />
        <rect x="8" y="12" width="10" height="5" rx="1.5" fill="#0B2545" />
        <path d="M18 11l4-2v11l-4-2z" fill="#F59E0B" />
      </svg>
    ),
    radio: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#E0E7FF" />
        <line x1="9" y1="11" x2="18" y2="7" stroke="#0B2545" strokeWidth="2" strokeLinecap="round" />
        <rect x="6" y="11" width="16" height="10" rx="2.5" fill="#0369A1" />
        <circle cx="11" cy="16" r="2.2" fill="#FFFFFF" />
      </svg>
    ),
    botiquin: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#FEE2E2" />
        <rect x="6" y="9" width="16" height="12" rx="2.5" fill="#DC2626" />
        <path d="M14 12v6M11 15h6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    documentos: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#ECFDF5" />
        <rect x="8" y="6" width="12" height="16" rx="2" fill="#059669" />
        <path d="M11 11h6M11 15h6M11 18h4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    silbato: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#FEF3C7" />
        <path d="M8 15a5 5 0 1 0 9.5 2H21v-4h-7.5A5 5 0 0 0 8 15Z" fill="#D97706" />
      </svg>
    ),
    powerbank: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#E0F2FE" />
        <rect x="8" y="7" width="12" height="15" rx="2.5" fill="#0B2545" />
        <path d="M14.5 10l-3 5h2.5l-1 4 3.5-5.5H14z" fill="#00B4D8" />
      </svg>
    ),
    alimentos: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#FFEDD5" />
        <rect x="8" y="9" width="12" height="12" rx="3" fill="#EA580C" />
        <path d="M8 13h12" stroke="#FED7AA" strokeWidth="2" />
      </svg>
    ),
    mascarillas: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#ECFDF5" />
        <rect x="7" y="10" width="14" height="8" rx="3" fill="#059669" />
        <path d="M10 14h8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    manta: (
      <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="#F1F5F9" />
        <path d="M8 9h12v11l-6-3-6 3V9Z" fill="#0369A1" />
      </svg>
    ),
  };

  return icons[id] || icons.agua;
}
