import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  BellRing,
  CloudRain,
  MapPin,
  Search,
  ShieldCheck,
  Waves,
  Wifi,
  WifiOff,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Megaphone,
} from "lucide-react";
import { formatLimaTime, normalizeText } from "../utils/formatters";
import { buildCampusCatalog, getFeatureDisplayName } from "../utils/campusCatalog";
import ExplainabilityStrip from "./ui/ExplainabilityStrip";
import BuildingDynamicCard from "./ui/BuildingDynamicCard";
import { REPORT_CATEGORIES } from "./ui/CampusReportModal";
import WhereAmISafeRouteBar from "./ui/WhereAmISafeRouteBar";
import { findNearestSafeRoute } from "../utils/safeRouteHelper";
import { renderEvacuationLayers } from "../utils/evacuationLayers";
import { HD_BASEMAPS, attachHdBaseLayer } from "../utils/mapTiles";

const LIVE_WATER_STYLES = {
  leve: { color: "#38BDF8", weight: 0.8, fillColor: "#BAE6FD", fillOpacity: 0.65 },
  moderada: { color: "#0284C7", weight: 1.0, fillColor: "#38BDF8", fillOpacity: 0.72 },
  alta: { color: "#DC2626", weight: 1.5, fillColor: "#1D4ED8", fillOpacity: 0.82 },
};

const BUILDING_RISK_FILL = {
  critico: { color: "#DC2626", weight: 2, fillColor: "#EF4444", fillOpacity: 0.55 },
  alto: { color: "#D97706", weight: 1.8, fillColor: "#F59E0B", fillOpacity: 0.5 },
  moderado: { color: "#0284C7", weight: 1.5, fillColor: "#38BDF8", fillOpacity: 0.45 },
  seguro: { color: "#1D4ED8", weight: 1.2, fillColor: "#3B82F6", fillOpacity: 0.42 },
};

const UNT_CENTER = [-8.11473, -79.03923];
const BASEMAPS = HD_BASEMAPS;

const EVACUATION_DISCLAIMER =
  "Rutas y puntos referenciales (TRL 3–4). No reemplazan la señalización oficial de Defensa Civil UNT ni alertas de SENAMHI/COEN.";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

function resolveStudentNowAction(liveEvaluation, summary, activeDemoRole = "estudiante") {
  const level = liveEvaluation?.preventive_level || "INFORMATIVO";
  if (level === "PREPARACION_CRITICA" || level === "ATENCION_PREVENTIVA") {
    const roleText =
      activeDemoRole === "docente"
        ? "Docente: suspende prácticas de laboratorio en planta baja, migra clases teóricas al aula virtual y conduce al grupo hacia el punto seguro más cercano."
        : activeDemoRole === "administrativo"
        ? "Administrativo: activa Mesa de Partes virtual, desconecta y resguarda equipos en planta baja y evita cruzar Puerta 4 / Av. Jesús de Nazareth."
        : "Estudiante: evita desplazarte por sectores con acumulación de agua (Puerta 4 / Av. Jesús de Nazareth) y prioriza puntos seguros en cota alta.";
    return {
      tone: "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
      dot: "bg-rose-600",
      text: roleText,
    };
  }
  if (level === "VIGILANCIA_PREVENTIVA" || (summary?.max_intensity_mm_h ?? 0) >= 2) {
    const roleText =
      activeDemoRole === "docente"
        ? "Docente: prepara transición a aula virtual y ubica el punto de encuentro más cercano a tu pabellón."
        : activeDemoRole === "administrativo"
        ? "Administrativo: verifica drenajes cercanos a tu oficina y prepara resguardo de expedientes y equipos en planta baja."
        : "Estudiante: ten precaución en zonas bajas del campus y consulta comunicados oficiales de la UNT.";
    return {
      tone: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
      dot: "bg-amber-500",
      text: roleText,
    };
  }
  const normalText =
    activeDemoRole === "docente"
      ? "Docente: sin lluvias significativas previstas. Toca tu pabellón en el mapa para revisar el punto seguro asignado a tu grupo."
      : activeDemoRole === "administrativo"
      ? "Administrativo: sin lluvias significativas previstas. Toca tu edificio para revisar el protocolo de resguardo y acceso seguro."
      : "Estudiante: sin lluvias significativas previstas. Ubica tu facultad y los puntos de encuentro referenciales en el mapa.";
  return {
    tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100",
    dot: "bg-emerald-600",
    text: normalText,
  };
}

