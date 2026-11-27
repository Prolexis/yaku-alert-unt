import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Map as MapIcon,
  BookOpen,
  Sliders,
  AlertCircle,
  Info,
  ShieldCheck,
  CloudRain,
  Gauge,
  Percent,
  Waves,
  ShieldAlert,
  Megaphone,
} from "lucide-react";
import PrecipitationChart from "./ui/PrecipitationChart";
import SkeletonCard from "./ui/SkeletonCard";
import FacultyLookupCard from "./ui/FacultyLookupCard";
import ExecutiveDecisionCard from "./ui/ExecutiveDecisionCard";
import ActiveAlertsBanner from "./ui/ActiveAlertsBanner";
import { AdminReportsInbox } from "./ui/CampusReportModal";
import DataSourcesPanel from "./ui/DataSourcesPanel";
import {
  WeatherStateIllustration,
  CampusAccessStatusStrip,
  StudentThreeStepsStrip,
} from "./ui/StudentIllustrations";
import { formatLimaTime, humanPreventiveTitle } from "../utils/formatters";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

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

function buildWeatherPhrase(summary) {
  if (!summary) return "Consultando condiciones para la Ciudad Universitaria UNT...";
  const acc = summary.accumulated_24h_mm ?? 0;
  const maxI = summary.max_intensity_mm_h ?? 0;
  const maxP = summary.max_probability_24h_pct ?? summary.max_probability_pct;
  const probSuffix =
    maxP !== null && maxP !== undefined ? ` (probabilidad máxima estimada: ${maxP}% en 24 h).` : ".";
  if (acc < 0.5 && maxI < 0.5) {
    return `No se estiman acumulados significativos en las próximas 24 horas${probSuffix}`;
  }
  if (maxI >= 10 || acc >= 20) {
    return `El modelo probabilístico sugiere posibilidad de lluvias moderadas a fuertes en las próximas 24 horas${probSuffix}`;
  }
  return `El modelo probabilístico sugiere posibilidad de lluvias ligeras o intermitentes en las próximas 24 horas${probSuffix}`;
}

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
  onUpdateReportStatus,
}) {
  const [limitsOpen, setLimitsOpen] = useState(false);

  if (weatherLoading && !weather) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <SkeletonCard lines={5} />
          </div>
          <div className="lg:col-span-3">
            <SkeletonCard lines={5} />
          </div>
        </div>
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* 0a. Buzón/Banner vivo de alertas emitidas por Gestión UNT */}
      {activeAlerts.length > 0 && (
        <motion.div variants={itemVariants}>
          <ActiveAlertsBanner
            alerts={activeAlerts}
            onOpenSafeRoutes={() => onNavigate(userRole === "admin" ? "map" : "student_map")}
            canResolve={userRole === "admin"}
            onResolveAlert={onResolveAlert}
            onValidateAlert={onValidateAlert}
            onConfirmAlert={onConfirmAlert}
            activeDemoRole={activeDemoRole}
          />
        </motion.div>
      )}

      {/* 0. Pieza principal según perfil */}
      {userRole === "admin" ? (
        <motion.div variants={itemVariants}>
          <ExecutiveDecisionCard
            weather={weather}
            liveEvaluation={liveEvaluation}
            simResult={simResult}
            hydroResult={hydroResult}
            onPrepareNotice={() => onNavigate("prevention")}
            onOpenMap={() => onNavigate("map")}
          />
        </motion.div>
      ) : (
        <motion.section
          variants={itemVariants}
          aria-label="Bienvenida y estado rápido para estudiantes"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545] sm:p-6"
        >
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <WeatherStateIllustration
                intensityMmH={summary?.max_intensity_mm_h ?? 0}
                probabilityPct={typeof maxProb24 === "number" ? maxProb24 : 0}
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold ${levelBadgeStyle}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: liveEvaluation?.level_color || "#059669",
                      }}
                    />
                    <span>{statusTitle}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#0B2545] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <CloudRain className="h-3.5 w-3.5 text-[#0369A1]" />
                    <span>Prob. máx. 24 h:</span>
                    <span className="font-mono font-extrabold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                      {maxProb24}%
                    </span>
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
                  Estado del campus UNT hoy
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-[#475569] dark:text-slate-300">
                  {buildWeatherPhrase(summary)}
                </p>
              </div>
            </div>

            {/* 2 botones grandes y directos para el estudiante */}
            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onNavigate("student_map")}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#0B2545] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1] dark:hover:bg-[#00B4D8]"
              >
                <MapIcon className="h-4 w-4 shrink-0" />
                <span>Ver zonas seguras y rutas</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onNavigate("student_sim")}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-[#0369A1]/35 bg-[#F0F9FF] px-5 text-sm font-bold text-[#0369A1] transition hover:bg-[#E0F2FE] dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/60"
              >
                <Waves className="h-4 w-4 shrink-0" />
                <span>Explorar simulación educativa 2017 / 2023</span>
              </motion.button>

              {onOpenReportModal && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onOpenReportModal}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D97706]/40 bg-[#FFFBEB] px-4 text-sm font-bold text-[#92400E] transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <Megaphone className="h-4 w-4 shrink-0" />
                  <span>Reportar incidente</span>
                </motion.button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200/80 pt-3 text-xs text-[#475569] dark:border-slate-700/80 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0369A1] dark:text-[#38BDF8]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {summary?.forecast_confidence_label || "Pronóstico probabilístico 48 h — Open-Meteo"}
            </span>
            <span className="font-mono tabular-nums" title={utc}>
              {local}
            </span>
            <button
              type="button"
              onClick={() => setLimitsOpen((v) => !v)}
              className="inline-flex items-center gap-1 font-semibold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
            >
              <Info className="h-3.5 w-3.5" />
              {limitsOpen ? "Ocultar limitaciones" : "Ver limitaciones"}
            </button>
          </div>

          {limitsOpen && weather?.limitations && (
            <ul className="mt-3 list-disc space-y-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-6 py-3 text-xs text-[#475569] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              {weather.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          )}
        </motion.section>
      )}

      {/* 1b. Estado visual de puertas P1-P4 + 3 pasos ilustrados (Vista Estudiante) */}
      {userRole !== "admin" && (
        <>
          <motion.div variants={itemVariants}>
            <CampusAccessStatusStrip
              simResult={simResult}
              hydroResult={hydroResult}
              campusReports={campusReports}
              onOpenMap={() => onNavigate("student_map")}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StudentThreeStepsStrip onNavigate={onNavigate} />
          </motion.div>
        </>
      )}

      {/* 1. Resumen meteorológico para Gestión UNT (en Estudiante ya va integrado arriba) */}
      {userRole === "admin" && (
        <motion.section variants={itemVariants} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              Condiciones meteorológicas en la UNT
            </h2>
            <span
              title={utc}
              className="font-mono text-xs font-medium text-[#475569] tabular-nums dark:text-slate-300"
            >
              Actualizado: {local}
            </span>
          </div>
          <p className="text-sm text-[#475569] dark:text-slate-300">
            {buildWeatherPhrase(summary)}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#475569] dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0284C7]/25 bg-[#F0F9FF] px-2.5 py-0.5 font-semibold text-[#0369A1] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {summary?.forecast_confidence_label || "Pronóstico probabilístico 48 h — Open-Meteo"}
              </span>
            </span>
            <span>No es medición de pluviómetro local</span>
            <button
              type="button"
              onClick={() => setLimitsOpen((v) => !v)}
              className="inline-flex items-center gap-1 font-semibold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
            >
              <Info className="h-3.5 w-3.5" />
              {limitsOpen ? "Ocultar limitaciones" : "Ver limitaciones"}
            </button>
          </div>

          {limitsOpen && weather?.limitations && (
            <ul className="mt-2 list-disc space-y-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs text-[#475569] dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-300">
              {weather.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          )}
        </motion.section>
      )}

      {/* 2. Sección horizontal integrada 75/25: Gráfico protagonista + KPIs compactos */}
      <motion.section
        variants={itemVariants}
        aria-label="Evolución e indicadores de las próximas 24 horas"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch"
      >
        {/* Columna izquierda (75%): Gráfico protagonista */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-9">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                Evolución próximas 24 horas
              </h3>
              <p className="text-xs font-medium text-[#475569] dark:text-slate-300">
                Precipitación horaria (mm/h) y probabilidad estimada (%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(userRole === "admin" ? "monitoring" : "prevention")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#0369A1] transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] dark:border-slate-700 dark:bg-slate-900 dark:text-[#38BDF8]"
            >
              <span>{userRole === "admin" ? "Monitoreo 24h / 48h" : "Ver prevención"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <PrecipitationChart points={next24} height={240} />
        </div>

        {/* Columna derecha (25%): 4 indicadores compactos con íconos tintados y JetBrains Mono */}
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
              label="Intensidad máx."
              value={`${summary.max_intensity_mm_h}`}
              unit={`${units.precipitation || "mm"}/h`}
            />
            <CompactKpiRow
              icon={<Percent className="h-4 w-4 text-[#D97706] dark:text-amber-400" />}
              iconBg="bg-[#FFFBEB] dark:bg-amber-950/50"
              label="Probabilidad máx."
              value={`${maxProb24}`}
              unit="%"
              note={
                summary.max_probability_48h_pct !== null &&
                summary.max_probability_48h_pct !== undefined
                  ? `48 h: ${summary.max_probability_48h_pct}%`
                  : "Modelo numérico"
              }
            />
            <div className="py-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                    <ShieldAlert className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                    Nivel preventivo
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {liveEvaluation && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: liveEvaluation.level_color }}
                  />
                )}
                <span className="text-base font-extrabold text-[#0F172A] dark:text-white">
                  {statusTitle}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-[#475569] dark:text-slate-400">
                Orientativo (no sustituye alerta oficial SENAMHI/COER).
              </p>
              <button
                type="button"
                onClick={() => onNavigate("prevention")}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
              >
                Ver ficha explicable <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>
        )}
      </motion.section>

      {/* 3. Explora tu facultad / pabellón */}
      <motion.div variants={itemVariants}>
        <FacultyLookupCard
          campusLayers={campusLayers}
          simResult={simResult}
          onLocateInMap={onLocateInMap}
          onNavigate={onNavigate}
        />
      </motion.div>

      {/* 3b. Bandeja de reportes comunitarios anónimos (solo Gestión UNT) */}
      {userRole === "admin" && (
        <motion.div variants={itemVariants}>
          <AdminReportsInbox
            reports={campusReports}
            onUpdateStatus={onUpdateReportStatus}
          />
        </motion.div>
      )}

      {/* 4. Accesos rápidos */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionLink
          icon={<MapIcon className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />}
          iconBg="bg-[#F0F9FF] dark:bg-sky-950/60"
          title="Ver mapa del campus"
          desc="Ubica facultades, accesos, puntos seguros y Ruta del Agua."
          onClick={() => onNavigate(userRole === "admin" ? "map" : "student_map")}
        />
        <ActionLink
          icon={<BookOpen className="h-4 w-4 text-[#059669] dark:text-emerald-400" />}
          iconBg="bg-[#ECFDF5] dark:bg-emerald-950/60"
          title="Continuidad y brigadas"
          desc="Protocolos preventivos, brigadas y checklist de mochila."
          onClick={() => onNavigate("continuity")}
        />
        <ActionLink
          icon={<Sliders className="h-4 w-4 text-[#D97706] dark:text-amber-400" />}
          iconBg="bg-[#FFFBEB] dark:bg-amber-950/50"
          title={userRole === "admin" ? "Simulación dinámica 10 m" : "Simulación educativa"}
          desc={
            userRole === "admin"
              ? "Modelado horario en malla de 10 m y escenarios A/B/C/D."
              : "Explora lluvias históricas 2017 y 2023 sin conexión."
          }
          onClick={() => onNavigate(userRole === "admin" ? "hydro" : "student_sim")}
        />
      </motion.section>

      {/* 5. Transparencia de fuentes de datos */}
      <motion.div variants={itemVariants}>
        <DataSourcesPanel />
      </motion.div>
    </motion.div>
  );
}

function CompactKpiRow({ icon, iconBg, label, value, unit, note }) {
  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </span>
          <span className="text-xs font-bold text-[#475569] dark:text-slate-300">{label}</span>
        </div>
        {note && (
          <span className="font-mono text-xs font-medium text-[#475569] tabular-nums dark:text-slate-400">
            {note}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 pl-9">
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

function ActionLink({ icon, iconBg, title, desc, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      type="button"
      onClick={onClick}
      className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-subtle transition hover:border-[#00B4D8] hover:shadow-panel dark:border-slate-800 dark:bg-[#0B2545] dark:hover:border-[#00B4D8]"
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </span>
          <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">{title}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">{desc}</p>
      </div>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[#475569] transition group-hover:translate-x-1 group-hover:text-[#0369A1] dark:text-slate-400 dark:group-hover:text-[#38BDF8]" />
    </motion.button>
  );
}
