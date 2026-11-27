import React from "react";
import { motion } from "framer-motion";
import {
  Menu,
  Sun,
  Moon,
  HelpCircle,
  RefreshCw,
  FlaskConical,
  GraduationCap,
  Building2,
} from "lucide-react";
import { formatLimaTime } from "../../utils/formatters";

const VIEW_TITLES = {
  dashboard: "Inicio",
  student_map: "Mapa UNT",
  student_sim: "Simulación de lluvias",
  monitoring: "Monitoreo sinóptico",
  map: "Mapa técnico + IoT",
  hydro: "Simulación dinámica",
  simulator: "Simulaciones",
  prevention: "Prevención",
  continuity: "Continuidad académica",
};

const PREVENTIVE_LEVEL_STYLES = {
  INFORMATIVO: {
    label: "Informativo",
    dot: "bg-[#059669]",
    pill: "border-[#059669]/30 bg-[#ECFDF5] text-[#059669] dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  VIGILANCIA_PREVENTIVA: {
    label: "Vigilancia",
    dot: "bg-[#0284C7]",
    pill: "border-[#0284C7]/30 bg-[#F0F9FF] text-[#0284C7] dark:border-sky-700/70 dark:bg-sky-950/60 dark:text-sky-300",
  },
  ATENCION_PREVENTIVA: {
    label: "Atención",
    dot: "bg-[#D97706]",
    pill: "border-[#D97706]/35 bg-[#FFFBEB] text-[#B45309] dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-300",
  },
  PREPARACION_CRITICA: {
    label: "Crítica",
    dot: "bg-[#DC2626]",
    pill: "border-[#DC2626]/35 bg-[#FEF2F2] text-[#DC2626] dark:border-red-700/70 dark:bg-red-950/60 dark:text-red-300",
  },
};

const ROLE_OPTIONS = [
  { id: "student", label: "Comunidad UNT", icon: GraduationCap },
  { id: "admin", label: "Gestión UNT", icon: Building2 },
];

const SUB_ROLES = {
  student: [
    { id: "estudiante", label: "Estudiante" },
    { id: "docente", label: "Docente" },
    { id: "administrativo", label: "Administrativo" },
  ],
  admin: [
    { id: "directivo", label: "Directivo" },
    { id: "operador_riesgos", label: "Operador Riesgos" },
  ],
};

export default function TopHeader({
  activeView,
  weather,
  forceOffline,
  onToggleOffline,
  onRefresh,
  loading,
  theme,
  onToggleTheme,
  onOpenHelp,
  onOpenMobileMenu,
  isSimulationContext,
  userRole = "student",
  onChangeRole,
  activeDemoRole = "estudiante",
  onSelectDemoRole,
  preventiveLevel,
}) {
  const isLive = weather?.data_status === "LIVE_API" && !forceOffline;
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);
  const levelCfg =
    PREVENTIVE_LEVEL_STYLES[preventiveLevel] || PREVENTIVE_LEVEL_STYLES.INFORMATIVO;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#0B2545]/95">
      <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {/* Izquierda: menú móvil + título de vista */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-slate-200 bg-white p-2 text-[#0F172A] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-base font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              {VIEW_TITLES[activeView] || "Yaku Alert"}
            </h1>
            <span className="hidden text-xs font-medium text-[#475569] dark:text-slate-300 xl:inline">
              · Ciudad Universitaria UNT
            </span>
          </div>
        </div>

        {/* Derecha: cabecera limpia — Perfil de consulta + Estado informativo + Fuente/Hora + Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nivel preventivo actual */}
          {preventiveLevel && (
            <span
              title={`Estado informativo: ${levelCfg.label}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${levelCfg.pill}`}
            >
              <span className={`h-2 w-2 rounded-full ${levelCfg.dot}`} />
              <span>{levelCfg.label}</span>
            </span>
          )}

          {/* Procedencia de datos clara (NUNCA "En vivo" para pronósticos Open-Meteo) */}
          {isSimulationContext ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D97706]/35 bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#B45309] dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Simulación experimental</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onToggleOffline(!forceOffline)}
              title="Alternar entre pronóstico actualizado (Open-Meteo) y dato en caché offline"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                isLive
                  ? "border-emerald-300/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "border-sky-300/80 bg-sky-50 text-[#0369A1] hover:bg-sky-100/80 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
              }`}
            >
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  isLive ? "bg-emerald-600" : "bg-[#0284C7]"
                }`}
              />
              <span>{isLive ? "Pronóstico actualizado" : "Dato en caché"}</span>
              <span
                title={utc ? `Actualizado: ${utc}` : undefined}
                className="hidden font-mono text-[11px] font-normal opacity-80 lg:inline"
              >
                · {local}
              </span>
            </button>
          )}

          {/* Perfil público de consulta (solo adapta recomendaciones, sin privilegios admin) */}
          {userRole === "student" ? (
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#475569] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <GraduationCap className="h-3.5 w-3.5 text-[#0369A1]" />
              <span className="hidden sm:inline">Perfil:</span>
              <select
                aria-label="Perfil público de consulta"
                value={activeDemoRole}
                onChange={(e) => onSelectDemoRole?.(e.target.value)}
                className="bg-transparent font-bold text-[#0F172A] outline-none dark:text-white"
              >
                {SUB_ROLES.student.map((sub) => (
                  <option key={sub.id} value={sub.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                    {sub.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <button
              type="button"
              onClick={() => onChangeRole?.("student")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-50 px-2.5 py-1 text-xs font-bold text-[#0369A1] hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Gestión UNT · Volver a Comunidad</span>
            </button>
          )}

          {/* Acciones rápidas */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Actualizar pronóstico"
              title="Actualizar pronóstico"
              className="rounded-lg border border-slate-200 bg-white p-2 text-[#0F172A] transition hover:border-[#00B4D8] hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin text-[#0369A1]" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}
              className="rounded-lg border border-slate-200 bg-white p-2 text-[#0F172A] transition hover:border-[#00B4D8] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4 text-[#F59E0B]" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="Ayuda y metodología"
              title="Ayuda y metodología"
              className="rounded-lg border border-slate-200 bg-white p-2 text-[#0369A1] transition hover:border-[#00B4D8] hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-[#38BDF8] dark:hover:bg-slate-800"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
