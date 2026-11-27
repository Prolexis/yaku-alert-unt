import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Bell,
  CloudRain,
  Map as MapIcon,
  ShieldCheck,
  Sliders,
  BookOpen,
  Waves,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  GraduationCap,
} from "lucide-react";
import { YakuAlertLogo, NexoRiskBadge } from "./BrandLogo";

export const STUDENT_NAV_GROUPS = [
  {
    title: "Consulta rápida",
    items: [
      {
        id: "dashboard",
        label: "Inicio",
        fullTitle: "Inicio y estado preventivo del campus",
        icon: LayoutDashboard,
      },
      {
        id: "notifications",
        label: "Notificaciones",
        fullTitle: "Centro de notificaciones y alertas CAP 1.2",
        icon: Bell,
      },
      {
        id: "student_map",
        label: "Mapa UNT",
        fullTitle: "Buscar facultad, puntos de encuentro y rutas referenciales",
        icon: MapIcon,
      },
      {
        id: "student_sim",
        label: "Simular lluvias",
        fullTitle: "Simulación experimental de lluvias tipo 2017 y 2023",
        icon: Waves,
      },
    ],
  },
  {
    title: "Preparación",
    items: [
      {
        id: "prevention",
        label: "Prevención y brigadas",
        fullTitle: "Orientaciones preventivas, brigadas y mochila de emergencia",
        icon: ShieldCheck,
      },
      {
        id: "continuity",
        label: "Continuidad académica",
        fullTitle: "Protocolos y recomendaciones de continuidad",
        icon: BookOpen,
      },
    ],
  },
];

export const DIRECTIVO_NAV_GROUPS = [
  {
    title: "Decisión Ejecutiva",
    items: [
      {
        id: "dashboard",
        label: "Dashboard directivo",
        fullTitle: "Semáforo ejecutivo y confirmaciones por perfil",
        icon: LayoutDashboard,
      },
      {
        id: "notifications",
        label: "Notificaciones",
        fullTitle: "Centro de notificaciones, validación CAP 1.2 e historial",
        icon: Bell,
      },
      {
        id: "prevention",
        label: "Validar alertas CAP",
        fullTitle: "Validación humana CAP 1.2 y difusión WhatsApp",
        icon: ShieldCheck,
      },
      {
        id: "continuity",
        label: "Decisiones continuidad",
        fullTitle: "Activar y finalizar medidas académicas y administrativas",
        icon: BookOpen,
      },
    ],
  },
  {
    title: "Consulta Operativa",
    items: [
      {
        id: "hydro",
        label: "Simulación en vivo",
        fullTitle: "Consulta del simulacro activo en malla 10 m",
        icon: Waves,
        badge: "10m",
      },
      {
        id: "map",
        label: "Mapa UNT",
        fullTitle: "Consulta de exposición y rutas seguras",
        icon: MapIcon,
      },
      {
        id: "monitoring",
        label: "Monitoreo sinóptico",
        fullTitle: "Pronóstico horario, presión atmosférica y viento",
        icon: CloudRain,
      },
    ],
  },
];

export const ADMIN_NAV_GROUPS = [
  {
    title: "Operación Técnica",
    items: [
      {
        id: "hydro",
        label: "Simulación dinámica",
        fullTitle: "Activar simulación en vivo (10 m) y drenaje/canaletas",
        icon: Waves,
        badge: "10m",
      },
      {
        id: "map",
        label: "Mapa técnico + IoT",
        fullTitle: "Mapa técnico del campus y red virtual YAKU SENSE (S01–S06)",
        icon: MapIcon,
      },
      {
        id: "dashboard",
        label: "Panel y reportes",
        fullTitle: "Resumen operativo y bandeja de reportes ciudadanos",
        icon: LayoutDashboard,
      },
      {
        id: "notifications",
        label: "Notificaciones",
        fullTitle: "Centro de notificaciones y alertas CAP 1.2",
        icon: Bell,
      },
      {
        id: "monitoring",
        label: "Monitoreo sinóptico",
        fullTitle: "Pronóstico horario, presión atmosférica y viento",
        icon: CloudRain,
      },
    ],
  },
  {
    title: "Escenarios y Avisos",
    items: [
      {
        id: "simulator",
        label: "Escenarios A/B/C/D",
        fullTitle: "Simulador paramétrico de escenarios de lluvia",
        icon: Sliders,
        badge: "SIM",
      },
      {
        id: "prevention",
        label: "Borradores CAP",
        fullTitle: "Generador de borradores CAP 1.2 y reportes",
        icon: ShieldCheck,
      },
      {
        id: "continuity",
        label: "Continuidad",
        fullTitle: "Consulta de medidas de continuidad vigentes",
        icon: BookOpen,
      },
    ],
  },
];

