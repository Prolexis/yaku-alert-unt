import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Droplets,
  GraduationCap,
  History,
  Layers,
  Loader2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sliders,
  WifiOff,
  X,
} from "lucide-react";
import {
  fetchHydroForecast,
  fetchHydroPresets,
  fetchHydroRun,
  fetchSimulationHistory,
  recordSimulationRun,
} from "../services/api";
import SensorDetailPanel from "./ui/SensorDetailPanel";
import { SENSOR_STATUS_STYLES, resolveSensorReading } from "../utils/sensorFormatters";
import { getFeatureDisplayName } from "../utils/campusCatalog";

const UNT_CENTER = [-8.11473, -79.03923];

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
  vectorial: { label: "Solo vectorial" },
};

// Leyenda física comprensible para humanos
const WATER_CLASSES = {
  leve: {
    label: "2–5 cm · Encharcamiento / precaución",
    shortLabel: "Encharcamiento",
    range: "2–5 cm",
    style: { color: "#38BDF8", weight: 0.7, fillColor: "#BAE6FD", fillOpacity: 0.65 },
  },
  moderada: {
    label: "5–15 cm · Aniego peatonal / desvío",
    shortLabel: "Aniego peatonal",
    range: "5–15 cm",
    style: { color: "#0284C7", weight: 0.9, fillColor: "#38BDF8", fillOpacity: 0.72 },
  },
  alta: {
    label: "> 15 cm · Inundación crítica / cierre acceso",
    shortLabel: "Inundación crítica",
    range: "> 15 cm",
    style: { color: "#DC2626", weight: 1.4, fillColor: "#1D4ED8", fillOpacity: 0.8 },
  },
};
const WATER_CLASS_ORDER = ["leve", "moderada", "alta"];

// 3 Presets operativos realistas en 1 clic
const QUICK_PRESETS = [
  {
    id: "lluvia_moderada_trasvase",
    title: "Lluvia moderada / Trasvase",
    subtitle: "~18 mm / 24 h · Drenaje normal",
    badge: "VERDE / AMARILLO",
    badgeCls: "bg-[#ECFDF5] text-[#059669] border-[#059669]/35",
    series: [0, 0.5, 1.5, 3.0, 4.5, 4.0, 2.5, 1.2, 0.8, 0, 0, 0],
    drainage: "normal",
    inflowP4: "bajo",
    secondaryInflow: false,
    useReportedSinks: false,
  },
  {
    id: "evento_2017_03",
    title: "El Niño 2017",
    subtitle: "27.5 mm / 24 h · Ingreso medio P4",
    badge: "AMARILLO / NARANJA",
    badgeCls: "bg-[#FFFBEB] text-[#D97706] border-[#D97706]/40",
    drainage: "normal",
    inflowP4: "medio",
    secondaryInflow: false,
    useReportedSinks: true,
  },
  {
    id: "evento_2023_03_10",
    title: "Ciclón Yaku 2023",
    subtitle: "35 mm + ingreso crítico Puerta 4",
    badge: "NARANJA / ROJO",
    badgeCls: "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/40",
    drainage: "obstruido",
    inflowP4: "alto",
    secondaryInflow: true,
    useReportedSinks: true,
  },
];

