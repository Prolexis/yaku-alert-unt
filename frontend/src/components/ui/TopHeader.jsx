import React from "react";
import { Menu, MapPin, Clock, Wifi, WifiOff, Sun, Moon, HelpCircle, RefreshCw } from "lucide-react";

const VIEW_TITLES = {
  dashboard: "Dashboard",
  monitoring: "Monitoreo Meteorológico",
  map: "Mapa Interactivo UNT",
  simulator: "Simulador de Escenarios",
  prevention: "Análisis Preventivo",
  continuity: "Orientaciones y Continuidad",
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
  const lastUpdated = weather?.fetched_at_utc
    ? weather.fetched_at_utc.slice(0, 19).replace("T", " ") + " UTC"
    : "Sincronizando...";

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-[#0B1F33]/95">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-[#E2E8F0] p-2 text-[#111827] hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-base font-bold tracking-tight text-[#111827] dark:text-white sm:text-lg">
                {VIEW_TITLES[activeView] || "YAKU ALERT"}
              </h1>
              <span
                className={`hidden rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline-block ${
                  isSimulationContext
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                    : "bg-slate-100 text-[#64748B] dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {isSimulationContext ? "Escenario sintético" : "Pronóstico / Caché"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-[#64748B] dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-blue-400" />
                Ciudad Universitaria UNT
              </span>
              <span className="hidden items-center gap-1 md:inline-flex">
                <Clock className="h-3.5 w-3.5" />
                {lastUpdated}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleOffline(!forceOffline)}
            title="Alternar entre API Open-Meteo en vivo y caché local sin internet"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              isLive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            }`}
          >
            {isLive ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span className="hidden md:inline">En línea</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Offline</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar datos meteorológicos"
            title="Actualizar pronóstico"
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#111827] transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#2563EB]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
            title={theme === "light" ? "Modo oscuro" : "Modo claro"}
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#111827] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
            aria-label="Información, metodología y cumplimiento normativo"
            title="Ayuda y metodología"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <HelpCircle className="h-4 w-4 text-[#2563EB] dark:text-blue-400" />
            <span className="hidden sm:inline">Ayuda</span>
          </button>
        </div>
      </div>
    </header>
  );
}
