import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { AlertTriangle, Droplets, Layers, Loader2, MapPin, Pause, Play, WifiOff } from "lucide-react";
import { fetchHydroForecast, fetchHydroPresets, fetchHydroRun } from "../services/api";

const UNT_CENTER = [-8.11473, -79.03923];
// Puerta 4 (Av. Jesús de Nazareth): respaldo si el catálogo del campus aún no cargó.
const P4_FALLBACK = [-8.11167, -79.0359872];

const BASEMAPS = {
  calles: {
    label: "Calles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; colaboradores de OpenStreetMap",
  },
  satelite: {
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri",
  },
  vectorial: { label: "Offline" },
};

// Clases de comunicación visual de la lámina modelada (no clasifican peligro).
const WATER_CLASSES = {
  leve: {
    label: "Leve",
    range: "≈ 1–5 cm",
    style: { color: "#7DD3FC", weight: 0.6, fillColor: "#BAE6FD", fillOpacity: 0.6 },
  },
  moderada: {
    label: "Moderada",
    range: "≈ 5–15 cm",
    style: { color: "#0EA5E9", weight: 0.7, fillColor: "#38BDF8", fillOpacity: 0.65 },
  },
  alta: {
    label: "Alta",
    range: "≈ 15 cm o más",
    style: { color: "#1E40AF", weight: 0.9, fillColor: "#1D4ED8", fillOpacity: 0.7 },
  },
};
const WATER_CLASS_ORDER = ["leve", "moderada", "alta"];

const PRESET_OPTIONS = [
  { id: "evento_2017_03", label: "Evento tipo 2017" },
  { id: "evento_2023_03_10", label: "Evento tipo 2023" },
  { id: "extremo_hipotetico", label: "Extremo hipotético" },
];

const DRAINAGE_OPTIONS = [
  { id: "normal", label: "Normal (hipótesis)" },
  { id: "obstruido", label: "Obstruido (hipótesis)" },
  { id: "pendiente_deficiente", label: "Pendiente deficiente (hipótesis)" },
];

const INFLOW_OPTIONS = [
  { id: "ninguno", label: "Ninguno" },
  { id: "bajo", label: "Bajo" },
  { id: "medio", label: "Medio" },
  { id: "alto", label: "Alto" },
];

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const classFromCm = (cm) => {
  if (!cm || cm < 1) return null;
  if (cm < 5) return "leve";
  if (cm < 15) return "moderada";
  return "alta";
};

const classLabel = (cls) => (cls ? WATER_CLASSES[cls].label : "Sin agua");
const classRange = (cls) => (cls ? WATER_CLASSES[cls].range : "bajo el umbral visible");

const areaLabel = (m2) => {
  if (!m2) return "≈ 0 m²";
  if (m2 >= 10000) return `≈ ${Math.round(m2 / 10000)} ha`;
  return `≈ ${Math.round(m2).toLocaleString("es-PE")} m²`;
};