export default function StudentMonitoringMap({
  weather,
  liveEvaluation,
  campusLayers,
  declaredConditions = [],
  focusedBuildingId = "",
  onSelectBuilding,
  onNavigate,
  offline = false,
  activeAlerts = [],
  activeDemoRole = "estudiante",
  onConfirmAlert,
  campusReports = [],
  onOpenReportModal,
  liveSimulation = null,
  buildingStatusById = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const attentionGroupRef = useRef(null);
  const liveWaterGroupRef = useRef(null);
  const liveGatesGroupRef = useRef(null);
  const evacuationGroupRef = useRef(null);
  const trujilloContextGroupRef = useRef(null);
  const reportsGroupRef = useRef(null);
  const myRouteGroupRef = useRef(null);
  const focusLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);

  const [basemap, setBasemap] = useState(
    offline || (typeof navigator !== "undefined" && navigator.onLine === false)
      ? "vectorial"
      : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showAttentionZones, setShowAttentionZones] = useState(true);
  const [showSafeAreas, setShowSafeAreas] = useState(true);
  const [showMeetingPoints, setShowMeetingPoints] = useState(true);
  const [showTrujilloContext, setShowTrujilloContext] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [frequentOpen, setFrequentOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [myLocationId, setMyLocationId] = useState("");
  const lastFlownOriginRef = useRef("");

  // Blindaje offline: al activarse modo sin conexión, cambia automáticamente a Solo vectorial
  useEffect(() => {
    if (offline) {
      setBasemap("vectorial");
    }
  }, [offline]);

  const catalog = useMemo(() => buildCampusCatalog(campusLayers, null), [campusLayers]);

  const facultyOptions = useMemo(
    () =>
      catalog.filter(
        (c) =>
          c.center &&
          ["facultad", "escuela_pabellon", "biblioteca_auditorio", "comedor_servicios", "oficina"].includes(
            c.typeId
          )
      ),
    [catalog]
  );

  const blockedGatesFromReports = useMemo(() => {
    const blockedGates = new Set();
    campusReports.forEach((r) => {
      if (r.status === "atendido") return;
      const z = String(r.zone_name || "").toLowerCase();
      if (r.category === "acceso_bloqueado" || r.severity === "alta") {
        if (z.includes("puerta 4")) blockedGates.add("P4");
        if (z.includes("puerta 3")) blockedGates.add("P3");
        if (z.includes("puerta 2")) blockedGates.add("P2");
        if (z.includes("puerta 1")) blockedGates.add("P1");
      }
    });
    if (liveSimulation?.active && Array.isArray(liveSimulation.affected_gates)) {
      liveSimulation.affected_gates.forEach((g) => {
        const s = String(g || "").toLowerCase();
        if (s.includes("4")) blockedGates.add("P4");
        if (s.includes("3")) blockedGates.add("P3");
        if (s.includes("2")) blockedGates.add("P2");
        if (s.includes("1")) blockedGates.add("P1");
      });
    }
    return blockedGates;
  }, [campusReports, liveSimulation]);

  const activeBuildingStatus = useMemo(() => {
    const targetId = focusedBuildingId || myLocationId || "";
    if (!targetId || !buildingStatusById) return null;
    return buildingStatusById.get(targetId) || null;
  }, [focusedBuildingId, myLocationId, buildingStatusById]);

  const mySafeRoute = useMemo(() => {
    if (!myLocationId) return null;
    const origin = catalog.find((c) => c.id === myLocationId);
    if (!origin) return null;
    return findNearestSafeRoute({
      originItem: origin,
      campusLayers,
      affectedGates: blockedGatesFromReports,
    });
  }, [myLocationId, catalog, campusLayers, blockedGatesFromReports]);

  const filteredCatalog = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) {
      return catalog
        .filter((c) => c.typeId === "facultad" || c.typeId === "comedor_servicios" || c.typeId === "biblioteca_auditorio")
        .slice(0, 8);
    }
    return catalog.filter((c) => c.searchText.includes(q)).slice(0, 10);
  }, [catalog, query]);

  const { local: updatedLima } = formatLimaTime(weather?.fetched_at_utc);
  const isLive = weather?.data_status === "LIVE_API";
  const studentNow = resolveStudentNowAction(liveEvaluation, weather?.summary, activeDemoRole);
  const maxProb24 =
    weather?.summary?.max_probability_24h_pct ?? weather?.summary?.max_probability_pct;

  // Inicializa el mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 19,
      zoomSnap: 1,
      zoomDelta: 1,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution("Datos del campus &copy; OpenStreetMap (ODbL)");
    baseGroupRef.current = L.layerGroup().addTo(map);
    attentionGroupRef.current = L.layerGroup().addTo(map);
    liveWaterGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    liveGatesGroupRef.current = L.layerGroup().addTo(map);
    trujilloContextGroupRef.current = L.layerGroup().addTo(map);
    reportsGroupRef.current = L.layerGroup().addTo(map);
    myRouteGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      attentionGroupRef.current = null;
      liveWaterGroupRef.current = null;
      liveGatesGroupRef.current = null;
      evacuationGroupRef.current = null;
      trujilloContextGroupRef.current = null;
      reportsGroupRef.current = null;
      myRouteGroupRef.current = null;
      focusLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Mapa base HD (@2x Retina)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    tileErrorsRef.current = 0;
    setTilesFailed(false);
    tileLayerRef.current = attachHdBaseLayer(map, basemap, {
      onFallbackOffline: () => setTilesFailed(true),
      onTileLoaded: () => setTilesFailed(false),
    });
  }, [basemap]);

  // Capas del campus (sin sensores IoT ni elementos administrativos)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = baseGroupRef.current;
    if (!map || !group || !campusLayers) return;
    group.clearLayers();

    const features = campusLayers.campus?.features || [];
    const perimeters = features.filter((f) => f.properties?.category === "perimetro_campus");
    perimeters.forEach((f) => {
      const layer = L.geoJSON(f, {
        interactive: false,
        style: {
          color: "#0B1F33",
          weight: 2,
          dashArray: "3 5",
          fill: true,
          fillColor: "#F8FAFC",
          fillOpacity: 0.3,
        },
      }).addTo(group);
      if (!fittedRef.current) {
        const b = layer.getBounds();
        if (b.isValid()) {
          map.fitBounds(b, { padding: [20, 20] });
          fittedRef.current = true;
        }
      }
    });

    // Vías, áreas verdes y deportivas locales para que el modo Solo vectorial sea claro sin internet
    features
      .filter((f) => f.properties?.category === "via")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#94A3B8", weight: 1.2, opacity: 0.75 },
        }).addTo(group);
      });
    features
      .filter((f) => f.properties?.category === "area_verde")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#86EFAC", weight: 0.8, fillColor: "#DCFCE7", fillOpacity: 0.5 },
        }).addTo(group);
      });
    features
      .filter((f) => f.properties?.category === "area_deportiva")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#4ADE80", weight: 0.9, fillColor: "#BBF7D0", fillOpacity: 0.35 },
        }).addTo(group);
      });

    // Edificios reales OSM (coloreados dinámicamente si hay simulación en vivo activa)
    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const bldId = f.properties?.id || "";
        const name = getFeatureDisplayName(f.properties);
        const isNamed = !/^Edificio sin nombre/i.test(f.properties?.name || "");
        const dyn = buildingStatusById?.get(bldId);
        const dynStyle =
          liveSimulation?.active && dyn && dyn.risk_level !== "seguro"
            ? BUILDING_RISK_FILL[dyn.risk_level] || BUILDING_RISK_FILL.seguro
            : {
                color: isNamed ? "#1D4ED8" : "#94A3B8",
                weight: 1.2,
                fillColor: isNamed ? "#3B82F6" : "#CBD5E1",
                fillOpacity: 0.45,
              };
        L.geoJSON(f, {
          style: dynStyle,
          onEachFeature: (_feat, lyr) => {
            const badgeText = dyn
              ? `${dyn.risk_label || dyn.risk_level} · ${dyn.max_depth_cm} cm`
              : isNamed
              ? "Campus UNT"
              : "Referencia";
            const badgeBg =
              dyn?.risk_level === "critico"
                ? "background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;"
                : dyn?.risk_level === "alto"
                ? "background:#FFFBEB;color:#D97706;border:1px solid #FDE68A;"
                : dyn?.risk_level === "moderado"
                ? "background:#F0F9FF;color:#0284C7;border:1px solid #BAE6FD;"
                : "background:#ECFDF5;color:#059669;border:1px solid #A7F3D0;";
            const statusBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:999px;${badgeBg}font:700 10px/1.4 system-ui,sans-serif;">${esc(badgeText)}</span>`;
            const roleKey =
              activeDemoRole === "docente"
                ? "docente"
                : activeDemoRole === "administrativo"
                ? "administrativo"
                : "estudiante";
            const dynRec =
              dyn?.recommendations_by_role?.[roleKey] ||
              "Haz clic para ver el estado y trazar la ruta segura más cercana.";
            lyr.bindTooltip(
              `<div style="min-width:140px;">
                <div style="font-weight:800;color:#0F172A;font-size:12px;">${esc(name)}</div>
                <div style="margin-top:2px;">${statusBadge}</div>
              </div>`,
              { sticky: true, direction: "top" }
            );
            lyr.bindPopup(
              `<div class="space-y-1.5 max-w-[245px]">
                <div class="flex items-center justify-between gap-2">${statusBadge}</div>
                <div class="font-extrabold text-[#0F172A] text-xs">${esc(name)}</div>
                <div class="text-xs text-[#475569]">${esc(dynRec)}</div>
              </div>`,
              { className: "yaku-popup" }
            );
            lyr.on("click", () => {
              onSelectBuilding?.(bldId);
              if (!dyn) {
                setSelectedCard({
                  name,
                  infoType: f.properties?.verified ? "Instalación verificada" : "Referencia cartográfica",
                  explanation:
                    "Instalación registrada en la Ciudad Universitaria UNT. Selecciona tu facultad abajo para trazar la ruta segura más cercana.",
                });
              } else {
                setSelectedCard(null);
              }
            });
          },
        }).addTo(group);
      });

    // Accesos y puntos de encuentro referenciales
    features
      .filter((f) => f.properties?.category === "acceso")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: 6,
          color: "#0B1F33",
          weight: 1.5,
          fillColor: "#2563EB",
          fillOpacity: 0.9,
        })
          .on("click", () => {
            setSelectedCard({
              name: f.properties?.name || "Acceso UNT",
              infoType: "Referencia cartográfica",
              explanation:
                "Acceso perimetral de la Ciudad Universitaria UNT. En caso de lluvia intensa, prioriza vías sin acumulación de agua y avisos oficiales.",
            });
          })
          .addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "punto_encuentro")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: 7,
          color: "#0B1F33",
          weight: 1.5,
          fillColor: "#14B8A6",
          fillOpacity: 0.95,
        })
          .on("click", () => {
            setSelectedCard({
              name: f.properties?.name || "Punto de encuentro referencial",
              infoType: "Referencia preventiva",
              explanation:
                "Espacio abierto referencial dentro del campus. Sigue siempre la señalización física y las indicaciones de Defensa Civil UNT.",
            });
          })
          .addTo(group);
      });
  }, [campusLayers, onSelectBuilding, buildingStatusById, liveSimulation?.active, activeDemoRole]);

  // Capa en vivo de celdas inundadas y puertas bloqueadas cuando Gestión UNT activa simulación en vivo
  useEffect(() => {
    const waterGroup = liveWaterGroupRef.current;
    const gatesGroup = liveGatesGroupRef.current;
    if (!waterGroup || !gatesGroup) return;
    waterGroup.clearLayers();
    gatesGroup.clearLayers();

    if (!liveSimulation?.active) return;

    const frames = liveSimulation.frames || [];
    const targetHr = liveSimulation.current_sim_hour || liveSimulation.summary?.peak_hour || 1;
    const frame =
      frames.find((f) => f.hour === targetHr) ||
      frames.find((f) => f.hour === liveSimulation.summary?.peak_hour) ||
      frames[frames.length - 1];

    if (frame?.geojson?.features?.length) {
      frame.geojson.features.forEach((feat) => {
        const cls = feat.properties?.depth_class || "leve";
        const style = LIVE_WATER_STYLES[cls] || LIVE_WATER_STYLES.leve;
        const label =
          cls === "alta"
            ? "> 15 cm · Inundación crítica (Simulación en vivo)"
            : cls === "moderada"
            ? "5–15 cm · Aniego peatonal (Simulación en vivo)"
            : "2–5 cm · Encharcamiento leve (Simulación en vivo)";
        L.geoJSON(feat, { style })
          .bindTooltip(label, { sticky: true })
          .addTo(waterGroup);
      });
    }

    // Marcar puertas P1-P4 bloqueadas / libres en vivo
    const features = campusLayers?.campus?.features || [];
    features
      .filter((f) => f.properties?.category === "acceso" && f.geometry?.type === "Point")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const nm = String(f.properties?.name || "");
        const m = nm.match(/Puerta\s*([1-4])/i);
        if (!m) return;
        const code = `P${m[1]}`;
        const isBlocked = blockedGatesFromReports.has(code);
        const color = isBlocked ? "#DC2626" : "#059669";
        const label = isBlocked ? "Bloqueada (Simulación en vivo)" : "Libre";
        const icon = L.divIcon({
          className: "yaku-gate-marker",
          html: `<div class="${isBlocked ? "yaku-alert-pulse" : ""}" style="display:flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:999px;background:${color};color:#fff;font:800 11px/1.2 'JetBrains Mono',monospace;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">${esc(code)}</div>`,
          iconSize: [34, 22],
          iconAnchor: [17, 11],
        });
        L.marker([lat, lon], { icon, zIndexOffset: 760 })
          .bindTooltip(`${esc(nm)} · ${label}`, { direction: "top" })
          .addTo(gatesGroup);
      });
  }, [liveSimulation, campusLayers, blockedGatesFromReports]);

  // Capa comprensible «Zonas de atención» (reutiliza evidencias documentadas y capas exploratorias existentes)
  useEffect(() => {
    const group = attentionGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (!showAttentionZones) return;

    const reported = campusLayers.reported_zones?.features || [];
    reported.forEach((f) => {
      const label = f.properties?.label || f.properties?.name || "Sector con antecedentes documentados";
      L.geoJSON(f, {
        style: {
          color: "#D97706",
          weight: 2,
          dashArray: "5 4",
          fillColor: "#F59E0B",
          fillOpacity: 0.28,
        },
        onEachFeature: (_feat, lyr) => {
          lyr.on("click", () => {
            setSelectedCard({
              name: label,
              infoType: "Evidencia histórica",
              explanation:
                "Sector documentado en antecedentes locales (2017/2023) o reportes universitarios. No representa una alerta activa ni un mapa oficial de peligro.",
            });
          });
        },
      }).addTo(group);
    });

    // Zonas exploratorias de relieve (DEM Copernicus GLO-30) ya existentes en hazards
    const relief = (campusLayers.hazards?.features || []).filter(
      (f) => f.properties?.scenario_id === "lluvia_moderada"
    );
    relief.forEach((f) => {
      L.geoJSON(f, {
        style: {
          color: "#0284C7",
          weight: 1.5,
          fillColor: "#38BDF8",
          fillOpacity: 0.2,
        },
        onEachFeature: (_feat, lyr) => {
          lyr.on("click", () => {
            setSelectedCard({
              name: "Sector de cota relativamente baja (DEM 30 m)",
              infoType: "Resultado exploratorio",
              explanation:
                "Área identificada por relieve relativo en el modelo Copernicus GLO-30 (±4 m de error). Sirve solo como referencia preventiva orientativa.",
            });
          });
        },
      }).addTo(group);
    });
  }, [campusLayers, showAttentionZones]);

  // Capas independientes: Áreas seguras (polígonos #10B981) + Puntos de encuentro (#059669) + Rutas
  useEffect(() => {
    const group = evacuationGroupRef.current;
    if (!group || !campusLayers) return;
    renderEvacuationLayers({
      group,
      evacuationData: campusLayers.evacuation,
      showSafeAreas,
      showMeetingPoints,
      showRoutes: showMeetingPoints,
      affectedGates: blockedGatesFromReports,
      recommendedPointId: mySafeRoute?.safePoint?.id || "",
      onSelectFeature: setSelectedCard,
    });
  }, [campusLayers, showSafeAreas, showMeetingPoints, blockedGatesFromReports, mySafeRoute]);

  // Capa referencial de Contexto Trujillo (Ruta del Agua y entorno) — desactivada por defecto
  useEffect(() => {
    const group = trujilloContextGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (!showTrujilloContext) return;

    const ctxFeatures = campusLayers.surrounding_context?.features || [];
    ctxFeatures.forEach((f) => {
      const p = f.properties || {};
      const ftype = p.feature_type || "";
      const popupHtml = `<div class="space-y-1 max-w-[235px]">
        <div class="text-[10px] font-bold uppercase text-indigo-700">Capa referencial · Contexto Trujillo</div>
        <div class="font-bold text-slate-900">${esc(p.name)}</div>
        <div class="text-[11px] text-slate-700">${esc(p.description || "")}</div>
        <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(p.disclaimer || "Trazo referencial orientativo.")}</div>
      </div>`;

      if (f.geometry?.type === "Point") {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: "#4F46E5",
          fillOpacity: 0.95,
        })
          .bindTooltip(`${esc(p.name)} (referencial)`, { direction: "top" })
          .bindPopup(popupHtml, { className: "yaku-popup" })
          .on("click", () => {
            setSelectedCard({
              name: p.name,
              infoType: "Contexto Trujillo (referencial)",
              explanation: p.description || "Punto referencial del entorno inmediato UNT.",
            });
          })
          .addTo(group);
      } else {
        const style =
          ftype === "ruta_del_agua"
            ? { color: "#0284C7", weight: 4, dashArray: "10 6", opacity: 0.9 }
            : ftype === "corredor_aniego"
            ? { color: "#4F46E5", weight: 4.5, dashArray: "4 6", opacity: 0.9 }
            : { color: "#B45309", weight: 2, dashArray: "5 4", fillColor: "#F59E0B", fillOpacity: 0.18 };
        L.geoJSON(f, {
          style,
          onEachFeature: (_feat, lyr) => {
            lyr.bindTooltip(`${esc(p.name)} (referencial)`, { sticky: true, direction: "top" });
            lyr.bindPopup(popupHtml, { className: "yaku-popup" });
            lyr.on("click", () => {
              setSelectedCard({
                name: p.name,
                infoType: "Contexto Trujillo (referencial)",
                explanation: p.description || "Sector referencial del entorno inmediato de la UNT.",
              });
            });
          },
        }).addTo(group);
      }
    });
  }, [campusLayers, showTrujilloContext]);

  // Capa en vivo de reportes comunitarios anónimos (SQLite)
  useEffect(() => {
    const group = reportsGroupRef.current;
    if (!group) return;
    group.clearLayers();
    campusReports.forEach((rep) => {
      if (rep.lat === null || rep.lat === undefined || rep.lon === null || rep.lon === undefined) {
        return;
      }
      const cat = REPORT_CATEGORIES.find((c) => c.id === rep.category);
      const bg = cat?.color || "#D97706";
      const pulse = rep.severity === "alta" && rep.status !== "atendido" ? "yaku-alert-pulse" : "";
      const icon = L.divIcon({
        className: "yaku-report-marker",
        html: `<div class="${pulse}" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:${bg};color:#ffffff;font:800 11px/1 system-ui,sans-serif;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(11,37,69,0.35);">!</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([rep.lat, rep.lon], { icon, zIndexOffset: 600 })
        .bindTooltip(`${esc(rep.zone_name)} · ${esc(cat?.label || rep.category)}`, { direction: "top" })
        .bindPopup(
          `<div class="space-y-1 max-w-[230px]">
            <div class="text-[10px] font-bold uppercase" style="color:${bg}">Reporte comunitario anónimo · ${esc(rep.status)}</div>
            <div class="font-extrabold text-slate-900">${esc(rep.zone_name)}</div>
            <div class="text-xs font-semibold text-slate-700">${esc(cat?.label || rep.category)} (Severidad: ${esc(rep.severity)})</div>
            ${rep.note ? `<div class="text-xs text-slate-600">${esc(rep.note)}</div>` : ""}
          </div>`,
          { className: "yaku-popup" }
        )
        .addTo(group);
    });
  }, [campusReports]);

  // Dibujar ruta segura personalizada (encuadra solo cuando el usuario cambia de facultad, sin re-disparar zoom en cada refresco)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = myRouteGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!mySafeRoute) {
      lastFlownOriginRef.current = "";
      return;
    }

    const { origin, safePoint } = mySafeRoute;
    L.polyline(
      [
        [origin.lat, origin.lon],
        [safePoint.lat, safePoint.lon],
      ],
      {
        color: "#00B4D8",
        weight: 6,
        opacity: 0.35,
      }
    ).addTo(group);
    L.polyline(
      [
        [origin.lat, origin.lon],
        [safePoint.lat, safePoint.lon],
      ],
      {
        color: "#059669",
        weight: 3.5,
        dashArray: "8 6",
        opacity: 0.95,
      }
    ).addTo(group);

    L.circleMarker([origin.lat, origin.lon], {
      radius: 8,
      color: "#FFFFFF",
      weight: 2.5,
      fillColor: "#0B2545",
      fillOpacity: 1,
    })
      .bindTooltip(`Tu ubicación: ${esc(origin.name)}`, { permanent: false, direction: "top" })
      .addTo(group);

    if (lastFlownOriginRef.current !== myLocationId) {
      lastFlownOriginRef.current = myLocationId;
      const routeBounds = L.latLngBounds([
        [origin.lat, origin.lon],
        [safePoint.lat, safePoint.lon],
      ]);
      if (routeBounds.isValid()) {
        map.fitBounds(routeBounds, { padding: [56, 56], maxZoom: 18, animate: false });
      }
    }
  }, [mySafeRoute, myLocationId]);

  // Enfocar edificio seleccionado desde Inicio / Asistente YAKU
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusedBuildingId || !catalog.length) return;
    const item = catalog.find((c) => c.id === focusedBuildingId);
    if (!item || !item.geometry) return;

    if (focusLayerRef.current) {
      map.removeLayer(focusLayerRef.current);
      focusLayerRef.current = null;
    }

    const layer = L.geoJSON(item.geometry, {
      style: { color: "#1D4ED8", weight: 3, fillColor: "#2563EB", fillOpacity: 0.5 },
      pointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, {
          radius: 9,
          color: "#0B1F33",
          weight: 2.5,
          fillColor: "#2563EB",
          fillOpacity: 0.9,
        }),
    }).addTo(map);
    focusLayerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });
    }

    setSelectedCard({
      name: item.displayLabel,
      infoType: item.verificationStatus === "Verificado" ? "Instalación verificada" : "Referencia cartográfica",
      explanation: `${item.typeLabel} registrada en OpenStreetMap. Para ver cómo podría acumularse el agua cerca, abre la Simulación sencilla (2017 / 2023).`,
    });
  }, [focusedBuildingId, catalog]);

  const topAlert = activeAlerts[0] || null;
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
    <div className="space-y-4">
      {/* Franja compacta en 1 línea (sin empujar el mapa hacia abajo) */}
      {topAlert && (
        <section
          aria-label="Aviso institucional activo"
          className={`flex flex-col justify-between gap-2 rounded-xl border px-4 py-2.5 sm:flex-row sm:items-center ${topAlertTone}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${topAlertBadge}`}
            >
              <BellRing className="h-3 w-3" />
              <span>
                {/escenario|simulac/i.test(String(topAlert.what_happens || topAlert.title || ""))
                  ? "Simulacro activo"
                  : `Aviso ${topAlertSev.toLowerCase()}`}
              </span>
            </span>
            <span className="truncate font-semibold">
              {topAlert.what_happens || topAlert.title}
            </span>
            {activeAlerts.length > 1 && (
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0B2545] dark:bg-slate-900/80 dark:text-white">
                +{activeAlerts.length - 1} más
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.("notifications")}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold underline decoration-current/40 underline-offset-4 hover:decoration-current"
          >
            <span>Ver aviso</span>
            <span>→</span>
          </button>
        </section>
      )}

      {/* Barra compacta de búsqueda + chips rápidos + acciones */}
      <section
        aria-label="¿Qué lugar de la UNT buscas?"
        className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:p-4"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Buscador conectado también a la ruta segura */}
          <div className="relative flex-1 xl:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0369A1] dark:text-[#38BDF8]" />
            <input
              id="student-map-search"
              type="text"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Busca tu facultad, comedor, biblioteca o puerta..."
              aria-label="Buscar facultad o instalación en el mapa"
              className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pl-10 pr-9 text-xs font-semibold text-[#0F172A] outline-none transition focus:border-[#0369A1] focus:bg-white focus:ring-2 focus:ring-[#0369A1]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {searchOpen && filteredCatalog.length > 0 && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-11 z-[500] max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#0B2545]"
              >
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    onClick={() => {
                      setQuery(item.displayLabel);
                      setSearchOpen(false);
                      setMyLocationId(item.id);
                      onSelectBuilding?.(item.id);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-[#F0F9FF] dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#0F172A] dark:text-white">
                        {item.displayLabel}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {item.typeLabel} · {item.verificationStatus}
                      </div>
                    </div>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chips rápidos de 1 clic */}
          <div className="flex flex-wrap items-center gap-1.5">
            {["Comedor Universitario", "Biblioteca Central", "Ingeniería", "Rectorado", "Puerta 4"].map(
              (quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => {
                    const found = catalog.find((c) =>
                      normalizeText(c.displayLabel).includes(normalizeText(quick))
                    );
                    setQuery(found ? found.displayLabel : quick);
                    setSearchOpen(false);
                    if (found) {
                      setMyLocationId(found.id);
                      onSelectBuilding?.(found.id);
                    }
                  }}
                  className="rounded-full border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-bold text-[#0369A1] transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] dark:border-slate-700 dark:bg-slate-900 dark:text-[#38BDF8]"
                >
                  {quick}
                </button>
              )
            )}
          </div>

          {/* Botones de acción alineados */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {onOpenReportModal && (
              <button
                type="button"
                onClick={onOpenReportModal}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D97706]/40 bg-[#FFFBEB] px-3 text-xs font-bold text-[#92400E] transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <Megaphone className="h-3.5 w-3.5" />
                <span>Reportar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("student_sim")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0B2545] px-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
            >
              <Waves className="h-3.5 w-3.5" />
              <span>Simular lluvias</span>
            </button>
          </div>
        </div>

        {/* Estado climático resumido en 1 línea limpia */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${studentNow.dot}`} />
            <span className="font-semibold text-[#0F172A] dark:text-slate-100">{studentNow.text}</span>
          </div>
          <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            {isLive ? "Pronóstico 48 h" : "Caché offline"} · 24 h:{" "}
            <strong className="text-[#0F172A] dark:text-white">
              {weather?.summary ? `${weather.summary.accumulated_24h_mm} mm` : "—"}
            </strong>{" "}
            · Máx:{" "}
            <strong className="text-[#0F172A] dark:text-white">
              {weather?.summary ? `${weather.summary.max_intensity_mm_h} mm/h` : "—"}
            </strong>{" "}
            ({updatedLima})
          </span>
        </div>
      </section>

      {/* Aviso transparente si existen condiciones externas declaradas manualmente */}
      {declaredConditions.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Condición externa declarada manualmente ({declaredConditions.length}):</strong> registrada de forma manual en el sistema (no es una medición verificada por sensores).
          </span>
        </div>
      )}

      {/* Mapa protagonista Map-First + Ficha breve lateral */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-8">
          <div
            ref={mapContainerRef}
            className="h-[460px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[620px] 2xl:h-[720px]"
          />

          {(basemap === "vectorial" || tilesFailed) && (
            <div className="absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-3 py-1.5 text-xs font-bold text-[#92400E] shadow-sm backdrop-blur-md">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Solo vectorial (sin internet). Capas locales activas.</span>
            </div>
          )}

          {/* Control agrupado «Capas y mapa base» arriba a la derecha (sin saturar el mapa con botones) */}
          <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setLayersOpen((v) => !v)}
              aria-expanded={layersOpen}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2 text-xs font-bold text-[#0F172A] shadow-sm backdrop-blur-md hover:bg-white dark:border-slate-700 dark:bg-[#0B2545]/95 dark:text-white"
            >
              <span>Capas y mapa base</span>
              {layersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {layersOpen && (
              <div className="w-64 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/95">
                <div className="flex gap-1" role="group" aria-label="Mapa base">
                  {Object.entries(BASEMAPS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBasemap(key)}
                      aria-pressed={basemap === key}
                      className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        basemap === key
                          ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                          : "border border-slate-200 text-[#475569] dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {cfg.shortLabel || cfg.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 text-[#0F172A] dark:text-slate-200">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showAttentionZones}
                      onChange={(e) => setShowAttentionZones(e.target.checked)}
                      className="rounded accent-[#0369A1]"
                    />
                    <span>Zonas de atención (antecedentes y DEM)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showSafeAreas}
                      onChange={(e) => setShowSafeAreas(e.target.checked)}
                      className="rounded accent-[#0369A1]"
                    />
                    <span>Áreas elevadas referenciales</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showMeetingPoints}
                      onChange={(e) => setShowMeetingPoints(e.target.checked)}
                      className="rounded accent-[#0369A1]"
                    />
                    <span>Puntos de encuentro y rutas ref.</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showTrujilloContext}
                      onChange={(e) => setShowTrujilloContext(e.target.checked)}
                      className="rounded accent-[#0369A1]"
                    />
                    <span>Contexto territorial (Ruta del Agua ref.)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Leyenda flotante colapsable */}
          <div className="absolute bottom-3 left-3 z-[400] max-w-[85%] rounded-xl border border-slate-200/90 bg-white/92 px-3 py-2 text-xs text-[#0F172A] shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92 dark:text-slate-100">
            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              aria-expanded={legendOpen}
              className="flex items-center gap-2 font-bold text-[#0B2545] dark:text-white"
            >
              <span>Leyenda</span>
              {legendOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
            {legendOpen && (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm border border-amber-600 bg-amber-400/70" /> Antecedente histórico
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm border border-sky-600 bg-sky-400/60" /> Relieve bajo (DEM)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#059669] bg-[#10B981]/35" /> Área elevada ref.
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" /> Punto encuentro ref.
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 border-t-2 border-dashed border-emerald-700" /> Ruta referencial
                  </span>
                  {showTrujilloContext && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 border-t-2 border-dashed border-sky-600" /> Ruta del Agua (ref.)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 border-t-2 border-dotted border-indigo-600" /> Av. J. de Nazareth (ref.)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm border border-amber-700 bg-amber-400/40" /> Urb. San Andrés (ref.)
                      </span>
                    </>
                  )}
                </div>
                {campusLayers?.evacuation?.dem_validation?.verified_against_dem && (
                  <div className="text-[11px] font-semibold text-[#059669] dark:text-emerald-300">
                    Referencia DEM 10 m (2017/2023): máx. {campusLayers.evacuation.dem_validation.max_depth_at_safe_points_cm} cm en puntos de encuentro.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho jerarquizado: 1) ¿Dónde estás / Ruta segura -> 2) Edificio seleccionado -> 3) Lugares colapsables */}
        <div className="min-w-0 space-y-3.5 lg:col-span-4">
          <WhereAmISafeRouteBar
            options={facultyOptions}
            selectedId={myLocationId}
            onSelectOrigin={(id) => {
              setMyLocationId(id);
              if (id) onSelectBuilding?.(id);
            }}
            safeRoute={mySafeRoute}
            onClear={() => setMyLocationId("")}
          />

          {activeBuildingStatus ? (
            <BuildingDynamicCard
              buildingStatus={activeBuildingStatus}
              activeDemoRole={activeDemoRole}
              onTraceRoute={(bld) => {
                setMyLocationId(bld.id);
                onSelectBuilding?.(bld.id);
              }}
              onClose={() => {
                onSelectBuilding?.("");
                setSelectedCard(null);
              }}
            />
          ) : selectedCard ? (
            <section className="rounded-2xl border border-[#0369A1]/40 bg-white p-4 shadow-panel dark:border-sky-800 dark:bg-[#0B2545]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block rounded-full bg-[#F0F9FF] px-2.5 py-0.5 text-[10px] font-bold text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
                    {selectedCard.infoType}
                  </span>
                  <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
                    {selectedCard.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCard(null)}
                  aria-label="Cerrar tarjeta"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                {selectedCard.explanation}
              </p>
              <button
                type="button"
                onClick={() => onNavigate("prevention")}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B2545] px-3 text-xs font-extrabold text-white transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Ver recomendaciones preventivas</span>
              </button>
            </section>
          ) : null}

          {/* Lista de lugares frecuentes como acordeón limpio */}
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
            <button
              type="button"
              onClick={() => setFrequentOpen((v) => !v)}
              aria-expanded={frequentOpen}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Directorio del campus ({filteredCatalog.length})
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Facultades, bibliotecas, comedor y puertas
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-[#475569] transition-transform ${
                  frequentOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {frequentOpen && (
              <div className="max-h-56 space-y-1 overflow-y-auto border-t border-slate-100 p-2.5 dark:border-slate-800">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectBuilding?.(item.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-[#F0F9FF] dark:hover:bg-slate-800"
                  >
                    <span className="truncate font-semibold text-[#0F172A] dark:text-white">
                      {item.displayLabel}
                    </span>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Nota metodológica compacta desplegable */}
          <div className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-3.5 py-2.5 text-[11px] text-[#475569] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setDisclaimerOpen((v) => !v)}
              aria-expanded={disclaimerOpen}
              className="flex w-full items-center justify-between text-left font-bold text-[#0F172A] dark:text-slate-200"
            >
              <span className="inline-flex items-center gap-1.5">
                <CloudRain className="h-3.5 w-3.5 text-[#0369A1]" />
                <span>Fuente y alcance referencial (TRL 3–4)</span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${disclaimerOpen ? "rotate-180" : ""}`}
              />
            </button>
            {disclaimerOpen && <p className="mt-1.5 leading-relaxed">{EVACUATION_DISCLAIMER}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
