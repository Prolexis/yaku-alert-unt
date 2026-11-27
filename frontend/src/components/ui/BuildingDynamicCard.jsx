import React, { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Droplets,
  Navigation,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";

const RISK_STYLES = {
  critico: {
    badge: "bg-[#DC2626] text-white",
    border: "border-[#DC2626]/45 dark:border-red-700",
    bg: "bg-[#FEF2F2]/70 dark:bg-red-950/35",
    label: "Crítico",
  },
  alto: {
    badge: "bg-[#D97706] text-white",
    border: "border-[#D97706]/45 dark:border-amber-700",
    bg: "bg-[#FFFBEB]/80 dark:bg-amber-950/35",
    label: "Alto",
  },
  moderado: {
    badge: "bg-[#0284C7] text-white",
    border: "border-[#0284C7]/40 dark:border-sky-700",
    bg: "bg-[#F0F9FF]/80 dark:bg-sky-950/35",
    label: "Moderado",
  },
  seguro: {
    badge: "bg-[#059669] text-white",
    border: "border-[#059669]/40 dark:border-emerald-700",
    bg: "bg-[#ECFDF5]/80 dark:bg-emerald-950/35",
    label: "Seguro",
  },
};

const ROLE_LABELS = {
  estudiante: "Estudiante",
  docente: "Docente",
  administrativo: "Administrativo",
};

function resolveCommunityRole(role) {
  if (role === "docente") return "docente";
  if (role === "administrativo" || role === "directivo" || role === "operador_riesgos") {
    return "administrativo";
  }
  return "estudiante";
}

export default function BuildingDynamicCard({
  buildingStatus,
  fallbackName = "",
  activeDemoRole = "estudiante",
  allowRolePreview = false,
  onTraceRoute,
  onClose,
}) {
  const defaultRole = resolveCommunityRole(activeDemoRole);
  const [previewRole, setPreviewRole] = useState(defaultRole);

  if (!buildingStatus) return null;

  const effectiveRole = allowRolePreview ? previewRole : defaultRole;
  const riskKey = buildingStatus.risk_level || "seguro";
  const st = RISK_STYLES[riskKey] || RISK_STYLES.seguro;
  const recommendation =
    buildingStatus.recommendations_by_role?.[effectiveRole] ||
    buildingStatus.recommendations_by_role?.estudiante ||
    "";
  const mp = buildingStatus.nearest_safe_meeting_point;
  const avoidGates = buildingStatus.avoid_gates || [];

  return (
    <section
      aria-label={`Estado dinámico de ${buildingStatus.name || fallbackName}`}
      className={`rounded-2xl border p-4 shadow-sm ${st.border} ${st.bg} bg-white dark:bg-[#0B2545]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${st.badge}`}>
              {st.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-900 dark:text-sky-300 dark:ring-slate-700">
              <Droplets className="h-3 w-3 text-[#0369A1]" />
              {buildingStatus.max_depth_cm ?? 0} cm
            </span>
            {buildingStatus.peak_hour !== null && buildingStatus.peak_hour !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#475569] ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                <Clock className="h-3 w-3" />
                Pico h+{buildingStatus.peak_hour}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base font-extrabold leading-snug text-[#0F172A] dark:text-white">
            {buildingStatus.name || fallbackName}
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tarjeta de edificio"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selector de rol opcional para Gestión UNT */}
      {allowRolePreview && (
        <div className="mt-2.5 flex items-center gap-1 rounded-xl bg-white/80 p-1 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-700">
          {["estudiante", "docente", "administrativo"].map((roleKey) => (
            <button
              key={roleKey}
              type="button"
              onClick={() => setPreviewRole(roleKey)}
              className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                effectiveRole === roleKey
                  ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                  : "text-[#475569] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {ROLE_LABELS[roleKey]}
            </button>
          ))}
        </div>
      )}

      {/* Recomendación específica para ESTE edificio y el rol activo */}
      <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white/95 p-3 dark:border-slate-700/80 dark:bg-slate-900/85">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#0369A1] dark:text-[#38BDF8]">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Recomendación para {ROLE_LABELS[effectiveRole]}</span>
        </div>
        <p className="mt-1 text-xs font-medium leading-relaxed text-[#0F172A] dark:text-slate-100">
          {recommendation}
        </p>
      </div>

      {/* Puertas a evitar */}
      {avoidGates.length > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
          <span>
            <strong>Evitar accesos:</strong> {avoidGates.join(", ")}
          </span>
        </div>
      )}

      {/* Punto de encuentro libre más cercano + botón Trazar ruta */}
      {mp && (
        <div className="mt-2.5 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/75 p-3 dark:border-emerald-800 dark:bg-emerald-950/35">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#059669] dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Punto de encuentro libre (&lt; 2 cm)</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-extrabold text-[#0F172A] dark:text-white">
                {mp.name}
              </div>
            </div>
            <div className="shrink-0 text-right font-mono text-[11px] font-bold text-[#065F46] dark:text-emerald-200">
              <div>~{mp.distance_m} m</div>
              <div>~{mp.walk_time_min} min</div>
            </div>
          </div>

          {onTraceRoute && (
            <button
              type="button"
              onClick={() => onTraceRoute(buildingStatus)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Trazar ruta segura desde aquí</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
