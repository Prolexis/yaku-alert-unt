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
  Lock,
  GraduationCap,
} from "lucide-react";

export const STUDENT_NAV_ITEMS = [
  { id: "dashboard", label: "Inicio", fullTitle: "Inicio y consulta rápida", icon: LayoutDashboard },
  { id: "student_map", label: "Mapa UNT", fullTitle: "Mapa de monitoreo del campus UNT", icon: MapIcon },
  {
    id: "student_sim",
    label: "Simulación sencilla",
    fullTitle: "Simulación de lluvias tipo 2017 y 2023",
    icon: Waves,
    badge: "SIM",
  },
  { id: "prevention", label: "Prevención", fullTitle: "Orientaciones y avisos preventivos", icon: ShieldCheck },
  { id: "continuity", label: "Continuidad académica", fullTitle: "Recomendaciones de continuidad", icon: BookOpen },
];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", fullTitle: "Dashboard principal", icon: LayoutDashboard },
  { id: "monitoring", label: "Monitoreo", fullTitle: "Monitoreo meteorológico", icon: CloudRain },
  { id: "map", label: "Mapa UNT + IoT", fullTitle: "Mapa técnico y sensores IoT [SIM]", icon: MapIcon },
  {
    id: "hydro",
    label: "Simulación dinámica",
    fullTitle: "Agua modelada por hora (simulación exploratoria avanzada)",
    icon: Waves,
    badge: "EXP",
  },
  { id: "simulator", label: "Simulaciones", fullTitle: "Simulador de escenarios A/B/C/D", icon: Sliders, badge: "SIM" },
  { id: "prevention", label: "Prevención", fullTitle: "Análisis preventivo explicable", icon: ShieldCheck },
  { id: "continuity", label: "Continuidad", fullTitle: "Orientaciones y continuidad académica", icon: BookOpen },
];

export default function Sidebar({
  activeView,
  onSelectView,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  simActive,
  userRole = "student",
  onChangeRole,
}) {
  const items = userRole === "admin" ? NAV_ITEMS : STUDENT_NAV_ITEMS;
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
        } ${collapsed ? "w-64 lg:w-[72px]" : "w-64"}`}
      >
        {/* Marca */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
              <Waves className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-white">YAKU ALERT</div>
                <div className="text-[11px] text-slate-400">UNT · Trujillo</div>
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
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navegación diferenciada por rol */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
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
                title={item.fullTitle}
                aria-current={isActive ? "page" : undefined}
                className={`group flex h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition-colors duration-150 ${
                  collapsed ? "justify-center" : "justify-between"
                } ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  {!collapsed && <span>{item.label}</span>}
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

        {/* Selector de experiencia (Estudiante público vs Administrador técnico) */}
        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Rol activo</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-200">
                  {userRole === "admin" ? "Administrador" : "Estudiante"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChangeRole?.(userRole === "admin" ? "student" : "admin")}
                title="Separación de interfaz para demostración; en producción el acceso administrador requiere autenticación RBAC en backend."
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                  userRole === "admin"
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/15"
                }`}
              >
                {userRole === "admin" ? (
                  <>
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Volver a vista Estudiante</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Acceso Administrador</span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400">
                <span>TRL 3–4 · Ley N.° 29664</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChangeRole?.(userRole === "admin" ? "student" : "admin")}
              title={userRole === "admin" ? "Cambiar a vista Estudiante" : "Cambiar a vista Administrador"}
              className="flex w-full justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10"
            >
              {userRole === "admin" ? <GraduationCap className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
