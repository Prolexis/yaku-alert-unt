import React, { useState } from "react";
import {
  Menu,
  Sun,
  Moon,
  HelpCircle,
  RefreshCw,
  FlaskConical,
  GraduationCap,
  Building2,
  ShieldCheck,
  Wrench,
  KeyRound,
  Bell,
  X,
} from "lucide-react";
import { formatLimaTime } from "../../utils/formatters";

const VIEW_TITLES = {
  dashboard: "Inicio",
  notifications: "Notificaciones",
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

const SUB_ROLES = {
  student: [
    { id: "estudiante", label: "Estudiante", short: "Est." },
    { id: "docente", label: "Docente", short: "Doc." },
    { id: "administrativo", label: "Administrativo", short: "Admin." },
  ],
  admin: [
    { id: "directivo", label: "Directivo", short: "Dir." },
    { id: "operador_riesgos", label: "Operador de Riesgos", short: "Oper." },
  ],
};

const ADMIN_DEMO_ACCOUNTS = [
  {
    role: "directivo",
    title: "Directivo / Decanato UNT",
    email: "directivo@unt.demo",
    scope: "Semáforo ejecutivo, validación humana CAP 1.2, WhatsApp y decisiones de continuidad.",
    icon: ShieldCheck,
  },
  {
    role: "operador_riesgos",
    title: "Operador de Gestión de Riesgos",
    email: "operador@unt.demo",
    scope: "Simulación en vivo (10 m), drenaje/canaletas, YAKU SENSE (S01–S06) y reportes ciudadanos.",
    icon: Wrench,
  },
];

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
  alertsBadgeCount = 0,
  hasUnconfirmedAlerts = false,
  onOpenNotifications,
}) {
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const isLive = weather?.data_status === "LIVE_API" && !forceOffline;
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);
  const levelCfg =
    PREVENTIVE_LEVEL_STYLES[preventiveLevel] || PREVENTIVE_LEVEL_STYLES.INFORMATIVO;
  const subOptions = userRole === "admin" ? SUB_ROLES.admin : SUB_ROLES.student;

  const handleQuickAdminLogin = (roleId) => {
    setAdminModalOpen(false);
    onSelectDemoRole?.(roleId);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0B2545]/95">
        <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Izquierda: menú móvil + título limpio + chip de estado actual */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="rounded-xl border border-slate-200/90 bg-white p-2 text-[#0F172A] shadow-subtle transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                {VIEW_TITLES[activeView] || "Yaku Alert"}
              </h1>

              {/* Mostrar chip técnico solo en Gestión UNT para no contradecir alertas ni duplicar tarjetas en Comunidad */}
              {preventiveLevel && userRole === "admin" && (
                <span
                  title={`Estado informativo: ${levelCfg.label}`}
                  className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold sm:inline-flex ${levelCfg.pill}`}
                >
                  <span className={`h-2 w-2 rounded-full ${levelCfg.dot}`} />
                  <span>{levelCfg.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* Derecha: Conmutador [Comunidad UNT | Gestión UNT] + Selector limpio de rol + Utilidades */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Conmutador principal: [ Comunidad UNT | Gestión UNT ] */}
            <div
              role="group"
              aria-label="Modo de acceso"
              className="inline-flex items-center rounded-xl bg-slate-100/95 p-1 dark:bg-slate-900/90"
            >
              <button
                type="button"
                onClick={() => onChangeRole?.("student")}
                aria-pressed={userRole === "student"}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  userRole === "student"
                    ? "bg-white text-[#0B2545] shadow-sm dark:bg-[#0369A1] dark:text-white"
                    : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5 text-[#0369A1] dark:text-current" />
                <span>Comunidad UNT</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeRole?.("admin")}
                aria-pressed={userRole === "admin"}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  userRole === "admin"
                    ? "bg-[#0B2545] text-white shadow-sm dark:bg-[#0369A1]"
                    : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Gestión UNT</span>
              </button>
            </div>

            {/* Selector compacto de los 5 perfiles */}
            <div
              role="group"
              aria-label={
                userRole === "admin" ? "Perfil de Gestión UNT" : "Perfil de Comunidad UNT"
              }
              className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white p-0.5 shadow-subtle dark:border-slate-700 dark:bg-slate-900/90"
            >
              {subOptions.map((sub) => {
                const active = activeDemoRole === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => onSelectDemoRole?.(sub.id)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#0B2545] text-white shadow-sm dark:bg-[#0369A1] dark:text-white"
                        : "text-[#475569] hover:bg-slate-100 hover:text-[#0F172A] dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="sm:hidden">{sub.short}</span>
                    <span className="hidden sm:inline">{sub.label}</span>
                  </button>
                );
              })}

              {userRole === "admin" && (
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(true)}
                  title="Acceso demo rápido con cuentas sintéticas SQLite (Ley N.° 29733)"
                  className="ml-0.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-[#0369A1] hover:bg-[#F0F9FF] dark:text-[#38BDF8] dark:hover:bg-slate-800"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Demo</span>
                </button>
              )}
            </div>

            {/* Procedencia de datos discreta */}
            {isSimulationContext && userRole === "admin" ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-[#D97706]/35 bg-[#FFFBEB] px-2.5 py-1 text-xs font-bold text-[#B45309] dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 lg:inline-flex">
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Simulación experimental</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onToggleOffline(!forceOffline)}
                title={
                  utc
                    ? `Fuente Open-Meteo (${local} · UTC ${utc}). Alternar pronóstico / caché offline.`
                    : "Alternar entre pronóstico actualizado (Open-Meteo) y dato en caché offline"
                }
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition lg:inline-flex ${
                  isLive
                    ? "border-slate-200 bg-[#F8FAFC] text-emerald-800 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300"
                    : "border-sky-300/80 bg-sky-50 text-[#0369A1] hover:bg-sky-100/80 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                }`}
              >
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    isLive ? "bg-emerald-600" : "bg-[#0284C7]"
                  }`}
                />
                <span>{isLive ? "En línea" : "Caché offline"}</span>
              </button>
            )}

            {/* Barra unificada de utilidades rápidas */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-[#F8FAFC]/80 p-1 dark:border-slate-700/80 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label={`Notificaciones y alertas CAP (${alertsBadgeCount} activas)`}
                title={`Notificaciones y alertas CAP (${alertsBadgeCount} activas)`}
                className={`relative rounded-lg p-1.5 transition ${
                  activeView === "notifications"
                    ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                    : "text-[#0F172A] hover:bg-white hover:shadow-sm dark:text-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Bell className="h-4 w-4" />
                {alertsBadgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 font-mono text-[10px] font-extrabold text-white shadow-sm ring-2 ring-white dark:ring-[#0B2545]">
                    {hasUnconfirmedAlerts && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DC2626] opacity-60" />
                    )}
                    <span className="relative">{alertsBadgeCount}</span>
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Actualizar pronóstico"
                title="Actualizar pronóstico"
                className="rounded-lg p-1.5 text-[#475569] transition hover:bg-white hover:text-[#0F172A] hover:shadow-sm disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
                className="rounded-lg p-1.5 text-[#475569] transition hover:bg-white hover:text-[#0F172A] hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
                className="rounded-lg p-1.5 text-[#0369A1] transition hover:bg-white hover:shadow-sm dark:text-[#38BDF8] dark:hover:bg-slate-800"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modal rápido de acceso demo Gestión UNT (1 clic contra /api/auth/demo-login) */}
      {adminModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Acceso demo Gestión UNT"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071524]/60 p-4 backdrop-blur-sm"
          onClick={() => setAdminModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F0F9FF] px-2.5 py-0.5 text-[11px] font-bold text-[#0369A1] dark:bg-sky-950 dark:text-[#38BDF8]">
                  Sesión demo sintética — Ley N.° 29733
                </span>
                <h2 className="mt-1.5 text-base font-extrabold text-[#0F172A] dark:text-white">
                  Acceso rápido · Gestión UNT
                </h2>
                <p className="mt-0.5 text-xs text-[#475569] dark:text-slate-300">
                  Elige un perfil institucional sintético (0 PII) autenticado en SQLite local:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                aria-label="Cerrar modal de acceso demo"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {ADMIN_DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const isSelected = activeDemoRole === acc.role;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleQuickAdminLogin(acc.role)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-[#0369A1] bg-[#F0F9FF] ring-1 ring-[#0369A1] dark:border-[#38BDF8] dark:bg-sky-950/50"
                        : "border-slate-200 bg-[#F8FAFC] hover:border-[#00B4D8] dark:border-slate-700 dark:bg-slate-900/60"
                    }`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B2545] text-white dark:bg-[#0369A1]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                          {acc.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#0369A1] dark:text-[#38BDF8]">
                          {acc.email}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-[#475569] dark:text-slate-300">
                        {acc.scope}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
