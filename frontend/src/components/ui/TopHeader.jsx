import React from "react";
import { Menu, Wifi, WifiOff, Sun, Moon, HelpCircle, RefreshCw, FlaskConical } from "lucide-react";
import { formatLimaTime } from "../../utils/formatters";

const VIEW_TITLES = {
  dashboard: "Inicio",
  student_map: "Mapa UNT",
  student_sim: "Simulación de lluvias",
  monitoring: "Monitoreo",
  map: "Mapa técnico + IoT",
  hydro: "Simulación dinámica",
  simulator: "Simulaciones",
  prevention: "Prevención",
  continuity: "Continuidad académica",
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
}) {
  const isLive = weather?.data_status === "LIVE_API" && !forceOffline;
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-[#0B1F33]/95">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-[#E2E8F0] p-2 text-[#101828] hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-base font-bold text-[#101828] dark:text-white">
              {VIEW_TITLES[activeView] || "YAKU ALERT"}
            </h1>
            <span className="hidden text-xs text-[#475467] dark:text-slate-400 sm:inline">
              · Ciudad Universitaria UNT
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Única indicación inequívoca de estado + fecha en America/Lima */}
          <span
            title={utc ? `Actualizado: ${utc}` : undefined}
            className="hidden text-xs text-[#475467] dark:text-slate-400 md:inline"
          >
            {local}
          </span>

          {isSimulationContext ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Simulación</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onToggleOffline(!forceOffline)}
              title="Alternar entre pronóstico en línea y caché offline"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                isLive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
              }`}
            >
              {isLive ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pronóstico</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Caché</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar pronóstico"
            title="Actualizar pronóstico"
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#101828] transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#2563EB]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
            title={theme === "light" ? "Modo oscuro" : "Modo claro"}
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#101828] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Ayuda y metodología"
            title="Ayuda y metodología"
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#101828] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <HelpCircle className="h-4 w-4 text-[#2563EB] dark:text-blue-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
