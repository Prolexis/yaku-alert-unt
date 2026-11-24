import React from "react";
import {
  LayoutDashboard,
  CloudRain,
  Map as MapIcon,
  ShieldCheck,
  Sliders,
  BookOpen,
  Waves,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "monitoring", label: "Monitoreo", icon: CloudRain },
  { id: "map", label: "Mapa UNT", icon: MapIcon },
  { id: "simulator", label: "Simulaciones", icon: Sliders, badge: "SIM" },
  { id: "prevention", label: "Análisis preventivo", icon: ShieldCheck },
  { id: "continuity", label: "Orientaciones y continuidad", icon: BookOpen },
];

export default function Sidebar({
  activeView,
  onSelectView,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  simActive,
}) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#0B1F33] text-slate-100 transition-all duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-72 lg:w-[76px]" : "w-72 lg:w-64"}`}
      >
        {/* Identidad */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white">
              <Waves className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight text-white">
                  YAKU ALERT
                </div>
                <div className="truncate text-xs text-slate-400">UNT · Trujillo</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Módulos
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={`group flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
                  collapsed ? "justify-center" : "justify-between"
                } ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                      simActive
                        ? "bg-amber-400 text-slate-950"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pie institucional */}
        <div className="border-t border-white/10 p-3">
          {collapsed ? (
            <div
              title="Prototipo TRL 3–4 · Innova Norte 3G 2026"
              className="flex justify-center py-1"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
              <div className="flex items-center justify-between font-semibold text-white">
                <span>Prototipo TRL 3–4</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Innova Norte 3G 2026 · Ley N.° 29664 y Ley N.° 29733.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
