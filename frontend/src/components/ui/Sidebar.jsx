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
} from "lucide-react";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "monitoring", label: "Monitoreo meteorológico", icon: CloudRain },
  { id: "map", label: "Mapa interactivo", icon: MapIcon },
  { id: "prevention", label: "Análisis preventivo", icon: ShieldCheck },
  { id: "simulator", label: "Simulaciones", icon: Sliders, badge: "SIM" },
  { id: "continuity", label: "Orientaciones y continuidad", icon: BookOpen },
];

export default function Sidebar({ activeView, onSelectView, mobileOpen, onCloseMobile, simActive }) {
  return (
    <>
      {/* Backdrop en móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0B1F33] text-slate-100 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Marca */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#14B8A6] shadow-sm">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">YAKU ALERT</div>
              <div className="text-[11px] font-medium text-tealbrand-400">UNT • Geointeligencia</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de navegación */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Plataforma Preventiva
          </div>
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
                aria-current={isActive ? "page" : undefined}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-tealbrand-400"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
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
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-white">
              <span>Prototipo TRL 3–4</span>
              <span className="h-2 w-2 rounded-full bg-tealbrand-400" />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Innova Norte 3G 2026 · Desafío 3. Cumplimiento Ley N.° 29664 y Ley N.° 29733.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
