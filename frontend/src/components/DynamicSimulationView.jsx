import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Droplets,
  Layers,
  Loader2,
  MapPin,
  Pause,
  Play,
  Radio,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import { fetchHydroForecast, fetchHydroPresets, fetchHydroRun } from "../services/api";
import SensorDetailPanel from "./ui/SensorDetailPanel";
import {
  SENSOR_STATUS_STYLES,
  resolveSensorReading,
} from "../utils/sensorFormatters";

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

const CATEGORY_LABELS = {
  edificio: "Edificio",
  acceso: "Acceso",
  estacionamiento: "Estacionamiento",
  area_deportiva: "Área deportiva",
};

const elementName = (element) =>
  element?.name && element.name !== "area_deportiva"
    ? element.name
    : CATEGORY_LABELS[element?.category] || element?.name || "Elemento";

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

export default function DynamicSimulationView({
  campusLayers,
  onResultChange,
  onHourChange,
  virtualSensors = [],
  selectedSensorId = "",
  onSelectSensor,
  disconnectedSensors = {},
  onToggleDisconnectSensor,
  onLocateBuildingInMap,
  onNavigate,
  offline: offlineProp = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const catalogGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const sensorsGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);
  const waterLayersRef = useRef([]);
  const builtKeyRef = useRef("");
  const [showSensorsLayer, setShowSensorsLayer] = useState(true);

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
    offlineProp || (typeof navigator !== "undefined" && navigator.onLine === false)
      ? "vectorial"
      : "calles"
  );
  const [legendOpen, setLegendOpen] = useState(false);

  // Blindaje offline: cambia automáticamente a Solo vectorial cuando se activa modo sin conexión
  useEffect(() => {
    if (offlineProp) {
      setBasemap("vectorial");
    }
  }, [offlineProp]);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [lastCalcAt, setLastCalcAt] = useState("");
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [focusedElementId, setFocusedElementId] = useState("");

  const offline = manualOffline || browserOffline;
  const selectedPreset = useMemo(
    () => (presets || []).find((preset) => preset.id === source) || null,
    [presets, source]
  );

  useEffect(() => {
    onResultChange?.(result);
  }, [result, onResultChange]);

  useEffect(() => {
    onHourChange?.(hour);
  }, [hour, onHourChange]);

  const selectedSensor = useMemo(
    () => virtualSensors.find((s) => s.id === selectedSensorId) || null,
    [virtualSensors, selectedSensorId]
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
    sensorsGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      catalogGroupRef.current = null;
      waterGroupRef.current = null;
      sensorsGroupRef.current = null;
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

  // Capa sincronizada YAKU SENSE (Sensores IoT [SIM]) sobre la simulación dinámica
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = sensorsGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!showSensorsLayer || !virtualSensors.length) return;

    virtualSensors.forEach((sensor) => {
      const r = resolveSensorReading(sensor, hour, disconnectedSensors[sensor.id]);
      const st = SENSOR_STATUS_STYLES[r.statusKey] || SENSOR_STATUS_STYLES.no_reading;
      const isSelected = sensor.id === selectedSensorId;
      const borderStyle = r.statusKey === "disconnected_sim" ? "dashed" : "solid";
      const valChip =
        r.value !== null && r.value !== undefined ? ` · ${esc(r.displayValue)}` : "";

      const icon = L.divIcon({
        className: "yaku-sensor-marker",
        html: `<div style="display:flex;align-items:center;gap:3px;padding:3px 7px;border-radius:999px;background:${st.fill};color:#fff;font:700 10px/1.1 system-ui,sans-serif;border:2px ${borderStyle} ${isSelected ? "#0B1F33" : "#ffffff"};box-shadow:${isSelected ? "0 0 0 3px rgba(37,99,235,0.45),0 4px 10px rgba(0,0,0,0.28)" : "0 2px 6px rgba(0,0,0,0.25)"};white-space:nowrap;"><span>${esc(sensor.id)}${valChip}</span></div>`,
        iconSize: [78, 22],
        iconAnchor: [39, 11],
      });

      const marker = L.marker([sensor.lat, sensor.lon], {
        icon,
        zIndexOffset: isSelected ? 1000 : 600,
      });
      marker.bindTooltip(
        `${esc(sensor.name)} · ${esc(r.displayValue)} (${esc(st.shortLabel)})`,
        { direction: "top", offset: [0, -10] }
      );
      marker.on("click", () => {
        onSelectSensor?.(sensor.id);
        map.panTo([sensor.lat, sensor.lon], { animate: true });
      });
      marker.addTo(group);
    });
  }, [
    showSensorsLayer,
    virtualSensors,
    hour,
    disconnectedSensors,
    selectedSensorId,
    onSelectSensor,
  ]);

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

  const elements = result?.elements || [];
  const affectedElements = elements.filter((element) => element.first_hour_affected);
  const wetElements = affectedElements.filter(
    (element) => element.first_hour_affected <= hour
  );
  const firstAffectation = [...affectedElements].sort(
    (a, b) =>
      a.first_hour_affected - b.first_hour_affected || b.max_depth_cm - a.max_depth_cm
  );
  const actionWindows = result?.evaluation?.action_windows || [];
  const activeHydroRules = result?.evaluation?.rules_triggered || [];

  const focusElement = (element) => {
    setFocusedElementId(element.id);
    const map = mapInstanceRef.current;
    const feature = (campusLayers?.campus?.features || []).find(
      (item) => item.properties?.id === element.id
    );
    if (!map || !feature) return;
    if (feature.geometry?.type === "Point") {
      const [lon, lat] = feature.geometry.coordinates;
      map.setView([lat, lon], 18);
      return;
    }
    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
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
      : result?.weather?.data_status === "OFFLINE_FALLBACK"
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

        {!offline && sourceKind === "forecast" && result?.weather?.data_status === "OFFLINE_FALLBACK" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              El backend no obtuvo el pronóstico en línea y respondió con su respaldo local, que
              puede ser de otra fecha.
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
        {/* Mapa + capa de agua (Map-First) */}
        <div className="min-w-0 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
            <div className="relative">
              <div
                ref={mapContainerRef}
                className="h-[420px] w-full bg-slate-100 dark:bg-slate-900 sm:h-[480px] lg:h-[calc(100vh-250px)] lg:min-h-[520px]"
              />

              <div className="pointer-events-none absolute left-3 top-3 z-[400] flex max-w-[calc(100%-5.5rem)] flex-col gap-1.5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/92 px-3 py-1.5 font-mono text-xs font-bold text-[#0B2545] shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/92 dark:text-white">
                  <Layers className="h-3.5 w-3.5 text-[#0369A1] dark:text-[#38BDF8]" />
                  {currentFrame?.label || "Sin marco"}
                  {maxClass && <span className="font-sans font-semibold text-[#475569] dark:text-slate-300">· {classLabel(maxClass)}</span>}
                </span>
              </div>

              {(basemap === "vectorial" || tilesFailed) && (
                <div
                  role="status"
                  className="absolute left-3 top-14 z-[400] flex max-w-[16rem] items-start gap-2 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-3 py-1.5 text-xs font-bold text-[#92400E] shadow-sm backdrop-blur-md"
                >
                  <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Solo vectorial (sin internet). Capas locales activas.</span>
                </div>
              )}

              <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/92 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
                  <button
                    type="button"
                    onClick={() => setShowSensorsLayer((v) => !v)}
                    aria-pressed={showSensorsLayer}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      showSensorsLayer
                        ? "bg-[#0369A1] text-white shadow-sm"
                        : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Sensores IoT [SIM]</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayersOpen((value) => !value)}
                    aria-expanded={layersOpen}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                  >
                    <Layers className="h-3.5 w-3.5 text-[#0369A1] dark:text-[#38BDF8]" />
                    <span>Capas</span>
                  </button>
                </div>
                {layersOpen && (
                  <div className="w-44 rounded-xl border border-slate-200/90 bg-white/92 p-2 text-xs shadow-elevated backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/95">
                    <div className="flex gap-1" role="group" aria-label="Mapa base">
                      {Object.entries(BASEMAPS).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setBasemap(key)}
                          aria-pressed={basemap === key}
                          className={`flex-1 rounded-md px-1.5 py-1 text-xs font-bold transition ${
                            basemap === key
                              ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                              : "border border-slate-200 text-[#475569] dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Leyenda colapsable flotante */}
              <div className="absolute bottom-3 left-3 z-[400] max-w-[calc(100%-1.5rem)] rounded-xl border border-slate-200/90 bg-white/92 px-3 py-2 text-xs shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  aria-expanded={legendOpen}
                  className="flex items-center gap-2 font-bold text-[#0B2545] dark:text-white"
                >
                  <span>Leyenda · Agua modelada</span>
                  {legendOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                {legendOpen && (
                  <>
                    <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[#0F172A] dark:text-slate-200 sm:grid-cols-3">
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
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs leading-snug text-[#475569] dark:text-slate-400">
                      <MapPin className="h-3 w-3 shrink-0" />
                      Estimación exploratoria en malla 10 m (DEM ±4 m)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Reproductor moderno + mini-gráfico de lluvia */}
            <div className="space-y-3 border-t border-slate-200 bg-[#F8FAFC] px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                  <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                    Hora simulada
                  </div>
                  <div className="font-mono text-lg font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                    {currentFrame?.label || "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                  <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                    Lluvia acumulada
                  </div>
                  <div className="font-mono text-lg font-extrabold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                    {rain
                      .slice(0, Math.min(hour, rain.length))
                      .reduce((s, v) => s + (v || 0), 0)
                      .toFixed(1)}{" "}
                    mm
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                  <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                    Zonas afectadas
                  </div>
                  <div className="font-mono text-lg font-extrabold text-[#D97706] tabular-nums dark:text-amber-300">
                    {wetElements.length}
                    <span className="ml-1 text-xs font-semibold text-[#475569] dark:text-slate-400">
                      / {affectedElements.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  disabled={!frames.length}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0369A1]"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? "Pausar" : "Reproducir"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setHour(1);
                  }}
                  disabled={!frames.length}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reiniciar</span>
                </button>
                <span className="ml-auto font-mono text-xs font-semibold text-[#475569] tabular-nums dark:text-slate-300">
                  Lluvia en hora: ≈ {Math.round(currentRain)} mm
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

        {/* Controles y panel de la hora seleccionada */}
        <div className="min-w-0 space-y-4 lg:col-span-4">
          {showSensorsLayer && selectedSensor && (
            <SensorDetailPanel
              sensor={selectedSensor}
              activeHour={hour}
              disconnectedEntry={disconnectedSensors[selectedSensor.id]}
              onToggleDisconnect={onToggleDisconnectSensor}
              onClose={() => onSelectSensor?.("")}
              onCenterMap={(s) =>
                mapInstanceRef.current?.setView([s.lat, s.lon], 18, { animate: true })
              }
              onOpenFacility={(facId) => onLocateBuildingInMap?.(facId)}
              onOpenGuidance={() => onNavigate?.("continuity")}
            />
          )}

          {showSensorsLayer && virtualSensors.length > 0 && (
            <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 dark:border-sky-900/80 dark:bg-sky-950/25">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-sky-950 dark:text-sky-200">
                  YAKU SENSE · Sensores virtuales (h+{hour})
                </div>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  SIM
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {virtualSensors.map((s) => {
                  const r = resolveSensorReading(s, hour, disconnectedSensors[s.id]);
                  const active = s.id === selectedSensorId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onSelectSensor?.(s.id);
                        mapInstanceRef.current?.panTo([s.lat, s.lon], { animate: true });
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                        active
                          ? "border-[#2563EB] bg-blue-50 dark:border-sky-400 dark:bg-sky-950/70"
                          : "border-[#E2E8F0] bg-white hover:border-sky-400 dark:border-slate-800 dark:bg-[#0B1F33]"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[#101828] dark:text-white">
                        <span>{s.id}</span>
                        <span className="font-mono text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                          {r.value !== null && r.value !== undefined ? r.displayValue : "N/D"}
                        </span>
                      </div>
                      <div className="truncate text-[10px] text-[#475467] dark:text-slate-400">
                        {s.short_name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="min-w-0 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-slate-800 dark:bg-[#0B1F33]">
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

          <section className="min-w-0 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-slate-800 dark:bg-[#0B1F33]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#101828] dark:text-white">Hora seleccionada</h3>
                <p className="text-[10px] text-[#64748B] dark:text-slate-400">Lectura del marco horario actual</p>
              </div>
              <span className="shrink-0 rounded-md bg-[#F7F9FC] px-2 py-1 text-[10px] font-semibold tabular-nums text-[#101828] dark:bg-slate-900/70 dark:text-white">
                {currentFrame?.label || "—"}
              </span>
            </div>

            {loading && result && (
              <p className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Actualizando la corrida…
              </p>
            )}

            {!result && loading && (
              <p className="flex items-center gap-2 rounded-lg bg-[#F7F9FC] px-3 py-3 text-[11px] text-[#475467] dark:bg-slate-900/70 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando la simulación inicial…
              </p>
            )}

            {!result && !loading && (
              <p className="rounded-lg bg-[#F7F9FC] px-3 py-3 text-[11px] text-[#475467] dark:bg-slate-900/70 dark:text-slate-300">
                Aún no hay una corrida. Elija los controles y pulse Calcular.
              </p>
            )}

            {result && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0 rounded-lg bg-[#F7F9FC] p-2.5 dark:bg-slate-900/70">
                    <div className="text-[10px] text-[#475467] dark:text-slate-400">Clase máxima</div>
                    <div className="truncate text-sm font-bold text-[#101828] dark:text-white">
                      {classLabel(maxClass)}
                    </div>
                    <div className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                      {classRange(maxClass)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[#F7F9FC] p-2.5 dark:bg-slate-900/70">
                    <div className="text-[10px] text-[#475467] dark:text-slate-400">Área mojada aprox.</div>
                    <div className="truncate text-sm font-bold tabular-nums text-[#101828] dark:text-white">
                      {areaLabel(currentFrame?.wet_area_m2)}
                    </div>
                    <div className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                      en este marco horario
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 rounded-lg bg-[#F7F9FC] p-2.5 dark:bg-slate-900/70">
                    <div className="text-[10px] text-[#475467] dark:text-slate-400">Elementos con agua</div>
                    <div className="text-sm font-bold tabular-nums text-[#101828] dark:text-white">
                      {wetElements.length}{" "}
                      <span className="text-[10px] font-normal text-[#64748B] dark:text-slate-400">
                        de {affectedElements.length} que el modelo moja en la corrida
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                  estimación exploratoria; el DEM tiene ±4 m de error
                </p>

                <div className="space-y-1.5 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#101828] dark:text-white">Primera afectación</h4>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#64748B] dark:text-slate-400">
                      {firstAffectation.length}
                    </span>
                  </div>
                  <p className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                    Hora en que el modelo moja por primera vez cada elemento. Clic para centrar en el
                    mapa. La clase describe la lámina modelada, no un nivel de daño.
                  </p>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {firstAffectation.length ? (
                      firstAffectation.map((element) => {
                        const cls = classFromCm(
                          element.first_hour_depth_cm ?? element.max_depth_cm
                        );
                        return (
                          <button
                            key={element.id}
                            type="button"
                            onClick={() => focusElement(element)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:border-[#2563EB] ${
                              focusedElementId === element.id
                                ? "border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/30"
                                : "border-[#E2E8F0] dark:border-slate-800"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-medium text-[#101828] dark:text-slate-200">
                                {elementName(element)}
                              </span>
                              <span className="block text-[10px] text-[#64748B] dark:text-slate-400">
                                {CATEGORY_LABELS[element.category] || element.category} · {classLabel(cls)} (
                                {classRange(cls)})
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#2563EB] dark:text-blue-300">
                              h+{element.first_hour_affected}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="rounded-lg bg-[#F7F9FC] px-2.5 py-2 text-[10px] text-[#475467] dark:bg-slate-900/70 dark:text-slate-300">
                        Ningún elemento del catálogo tiene agua en esta corrida.
                      </p>
                    )}
                  </div>
                </div>

                <section className="space-y-2 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-white">
                      Qué hacer y cuándo
                    </h4>
                    <p className="text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                      {result.evaluation?.notice ||
                        "Orientación experimental a partir de la corrida; no reemplaza avisos oficiales."}
                    </p>
                  </div>
                  {actionWindows.length ? (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {actionWindows.map((window) => (
                        <article
                          key={window.hour}
                          className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#101828] dark:text-white">
                              {window.time_label}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold text-[#2563EB] dark:text-blue-300">
                              h+{window.hour}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-snug text-[#475467] dark:text-slate-300">
                            {window.recommendation}
                          </p>
                          {window.role_guidance?.length > 0 && (
                            <ul className="mt-1.5 space-y-1 text-[10px] leading-snug text-[#475467] dark:text-slate-300">
                              {window.role_guidance.map((guidance) => (
                                <li key={guidance.role}>
                                  <strong>{guidance.role}:</strong> {guidance.text}
                                </li>
                              ))}
                            </ul>
                          )}
                          {window.academic_continuity?.length > 0 && (
                            <p className="mt-1.5 text-[10px] leading-snug text-[#475467] dark:text-slate-300">
                              Continuidad académica: {window.academic_continuity.join(" ")}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-[#F7F9FC] px-2.5 py-2 text-[10px] text-[#475467] dark:bg-slate-900/70 dark:text-slate-300">
                      {result.evaluation?.when ||
                        "No hay ventanas de acción disponibles en esta respuesta."}
                    </p>
                  )}
                  {result.evaluation && (
                    <>
                      <p className="break-words text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                        Fuente: {(result.evaluation.sources || []).join(" · ")} · actualizado:{" "}
                        {formatLima(result.evaluation.updated_at_utc) || result.evaluation.updated_at_utc}
                      </p>
                      <ul className="space-y-1 text-[10px] leading-snug text-[#64748B] dark:text-slate-400">
                        {(result.evaluation.uncertainty || []).map((text, index) => (
                          <li key={index} className="break-words">
                            {text}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>

                <section className="border-t border-[#E2E8F0] pt-2 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRulesOpen((value) => !value)}
                    aria-expanded={rulesOpen}
                    className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-[#101828] dark:text-white"
                  >
                    <span>Reglas R-HID activadas ({activeHydroRules.length})</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-[#64748B] transition-transform dark:text-slate-400 ${
                        rulesOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {rulesOpen && (
                    <div className="mt-2 space-y-1.5">
                      {activeHydroRules.length ? (
                        activeHydroRules.map((rule) => (
                          <div
                            key={rule.rule_id}
                            className="rounded-lg bg-[#F7F9FC] p-2 text-[10px] dark:bg-slate-900/70"
                          >
                            <div className="font-semibold text-[#101828] dark:text-white">
                              <span className="mr-1 font-mono text-[#2563EB]">{rule.rule_id}</span>
                              {rule.description}
                            </div>
                            <p className="mt-0.5 break-words text-[#475467] dark:text-slate-300">
                              Observado: {rule.observed_value}
                            </p>
                            <p className="mt-0.5 break-words text-[#64748B] dark:text-slate-400">
                              {rule.threshold_note}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-[#64748B] dark:text-slate-400">
                          No se activaron reglas R-HID en esta corrida.
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <div className="border-t border-[#E2E8F0] pt-2 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAssumptionsOpen((value) => !value)}
                    aria-expanded={assumptionsOpen}
                    className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-[#101828] dark:text-white"
                  >
                    <span>Supuestos y límites</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-[#64748B] transition-transform dark:text-slate-400 ${
                        assumptionsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {assumptionsOpen && (
                    <div className="mt-2 space-y-2 text-[10px] leading-relaxed text-[#475467] dark:text-slate-300">
                      <div>
                        <div className="font-bold text-[#101828] dark:text-white">Supuestos</div>
                        <ul className="list-disc space-y-1 pl-4">
                          {(result.assumptions || []).map((text, index) => (
                            <li key={index} className="break-words">
                              {text}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-bold text-[#101828] dark:text-white">Límites</div>
                        <ul className="list-disc space-y-1 pl-4">
                          {(result.limitations || []).map((text, index) => (
                            <li key={index} className="break-words">
                              {text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