const ROLE_DISPLAY_NAMES = {
  estudiante: "Estudiante",
  docente: "Docente",
  administrativo: "Administrativo",
  directivo: "Directivo UNT",
  operador_riesgos: "Operador Riesgos",
};

export const STUDENT_NAV_ITEMS = STUDENT_NAV_GROUPS.flatMap((g) => g.items);
export const NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export default function Sidebar({
  activeView,
  onSelectView,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  simActive,
  userRole = "student",
  activeDemoRole = "estudiante",
  onChangeRole,
  alertsBadgeCount = 0,
}) {
  const groups =
    userRole === "admin"
      ? activeDemoRole === "directivo"
        ? DIRECTIVO_NAV_GROUPS
        : ADMIN_NAV_GROUPS
      : STUDENT_NAV_GROUPS;
  const roleLabel = ROLE_DISPLAY_NAMES[activeDemoRole] || "Estudiante";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#071524]/70 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#0B2545] text-slate-100 transition-all duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-64 lg:w-[76px]" : "w-64"}`}
      >
        {/* Cabecera de marca Yaku Alert */}
        <div
          className={`flex h-[60px] items-center border-b border-white/10 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <YakuAlertLogo
            size="sm"
            showSubtitle={!collapsed}
            variant="dark"
            iconOnly={collapsed}
          />

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label="Contraer menú"
              title="Contraer menú"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Botón expandir cuando está colapsado */}
        {collapsed && (
          <div className="hidden justify-center border-b border-white/10 py-2 lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Expandir menú"
              title="Expandir menú"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navegación agrupada y limpia */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {!collapsed && (
                <div className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
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
                      className={`group relative flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
                        collapsed ? "justify-center" : "justify-between"
                      } ${
                        isActive
                          ? "text-white"
                          : "text-slate-200 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-indicator"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-xl border border-[#00B4D8]/45 bg-[#00B4D8]/20 shadow-sm"
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-bar"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#00B4D8]"
                        />
                      )}

                      <span className="relative z-10 flex min-w-0 items-center gap-3">
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                            isActive
                              ? "text-[#38BDF8]"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>

                      {!collapsed && item.id === "notifications" && alertsBadgeCount > 0 ? (
                        <span className="relative z-10 rounded-full bg-[#DC2626] px-2 py-0.5 font-mono text-[11px] font-extrabold text-white">
                          {alertsBadgeCount}
                        </span>
                      ) : !collapsed && item.badge ? (
                        <span
                          className={`relative z-10 rounded-md px-1.5 py-0.5 font-mono text-xs font-bold ${
                            simActive && isActive
                              ? "bg-[#F59E0B] text-[#0B2545]"
                              : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie del sidebar: Acceso Comunidad vs Gestión UNT + firma NexoRisk */}
        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onChangeRole?.(userRole === "admin" ? "student" : "admin")}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                <span className="flex items-center gap-2">
                  {userRole === "admin" ? (
                    <GraduationCap className="h-3.5 w-3.5 text-[#38BDF8]" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                  )}
                  <span>{roleLabel}</span>
                </span>
                <span className="text-[11px] font-bold text-[#38BDF8]">
                  {userRole === "admin" ? "Comunidad" : "Gestión"}
                </span>
              </button>
              <NexoRiskBadge variant="dark" className="w-full" />
              <div className="flex items-center justify-between px-1 text-xs font-medium text-slate-300">
                <span className="font-mono">TRL 3–4 · SINAGERD</span>
                <span
                  title="Sistema operativo"
                  className="h-2 w-2 rounded-full bg-emerald-400"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeRole?.(userRole === "admin" ? "student" : "admin")}
                title={userRole === "admin" ? "Volver a Comunidad UNT" : "Acceso Gestión UNT"}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
              >
                {userRole === "admin" ? <GraduationCap className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </button>
              <NexoRiskBadge variant="dark" compact />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