const SEMAPHORE_4_STYLES = {
  VERDE: {
    label: "VERDE (< 20 mm)",
    level: "INFORMATIVO",
    pill: "bg-[#059669] text-white",
    border: "border-[#059669]/35 bg-[#ECFDF5]/80 dark:border-emerald-800 dark:bg-emerald-950/35",
    academic: "Clases presenciales normales; mantener aula virtual UNT lista.",
    admin: "Atención presencial regular y verificación preventiva de drenajes.",
  },
  AMARILLO: {
    label: "AMARILLO (20–29 mm)",
    level: "VIGILANCIA_PREVENTIVA",
    pill: "bg-[#0284C7] text-white",
    border: "border-[#0284C7]/35 bg-[#F0F9FF]/80 dark:border-sky-800 dark:bg-sky-950/35",
    academic: "Flexibilidad de asistencia; habilitar grabación/transmisión sincrónica.",
    admin: "Priorizar Mesa de Partes virtual y elevar equipos en planta baja.",
  },
  NARANJA: {
    label: "NARANJA (30–49 mm)",
    level: "ATENCION_PREVENTIVA",
    pill: "bg-[#D97706] text-white",
    border: "border-[#D97706]/40 bg-[#FFFBEB]/85 dark:border-amber-700 dark:bg-amber-950/35",
    academic: "Migrar clases teóricas a aula virtual UNT y reprogramar laboratorios.",
    admin: "Activar Mesa de Partes virtual y trabajo remoto en oficinas de planta baja.",
  },
  ROJO: {
    label: "ROJO (≥ 50 mm o ingreso crítico P4)",
    level: "PREPARACION_CRITICA",
    pill: "bg-[#DC2626] text-white",
    border: "border-[#DC2626]/40 bg-[#FEF2F2]/85 dark:border-red-700 dark:bg-red-950/35",
    academic: "Virtualidad preventiva integral y suspensión de prácticas presenciales.",
    admin: "Cierre de accesos críticos, trabajo remoto obligatorio y coordinación COER/UNT.",
  },
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

function resolveSemaphore(totalRainMm, maxDepthCm, inflowP4) {
  if (totalRainMm >= 50 || maxDepthCm >= 15 || (inflowP4 === "alto" && maxDepthCm >= 10)) {
    return "ROJO";
  }
  if (totalRainMm >= 30 || maxDepthCm >= 8) return "NARANJA";
  if (totalRainMm >= 20 || maxDepthCm >= 3) return "AMARILLO";
  return "VERDE";
}

function detectGateStatusAtHour(elements = [], activeHour = 1) {
  const gateDefs = [
    { code: "P1", match: ["puerta 1", "p1"] },
    { code: "P2", match: ["puerta 2", "p2", "derecho"] },
    { code: "P3", match: ["puerta 3", "p3", "comedor", "enfermer"] },
    { code: "P4", match: ["puerta 4", "p4", "nazareth", "cidunt"] },
  ];
  const map = {};
  gateDefs.forEach((g) => {
    const matched = elements.filter((el) => {
      if (el.first_hour_affected === null || el.first_hour_affected === undefined) return false;
      if (el.first_hour_affected > activeHour) return false;
      const nm = String(el.name || "").toLowerCase();
      return g.match.some((kw) => nm.includes(kw));
    });
    if (!matched.length) {
      map[g.code] = { state: "libre", depthCm: 0, color: "#059669", label: "Libre" };
    } else {
      const peakDepth = Math.max(...matched.map((m) => m.max_depth_cm ?? 0));
      if (peakDepth >= 12) {
        map[g.code] = { state: "bloqueada", depthCm: peakDepth, color: "#DC2626", label: "Bloqueada" };
      } else {
        map[g.code] = { state: "precaucion", depthCm: peakDepth, color: "#F59E0B", label: "Precaución" };
      }
    }
  });
  return map;
}

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
  activeDemoRole = "operador_riesgos",
  onIssueAlert,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const catalogGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const gatesGroupRef = useRef(null);
  const evacuationGroupRef = useRef(null);
  const trujilloGroupRef = useRef(null);
  const sensorsGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);
  const waterLayersRef = useRef([]);
  const builtKeyRef = useRef("");

  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState("evento_2017_03");
  const [source, setSource] = useState("evento_2017_03");
  const [drainageState, setDrainageState] = useState("normal");
  const [inflowP4, setInflowP4] = useState("medio");
  const [useReportedSinks, setUseReportedSinks] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [basemap, setBasemap] = useState(
    offlineProp || (typeof navigator !== "undefined" && navigator.onLine === false)
      ? "vectorial"
      : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showEvacuation, setShowEvacuation] = useState(true);
  const [showTrujilloContext, setShowTrujilloContext] = useState(false);
  const [showSensorsLayer, setShowSensorsLayer] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(900);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRuns, setHistoryRuns] = useState([]);
  const [savingRun, setSavingRun] = useState(false);
  const [creatingCap, setCreatingCap] = useState(false);

  // Blindaje offline automático -> Solo vectorial
  useEffect(() => {
    if (offlineProp) setBasemap("vectorial");
  }, [offlineProp]);

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

  // Cargar catálogo de presets y ejecutar preset inicial (El Niño 2017)
  useEffect(() => {
    let cancelled = false;
    fetchHydroPresets()
      .then((data) => {
        if (cancelled) return;
        const list = data.presets || [];
        setPresets(list);
        const initPreset = list.find((p) => p.id === "evento_2017_03");
        if (initPreset) {
          runPresetConfig(QUICK_PRESETS[1], list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          runPresetConfig(QUICK_PRESETS[0], []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPresetConfig(presetCard, presetList = presets) {
    setPlaying(false);
    setLoading(true);
    setError("");
    setActivePresetId(presetCard.id);
    setSource(presetCard.id);
    setDrainageState(presetCard.drainage);
    setInflowP4(presetCard.inflowP4);
    setUseReportedSinks(Boolean(presetCard.useReportedSinks));
    try {
      const apiPreset = (presetList || []).find((p) => p.id === presetCard.id);
      const rainfall = apiPreset?.rainfall_mm_h || presetCard.series;
      const data = await fetchHydroRun({
        rainfall_mm_h: rainfall,
        drainage_state: presetCard.drainage,
        inflow_p4: presetCard.inflowP4,
        secondary_inflow: Boolean(presetCard.secondaryInflow),
        use_reported_sinks: Boolean(presetCard.useReportedSinks),
      });
      setResult(data);
      setHour(data.summary?.peak_hour || 1);
    } catch (err) {
      setError(err.message || "No se pudo ejecutar la simulación.");
    } finally {
      setLoading(false);
    }
  }

  async function runCustomCalculation() {
    setPlaying(false);
    setLoading(true);
    setError("");
    try {
      let data;
      if (source === "forecast") {
        data = await fetchHydroForecast(offlineProp, {
          drainage_state: drainageState,
          inflow_p4: inflowP4,
          use_reported_sinks: useReportedSinks,
        });
      } else {
        const apiPreset = presets.find((p) => p.id === source);
        const card = QUICK_PRESETS.find((q) => q.id === source);
        const rainfall = apiPreset?.rainfall_mm_h || card?.series || QUICK_PRESETS[0].series;
        data = await fetchHydroRun({
          rainfall_mm_h: rainfall,
          drainage_state: drainageState,
          inflow_p4: inflowP4,
          secondary_inflow: Boolean(card?.secondaryInflow),
          use_reported_sinks: useReportedSinks,
        });
      }
      setResult(data);
      setHour(data.summary?.peak_hour || 1);
      toast.success("Simulación recalculada con parámetros personalizados");
    } catch (err) {
      setError(err.message || "No se pudo recalcular la simulación.");
    } finally {
      setLoading(false);
    }
  }

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution("Campus UNT &copy; OpenStreetMap (ODbL)");
    catalogGroupRef.current = L.layerGroup().addTo(map);
    trujilloGroupRef.current = L.layerGroup().addTo(map);
    waterGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    gatesGroupRef.current = L.layerGroup().addTo(map);
    sensorsGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      catalogGroupRef.current = null;
      trujilloGroupRef.current = null;
      waterGroupRef.current = null;
      evacuationGroupRef.current = null;
      gatesGroupRef.current = null;
      sensorsGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Mapa base
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
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
      maxNativeZoom: 19,
    });
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

  const frames = result?.frames || [];
  const currentFrame = frames[Math.min(Math.max(hour, 1), Math.max(frames.length, 1)) - 1] || null;
  const rain = result?.parameters?.rainfall_mm_h || [];
  const rainMax = Math.max(1, ...rain);
  const totalRainMm = useMemo(() => rain.reduce((s, v) => s + (v || 0), 0), [rain]);
  const accRainAtHour = useMemo(
    () => rain.slice(0, Math.min(hour, rain.length)).reduce((s, v) => s + (v || 0), 0),
    [rain, hour]
  );

  const elements = result?.elements || [];
  const affectedElements = useMemo(
    () => elements.filter((e) => e.first_hour_affected !== null && e.first_hour_affected !== undefined),
    [elements]
  );
  const wetElementsAtHour = useMemo(
    () => affectedElements.filter((e) => e.first_hour_affected <= hour),
    [affectedElements, hour]
  );
  const gateStatusMap = useMemo(
    () => detectGateStatusAtHour(elements, hour),
    [elements, hour]
  );
  const blockedOrCautionGates = useMemo(
    () =>
      new Set(
        Object.entries(gateStatusMap)
          .filter(([, st]) => st.state !== "libre")
          .map(([code]) => code)
      ),
    [gateStatusMap]
  );

  // Capa base vectorial del campus con tooltips claros en facultades afectadas
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = catalogGroupRef.current;
    if (!map || !group || !campusLayers) return;
    group.clearLayers();
    const features = campusLayers.campus?.features || [];
    const wetById = new Map(wetElementsAtHour.map((el) => [el.id, el]));

    const perimeters = features.filter((f) => f.properties?.category === "perimetro_campus");
    perimeters.forEach((f) =>
      L.geoJSON(f, {
        interactive: false,
        style: { color: "#0B2545", weight: 2, dashArray: "3 5", fill: true, fillColor: "#F8FAFC", fillOpacity: 0.35 },
      }).addTo(group)
    );
    features
      .filter((f) => f.properties?.category === "via")
      .forEach((f) =>
        L.geoJSON(f, { interactive: false, style: { color: "#94A3B8", weight: 1.1, opacity: 0.75 } }).addTo(group)
      );
    features
      .filter((f) => f.properties?.category === "area_deportiva" || f.properties?.category === "area_verde")
      .forEach((f) =>
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#86EFAC", weight: 0.8, fillColor: "#DCFCE7", fillOpacity: 0.45 },
        }).addTo(group)
      );

    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const name = getFeatureDisplayName(f.properties);
        const wet = wetById.get(f.properties?.id);
        L.geoJSON(f, {
          style: wet
            ? { color: "#DC2626", weight: 1.8, fillColor: "#F59E0B", fillOpacity: 0.55 }
            : { color: "#64748B", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.4 },
        })
          .bindTooltip(
            wet
              ? `<strong>${esc(name)}</strong> · ${wet.max_depth_cm} cm (desde h+${wet.first_hour_affected})`
              : esc(name),
            { sticky: true, direction: "top" }
          )
          .addTo(group);
      });

    if (!fittedRef.current && perimeters.length) {
      const bounds = L.featureGroup(perimeters.map((f) => L.geoJSON(f))).getBounds();
      if (bounds.isValid()) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [22, 22] });
        fittedRef.current = true;
      }
    }
  }, [campusLayers, wetElementsAtHour]);

  // Puertas P1–P4 sincronizadas hora por hora (Verde libre / Ámbar precaución / Rojo bloqueada)
  useEffect(() => {
    const group = gatesGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    const features = campusLayers.campus?.features || [];
    features
      .filter((f) => f.properties?.category === "acceso" && f.geometry?.type === "Point")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const nm = String(f.properties?.name || "Acceso");
        const codeMatch = nm.match(/Puerta\s*([1-4])/i);
        const code = codeMatch ? `P${codeMatch[1]}` : null;
        const st = (code && gateStatusMap[code]) || {
          state: "libre",
          depthCm: 0,
          color: "#059669",
          label: "Libre",
        };
        const pulseCls = st.state === "bloqueada" ? "yaku-alert-pulse" : "";
        const icon = L.divIcon({
          className: "yaku-gate-marker",
          html: `<div class="${pulseCls}" style="display:flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:999px;background:${st.color};color:#fff;font:800 11px/1.2 'JetBrains Mono',monospace;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">${esc(code || "P")}</div>`,
          iconSize: [34, 22],
          iconAnchor: [17, 11],
        });
        L.marker([lat, lon], { icon, zIndexOffset: 750 })
          .bindTooltip(`${esc(nm)} · ${st.label}${st.depthCm ? ` (${st.depthCm} cm)` : ""}`, {
            direction: "top",
          })
          .addTo(group);
      });
  }, [campusLayers, gateStatusMap]);

  // Puntos seguros y rutas referenciales dinámicas
  useEffect(() => {
    const group = evacuationGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (!showEvacuation) return;

    const evac = campusLayers.evacuation?.features || [];
    evac
      .filter((f) => f.properties?.zone_type === "evacuation_route")
      .forEach((f) => {
        const p = f.properties || {};
        const avoidGate = p.avoid_when_gate_affected;
        const highlighted = Boolean(avoidGate && blockedOrCautionGates.has(avoidGate));
        if (highlighted) {
          L.geoJSON(f, {
            interactive: false,
            style: { color: "#F59E0B", weight: 7, opacity: 0.4 },
          }).addTo(group);
        }
        L.geoJSON(f, {
          style: {
            color: "#059669",
            weight: highlighted ? 4.2 : 2.8,
            dashArray: "8 6",
            opacity: 0.95,
          },
        })
          .bindTooltip(
            highlighted
              ? `Ruta alternativa recomendada (evita ${avoidGate})`
              : `Ruta referencial: ${esc(p.from_zone || "")}`,
            { sticky: true }
          )
          .addTo(group);
      });

    evac
      .filter((f) => f.properties?.zone_type === "safe_point" && f.geometry?.type === "Point")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties || {};
        const icon = L.divIcon({
          className: "yaku-safe-point-marker",
          html: `<div class="yaku-safe-pulse" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:#059669;color:#fff;font:800 12px/1 system-ui,sans-serif;border:2px solid #fff;">S</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([lat, lon], { icon, zIndexOffset: 650 })
          .bindTooltip(`Punto seguro: ${esc(p.name)}`, { direction: "top" })
          .addTo(group);
      });
  }, [campusLayers, showEvacuation, blockedOrCautionGates]);

  // Contexto Trujillo (Ruta del Agua)
  useEffect(() => {
    const group = trujilloGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (!showTrujilloContext) return;
    (campusLayers.surrounding_context?.features || []).forEach((f) => {
      const p = f.properties || {};
      if (f.geometry?.type === "Point") return;
      L.geoJSON(f, {
        style:
          p.feature_type === "ruta_del_agua"
            ? { color: "#00B4D8", weight: 4, dashArray: "10 6", opacity: 0.9 }
            : { color: "#4F46E5", weight: 3.5, dashArray: "5 5", opacity: 0.8 },
      })
        .bindTooltip(`${esc(p.name)} (ref.)`, { sticky: true })
        .addTo(group);
    });
  }, [campusLayers, showTrujilloContext]);

  // Capa YAKU SENSE opcional
  useEffect(() => {
    const group = sensorsGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showSensorsLayer || !virtualSensors.length) return;
    virtualSensors.forEach((sensor) => {
      const r = resolveSensorReading(sensor, hour, disconnectedSensors[sensor.id]);
      const st = SENSOR_STATUS_STYLES[r.statusKey] || SENSOR_STATUS_STYLES.no_reading;
      const icon = L.divIcon({
        className: "yaku-sensor-marker",
        html: `<div style="padding:2px 6px;border-radius:999px;background:${st.fill};color:#fff;font:700 10px/1.1 system-ui,sans-serif;border:2px solid #fff;white-space:nowrap;">${esc(sensor.id)}</div>`,
        iconSize: [44, 20],
        iconAnchor: [22, 10],
      });
      L.marker([sensor.lat, sensor.lon], { icon, zIndexOffset: 800 })
        .bindTooltip(`${esc(sensor.name)} · ${esc(r.displayValue)} [SIM]`, { direction: "top" })
        .on("click", () => onSelectSensor?.(sensor.id))
        .addTo(group);
    });
  }, [showSensorsLayer, virtualSensors, hour, disconnectedSensors, onSelectSensor]);

  // Malla de agua precalculada por hora
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group || !result?.frames?.length) return;
    const key = `${result.run_id}|${result.frames.length}`;
    if (builtKeyRef.current !== key) {
      waterLayersRef.current = result.frames.map((frame) => {
        const fg = L.layerGroup();
        (frame.geojson?.features || []).forEach((feat) => {
          const cls = WATER_CLASSES[feat.properties?.depth_class]
            ? feat.properties.depth_class
            : "leve";
          L.geoJSON(feat, { style: WATER_CLASSES[cls].style })
            .bindTooltip(WATER_CLASSES[cls].label, { sticky: true })
            .addTo(fg);
        });
        return fg;
      });
      builtKeyRef.current = key;
    }
    group.clearLayers();
    const idx = Math.min(Math.max(hour, 1), result.frames.length) - 1;
    if (waterLayersRef.current[idx]) group.addLayer(waterLayersRef.current[idx]);
  }, [result, hour]);

  // Reproducción temporal fluida
  useEffect(() => {
    if (!playing || !frames.length) return;
    if (hour >= frames.length) {
      setPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setHour((prev) => Math.min(prev + 1, frames.length));
    }, speedMs);
    return () => clearInterval(timer);
  }, [playing, hour, frames.length, speedMs]);

  const maxDepthAtHour = currentFrame?.max_depth_cm ?? 0;
  const semaphoreKey = resolveSemaphore(totalRainMm, maxDepthAtHour, inflowP4);
  const semCfg = SEMAPHORE_4_STYLES[semaphoreKey];

  const activePresetTitle =
    QUICK_PRESETS.find((q) => q.id === activePresetId)?.title ||
    (source === "forecast" ? "Pronóstico 48 h" : "Escenario personalizado");

  const affectedGatesList = Object.entries(gateStatusMap)
    .filter(([, st]) => st.state !== "libre")
    .map(([code]) => code);

  // Narrativa en 1 frase clara para la hora actual
  const hourNarrative = useMemo(() => {
    const hStr = `Hora ${String(hour).padStart(2, "0")}`;
    if (!currentFrame || maxDepthAtHour < 2) {
      return `${hStr}: sin acumulación crítica visible en accesos; mantener monitoreo preventivo del campus.`;
    }
    if (affectedGatesList.length > 0) {
      return `${hStr}: acumulación de ${maxDepthAtHour} cm con compromiso en ${affectedGatesList.join(", ")} (${wetElementsAtHour.length} sectores); desviar evacuación hacia Explanada Sociales / Parque Max Díaz.`;
    }
    return `${hStr}: encharcamiento modelado de ${maxDepthAtHour} cm en ${wetElementsAtHour.length} sectores bajos; transitar por veredas elevadas.`;
  }, [hour, currentFrame, maxDepthAtHour, affectedGatesList, wetElementsAtHour.length]);

  const handleCreateCapAlert = async () => {
    if (!onIssueAlert || creatingCap) return;
    setCreatingCap(true);
    try {
      const peakDepth = result?.summary?.max_depth_cm ?? maxDepthAtHour;
      const peakHr = result?.summary?.peak_hour ?? hour;
      const zones = affectedGatesList.length
        ? affectedGatesList.map((g) => `Acceso ${g}`)
        : ["Puerta 4 (Av. Jesús de Nazareth)", "Sectores bajos UNT"];
      await onIssueAlert({
        level: semCfg.level,
        severity: semaphoreKey,
        target_profile: "all",
        target_roles: ["estudiante", "docente", "administrativo"],
        channel: "campus_banner",
        title: `Simulación ${activePresetTitle} — Nivel ${semaphoreKey}`,
        what_happens: `Escenario ${activePresetTitle} (${totalRainMm.toFixed(1)} mm) con lámina pico de ${peakDepth} cm en h+${peakHr}.`,
        where_zone: `Ciudad Universitaria UNT (${zones.join(", ")})`,
        when_window: `Pico modelado en Hora ${String(peakHr).padStart(2, "0")} · Ventana 24 h`,
        what_to_do: `${semCfg.academic} ${semCfg.admin} Evitar ${zones.join(", ")} y evacuar a puntos seguros.`,
        issuer: `Yaku Alert UNT — Validación Humana (${activeDemoRole}) · Datos sintéticos`,
        affected_zones: zones,
        status: "emitida",
        validated_by_role: activeDemoRole === "operador_riesgos" ? "operador_riesgos" : "directivo",
      });
    } catch (err) {
      toast.error("No se pudo crear la alerta CAP", { description: err.message });
    } finally {
      setCreatingCap(false);
    }
  };

  const handleSaveRun = async () => {
    if (!result || savingRun) return;
    setSavingRun(true);
    try {
      await recordSimulationRun({
        scenario_name: `${activePresetTitle} (${totalRainMm.toFixed(1)} mm)`,
        params: { drainage_state: drainageState, inflow_p4: inflowP4, use_reported_sinks: useReportedSinks },
        peak_hour: result.summary?.peak_hour || hour,
        max_depth_cm: result.summary?.max_depth_cm || maxDepthAtHour,
        affected_gates: affectedGatesList,
        affected_buildings_count: affectedElements.length,
        executed_by_role: activeDemoRole,
      });
      toast.success("Simulacro guardado en historial SQLite");
      const hist = await fetchSimulationHistory();
      setHistoryRuns(hist.runs || []);
    } catch (err) {
      toast.error("No se pudo guardar el simulacro", { description: err.message });
    } finally {
      setSavingRun(false);
    }
  };

  const openHistoryModal = async () => {
    setHistoryOpen(true);
    try {
      const hist = await fetchSimulationHistory();
      setHistoryRuns(hist.runs || []);
    } catch {
      // Silencioso
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* ZONA SUPERIOR: Cabecera + 3 Presets en 1 clic + Parámetros colapsables */}
      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D97706]/40 bg-[#FFFBEB] px-3 py-0.5 text-xs font-extrabold text-[#92400E] dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                TRL 3–4 · Datos sintéticos para simulación operativa
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${semCfg.pill}`}>
                Semáforo {semaphoreKey}
              </span>
            </div>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
              Centro de Simulación Operativa (10 m)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openHistoryModal}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-[#0B2545] transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] dark:border-slate-700 dark:bg-[#0B2545] dark:text-white"
            >
              <History className="h-4 w-4 text-[#0369A1]" />
              <span>Historial de simulacros</span>
            </button>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-[#475569] transition hover:border-[#00B4D8] hover:text-[#0F172A] dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-200"
            >
              <Sliders className="h-4 w-4 text-[#0369A1]" />
              <span>Ajustar parámetros hidrológicos (especialistas)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* 3 Tarjetas-botón directas en 1 clic */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {QUICK_PRESETS.map((p) => {
            const active = activePresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => runPresetConfig(p)}
                aria-pressed={active}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-[#0369A1] bg-[#F0F9FF] shadow-sm ring-1 ring-[#0369A1] dark:border-[#00B4D8] dark:bg-sky-950/45"
                    : "border-slate-200 bg-white hover:border-[#00B4D8] dark:border-slate-800 dark:bg-[#0B2545]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CloudRain className="h-4 w-4 shrink-0 text-[#0369A1] dark:text-[#38BDF8]" />
                    <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {p.title}
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${p.badgeCls}`}>
                    {p.badge}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs font-medium text-[#475569] dark:text-slate-300">
                  <span>{p.subtitle}</span>
                  {loading && active && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0369A1]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Panel colapsable de parámetros avanzados (cerrado por defecto) */}
        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1 text-xs font-bold text-[#475569] dark:text-slate-300">
                  <span>Fuente lluvia</span>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="forecast">Pronóstico 48 h (Open-Meteo)</option>
                    {QUICK_PRESETS.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-bold text-[#475569] dark:text-slate-300">
                  <span>Estado del drenaje</span>
                  <select
                    value={drainageState}
                    onChange={(e) => setDrainageState(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="obstruido">Obstruido</option>
                    <option value="pendiente_deficiente">Pendiente deficiente</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-bold text-[#475569] dark:text-slate-300">
                  <span>Ingreso por Puerta 4</span>
                  <select
                    value={inflowP4}
                    onChange={(e) => setInflowP4(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="ninguno">Ninguno</option>
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </label>

                <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={useReportedSinks}
                    onChange={(e) => setUseReportedSinks(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#0369A1]"
                  />
                  <span>Sumideros reportados (CIDUNT/P4)</span>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={runCustomCalculation}
                    disabled={loading}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-extrabold text-white transition hover:bg-[#0369A1] disabled:opacity-60 dark:bg-[#0369A1]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
                    <span>Recalcular</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div role="alert" className="rounded-xl border border-[#DC2626]/35 bg-[#FEF2F2] px-4 py-2 text-xs font-semibold text-[#991B1B]">
            {error}
          </div>
        )}
      </div>

      {/* ZONA CENTRAL (~68%) + ZONA DERECHA (~32%) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ZONA CENTRAL: Mapa operativo sincronizado hora por hora */}
        <div className="min-w-0 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
            <div className="relative">
              <div
                ref={mapContainerRef}
                className="h-[440px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[560px]"
              />

              {/* Pill hora actual + estado offline */}
              <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-1.5">
                <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200/90 bg-white/92 px-3 py-1.5 font-mono text-xs font-extrabold text-[#0B2545] shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/92 dark:text-white">
                  <span>Hora {String(hour).padStart(2, "0")} / {frames.length || 24}</span>
                  <span className="text-[#0369A1] dark:text-[#38BDF8]">· {maxDepthAtHour} cm</span>
                </span>
                {(basemap === "vectorial" || tilesFailed) && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-2.5 py-1 text-xs font-bold text-[#92400E] shadow-sm">
                    <WifiOff className="h-3.5 w-3.5" />
                    Solo vectorial (100 % offline)
                  </span>
                )}
              </div>

              {/* Controles flotantes limpios arriba a la derecha */}
              <div className="absolute right-3 top-3 z-[400] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-1.5 rounded-xl border border-slate-200/80 bg-white/92 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
                <button
                  type="button"
                  onClick={() => setShowEvacuation((v) => !v)}
                  aria-pressed={showEvacuation}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    showEvacuation
                      ? "bg-[#059669] text-white"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-slate-100"
                  }`}
                >
                  Rutas seguras
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrujilloContext((v) => !v)}
                  aria-pressed={showTrujilloContext}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    showTrujilloContext
                      ? "bg-[#0369A1] text-white"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-slate-100"
                  }`}
                >
                  Ruta del Agua
                </button>
                <button
                  type="button"
                  onClick={() => setShowSensorsLayer((v) => !v)}
                  aria-pressed={showSensorsLayer}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    showSensorsLayer
                      ? "bg-[#0B2545] text-white dark:bg-[#00B4D8]"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-slate-100"
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>IoT [SIM]</span>
                </button>
                <div
                  role="group"
                  aria-label="Mapa base"
                  className="inline-flex rounded-lg border border-slate-200 bg-[#F8FAFC] p-0.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  {Object.entries(BASEMAPS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBasemap(key)}
                      aria-pressed={basemap === key}
                      className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                        basemap === key
                          ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                          : "text-[#475569] dark:text-slate-300"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leyenda física comprensible (colapsable) */}
              <div className="absolute bottom-3 left-3 z-[400] max-w-[92%] rounded-xl border border-slate-200/90 bg-white/92 px-3 py-2 text-xs shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  aria-expanded={legendOpen}
                  className="flex items-center gap-2 font-extrabold text-[#0B2545] dark:text-white"
                >
                  <span>Leyenda física (malla 10 m)</span>
                  {legendOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                {legendOpen && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-[#0F172A] dark:text-slate-200">
                    {WATER_CLASS_ORDER.map((cls) => (
                      <span key={cls} className="inline-flex items-center gap-1.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{
                            background: WATER_CLASSES[cls].style.fillColor,
                            border: `1.5px solid ${WATER_CLASSES[cls].style.color}`,
                          }}
                        />
                        {WATER_CLASSES[cls].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reproductor horario + mini-gráfico de lluvia */}
            <div className="space-y-3 border-t border-slate-200 bg-[#F8FAFC] px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!playing && hour >= frames.length) setHour(1);
                    setPlaying((p) => !p);
                  }}
                  disabled={!frames.length}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 text-xs font-extrabold text-white transition hover:bg-[#0369A1] disabled:opacity-50 dark:bg-[#0369A1]"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{playing ? "Pausar" : "Reproducir"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setHour(1);
                  }}
                  disabled={!frames.length}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#0F172A] hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reiniciar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedMs((s) => (s === 900 ? 450 : 900))}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-[#0369A1] hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0B2545] dark:text-[#38BDF8]"
                >
                  {speedMs === 900 ? "1x" : "2x"}
                </button>

                <div className="flex min-w-[160px] flex-1 items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={Math.max(frames.length, 1)}
                    step={1}
                    value={Math.min(Math.max(hour, 1), Math.max(frames.length, 1))}
                    onChange={(e) => {
                      setPlaying(false);
                      setHour(Number(e.target.value));
                    }}
                    disabled={!frames.length}
                    aria-label="Línea de tiempo horaria"
                    className="h-2.5 flex-1 cursor-pointer accent-[#0369A1]"
                  />
                  <span className="shrink-0 font-mono text-xs font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                    {accRainAtHour.toFixed(1)} mm acum.
                  </span>
                </div>
              </div>

              {/* Estado en vivo de puertas P1–P4 en esta hora */}
              <div className="grid grid-cols-4 gap-2">
                {["P1", "P2", "P3", "P4"].map((code) => {
                  const st = gateStatusMap[code];
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-[#0B2545]"
                    >
                      <span className="font-mono font-extrabold text-[#0B2545] dark:text-white">
                        {code}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 font-bold"
                        style={{ color: st.color }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mini-gráfico interactivo de lluvia */}
              <svg
                viewBox={`0 0 ${Math.max(rain.length, 1) * 8} 44`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Hietograma horario de la simulación"
                className="h-10 w-full cursor-pointer rounded-lg bg-white dark:bg-slate-900"
                onClick={(e) => {
                  if (!rain.length) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 0.999);
                  setPlaying(false);
                  setHour(Math.min(rain.length, Math.max(1, Math.floor(ratio * rain.length) + 1)));
                }}
              >
                {rain.map((val, idx) => {
                  const h = val > 0 ? Math.max((val / rainMax) * 38, 2) : 0;
                  const isCurr = idx + 1 === hour;
                  return (
                    <rect
                      key={idx}
                      x={idx * 8 + 1}
                      y={44 - h}
                      width={6}
                      height={h}
                      rx={1.5}
                      fill={isCurr ? "#0B2545" : idx + 1 < hour ? "#00B4D8" : "#CBD5E1"}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* ZONA DERECHA (~32%): Panel de Decisión y Acción en Tiempo Real */}
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

          {/* 1. Narrativa de la hora actual */}
          <section className={`rounded-2xl border-2 p-4 shadow-panel ${semCfg.border}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-slate-200">
                1. Lectura operativa (Hora {String(hour).padStart(2, "0")})
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${semCfg.pill}`}>
                {semaphoreKey}
              </span>
            </div>
            <p className="mt-2 text-sm font-bold leading-snug text-[#0F172A] dark:text-white">
              {hourNarrative}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/90 p-2 text-center dark:bg-[#0B2545]">
                <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">Lluvia</div>
                <div className="font-mono text-sm font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                  {totalRainMm.toFixed(1)} mm
                </div>
              </div>
              <div className="rounded-xl bg-white/90 p-2 text-center dark:bg-[#0B2545]">
                <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">Lámina</div>
                <div className="font-mono text-sm font-extrabold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                  {maxDepthAtHour} cm
                </div>
              </div>
              <div className="rounded-xl bg-white/90 p-2 text-center dark:bg-[#0B2545]">
                <div className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">Sectores</div>
                <div className="font-mono text-sm font-extrabold text-[#D97706] tabular-nums dark:text-amber-300">
                  {wetElementsAtHour.length}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Regla activada y Umbral Oficial (4 colores) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
              <AlertTriangle className="h-4 w-4" />
              <span>2. Regla compuesta y Umbral Oficial</span>
            </div>
            <div className="mt-2 rounded-xl bg-[#F8FAFC] p-3 font-mono text-xs font-bold text-[#0B2545] dark:bg-slate-900/70 dark:text-slate-100">
              SI lluvia_24h ({totalRainMm.toFixed(1)} mm) / lámina ({maxDepthAtHour} cm) ≥ umbral →{" "}
              <span className="underline">{semaphoreKey}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
              <span className="rounded-md bg-[#ECFDF5] px-2 py-1 text-[#059669]">VERDE &lt; 20 mm</span>
              <span className="rounded-md bg-[#F0F9FF] px-2 py-1 text-[#0284C7]">AMARILLO 20–29 mm</span>
              <span className="rounded-md bg-[#FFFBEB] px-2 py-1 text-[#D97706]">NARANJA 30–49 mm</span>
              <span className="rounded-md bg-[#FEF2F2] px-2 py-1 text-[#DC2626]">ROJO ≥ 50 mm / P4</span>
            </div>
          </section>

          {/* 3. Alternativas de Continuidad sugeridas */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-white">
              3. Alternativas de Continuidad sugeridas
            </div>
            <div className="mt-2.5 space-y-2">
              <div className="rounded-xl bg-[#F0F9FF] p-3 dark:bg-sky-950/40">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0369A1] dark:text-[#38BDF8]">
                  <GraduationCap className="h-4 w-4" />
                  <span>Académica</span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  {semCfg.academic}
                </p>
              </div>
              <div className="rounded-xl bg-[#ECFDF5] p-3 dark:bg-emerald-950/35">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                  <Briefcase className="h-4 w-4" />
                  <span>Administrativa</span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  {semCfg.admin}
                </p>
              </div>
            </div>
          </section>

          {/* 4. Acciones reales conectadas a SQLite */}
          <section className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-white">
              4. Acciones operativas (SQLite en vivo)
            </div>
            <button
              type="button"
              onClick={handleCreateCapAlert}
              disabled={!result || creatingCap || !onIssueAlert}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] disabled:opacity-50 dark:bg-[#0369A1]"
            >
              <Send className="h-4 w-4" />
              <span>
                {creatingCap ? "Emitiendo alerta CAP..." : "Crear alerta CAP para este escenario"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSaveRun}
              disabled={!result || savingRun}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#0369A1]/40 bg-[#F0F9FF] px-4 text-xs font-bold text-[#0369A1] transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-950/60 dark:text-[#38BDF8]"
            >
              <Save className="h-4 w-4" />
              <span>{savingRun ? "Guardando..." : "Guardar simulacro en historial"}</span>
            </button>
            <p className="text-xs leading-snug text-[#475569] dark:text-slate-400">
              TRL 3–4 · Simulación exploratoria (DEM ±4 m). No sustituye alertas oficiales SENAMHI / COER.
            </p>
          </section>
        </div>
      </div>

      {/* Modal de Historial de Simulacros (Pilar 4 — SQLite) */}
      <AnimatePresence>
        {historyOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071524]/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Historial de simulacros guardados"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2545] px-5 py-4 text-white dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#38BDF8]" />
                  <h3 className="text-sm font-extrabold">
                    Historial de simulacros guardados (Pilar 4 · SQLite)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Cerrar historial"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[64vh] space-y-2.5 overflow-y-auto p-5">
                {historyRuns.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-[#475569] dark:border-slate-700 dark:text-slate-300">
                    Aún no hay simulacros guardados. Pulsa "Guardar simulacro en historial" para registrar esta corrida y comparar escenarios.
                  </p>
                ) : (
                  historyRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 text-xs dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <div>
                        <div className="font-extrabold text-[#0F172A] dark:text-white">
                          #{run.id} · {run.scenario_name}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-[#475569] dark:text-slate-300">
                          Pico: h+{run.peak_hour} · Lámina máx.: {run.max_depth_cm} cm · Edificios:{" "}
                          {run.affected_buildings_count} · Rol: {run.executed_by_role}
                        </div>
                      </div>
                      {run.affected_gates?.length > 0 && (
                        <span className="rounded-full bg-[#FEF2F2] px-2.5 py-0.5 font-mono text-xs font-bold text-[#DC2626] dark:bg-red-950 dark:text-red-200">
                          Accesos: {run.affected_gates.join(", ")}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
