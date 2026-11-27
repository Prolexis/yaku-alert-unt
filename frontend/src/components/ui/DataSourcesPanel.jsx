import React, { useEffect, useState } from "react";
import {
  CloudRain,
  History,
  Layers,
  Database,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { fetchSourcesStatus } from "../../services/api";
import { formatLimaTime } from "../../utils/formatters";

const STATIC_SOURCES = [
  {
    id: "open_meteo_forecast",
    name: "Open-Meteo Weather Forecast API",
    category: "Pronóstico meteorológico 48 h",
    models: "ECMWF / GFS / ICON",
    variables: "Lluvia (mm/h), probabilidad (%), presión (hPa), viento y sensación térmica",
    role: "Alimenta el semáforo preventivo, gráfico 24/48 h y variables sinópticas.",
    url: "https://open-meteo.com/",
  },
  {
    id: "open_meteo_era5",
    name: "Open-Meteo Historical Archive (ERA5) + Registros locales",
    category: "Calibración histórica (2017 y 2023)",
    models: "Reanálisis ERA5 + reportes de campo UNT",
    variables: "Eventos 2017 (27.5 mm) y 2023 (35 mm)",
    role: "Escenarios educativos interactivos sin confundirse con alertas en curso.",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
  },
  {
    id: "dem_osm_hydro",
    name: "DEM ~30 m remuestreado a 10 m + OpenStreetMap",
    category: "Modelo espacial y escurrimiento",
    models: "Copernicus GLO-30 + Shapely 2.x + autómata celular determinista",
    variables: "Facultades UNT, accesos, puntos seguros y lámina modelada (cm)",
    role: "Cálculo determinista de exposición por pabellón y desvíos preventivos.",
    url: "https://www.openstreetmap.org/",
  },
  {
    id: "sqlite_local",
    name: "SQLite 3 Embebido (Yaku Alert)",
    category: "Persistencia operativa",
    models: "Base de datos local sin servidores externos",
    variables: "Avisos institucionales, reportes anónimos (0 PII) y caché meteorológico",
    role: "Conecta Gestión UNT ↔ Estudiantes en tiempo real y respalda el modo offline.",
    url: null,
  },
  {
    id: "sinagerd_official",
    name: "COER La Libertad / COEN · SENAMHI · ENFEN · INDECI",
    category: "Validación oficial Perú",
    models: "SINAGERD / PLANAGERD 2022–2030",
    variables: "Quebradas, avisos meteorológicos, FEN/TSM y normativa oficial",
    role: "Únicas fuentes oficiales vinculantes para decisiones de emergencia.",
    url: "https://www.senamhi.gob.pe/",
  },
];

const SOURCE_ICON = {
  open_meteo_forecast: { icon: CloudRain, tone: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]" },
  open_meteo_era5: { icon: History, tone: "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-300" },
  dem_osm_hydro: { icon: Layers, tone: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
  sqlite_local: { icon: Database, tone: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-300" },
  sinagerd_official: { icon: ShieldCheck, tone: "bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/60 dark:text-red-300" },
};

export default function DataSourcesPanel({ compact = false }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchSourcesStatus()
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch(() => {
        // Fallback estático silencioso si el backend no responde
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sources = data?.sources?.length ? data.sources : STATIC_SOURCES;
  const stats = data?.persistence;

  return (
    <section
      aria-label="Fuentes de datos y modelos de pronóstico"
      className={
        compact
          ? "space-y-3"
          : "rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
            Transparencia de Fuentes de Datos y Modelos
          </h3>
          <p className="mt-0.5 text-xs text-[#475569] dark:text-slate-300">
            Origen exacto de pronósticos, calibración histórica, simulación 10 m y persistencia SQLite.
          </p>
        </div>
        {stats && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#059669]/30 bg-[#ECFDF5] px-2.5 py-1 font-mono text-xs font-bold text-[#059669] tabular-nums dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              SQLite: {stats.active_alerts} aviso(s) · {stats.total_reports} reporte(s) ·{" "}
              {stats.weather_snapshots} caché
            </span>
          </span>
        )}
      </div>

      <div
        className={`mt-4 grid grid-cols-1 gap-3 ${
          compact ? "sm:grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {sources.map((src) => {
          const cfg = SOURCE_ICON[src.id] || SOURCE_ICON.open_meteo_forecast;
          const Icon = cfg.icon;
          const { local } = src.latest_timestamp_utc
            ? formatLimaTime(src.latest_timestamp_utc)
            : { local: null };

          return (
            <div
              key={src.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 dark:border-slate-700/80 dark:bg-slate-900/60"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs font-extrabold uppercase tracking-wide text-[#0369A1] dark:text-[#38BDF8]">
                        {src.category}
                      </div>
                      <div className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                        {src.name}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="font-mono text-xs font-semibold text-[#0B2545] dark:text-slate-200">
                  {src.models}
                </div>
                <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                  {src.variables}
                </p>
                <p className="text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  {src.role}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs dark:border-slate-700/80">
                <span className="font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
                  {local ? `Último dato: ${local}` : src.coverage || "Operativo local"}
                </span>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
                  >
                    <span>Fuente</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