const LIMA_TZ = "America/Lima";
const LIMA_FORMAT = {
  timeZone: LIMA_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const formatLima = (raw) => {
  if (!raw) return null;
  const match = String(raw).match(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/
  );
  const date = new Date(match ? match[0] : raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleString("es-PE", LIMA_FORMAT)} (Lima)`;
};

const limaNow = () => `${new Date().toLocaleString("es-PE", LIMA_FORMAT)} (Lima)`;

const FIELD_CLASS =
  "w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const CHECK_CLASS = "h-4 w-4 rounded accent-[#2563EB]";

export default function DynamicSimulationView({ campusLayers }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const catalogGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);
  const waterLayersRef = useRef([]);
  const builtKeyRef = useRef("");

  const [presets, setPresets] = useState(null);
  const [presetsError, setPresetsError] = useState("");
  const [source, setSource] = useState("forecast");
  const [sourceKind, setSourceKind] = useState("forecast");
  const [drainageState, setDrainageState] = useState("normal");
  const [inflowP4, setInflowP4] = useState("medio");
  const [useReportedSinks, setUseReportedSinks] = useState(false);
  const [manualOffline, setManualOffline] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );
  const [basemap, setBasemap] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false ? "vectorial" : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [lastCalcAt, setLastCalcAt] = useState("");

  const offline = manualOffline || browserOffline;
  const selectedPreset = useMemo(
    () => (presets || []).find((preset) => preset.id === source) || null,
    [presets, source]
  );

  // Red disponible: el modo pronóstico usa ?offline=true cuando no hay conexión.
  useEffect(() => {
    const goOnline = () => setBrowserOffline(false);
    const goOffline = () => setBrowserOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Catálogo de eventos tipo (hietogramas supuestos declarados por la API).
  useEffect(() => {
    let cancelled = false;
    fetchHydroPresets()
      .then((data) => {
        if (!cancelled) setPresets(data.presets || []);
      })
      .catch((err) => {
        if (!cancelled) setPresetsError(err.message || "No se pudieron cargar los eventos tipo.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga inicial: pronóstico real (o caché local si no hay red).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchHydroForecast(typeof navigator !== "undefined" && navigator.onLine === false, {
      drainage_state: "normal",
      inflow_p4: "medio",
      use_reported_sinks: false,
    })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setSourceKind("forecast");
        setHour(1);
        setLastCalcAt(limaNow());
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "No se pudo cargar el pronóstico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function calcular() {
    setPlaying(false);
    setLoading(true);
    setError("");
    try {
      let data;
      if (source === "forecast") {
        data = await fetchHydroForecast(offline, {
          drainage_state: drainageState,
          inflow_p4: inflowP4,
          use_reported_sinks: useReportedSinks,
        });
        setSourceKind("forecast");
        setHour(1);
      } else {
        const preset = (presets || []).find((item) => item.id === source);
        if (!preset) throw new Error("El evento tipo no está disponible; recargue la página.");
        data = await fetchHydroRun({
          rainfall_mm_h: preset.rainfall_mm_h,
          drainage_state: drainageState,
          inflow_p4: inflowP4,
          secondary_inflow: Boolean(preset.defaults?.secondary_inflow),
          use_reported_sinks: useReportedSinks,
        });
        setSourceKind("preset");
        setHour(data.summary?.peak_hour || 1);
      }
      setResult(data);
      setLastCalcAt(limaNow());
    } catch (err) {
      setError(err.message || "No se pudo ejecutar la simulación.");
    } finally {
      setLoading(false);
    }
  }

  // Inicializa el mapa (mismo patrón que Mapa UNT: base intercambiable y capas vectoriales locales).
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution(
      "Datos del campus &copy; colaboradores de OpenStreetMap (ODbL)"
    );
    catalogGroupRef.current = L.layerGroup().addTo(map);
    waterGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      catalogGroupRef.current = null;
      waterGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Mapa base; si los mosaicos fallan se informa y quedan las capas vectoriales.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    tileErrorsRef.current = 0;
    setTilesFailed(false);
    const cfg = BASEMAPS[basemap];
    if (!cfg?.url) return;
    const layer = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 20, maxNativeZoom: 19 });
    layer.on("tileerror", () => {
      tileErrorsRef.current += 1;
      if (tileErrorsRef.current >= 4) setTilesFailed(true);
    });
    layer.on("tileload", () => {
      tileErrorsRef.current = 0;
      setTilesFailed(false);
    });
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [basemap]);

  // Catálogo del campus: perímetro, vías, estacionamientos, edificios y accesos.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = catalogGroupRef.current;
    if (!map || !group || !campusLayers) return;
    group.clearLayers();
    const features = campusLayers.campus?.features || [];
    const perimeters = features.filter((f) => f.properties?.category === "perimetro_campus");

    perimeters.forEach((f) =>
      L.geoJSON(f, {
        interactive: false,
        style: { color: "#0B1F33", weight: 2, dashArray: "2 6", fill: true, fillColor: "#F1F5F9", fillOpacity: 0.35 },
      }).addTo(group)
    );

    features
      .filter((f) => f.properties?.category === "via")
      .forEach((f) =>
        L.geoJSON(f, { interactive: false, style: { color: "#CBD5E1", weight: 1.2, opacity: 0.9 } }).addTo(group)
      );

    features
      .filter((f) => f.properties?.category === "estacionamiento")
      .forEach((f) =>
        L.geoJSON(f, { style: { color: "#94A3B8", weight: 1, fillColor: "#E2E8F0", fillOpacity: 0.75 } })
          .bindPopup(`<div><strong>Estacionamiento</strong></div>`, { className: "yaku-popup" })
          .addTo(group)
      );

    features
      .filter((f) => f.properties?.category === "area_deportiva")
      .forEach((f) =>
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#86EFAC", weight: 0.8, fillColor: "#DCFCE7", fillOpacity: 0.5 },
        }).addTo(group)
      );

    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const name = f.properties?.name || "Edificio";
        L.geoJSON(f, { style: { color: "#60A5FA", weight: 1, fillColor: "#DBEAFE", fillOpacity: 0.55 } })
          .bindTooltip(esc(name), { sticky: true, direction: "top" })
          .bindPopup(`<div><strong>${esc(name)}</strong></div>`, { className: "yaku-popup" })
          .addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "acceso" && f.geometry?.type === "Point")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: 5,
          color: "#FFFFFF",
          weight: 1.5,
          fillColor: "#10B981",
          fillOpacity: 0.95,
        })
          .bindTooltip(esc(f.properties?.name || "Acceso"), { direction: "top" })
          .addTo(group);
      });

    // Puerta 4: fuente de ingreso externo del escenario (no un caudal medido).
    const p4 = features.find(
      (f) => f.properties?.category === "acceso" && /Puerta\s*4/i.test(f.properties?.name || "")
    );
    const p4LatLng =
      p4?.geometry?.type === "Point"
        ? [p4.geometry.coordinates[1], p4.geometry.coordinates[0]]
        : P4_FALLBACK;
    L.circleMarker(p4LatLng, {
      radius: 9,
      color: "#5B21B6",
      weight: 2.5,
      fillColor: "#A78BFA",
      fillOpacity: 0.9,
    })
      .bindTooltip("Fuente de ingreso (escenario)", {
        permanent: true,
        direction: "top",
        offset: [0, -8],
      })
      .bindPopup(
        `<div><strong>Puerta 4 (Av. Jesús de Nazareth)</strong><br/><span class="text-[11px]">Fuente de ingreso externo del escenario. No es un caudal medido ni una alerta oficial.</span></div>`,
        { className: "yaku-popup" }
      )
      .addTo(group);

    if (!fittedRef.current && perimeters.length) {
      const bounds = L.featureGroup(perimeters.map((f) => L.geoJSON(f))).getBounds();
      if (bounds.isValid()) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [24, 24] });
        fittedRef.current = true;
      }
    }
  }, [campusLayers]);

  // Capas de agua precalculadas por hora: mover la línea de tiempo no llama a la API.
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group || !result?.frames?.length) return;
    const key = `${result.run_id}|${result.frames.length}|${result.parameters?.fill_max_rise_m}`;
    if (builtKeyRef.current !== key) {
      waterLayersRef.current = result.frames.map((frame) => {
        const frameGroup = L.layerGroup();
        (frame.geojson?.features || []).forEach((feature) => {
          const props = feature.properties || {};
          const cls = WATER_CLASSES[props.depth_class] ? props.depth_class : "leve";
          L.geoJSON(feature, { style: WATER_CLASSES[cls].style })
            .bindTooltip(`${classLabel(cls)} · ${classRange(cls)}`, {
              sticky: true,
              direction: "top",
            })
            .bindPopup(
              `<div>
                <strong>Agua modelada · clase ${esc(classLabel(cls).toLowerCase())}</strong><br/>
                <span class="text-[11px]">Profundidad ${esc(classRange(cls))}</span><br/>
                <span class="text-[10px] text-slate-500">estimación exploratoria; el DEM tiene ±4 m de error</span>
              </div>`,
              { className: "yaku-popup" }
            )
            .addTo(frameGroup);
        });
        return frameGroup;
      });
      builtKeyRef.current = key;
    }
    group.clearLayers();
    const index = Math.min(Math.max(hour, 1), result.frames.length) - 1;
    const layer = waterLayersRef.current[index];
    if (layer) group.addLayer(layer);
  }, [result, hour]);

  const frames = result?.frames || [];
  const currentFrame = frames[Math.min(Math.max(hour, 1), Math.max(frames.length, 1)) - 1] || null;
  const maxClass = classFromCm(currentFrame?.max_depth_cm);
  const rain = result?.parameters?.rainfall_mm_h || [];
  const rainMax = Math.max(1, ...rain);
  const currentRain = rain[Math.min(Math.max(hour, 1), Math.max(rain.length, 1)) - 1] || 0;

  // Reproducción: 1 hora por segundo, sin volver a llamar a la API.
  useEffect(() => {
    if (!playing) return;
    if (hour >= frames.length) {
      setPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setHour((prev) => Math.min(prev + 1, frames.length));
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, hour, frames.length]);

  const togglePlayback = () => {
    if (!frames.length) return;
    if (!playing && hour >= frames.length) setHour(1);
    setPlaying((value) => !value);
  };

  const sourceMeta = result
    ? sourceKind === "forecast"
      ? {
          source:
            result.weather?.source_name ||
            String(result.metadata?.source || "Pronóstico numérico").split(" (")[0],
          updated: formatLima(result.weather?.fetched_at_utc) || lastCalcAt || "s/f",
          cached: result.weather?.data_status === "OFFLINE_FALLBACK",
        }
      : {
          source: selectedPreset?.source
            ? `${selectedPreset.source}; hietograma horario supuesto`
            : "Evento tipo (supuesto)",
          updated: lastCalcAt || "s/f",
          cached: false,
        }
    : null;

  const badge =
    sourceKind === "preset"
      ? { label: "Evento tipo (supuesto)", className: "bg-violet-100 text-violet-800 border-violet-300" }
      : result?.metadata?.offline || result?.weather?.data_status === "OFFLINE_FALLBACK"
      ? { label: "Caché local", className: "bg-amber-100 text-amber-900 border-amber-300" }
      : { label: "Pronóstico real", className: "bg-sky-100 text-sky-900 border-sky-300" };

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-[#101828] dark:text-white sm:text-3xl">
              Simulación dinámica
            </h2>
            <p className="text-sm text-[#475467] dark:text-slate-400">
              Agua modelada por hora sobre el campus. Lectura exploratoria de un modelo simplificado.
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.className}`}
          >
            <Droplets className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        </div>

        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11px] font-bold leading-snug text-amber-950 sm:text-xs dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          SIMULACIÓN EXPLORATORIA — modelo simplificado, no es una alerta oficial
        </div>

        {offline && sourceKind === "forecast" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Sin conexión: se consulta el pronóstico con <code>offline=true</code> y la API responde
              con su respaldo local, que puede ser de otra fecha.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              No se pudo cargar la simulación: {error}. Revise que el backend esté en marcha e
              intente de nuevo.
            </span>
          </div>
        )}

        {presetsError && (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            Eventos tipo no disponibles ({presetsError}). El pronóstico sigue funcionando.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Mapa + capa de agua */}
        <div className="min-w-0 lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="relative">
              <div
                ref={mapContainerRef}
                className="h-[360px] w-full bg-slate-100 dark:bg-slate-900 sm:h-[420px] lg:h-[calc(100vh-290px)] lg:min-h-[460px]"
              />

              <div className="pointer-events-none absolute left-3 top-3 z-[400] flex max-w-[calc(100%-5.5rem)] flex-col gap-1.5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[#101828] backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-white">
                  <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                  {currentFrame?.label || "Sin marco"}
                  {maxClass && <span className="font-normal text-[#475467] dark:text-slate-300">· clase {classLabel(maxClass)}</span>}
                </span>
              </div>

              {(basemap === "vectorial" || tilesFailed) && (
                <div
                  role="status"
                  className="absolute left-3 top-16 z-[400] flex max-w-[15rem] items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-[11px] font-medium text-amber-900"
                >
                  <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Sin mapa base. Capas vectoriales locales activas.</span>
                </div>
              )}

              <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setLayersOpen((value) => !value)}
                  aria-expanded={layersOpen}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-xs font-semibold text-[#101828] backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-white"
                >
                  <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>Capas</span>
                </button>
                {layersOpen && (
                  <div className="w-40 rounded-xl border border-[#E2E8F0] bg-white/95 p-2 text-xs backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
                    <div className="flex gap-1" role="group" aria-label="Mapa base">
                      {Object.entries(BASEMAPS).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setBasemap(key)}
                          aria-pressed={basemap === key}
                          className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition ${
                            basemap === key
                              ? "bg-[#2563EB] text-white"
                              : "border border-[#E2E8F0] text-[#475467] dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Leyenda: la etiqueta de clase no depende del color */}
              <div className="absolute bottom-3 left-3 z-[400] max-w-[calc(100%-1.5rem)] rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-[11px] backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
                <div className="mb-1 font-semibold text-[#101828] dark:text-slate-100">Agua modelada</div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[#101828] dark:text-slate-200 sm:grid-cols-3">
                  {WATER_CLASS_ORDER.map((cls) => (
                    <span key={cls} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-400/50"
                        style={{ background: WATER_CLASSES[cls].style.fillColor }}
                      />
                      {WATER_CLASSES[cls].label} · {WATER_CLASSES[cls].range}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                  <MapPin className="h-3 w-3 shrink-0" />
                  estimación exploratoria; el DEM tiene ±4 m de error
                </div>
              </div>
            </div>

            {/* Línea de tiempo y mini-gráfico de lluvia (sin llamadas extra a la API) */}
            <div className="space-y-2.5 border-t border-[#E2E8F0] px-3 py-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  disabled={!frames.length}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3 text-[11px] font-semibold text-white transition hover:bg-[#122C46] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#2563EB]"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? "Pausa" : "Reproducir"}
                </button>
                <span className="text-[11px] font-semibold text-[#101828] tabular-nums dark:text-white">
                  {currentFrame?.label || "Sin marco"}
                </span>
                <span className="text-[10px] text-[#64748B] dark:text-slate-400">1 h por segundo</span>
                <span className="ml-auto text-[10px] text-[#64748B] dark:text-slate-400">
                  Lluvia de la hora: ≈ {Math.round(currentRain)} mm
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(frames.length, 1)}
                  step={1}
                  value={Math.min(Math.max(hour, 1), Math.max(frames.length, 1))}
                  onChange={(event) => {
                    setPlaying(false);
                    setHour(Number(event.target.value));
                  }}
                  disabled={!frames.length}
                  aria-label="Hora de la simulación"
                  className="h-2 w-full cursor-pointer accent-[#2563EB] disabled:cursor-not-allowed"
                />
                {sourceKind === "forecast" && (
                  <div className="mt-0.5 flex justify-between text-[10px] font-medium text-[#64748B] dark:text-slate-400">
                    <span className="text-amber-700 dark:text-amber-300">▏ahora</span>
                    <span>h+{frames.length}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-slate-400">
                  <span>Lluvia por hora (mm)</span>
                  <span>h+1 … h+{rain.length}</span>
                </div>
                <svg
                  viewBox={`0 0 ${Math.max(rain.length, 1) * 8} 64`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Mini-gráfico de lluvia por hora; elija una hora con el deslizador"
                  className="h-14 w-full cursor-pointer rounded bg-[#F7F9FC] dark:bg-slate-900/70"
                  onClick={(event) => {
                    if (!rain.length) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(
                      Math.max((event.clientX - rect.left) / rect.width, 0),
                      0.999
                    );
                    setPlaying(false);
                    setHour(Math.min(rain.length, Math.max(1, Math.floor(ratio * rain.length) + 1)));
                  }}
                >
                  {rain.map((value, index) => {
                    const height = value > 0 ? Math.max((value / rainMax) * 56, 1.5) : 0;
                    const isCurrent = index + 1 === hour;
                    const isPast = index + 1 <= hour;
                    return (
                      <rect
                        key={index}
                        x={index * 8 + 1}
                        y={64 - height}
                        width={6}
                        height={height}
                        fill={isCurrent ? "#1D4ED8" : isPast ? "#60A5FA" : "#BFDBFE"}
                      />
                    );
                  })}
                  {sourceKind === "forecast" && (
                    <line
                      x1="0.5"
                      y1="0"
                      x2="0.5"
                      y2="64"
                      stroke="#D97706"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
                </svg>
              </div>

              {sourceMeta && (
                <p className="break-words text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                  Fuente: {sourceMeta.source} · actualizado: {sourceMeta.updated}
                  {sourceMeta.cached ? " (respaldo local; puede ser de otra fecha)" : ""}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] px-3 py-2 text-[11px] text-[#64748B] dark:border-slate-800 dark:text-slate-400">
              <span>
                {currentFrame
                  ? `Marco ${currentFrame.label} de la corrida · agua visible: ${areaLabel(currentFrame.wet_area_m2)}`
                  : "Sin datos de agua para mostrar."}
              </span>
              <span className="font-medium">La capa azul es agua modelada, no una alerta.</span>
            </div>
          </div>
        </div>

        {/* Controles */}
        <section className="min-w-0 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-4">
          <div>
            <h3 className="text-sm font-bold text-[#101828] dark:text-white">Controles del escenario</h3>
            <p className="text-[11px] text-[#475467] dark:text-slate-400">
              Parámetros de entrada de una corrida exploratoria.
            </p>
          </div>

          <label className="block space-y-1 text-[11px] font-semibold text-[#475467] dark:text-slate-300">
            <span>Fuente de lluvia</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className={FIELD_CLASS}
              aria-label="Fuente de lluvia"
            >
              <option value="forecast">Pronóstico real 48 h</option>
              {PRESET_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="block text-[10px] font-normal leading-snug text-[#64748B] dark:text-slate-400">
              {source === "forecast"
                ? "Serie horaria de un pronóstico numérico; no es una medición local."
                : selectedPreset?.note || "Acumulado diario de referencia; el hietograma horario es supuesto."}
            </span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-[11px] font-semibold text-[#475467] dark:text-slate-300">
              <span>Drenaje</span>
              <select
                value={drainageState}
                onChange={(event) => setDrainageState(event.target.value)}
                className={FIELD_CLASS}
                aria-label="Estado del drenaje"
              >
                {DRAINAGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-[11px] font-semibold text-[#475467] dark:text-slate-300">
              <span>Ingreso por Puerta 4</span>
              <select
                value={inflowP4}
                onChange={(event) => setInflowP4(event.target.value)}
                className={FIELD_CLASS}
                aria-label="Ingreso por Puerta 4"
              >
                {INFLOW_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="rounded-lg bg-[#F7F9FC] px-2.5 py-2 text-[10px] leading-snug text-[#475467] dark:bg-slate-900/70 dark:text-slate-300">
            El ingreso por Puerta 4 es un <strong>escenario, no caudal medido</strong>.
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#475467] dark:text-slate-300">
            <input
              type="checkbox"
              checked={useReportedSinks}
              onChange={(event) => setUseReportedSinks(event.target.checked)}
              className={`${CHECK_CLASS} mt-0.5`}
            />
            <span>
              Incluir puntos reportados por el equipo
              <span className="block text-[10px] text-[#64748B] dark:text-slate-400">
                CIDUNT, Derecho, Puerta 4 y Av. Juan Pablo II retienen una lámina SUPUESTA.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#475467] dark:text-slate-300">
            <input
              type="checkbox"
              checked={manualOffline}
              onChange={(event) => setManualOffline(event.target.checked)}
              className={`${CHECK_CLASS} mt-0.5`}
            />
            <span>
              Forzar caché local (sin conexión)
              <span className="block text-[10px] text-[#64748B] dark:text-slate-400">
                Solo aplica al pronóstico real: usa <code>?offline=true</code>.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={calcular}
            disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando…
              </>
            ) : (
              <>
                <Droplets className="h-4 w-4" />
                Calcular
              </>
            )}
          </button>

          {result && (
            <div className="space-y-1 border-t border-[#E2E8F0] pt-3 text-[11px] text-[#475467] dark:border-slate-800 dark:text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <span>Corrida</span>
                <span className="truncate font-mono text-[10px]">{result.run_id}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Marcos horarios</span>
                <span className="tabular-nums">{frames.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Sumideros reportados</span>
                <span>{result.parameters?.use_reported_sinks ? "Activos" : "Desactivados"}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
