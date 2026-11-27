import React, { useState } from "react";
import {
  ArrowRight,
  BellRing,
  Map as MapIcon,
  ShieldCheck,
  AlertCircle,
  Info,
  CloudRain,
  Gauge,
  Percent,
  Waves,
  ShieldAlert,
  ChevronDown,
  Search,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";
import FacultyLookupCard from "./ui/FacultyLookupCard";
import ExecutiveDecisionCard from "./ui/ExecutiveDecisionCard";
import { AdminReportsInbox } from "./ui/CampusReportModal";
import DataSourcesPanel from "./ui/DataSourcesPanel";
import {
  WeatherStateIllustration,
  CampusAccessStatusStrip,
} from "./ui/StudentIllustrations";
import { formatLimaTime, humanPreventiveTitle } from "../utils/formatters";

const LEVEL_BADGE_MAP = {
  INFORMATIVO:
    "border-[#059669]/30 bg-[#ECFDF5] text-[#059669] dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  VIGILANCIA_PREVENTIVA:
    "border-[#0284C7]/30 bg-[#F0F9FF] text-[#0284C7] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  ATENCION_PREVENTIVA:
    "border-[#D97706]/35 bg-[#FFFBEB] text-[#B45309] dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  PREPARACION_CRITICA:
    "border-[#DC2626]/35 bg-[#FEF2F2] text-[#DC2626] dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
};

function buildSimpleConclusion(summary) {
  if (!summary) return "Consultando el pronóstico para la Ciudad Universitaria UNT...";
  const acc = summary.accumulated_24h_mm ?? 0;
  const maxI = summary.max_intensity_mm_h ?? 0;
  if (acc < 0.5 && maxI < 0.5) {
    return "No se prevén lluvias significativas en las próximas 24 horas (solo posible llovizna ligera).";
  }
  if (maxI >= 10 || acc >= 20) {
    return "El pronóstico estima lluvias moderadas a fuertes en las próximas 24 horas. Revisa las recomendaciones preventivas.";
  }
  return "Se estiman lluvias ligeras o intermitentes en las próximas 24 horas.";
}

const COMMUNITY_ROLE_GUIDE = {
  estudiante: {
    badge: "Perfil Estudiante",
    text: "Ubica tu ruta segura a puntos altos, evita puertas con aniego (Puerta 4 / Puerta 3) y confirma recepción cuando se emita una alerta CAP.",
  },
  docente: {
    badge: "Perfil Docente",
    text: "Habilita aula virtual UNT para clases teóricas, reprograma laboratorios y evaluaciones sin penalización y conduce al grupo hacia el punto seguro de tu pabellón.",
  },
  administrativo: {
    badge: "Perfil Personal Administrativo",
    text: "Activa Mesa de Partes virtual UNT, desconecta y resguarda equipos y expedientes en planta baja y coordina trabajo remoto preventivo.",
  },
};

export default function DashboardView({
  weather,
  weatherLoading,
  weatherError,
  liveEvaluation,
  campusLayers,
  simResult,
  hydroResult,
  onLocateInMap,
  onNavigate,
  onRefresh,
  userRole = "student",
  activeDemoRole = "estudiante",
  activeAlerts = [],
  campusReports = [],
  onOpenReportModal,
  onResolveAlert,
  onValidateAlert,
  onConfirmAlert,
  onSendWhatsApp,
  whatsappStatus = null,
  onUpdateReportStatus,
  liveSimulation = null,
}) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [showFacultySearch, setShowFacultySearch] = useState(false);

  if (weatherLoading && !weather) {
    return (
      <div className="space-y-5">
        <SkeletonCard lines={3} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (weatherError && !weather) {
    return (
      <div className="rounded-2xl border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B] dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <div className="flex items-center gap-2 text-base font-bold">
          <AlertCircle className="h-5 w-5" />
          No se pudo obtener el pronóstico
        </div>
        <p className="mt-1 text-sm">{weatherError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const summary = weather?.summary;
  const units = weather?.units || {};
  const next24 = weather?.hourly?.slice(0, 24) || [];
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);
  const preventiveLevel = liveEvaluation?.preventive_level || "INFORMATIVO";
  const statusTitle = liveEvaluation
    ? humanPreventiveTitle(preventiveLevel, false).split(" — ")[0]
    : "Evaluando";
  const maxProb24 =
    summary?.max_probability_24h_pct ?? summary?.max_probability_pct ?? "N/D";
  const levelBadgeStyle =
    LEVEL_BADGE_MAP[preventiveLevel] || LEVEL_BADGE_MAP.INFORMATIVO;
  const emittedActiveAlerts = activeAlerts.filter(
    (a) => a.status === "emitida" && a.active
  );
  const topAlert = emittedActiveAlerts[0] || null;
  const topAlertSev = String(topAlert?.severity || "AMARILLO").toUpperCase();
  const topAlertTone =
    topAlertSev === "ROJO"
      ? "border-[#DC2626]/45 bg-[#FEF2F2] text-[#991B1B] dark:border-red-800 dark:bg-red-950/45 dark:text-red-100"
      : topAlertSev === "NARANJA"
      ? "border-[#D97706]/45 bg-[#FFFBEB] text-[#92400E] dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100"
      : topAlertSev === "VERDE"
      ? "border-[#059669]/40 bg-[#ECFDF5] text-[#065F46] dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100"
      : "border-[#0284C7]/40 bg-[#F0F9FF] text-[#075985] dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-100";
  const topAlertBadge =
    topAlertSev === "ROJO"
      ? "bg-[#DC2626] text-white"
      : topAlertSev === "NARANJA"
      ? "bg-[#D97706] text-white"
      : topAlertSev === "VERDE"
      ? "bg-[#059669] text-white"
      : "bg-[#0284C7] text-white";

  return (
    <div className="space-y-6">
      {/* Franja compacta de alerta activa en 1 línea (sin apilar tarjetas gigantes en Inicio) */}
      {topAlert && (
        <section
          aria-label="Aviso institucional activo"
          className={`flex flex-col justify-between gap-2.5 rounded-2xl border px-4 py-3 shadow-subtle sm:flex-row sm:items-center ${topAlertTone}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${topAlertBadge}`}
            >
              <BellRing className="h-3 w-3" />
              <span>{topAlertSev}</span>
            </span>
            <span className="truncate font-extrabold">
              {topAlert.what_happens || topAlert.title}
            </span>
            {topAlert.where_zone && (
              <span className="hidden truncate opacity-85 xl:inline">
                · {topAlert.where_zone}
              </span>
            )}
            {emittedActiveAlerts.length > 1 && (
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#0B2545] dark:bg-slate-900/80 dark:text-white">
                +{emittedActiveAlerts.length - 1} más
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("notifications")}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0B2545] px-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Ver notificaciones</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(userRole === "admin" ? "map" : "student_map")}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-current/25 bg-white/85 px-3 text-xs font-bold text-[#0B2545] transition hover:bg-white dark:bg-slate-900/85 dark:text-white"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Ver rutas seguras</span>
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECCIÓN A — ESTADO ACTUAL (Estudiante vs Gestión UNT)
         ===================================================================== */}
      {userRole === "admin" ? (
        <ExecutiveDecisionCard
          weather={weather}
          liveEvaluation={liveEvaluation}
          simResult={simResult}
          hydroResult={hydroResult}
          activeAlerts={activeAlerts}
          activeDemoRole={activeDemoRole}
          onPrepareNotice={() => onNavigate("prevention")}
          onOpenMap={() => onNavigate("map")}
          onOpenContinuity={() => onNavigate("continuity")}
          onOpenHydro={() => onNavigate("hydro")}
        />
      ) : (
        <section
          aria-label="¿Cómo está el pronóstico en la UNT?"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <WeatherStateIllustration
                intensityMmH={summary?.max_intensity_mm_h ?? 0}
                probabilityPct={typeof maxProb24 === "number" ? maxProb24 : 0}
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${levelBadgeStyle}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: liveEvaluation?.level_color || "#059669" }}
                    />
                    <span>{statusTitle}</span>
                  </span>
                  <span className="text-xs text-[#475569] dark:text-slate-300" title={utc}>
                    Pronóstico Open-Meteo · {local}
                  </span>
                  {liveSimulation?.active && (
                    <button
                      type="button"
                      onClick={() => onNavigate("student_map")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#0369A1]/35 bg-[#F0F9FF] px-2.5 py-0.5 text-[11px] font-bold text-[#0369A1] transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200"
                    >
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#0284C7]" />
                      <span>Simulación en vivo activa · Ver Mapa UNT</span>
                    </button>
                  )}
                </div>

                <h2 className="text-xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-2xl">
                  ¿Cómo está el pronóstico en la UNT?
                </h2>
                <p className="text-sm font-medium text-[#0F172A] dark:text-slate-100">
                  {buildSimpleConclusion(summary)}
                </p>
                <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                  <strong>Cómo leer estos datos:</strong> Una probabilidad alta ({maxProb24}%) indica posibilidad de que caiga al menos llovizna (≥0.1 mm), pero la cantidad prevista es de{" "}
                  <strong>{summary?.accumulated_24h_mm ?? 0} mm</strong> en 24 h (intensidad máx.{" "}
                  <strong>{summary?.max_intensity_mm_h ?? 0} mm/h</strong>).
                </p>
                {COMMUNITY_ROLE_GUIDE[activeDemoRole] && (
                  <div className="mt-2 rounded-xl border border-[#0369A1]/20 bg-[#F0F9FF]/75 px-3 py-2 text-xs text-[#0B2545] dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-100">
                    <span className="font-extrabold text-[#0369A1] dark:text-[#38BDF8]">
                      {COMMUNITY_ROLE_GUIDE[activeDemoRole].badge}:{" "}
                    </span>
                    <span className="font-medium">
                      {COMMUNITY_ROLE_GUIDE[activeDemoRole].text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECCIÓN B — TRES ACCIONES PRINCIPALES (Sin duplicar CTAs)
         ===================================================================== */}
      {userRole !== "admin" && (
        <section aria-label="Acciones principales" className="space-y-3">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            <PrimaryActionCard
              icon={<Search className="h-5 w-5 text-[#0369A1] dark:text-[#38BDF8]" />}
              iconBg="bg-[#F0F9FF] dark:bg-sky-950/60"
              title="1. Buscar mi facultad"
              desc="Encuentra tu ubicación en el campus"
              onClick={() => setShowFacultySearch((v) => !v)}
              active={showFacultySearch}
            />
            <PrimaryActionCard
              icon={<Waves className="h-5 w-5 text-[#D97706] dark:text-amber-400" />}
              iconBg="bg-[#FFFBEB] dark:bg-amber-950/50"
              title="2. Simular lluvias"
              desc="Explora escenarios tipo 2017 y 2023"
              onClick={() => onNavigate("student_sim")}
            />
            <PrimaryActionCard
              icon={<ShieldCheck className="h-5 w-5 text-[#059669] dark:text-emerald-400" />}
              iconBg="bg-[#ECFDF5] dark:bg-emerald-950/60"
              title="3. ¿Qué hago si llueve fuerte?"
              desc="Consulta recomendaciones preventivas"
              onClick={() => onNavigate("prevention")}
            />
          </div>

          {showFacultySearch && (
            <FacultyLookupCard
              campusLayers={campusLayers}
              simResult={simResult}
              onLocateInMap={onLocateInMap}
              onNavigate={onNavigate}
            />
          )}
        </section>
      )}

      {userRole === "admin" && (
        <FacultyLookupCard
          campusLayers={campusLayers}
          simResult={simResult}
          onLocateInMap={onLocateInMap}
          onNavigate={onNavigate}
        />
      )}

      {/* =====================================================================
          SECCIÓN C — INFORMACIÓN ADICIONAL (Gráfico 75% + Indicadores 25%)
         ===================================================================== */}
      <section
        aria-label="Evolución e indicadores de las próximas 24 horas"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch"
      >
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-9">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                Evolución próximas 24 horas
              </h3>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Precipitación horaria prevista (mm/h) y probabilidad (%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(userRole === "admin" ? "monitoring" : "student_map")}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
            >
              <span>{userRole === "admin" ? "Monitoreo 24h / 48h" : "Abrir Mapa UNT"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <PrecipitationChart points={next24} height={220} />
        </div>

        {summary && (
          <aside
            aria-label="Indicadores principales"
            className="flex flex-col justify-between divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 py-1 shadow-panel dark:divide-slate-800 dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-3"
          >
            <CompactKpiRow
              icon={<CloudRain className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />}
              iconBg="bg-[#F0F9FF] dark:bg-sky-950/60"
              label="Lluvia 24 h"
              value={`${summary.accumulated_24h_mm}`}
              unit={units.precipitation || "mm"}
              note={`48 h: ${summary.accumulated_48h_mm} ${units.precipitation || "mm"}`}
            />
            <CompactKpiRow
              icon={<Gauge className="h-4 w-4 text-[#0B2545] dark:text-cyan-300" />}
              iconBg="bg-slate-100 dark:bg-slate-800"
              label="Intensidad máxima"
              value={`${summary.max_intensity_mm_h}`}
              unit={`${units.precipitation || "mm"}/h`}
            />
            <CompactKpiRow
              icon={<Percent className="h-4 w-4 text-[#D97706] dark:text-amber-400" />}
              iconBg="bg-[#FFFBEB] dark:bg-amber-950/50"
              label="Probabilidad de lluvia"
              value={`${maxProb24}`}
              unit="%"
              note="Chance de ≥0.1 mm"
            />
            <div className="py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                  Estado informativo
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-9">
                {liveEvaluation && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: liveEvaluation.level_color }}
                  />
                )}
                <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {statusTitle}
                </span>
              </div>
              <div className="mt-1 pl-9">
                <button
                  type="button"
                  onClick={() => onNavigate("prevention")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
                >
                  Ver ficha explicable <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </section>

      {/* Estado referencial de puertas P1-P4 */}
      <CampusAccessStatusStrip
        simResult={simResult}
        hydroResult={hydroResult}
        campusReports={campusReports}
        onOpenMap={() => onNavigate(userRole === "admin" ? "map" : "student_map")}
      />

      {/* Bandeja de reportes comunitarios anónimos (solo Gestión UNT) */}
      {userRole === "admin" && (
        <AdminReportsInbox
          reports={campusReports}
          onUpdateStatus={onUpdateReportStatus}
        />
      )}

      {/* Apartado secundario desplegable: «Cómo funciona YAKU ALERT» (Fuentes y limitaciones) */}
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B2545]">
        <button
          type="button"
          onClick={() => setHowItWorksOpen((v) => !v)}
          aria-expanded={howItWorksOpen}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
            <div>
              <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                Cómo funciona YAKU ALERT (fuentes, modelos y limitaciones)
              </span>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Pronóstico Open-Meteo, datos históricos 2017/2023, DEM Copernicus GLO-30 y límites científicos
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-[#475569] transition-transform ${
              howItWorksOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {howItWorksOpen && (
          <div className="space-y-4 border-t border-slate-200 p-5 dark:border-slate-800">
            <DataSourcesPanel compact />
            {weather?.limitations && (
              <ul className="list-disc space-y-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-6 py-3 text-xs text-[#475569] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                {weather.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function PrimaryActionCard({ icon, iconBg, title, desc, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-[#0369A1] bg-[#F0F9FF]/70 ring-1 ring-[#0369A1] dark:border-[#38BDF8] dark:bg-sky-950/40"
          : "border-slate-200 bg-white hover:border-[#00B4D8] hover:shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </span>
        <div>
          <div className="text-sm font-extrabold text-[#0F172A] dark:text-white">{title}</div>
          <div className="text-xs text-[#475569] dark:text-slate-300">{desc}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#475569] transition group-hover:translate-x-0.5 group-hover:text-[#0369A1] dark:text-slate-400" />
    </button>
  );
}

function CompactKpiRow({ icon, iconBg, label, value, unit, note }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </span>
          <span className="text-xs font-bold text-[#475569] dark:text-slate-300">{label}</span>
        </div>
        {note && (
          <span className="font-mono text-[11px] font-medium text-[#475569] tabular-nums dark:text-slate-400">
            {note}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5 pl-9">
        <span className="font-mono text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums dark:text-white">
          {value}
        </span>
        <span className="font-mono text-xs font-bold text-[#475569] dark:text-slate-300">
          {unit}
        </span>
      </div>
    </div>
  );
}
