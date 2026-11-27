import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
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
import ActiveAlertsBanner from "./ui/ActiveAlertsBanner";
import { REPORT_CATEGORIES } from "./ui/CampusReportModal";
import WhereAmISafeRouteBar from "./ui/WhereAmISafeRouteBar";
import { findNearestSafeRoute } from "../utils/safeRouteHelper";

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
  vectorial: {
    label: "Solo vectorial",
    title: "Solo vectorial (sin internet)",
  },
};

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

function resolveStudentNowAction(liveEvaluation, summary) {
  const level = liveEvaluation?.preventive_level || "INFORMATIVO";
  if (level === "PREPARACION_CRITICA" || level === "ATENCION_PREVENTIVA") {
    return {
      tone: "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
      dot: "bg-rose-600",
      text: "Evita desplazarte por sectores con acumulación de agua (Puerta 4 / Av. Jesús de Nazareth) y prioriza pisos altos o pautas oficiales UNT.",
    };
  }
  if (level === "VIGILANCIA_PREVENTIVA" || (summary?.max_intensity_mm_h ?? 0) >= 2) {
    return {
      tone: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
      dot: "bg-amber-500",
      text: "Ten precaución en zonas bajas del campus y consulta comunicados oficiales de la UNT.",
    };
  }
  return {
    tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100",
    dot: "bg-emerald-600",
    text: "Sin lluvias significativas previstas. Ubica tu facultad y los puntos de encuentro referenciales en el mapa.",
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
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const attentionGroupRef = useRef(null);
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
  const [showEvacuation, setShowEvacuation] = useState(true);
  const [showTrujilloContext, setShowTrujilloContext] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [myLocationId, setMyLocationId] = useState("");

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

  const mySafeRoute = useMemo(() => {
    if (!myLocationId) return null;
    const origin = catalog.find((c) => c.id === myLocationId);
    if (!origin) return null;
    const blockedGates = new Set();
    campusReports.forEach((r) => {
      if (r.status === "atendido") return;
      const z = String(r.zone_name || "").toLowerCase();
      if (r.category === "acceso_bloqueado" || r.severity === "alta") {
        if (z.includes("puerta 4")) blockedGates.add("P4");
        if (z.includes("puerta 3")) blockedGates.add("P3");
        if (z.includes("puerta 2")) blockedGates.add("P2");
      }
    });
    return findNearestSafeRoute({ originItem: origin, campusLayers, affectedGates: blockedGates });
  }, [myLocationId, catalog, campusLayers, campusReports]);

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
  const studentNow = resolveStudentNowAction(liveEvaluation, weather?.summary);
  const maxProb24 =
    weather?.summary?.max_probability_24h_pct ?? weather?.summary?.max_probability_pct;

  // Inicializa el mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution("Datos del campus &copy; OpenStreetMap (ODbL)");
    baseGroupRef.current = L.layerGroup().addTo(map);
    attentionGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    trujilloContextGroupRef.current = L.layerGroup().addTo(map);
    reportsGroupRef.current = L.layerGroup().addTo(map);
    myRouteGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      attentionGroupRef.current = null;
      evacuationGroupRef.current = null;
      trujilloContextGroupRef.current = null;
      reportsGroupRef.current = null;
      myRouteGroupRef.current = null;
      focusLayerRef.current = null;
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

    // Edificios reales OSM (con etiquetas enriquecidas y tooltip al pasar el cursor)
    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const name = getFeatureDisplayName(f.properties);
        const isNamed = !/^Edificio sin nombre/i.test(f.properties?.name || "");
        L.geoJSON(f, {
          style: {
            color: isNamed ? "#1D4ED8" : "#94A3B8",
            weight: 1.2,
            fillColor: isNamed ? "#3B82F6" : "#CBD5E1",
            fillOpacity: 0.45,
          },
          onEachFeature: (_feat, lyr) => {
            const statusBadge = isNamed
              ? `<span style="display:inline-block;padding:1px 6px;border-radius:999px;background:#ECFDF5;color:#059669;font:700 10px/1.4 system-ui,sans-serif;border:1px solid #A7F3D0;">Campus UNT</span>`
              : `<span style="display:inline-block;padding:1px 6px;border-radius:999px;background:#F1F5F9;color:#475569;font:700 10px/1.4 system-ui,sans-serif;">Referencia</span>`;
            lyr.bindTooltip(
              `<div style="min-width:140px;">
                <div style="font-weight:800;color:#0F172A;font-size:12px;">${esc(name)}</div>
                <div style="margin-top:2px;">${statusBadge}</div>
              </div>`,
              { sticky: true, direction: "top" }
            );
            lyr.bindPopup(
              `<div class="space-y-1.5 max-w-[235px]">
                <div class="flex items-center justify-between gap-2">${statusBadge}</div>
                <div class="font-extrabold text-[#0F172A] text-xs">${esc(name)}</div>
                <div class="text-xs text-[#475569]">Ubica el punto seguro verde más cercano y revisa el pronóstico 48 h antes de desplazarte.</div>
              </div>`,
              { className: "yaku-popup" }
            );
            lyr.on("click", () => {
              onSelectBuilding?.(f.properties?.id || "");
              setSelectedCard({
                name,
                infoType: f.properties?.verified ? "Instalación verificada" : "Referencia cartográfica",
                explanation:
                  "Instalación registrada en la Ciudad Universitaria UNT. Consulta las zonas de atención o la Simulación educativa (2017 / 2023) para explorar escenarios referenciales.",
              });
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
  }, [campusLayers, onSelectBuilding]);

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

  // Capa de puntos seguros y rutas referenciales de evacuación (TRL 3-4)
  useEffect(() => {
    const group = evacuationGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (!showEvacuation) return;

    const evacFeatures = campusLayers.evacuation?.features || [];
    const safePointsById = new Map();
    evacFeatures
      .filter((f) => f.properties?.zone_type === "safe_point")
      .forEach((f) => safePointsById.set(f.properties.id, f.properties));

    // Rutas referenciales primero (debajo de los marcadores de puntos seguros)
    evacFeatures
      .filter((f) => f.properties?.zone_type === "evacuation_route")
      .forEach((f) => {
        const p = f.properties || {};
        const dest = safePointsById.get(p.to_safe_point_id);
        const destName = dest?.name || p.to_safe_point_id;
        L.geoJSON(f, {
          style: {
            color: "#15803D",
            weight: 3.5,
            dashArray: "7 6",
            opacity: 0.92,
          },
          onEachFeature: (_feat, lyr) => {
            lyr.bindPopup(
              `<div class="space-y-1 max-w-[230px]">
                <div class="text-[10px] font-bold uppercase text-emerald-700">Ruta referencial de evacuación</div>
                <div class="font-bold text-slate-900">${esc(p.from_zone)} → ${esc(destName)}</div>
                <div class="text-[11px] text-slate-700">${esc(p.recommendation || "")}</div>
                <div class="text-[10px] text-slate-500">Distancia aprox.: ~${esc(p.distance_m_approx)} m</div>
                <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(EVACUATION_DISCLAIMER)}</div>
              </div>`,
              { className: "yaku-popup" }
            );
            lyr.on("click", () => {
              setSelectedCard({
                name: `${p.from_zone} → ${destName}`,
                infoType: "Ruta referencial (TRL 3–4)",
                explanation: `${p.recommendation || ""} (Distancia aproximada: ~${p.distance_m_approx} m).`,
              });
            });
          },
        }).addTo(group);
      });

    // Puntos seguros referenciales con marcador verde diferenciado
    evacFeatures
      .filter((f) => f.properties?.zone_type === "safe_point")
      .forEach((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry.coordinates;
        const icon = L.divIcon({
          className: "yaku-safe-point-marker",
          html: `<div class="yaku-safe-pulse" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#059669;color:#ffffff;font:800 12px/1 system-ui,sans-serif;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(5,150,105,0.42);">S</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([lat, lon], { icon, zIndexOffset: 450 })
          .bindTooltip(`${esc(p.name)} (referencial)`, { direction: "top", offset: [0, -10] })
          .bindPopup(
            `<div class="space-y-1 max-w-[230px]">
              <div class="text-[10px] font-bold uppercase text-emerald-700">Punto seguro referencial</div>
              <div class="font-bold text-slate-900">${esc(p.name)}</div>
              <div class="text-[11px] text-slate-700">${esc(p.rationale || "")}</div>
              <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(EVACUATION_DISCLAIMER)}</div>
            </div>`,
            { className: "yaku-popup" }
          )
          .on("click", () => {
            setSelectedCard({
              name: p.name,
              infoType: "Punto seguro referencial",
              explanation: p.rationale || "Zona abierta de cota elevada dentro del campus UNT.",
            });
          })
          .addTo(group);
      });
  }, [campusLayers, showEvacuation]);

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

  // Dibujar ruta segura personalizada + flyTo suave cuando el estudiante elige su facultad
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = myRouteGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!mySafeRoute) return;

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

    map.flyTo([origin.lat, origin.lon], 18, { duration: 0.9 });
  }, [mySafeRoute]);

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

  return (
    <div className="space-y-4">
      {/* Banner vivo de alertas emitidas por Gestión UNT (CAP 1.2 + Confirmación) */}
      {activeAlerts.length > 0 && (
        <ActiveAlertsBanner
          alerts={activeAlerts}
          activeDemoRole={activeDemoRole}
          onConfirmAlert={onConfirmAlert}
        />
      )}

      {/* Cabecera inequívoca de PRONÓSTICO (distinta de Simulación histórica) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-0.5 text-[11px] font-bold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>Estado actual y pronóstico probabilístico (48 h)</span>
            </span>
            {!isLive && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Caché offline
              </span>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
            Mapa de monitoreo UNT
          </h2>
          <p className="text-sm text-[#475467] dark:text-slate-400">
            Busca cualquier facultad o instalación, revisa las zonas de atención y ubica puntos de encuentro referenciales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D97706]/40 bg-[#FFFBEB] px-3.5 text-xs font-bold text-[#92400E] transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
            >
              <Megaphone className="h-4 w-4" />
              <span>Reportar incidente</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("student_sim")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-bold text-white transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
          >
            <Waves className="h-4 w-4" />
            <span>Simular lluvias (2017 / 2023)</span>
          </button>
        </div>
      </div>

      {/* Buscador protagonista: PRIMERO BUSCAR, DESPUÉS EXPLORAR */}
      <section
        aria-label="¿Qué lugar de la UNT buscas?"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <label
              htmlFor="student-map-search"
              className="block text-base font-extrabold text-[#0F172A] dark:text-white"
            >
              ¿Qué lugar de la UNT buscas?
            </label>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Escribe tu facultad, pabellón, biblioteca, comedor, auditorio o puerta para centrarlo en el mapa.
            </p>
          </div>

          <div className="relative flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="student-map-search"
              type="text"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Ej. Comedor Universitario, Ingeniería, Biblioteca Central, Puerta 4..."
              aria-label="Buscar facultad o instalación en el mapa"
              className="h-11 w-full rounded-xl border border-slate-300 bg-[#F8FAFC] pl-10 pr-9 text-sm font-medium text-[#0F172A] focus:border-[#0369A1] focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {searchOpen && filteredCatalog.length > 0 && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-12 z-[500] max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#0B2545]"
              >
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    onClick={() => {
                      setQuery(item.displayLabel);
                      setSearchOpen(false);
                      onSelectBuilding?.(item.id);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-[#F0F9FF] dark:hover:bg-slate-800"
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
        </div>

        {/* Franja meteorológica compacta y clara (sin 5 tarjetas separadas) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs text-[#475569] dark:border-slate-700/80 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${studentNow.dot}`} />
            <span className="font-semibold text-[#0F172A] dark:text-white">{studentNow.text}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span>
              Lluvia 24 h: <strong>{weather?.summary ? `${weather.summary.accumulated_24h_mm} mm` : "—"}</strong>
            </span>
            <span>
              Intensidad máx.: <strong>{weather?.summary ? `${weather.summary.max_intensity_mm_h} mm/h` : "—"}</strong>
            </span>
            <span>
              Prob. llovizna: <strong>{maxProb24 !== null && maxProb24 !== undefined ? `${maxProb24}%` : "N/D"}</strong>
            </span>
            <span className="text-[#64748B] dark:text-slate-400">Open-Meteo · {updatedLima}</span>
          </div>
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
            className="h-[440px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[580px]"
          />

          {(basemap === "vectorial" || tilesFailed) && (
            <div className="absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-3 py-1.5 text-xs font-bold text-[#92400E] shadow-sm backdrop-blur-md">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Solo vectorial (sin internet). Capas locales activas.</span>
            </div>
          )}

          {/* Control agrupado «Capas» arriba a la derecha (sin saturar el mapa con botones) */}
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
              <div className="w-60 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/95">
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
                      {key === "vectorial" ? "Offline" : cfg.label}
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
                      checked={showEvacuation}
                      onChange={(e) => setShowEvacuation(e.target.checked)}
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
              <div className="mt-2 flex flex-wrap gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-amber-600 bg-amber-400/70" /> Antecedente histórico
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-sky-600 bg-sky-400/60" /> Relieve bajo (DEM)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" /> Punto encuentro ref.
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t-2 border-dashed border-emerald-700" /> Ruta referencial
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho: ficha corta de la instalación seleccionada + ruta referencial + lugares frecuentes */}
        <div className="space-y-4 lg:col-span-4">
          {selectedCard ? (
            <section className="rounded-2xl border border-[#2563EB]/40 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-[#0B2545]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-300">
                    {selectedCard.infoType}
                  </span>
                  <h3 className="mt-1 text-base font-extrabold text-[#101828] dark:text-white">
                    {selectedCard.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCard(null)}
                  aria-label="Cerrar tarjeta"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#475467] dark:text-slate-300">
                {selectedCard.explanation}
              </p>
              <button
                type="button"
                onClick={() => onNavigate("prevention")}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B2545] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#0369A1] dark:bg-[#0369A1]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Ver recomendaciones</span>
              </button>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0B2545]">
              <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                Lugares frecuentes del campus
              </h3>
              <p className="mt-0.5 text-xs text-[#475569] dark:text-slate-300">
                Selecciona uno para ubicarlo en el mapa:
              </p>
              <div className="mt-2.5 max-h-52 space-y-1 overflow-y-auto">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectBuilding?.(item.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-[#F8FAFC] dark:hover:bg-slate-900"
                  >
                    <span className="truncate font-semibold text-[#101828] dark:text-white">
                      {item.displayLabel}
                    </span>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <WhereAmISafeRouteBar
            options={facultyOptions}
            selectedId={myLocationId}
            onSelectOrigin={setMyLocationId}
            safeRoute={mySafeRoute}
            onClear={() => setMyLocationId("")}
          />

          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-[11px] leading-snug text-[#475467] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-[#101828] dark:text-slate-200">
              <CloudRain className="h-3.5 w-3.5 text-[#0369A1]" />
              Pronóstico (Open-Meteo) · Puntos y rutas referenciales
            </div>
            <p className="mt-1">{EVACUATION_DISCLAIMER}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
