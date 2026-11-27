import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Layers, MapPin, ShieldAlert, Building2, Navigation, ArrowRight, WifiOff, Radio } from "lucide-react";
import { normalizeText } from "../utils/formatters";
import { buildCampusCatalog, CAMPUS_CATEGORIES, getFeatureDisplayName } from "../utils/campusCatalog";
import ExternalConditionsPanel from "./ui/ExternalConditionsPanel";
import SensorDetailPanel from "./ui/SensorDetailPanel";
import BuildingDynamicCard from "./ui/BuildingDynamicCard";
import {
  SENSOR_STATUS_STYLES,
  resolveSensorReading,
} from "../utils/sensorFormatters";
import {
  CONDITIONS_ZONE_ID,
  conditionsModeParams,
  isConditionsMode,
  safeHttpsUrl,
  toggledConditionParams,
} from "../utils/conditions";
import { renderEvacuationLayers } from "../utils/evacuationLayers";
import { HD_BASEMAPS, attachHdBaseLayer } from "../utils/mapTiles";

const UNT_CENTER = [-8.11473, -79.03923];
const BASEMAPS = HD_BASEMAPS;

// Los nombres vienen de OpenStreetMap (editable por terceros): se escapan antes de ir a un popup HTML.
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Niveles de exposición (según % de la huella dentro de la zona simulada; umbrales experimentales)
const LEVELS = {
  parcial: { label: "Parcial", color: "#D97706", fill: "#FBBF24", opacity: 0.55, weight: 2 },
  alta: { label: "Alta", color: "#EA580C", fill: "#F97316", opacity: 0.6, weight: 2.5 },
  total: { label: "Total", color: "#991B1B", fill: "#DC2626", opacity: 0.65, weight: 3 },
};
const isExposedLevel = (lv) => lv === "parcial" || lv === "alta" || lv === "total";

const isUnnamed = (name) => !name || /^Edificio sin nombre/i.test(name);
const displayBuildingName = (building) => getFeatureDisplayName(building);

const sourceLine = (props) =>
  `<div class="mt-1 text-[10px] text-slate-500">Fuente: ${esc(props.source || "referencial")} · ${
    props.verified ? "verificado" : "no verificado"
  }${props.osm_id ? " · " + esc(props.osm_id) : ""}</div>`;

export default function CampusMapView({
  campusLayers,
  conditionsCatalog,
  simParams,
  onChangeSimParams,
  simResult,
  focusedBuildingId,
  onSelectBuilding,
  onRunSimulation,
  onNavigate,
  virtualSensors = [],
  hydroActiveHour = 1,
  selectedSensorId = "",
  onSelectSensor,
  disconnectedSensors = {},
  onToggleDisconnectSensor,
  offline = false,
  activeDemoRole = "operador_riesgos",
  buildingStatusById = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const overlayGroupRef = useRef(null);
  const evacuationGroupRef = useRef(null);
  const customRouteGroupRef = useRef(null);
  const sensorsGroupRef = useRef(null);
  const focusLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);

  const [basemap, setBasemap] = useState(
    offline || (typeof navigator !== "undefined" && navigator.onLine === false)
      ? "vectorial"
      : "calles"
  );

  useEffect(() => {
    if (offline) {
      setBasemap("vectorial");
    }
  }, [offline]);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [onlyExposedFilter, setOnlyExposedFilter] = useState(false);
  const [techInfoOpen, setTechInfoOpen] = useState(false);

  const campusCatalog = useMemo(
    () => buildCampusCatalog(campusLayers, simResult),
    [campusLayers, simResult]
  );
  const [visibleLayers, setVisibleLayers] = useState({
    edificios: true,
    accesos: true,
    areas_seguras: true,
    puntos: true,
    rutas: true,
    peligro: true,
    senderos: true,
    deportes: true,
    reportes: true,
    influencia_sintetica: true,
    vigilar: true,
    sensores_iot: false,
    contexto_trujillo: false,
  });

  // Si se selecciona un sensor desde Asistente YAKU u otra vista, activa la capa automáticamente.
  useEffect(() => {
    if (selectedSensorId) {
      setVisibleLayers((prev) => (prev.sensores_iot ? prev : { ...prev, sensores_iot: true }));
    }
  }, [selectedSensorId]);

  const selectedSensor = useMemo(
    () => virtualSensors.find((s) => s.id === selectedSensorId) || null,
    [virtualSensors, selectedSensorId]
  );

  // Inicializa el mapa (sin mapa base: se maneja aparte para poder cambiarlo y degradar sin internet)
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
    map.attributionControl.addAttribution("Datos del campus &copy; colaboradores de OpenStreetMap (ODbL)");

    baseGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    customRouteGroupRef.current = L.layerGroup().addTo(map);
    sensorsGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      overlayGroupRef.current = null;
      evacuationGroupRef.current = null;
      customRouteGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Enfocar instalación seleccionada desde "Explora tu campus" o lista lateral (Polygon o Point)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !campusLayers) return;
    if (focusLayerRef.current) {
      map.removeLayer(focusLayerRef.current);
      focusLayerRef.current = null;
    }
    if (!focusedBuildingId) return;
    const feat = (campusLayers.campus?.features || []).find(
      (f) => f.properties?.id === focusedBuildingId
    );
    if (!feat) return;

    const catalogItem = campusCatalog.find((c) => c.id === focusedBuildingId);
    const title = catalogItem?.displayLabel || displayBuildingName(feat.properties);
    const subtitle = catalogItem
      ? `${catalogItem.typeLabel} · ${catalogItem.verificationStatus}`
      : "Instalación seleccionada";

    if (feat.geometry?.type === "Point") {
      const [lon, lat] = feat.geometry.coordinates;
      const marker = L.circleMarker([lat, lon], {
        radius: 11,
        color: "#1D4ED8",
        weight: 3,
        fillColor: "#2563EB",
        fillOpacity: 0.35,
      })
        .bindPopup(
          `<div><strong>${esc(title)}</strong><br/><span class="text-[11px]">${esc(subtitle)}</span>${sourceLine(
            feat.properties
          )}</div>`,
          { className: "yaku-popup" }
        )
        .addTo(map);
      focusLayerRef.current = marker;
      map.setView([lat, lon], 18);
      marker.openPopup();
    } else {
      const layer = L.geoJSON(feat, {
        style: { color: "#1D4ED8", weight: 4, fillColor: "#2563EB", fillOpacity: 0.25 },
      })
        .bindPopup(
          `<div><strong>${esc(title)}</strong><br/><span class="text-[11px]">${esc(subtitle)}</span>${sourceLine(
            feat.properties
          )}</div>`,
          { className: "yaku-popup" }
        )
        .addTo(map);
      focusLayerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 18 });
        layer.openPopup();
      }
    }
  }, [focusedBuildingId, campusLayers, campusCatalog]);

  // Mapa base HD (@2x Retina); si los mosaicos fallan (sin internet) se informa y quedan las capas vectoriales
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

  // Capas base reales del campus: perímetro, senderos y áreas deportivas (siempre vectoriales y locales)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const base = baseGroupRef.current;
    if (!map || !base || !campusLayers) return;
    base.clearLayers();
    const feats = campusLayers.campus?.features || [];
    const perimeters = feats.filter((f) => f.properties.category === "perimetro_campus");

    perimeters.forEach((f) =>
      L.geoJSON(f, {
        interactive: false,
        style: { color: "#0B1F33", weight: 2.5, dashArray: "2 6", fill: true, fillColor: "#F1F5F9", fillOpacity: 0.55 },
      }).addTo(base)
    );

    if (visibleLayers.senderos) {
      feats
        .filter((f) => f.properties.category === "via")
        .forEach((f) =>
          L.geoJSON(f, { interactive: false, style: { color: "#94A3B8", weight: 1.4, opacity: 0.9 } }).addTo(base)
        );
    }
    feats
      .filter((f) => f.properties.category === "estacionamiento")
      .forEach((f) =>
        L.geoJSON(f, { style: { color: "#94A3B8", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.7 } })
          .bindPopup(`<div><strong>Estacionamiento</strong>${sourceLine(f.properties)}</div>`, { className: "yaku-popup" })
          .addTo(base)
      );
    if (visibleLayers.deportes) {
      feats
        .filter((f) => f.properties.category === "area_verde")
        .forEach((f) =>
          L.geoJSON(f, { interactive: false, style: { color: "#86EFAC", weight: 0.8, fillColor: "#DCFCE7", fillOpacity: 0.6 } }).addTo(base)
        );
      feats
        .filter((f) => f.properties.category === "area_deportiva")
        .forEach((f) => {
          const nm = f.properties.name && f.properties.name !== "area_deportiva" ? f.properties.name : "Área deportiva";
          L.geoJSON(f, { style: { color: "#16A34A", weight: 1, fillColor: "#86EFAC", fillOpacity: 0.45 } })
            .bindPopup(`<div><strong>${esc(nm)}</strong>${sourceLine(f.properties)}</div>`, { className: "yaku-popup" })
            .addTo(base);
        });
    }

    if (!fittedRef.current && perimeters.length) {
      const bounds = L.featureGroup(perimeters.map((f) => L.geoJSON(f))).getBounds();
      if (bounds.isValid()) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [24, 24] });
        fittedRef.current = true;
      }
    }
  }, [campusLayers, visibleLayers.senderos, visibleLayers.deportes]);

  // Capas dinámicas: edificios, accesos, puntos y escenario simulado
  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();

    const exposureById = new Map(
      (simResult?.spatial_analysis?.exposed_buildings || []).map((b) => [b.id, b])
    );
    const watchById = new Map(
      (simResult?.spatial_analysis?.watch_buildings || []).map((w) => [w.id, w])
    );
    const restrictedAccessIds = new Set(
      (simResult?.spatial_analysis?.restricted_accesses || [])
        .filter((a) => a.inside_hazard_zone)
        .map((a) => a.id)
    );
    const compromisedPointsIds = new Set(
      (simResult?.spatial_analysis?.meeting_points_status || [])
        .filter((p) => p.inside_hazard_zone)
        .map((p) => p.id)
    );

    // Polígono de peligro simulado
    if (visibleLayers.peligro && simResult?.hazard_geojson) {
      const hp = simResult.hazard_geojson.properties || {};
      L.geoJSON(simResult.hazard_geojson, {
        style: {
          color: "#E11D48",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#F43F5E",
          fillOpacity: 0.24,
          className: "sim-hazard-polygon",
        },
      })
        .bindPopup(
          `<div class="space-y-1">
            <div class="font-bold text-rose-700">${esc(hp.zone_name)}</div>
            <div class="text-[11px] font-semibold uppercase text-amber-700">Escenario experimental — ${esc(hp.data_nature || "mixto")}</div>
            <div>${esc(hp.description)}</div>
          </div>`,
          { className: "yaku-popup" }
        )
        .addTo(group);
    }

    if (visibleLayers.influencia_sintetica && simResult?.synthetic_geojson) {
      simResult.synthetic_geojson.features.forEach((feature) => {
        const props = feature.properties || {};
        L.geoJSON(feature, {
          style: {
            color: "#0891B2",
            weight: 2.5,
            dashArray: "1 7",
            lineCap: "round",
            fillColor: "#22D3EE",
            fillOpacity: 0.12,
          },
        })
          .bindTooltip("SINTÉTICO", { permanent: true, direction: "center", className: "synthetic-tooltip" })
          .bindPopup(
            `<div class="space-y-1">
              <div class="font-bold text-cyan-700">SINTÉTICO · Influencia demostrativa</div>
              <div class="text-[11px]">${esc(props.description)}</div>
              <div class="text-[10px] text-slate-500">Naturaleza del dato: ${esc(props.data_nature)}</div>
            </div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      });
    }

    const features = campusLayers.campus?.features || [];

    // Zonas reportadas por la comunidad: testimonio, NO cálculo ni peligro validado.
    if (visibleLayers.reportes) {
      features
        .filter((f) => f.properties.category === "zona_reportada")
        .forEach((f) => {
          const pr = f.properties;
          const links = (pr.evidence || [])
            .filter((u) => /^https:\/\//.test(u))
            .map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="underline">fuente ${i + 1}</a>`)
            .join(" · ");
          L.geoJSON(f, {
            style: {
              color: "#7C3AED",
              weight: 2,
              dashArray: "2 5",
              fillColor: "#A78BFA",
              fillOpacity: 0.28,
            },
          })
            .bindPopup(
              `<div class="space-y-1">
                <div class="text-[10px] font-bold uppercase text-violet-700">Zona reportada · no verificada</div>
                <strong>${esc(pr.name)}</strong>
                <div class="text-[11px]">${esc(pr.description)}</div>
                <div class="text-[10px] text-slate-500">Fuente: ${esc(pr.source)}${links ? " · " + links : ""}</div>
              </div>`,
              { className: "yaku-popup" }
            )
            .addTo(group);
        });
    }

    features.forEach((feat) => {
      const { category, id, name } = feat.properties;

      if (category === "edificio" && visibleLayers.edificios) {
        const exp = exposureById.get(id);
        const lv = exp?.exposure_level;
        const isExposed = isExposedLevel(lv);
        const displayName = getFeatureDisplayName(feat.properties);
        const unnamed = isUnnamed(feat.properties.name);
        const watched = visibleLayers.vigilar ? watchById.get(id) : undefined;
        const baseStyle = isExposed
          ? {
              color: LEVELS[lv].color,
              weight: LEVELS[lv].weight,
              fillColor: LEVELS[lv].fill,
              fillOpacity: LEVELS[lv].opacity,
            }
          : unnamed
          ? { color: "#64748B", weight: 1, fillColor: "#94A3B8", fillOpacity: 0.4 }
          : { color: "#2563EB", weight: 1.5, fillColor: "#3B82F6", fillOpacity: 0.3 };
        // Edificio con agua en un evento previo: contorno punteado propio, sin agrandar el polígono.
        const style = watched
          ? { ...baseStyle, color: "#C026D3", weight: 3, dashArray: "5 3", fillColor: isExposed ? baseStyle.fillColor : "#E879F9", fillOpacity: Math.max(baseStyle.fillOpacity, 0.4) }
          : baseStyle;
        const watchedLink = watched ? safeHttpsUrl(watched.source) : null;
        const layer = L.geoJSON(feat, { style })
          .bindPopup(
            `<div>
              <strong>${esc(displayName)}</strong><br/>
              <span class="text-[11px]">${
                isExposed
                  ? `⚠️ Exposición ${LEVELS[lv].label.toLowerCase()} en escenario experimental (${exp.overlap_pct}% de la huella)`
                  : lv === "marginal"
                  ? `Contacto marginal (${exp.overlap_pct}% de la huella)`
                  : "Fuera de la zona analizada"
              }</span>
              ${
                watched
                  ? `<div class="mt-1 text-[11px] font-semibold text-fuchsia-700">Vigilar: agua reportada el ${esc(
                      watched.event_date || "s/f"
                    )} (prensa, por confirmar; confianza ${esc(watched.confidence)})${
                      watchedLink
                        ? ` · <a href="${esc(watchedLink)}" target="_blank" rel="noopener noreferrer" class="underline">fuente</a>`
                        : ""
                    }</div>`
                  : ""
              }
              ${sourceLine(feat.properties)}
            </div>`,
            { className: "yaku-popup" }
          );
        layer.bindTooltip(esc(displayName), { sticky: true, direction: "top" });
        layer.on("click", () => {
          onSelectBuilding?.(id);
        });
        layer.addTo(group);
      } else if (category === "ruta_referencial" && visibleLayers.rutas) {
        L.geoJSON(feat, { style: { color: "#7C3AED", weight: 3, dashArray: "5 6" } })
          .bindPopup(
            `<div><strong>${esc(name)}</strong><br/><span class="text-[11px]">${esc(feat.properties.disclaimer)}</span></div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      } else if (category === "acceso" && visibleLayers.accesos) {
        const [lon, lat] = feat.geometry.coordinates;
        const isRestricted = restrictedAccessIds.has(id);
        L.circleMarker([lat, lon], {
          radius: 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: isRestricted ? "#E11D48" : "#10B981",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<div><strong>${esc(name)}</strong><br/><span class="text-[11px]">${
              isRestricted ? "Dentro de la zona analizada (relieve o reporte)" : "Sin intersección con la zona analizada"
            }</span>${sourceLine(feat.properties)}</div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      } else if (category === "punto_encuentro" && visibleLayers.puntos) {
        const [lon, lat] = feat.geometry.coordinates;
        const isCompromised = compromisedPointsIds.has(id);
        L.circleMarker([lat, lon], {
          radius: 8,
          color: "#0B1F33",
          weight: 2,
          fillColor: isCompromised ? "#F59E0B" : "#14B8A6",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<div><strong>${esc(name)}</strong><br/><span class="text-[11px]">${
              isCompromised ? "Comprometido en simulación" : "Disponible como referencia"
            }</span><br/><small>${esc(feat.properties.note || "")}</small>${sourceLine(feat.properties)}</div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      }
    });

    // Capas independientes de evacuación (TRL 3-4): Áreas seguras (#10B981), Puntos de encuentro (#059669) y Rutas
    const evacGroup = evacuationGroupRef.current;
    if (evacGroup) {
      const restrictedGates = new Set();
      (simResult?.spatial_analysis?.restricted_accesses || []).forEach((a) => {
        if (!a.inside_hazard_zone) return;
        const nm = String(a.name || "").toLowerCase();
        if (nm.includes("puerta 4")) restrictedGates.add("P4");
        if (nm.includes("puerta 3")) restrictedGates.add("P3");
        if (nm.includes("puerta 2")) restrictedGates.add("P2");
        if (nm.includes("puerta 1")) restrictedGates.add("P1");
      });
      renderEvacuationLayers({
        group: evacGroup,
        evacuationData: campusLayers.evacuation,
        showSafeAreas: visibleLayers.areas_seguras,
        showMeetingPoints: visibleLayers.puntos,
        showRoutes: visibleLayers.rutas,
        affectedGates: restrictedGates,
      });
    }
    // Capa referencial de Contexto Trujillo (Ruta del Agua y entorno inmediato UNT) — desactivada por defecto
    if (visibleLayers.contexto_trujillo && campusLayers.surrounding_context?.features?.length) {
      campusLayers.surrounding_context.features.forEach((f) => {
        const p = f.properties || {};
        const ftype = p.feature_type || "";
        const popupHtml = `<div class="space-y-1 max-w-[240px]">
          <div class="text-[10px] font-bold uppercase text-indigo-700">Capa referencial · Contexto Trujillo</div>
          <strong>${esc(p.name)}</strong>
          <div class="text-[11px]">${esc(p.description || "")}</div>
          <div class="text-[10px] text-slate-500">${esc(p.disclaimer || "Trazo referencial orientativo.")}</div>
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
            .addTo(group);
        } else {
          const style =
            ftype === "ruta_del_agua"
              ? { color: "#0284C7", weight: 4, dashArray: "10 6", opacity: 0.9 }
              : ftype === "corredor_aniego"
              ? { color: "#4F46E5", weight: 4.5, dashArray: "4 6", opacity: 0.9 }
              : { color: "#B45309", weight: 2, dashArray: "5 4", fillColor: "#F59E0B", fillOpacity: 0.18 };
          L.geoJSON(f, { style })
            .bindTooltip(`${esc(p.name)} (referencial)`, { sticky: true, direction: "top" })
            .bindPopup(popupHtml, { className: "yaku-popup" })
            .addTo(group);
        }
      });
    }
  }, [campusLayers, simResult, visibleLayers]);

  // Capa YAKU SENSE: Sensores IoT [SIM]
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = sensorsGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!visibleLayers.sensores_iot || !virtualSensors.length) return;

    virtualSensors.forEach((sensor) => {
      const reading = resolveSensorReading(
        sensor,
        hydroActiveHour,
        disconnectedSensors[sensor.id]
      );
      const st = SENSOR_STATUS_STYLES[reading.statusKey] || SENSOR_STATUS_STYLES.no_reading;
      const isSelected = sensor.id === selectedSensorId;
      const borderStyle = reading.statusKey === "disconnected_sim" ? "dashed" : "solid";

      const icon = L.divIcon({
        className: "yaku-sensor-marker",
        html: `<div style="display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:${st.fill};color:#fff;font:700 11px/1.1 system-ui,sans-serif;border:2px ${borderStyle} ${isSelected ? "#0B1F33" : "#ffffff"};box-shadow:${isSelected ? "0 0 0 3px rgba(37,99,235,0.45),0 4px 10px rgba(0,0,0,0.28)" : "0 2px 6px rgba(0,0,0,0.25)"};white-space:nowrap;"><span>${esc(sensor.id)}</span></div>`,
        iconSize: [44, 24],
        iconAnchor: [22, 12],
      });

      const marker = L.marker([sensor.lat, sensor.lon], {
        icon,
        zIndexOffset: isSelected ? 1000 : 500,
      });

      marker.bindTooltip(
        `${esc(sensor.name)} · ${esc(reading.displayValue)} (${esc(st.shortLabel)})`,
        { direction: "top", offset: [0, -10] }
      );
      marker.on("click", () => {
        onSelectSensor?.(sensor.id);
        map.panTo([sensor.lat, sensor.lon], { animate: true });
      });
      marker.addTo(group);
    });
  }, [
    visibleLayers.sensores_iot,
    virtualSensors,
    hydroActiveHour,
    disconnectedSensors,
    selectedSensorId,
    onSelectSensor,
  ]);

  // Centrar el mapa al enfocar un sensor seleccionado desde fuera
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedSensor || !visibleLayers.sensores_iot) return;
    map.setView([selectedSensor.lat, selectedSensor.lon], Math.max(map.getZoom(), 17), {
      animate: true,
    });
  }, [selectedSensor, visibleLayers.sensores_iot]);

  const toggleCondition = (conditionId) => {
    const next = toggledConditionParams(simParams, conditionId);
    onChangeSimParams(next);
    onRunSimulation(next);
  };

  const selectQuickScenario = (scenarioId) => {
    if (scenarioId === CONDITIONS_ZONE_ID) {
      const next = isConditionsMode(simParams)
        ? simParams
        : conditionsModeParams();
      onChangeSimParams(next);
      onRunSimulation(next);
      return;
    }
    const presets = {
      lluvia_moderada: {
        scenario_id: "lluvia_moderada",
        intensity_mm_h: 12,
        duration_hours: 3,
        drainage_obstructed: false,
        antecedent_soil_saturated: false,
        hazard_zone_id: "lluvia_moderada",
        synthetic_reach_m: undefined,
      },
      lluvia_intensa_fen: {
        scenario_id: "lluvia_intensa_fen",
        intensity_mm_h: 28,
        duration_hours: 4,
        drainage_obstructed: true,
        antecedent_soil_saturated: false,
        hazard_zone_id: "lluvia_intensa_fen",
        synthetic_reach_m: 40,
      },
      escenario_extremo_fen: {
        scenario_id: "escenario_extremo_fen",
        intensity_mm_h: 45,
        duration_hours: 6,
        drainage_obstructed: true,
        antecedent_soil_saturated: true,
        hazard_zone_id: "escenario_extremo_fen",
        synthetic_reach_m: 80,
      },
    };
    const next = presets[scenarioId];
    if (next) {
      onChangeSimParams({ ...next, external_conditions: [] });
      onRunSimulation({ ...next, external_conditions: [] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Mapa del Campus UNT
          </h2>
          <p className="text-sm text-[#475467] dark:text-slate-400">
            Ubica edificios, accesos y puntos referenciales frente a cada escenario experimental.
          </p>
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Escenarios por mecanismo">
            {[
              { id: "lluvia_moderada", label: "A · Relieve" },
              { id: "lluvia_intensa_fen", label: "B · Ingreso reportado" },
              { id: "escenario_extremo_fen", label: "C · Combinado" },
              ...(conditionsCatalog ? [{ id: CONDITIONS_ZONE_ID, label: "D · Condiciones" }] : []),
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                role="tab"
                aria-selected={simParams.hazard_zone_id === sc.id}
                onClick={() => selectQuickScenario(sc.id)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                  simParams.hazard_zone_id === sc.id
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#E2E8F0] bg-white text-[#475467] hover:text-[#101828] dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-300"
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
          <p className="max-w-md text-[11px] leading-snug text-[#475467] dark:text-slate-400">
            A: sectores de cota relativamente baja (DEM de 30 m). B: zonas reportadas por
            testimonio y prensa. C: ambos. D: zonas armadas con las condiciones externas que usted
            declara (sí/no). La capa punteada SINTÉTICA no cambia con la lluvia. Canaletas nuevas de la UNT: no modeladas (sin datos).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Mapa protagonista (~67-70% en escritorio) */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-8">
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="h-[460px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[calc(100vh-195px)] lg:min-h-[560px]"
            />

            {(basemap === "vectorial" || tilesFailed) && (
              <div
                role="status"
                className="absolute left-3 top-3 z-[400] flex max-w-[16rem] items-start gap-2 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-3 py-2 text-xs font-bold text-[#92400E] shadow-sm backdrop-blur-md"
              >
                <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Solo vectorial (sin internet). Capas locales activas.</span>
              </div>
            )}

            {/* Control flotante translúcido — 3 capas independientes + Capas + IoT */}
            <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-slate-200/80 bg-white/92 p-1 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
                <button
                  type="button"
                  onClick={() => setVisibleLayers((prev) => ({ ...prev, peligro: !prev.peligro }))}
                  aria-pressed={visibleLayers.peligro}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    visibleLayers.peligro
                      ? "bg-[#E11D48] text-white shadow-sm"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                  }`}
                >
                  Zonas de riesgo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLayers((prev) => ({ ...prev, areas_seguras: !prev.areas_seguras }))
                  }
                  aria-pressed={visibleLayers.areas_seguras}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    visibleLayers.areas_seguras
                      ? "bg-[#10B981] text-white shadow-sm"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                  }`}
                >
                  Áreas seguras
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleLayers((prev) => ({ ...prev, puntos: !prev.puntos }))}
                  aria-pressed={visibleLayers.puntos}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    visibleLayers.puntos
                      ? "bg-[#059669] text-white shadow-sm"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                  }`}
                >
                  Puntos de encuentro
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLayers((prev) => ({ ...prev, sensores_iot: !prev.sensores_iot }))
                  }
                  aria-pressed={visibleLayers.sensores_iot}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    visibleLayers.sensores_iot
                      ? "bg-[#0369A1] text-white shadow-sm"
                      : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>IoT [SIM]</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayersOpen((v) => !v)}
                  aria-expanded={layersOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                >
                  <Layers className="h-3.5 w-3.5 text-[#0369A1] dark:text-[#38BDF8]" />
                  <span>Capas</span>
                </button>
              </div>

              {layersOpen && (
                <div className="w-64 rounded-2xl border border-slate-200/90 bg-white/92 p-3 text-xs shadow-elevated backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/95">
                  <div className="mb-2.5 flex gap-1" role="group" aria-label="Mapa base">
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
                        {key === "vectorial" ? "Offline" : cfg.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5 text-[#101828] dark:text-slate-200">
                    {[
                      { key: "peligro", label: "Zona analizada (A/B/C/D)" },
                      { key: "edificios", label: "Edificios UNT" },
                      { key: "reportes", label: "Zonas reportadas" },
                      { key: "influencia_sintetica", label: "Influencia SINTÉTICA" },
                      { key: "vigilar", label: "Edificios a vigilar (D)" },
                      { key: "senderos", label: "Vías y senderos" },
                      { key: "deportes", label: "Áreas verdes" },
                      { key: "accesos", label: "Accesos" },
                      { key: "areas_seguras", label: "Áreas seguras (polígonos DEM)" },
                      { key: "puntos", label: "Puntos de encuentro ref." },
                      { key: "rutas", label: "Rutas de evacuación ref." },
                      { key: "sensores_iot", label: "Sensores IoT [SIM]" },
                      { key: "contexto_trujillo", label: "Contexto Trujillo (Ruta del Agua y entorno) — ref." },
                    ].map((layer) => (
                      <label key={layer.key} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={visibleLayers[layer.key]}
                          onChange={(e) =>
                            setVisibleLayers({ ...visibleLayers, [layer.key]: e.target.checked })
                          }
                          className="rounded accent-[#2563EB]"
                        />
                        <span>{layer.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Leyenda minimalista */}
            <div className="absolute bottom-3 left-3 z-[400] max-w-xs rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-xs backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                aria-expanded={legendOpen}
                className="flex w-full items-center justify-between gap-4 font-semibold text-[#101828] dark:text-slate-100"
              >
                <span>Leyenda</span>
                <span className="text-[11px] font-medium text-[#475467]">
                  {legendOpen ? "Ocultar" : "Ver"}
                </span>
              </button>
              <div
                className={`${
                  legendOpen ? "mt-2 grid" : "hidden"
                } grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#101828] dark:text-slate-200`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVELS.parcial.fill }} /> Parcial
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVELS.alta.fill }} /> Alta
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVELS.total.fill }} /> Total
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Fuera de zona
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Edificio sin nombre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Acceso dentro de la zona
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#059669] bg-[#10B981]/35" /> Área segura (polígono)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" /> Punto de encuentro
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 border-t-2 border-dashed border-rose-600" /> Ruta evitar paso
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 border-t-2 border-dotted border-cyan-600" /> SINTÉTICO
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3 rounded-sm border-2 border-dashed border-fuchsia-600" /> A vigilar (evento previo)
                </span>
                {visibleLayers.sensores_iot && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Sensor virtual con datos
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Sensor sin lectura
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full border border-dashed border-amber-800 bg-amber-500" /> Sensor desconectado [SIM]
                    </span>
                  </>
                )}
                {visibleLayers.contexto_trujillo && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 border-t-2 border-dashed border-sky-600" /> Ruta del Agua (ref.)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 border-t-2 border-dotted border-indigo-600" /> Av. J. de Nazareth (ref.)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm border border-amber-700 bg-amber-400/40" /> Urb. San Andrés (ref.)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel lateral compacto (~30%) */}
        <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-4">
          <div className="space-y-4">
            {focusedBuildingId && buildingStatusById?.get(focusedBuildingId) && (
              <BuildingDynamicCard
                buildingStatus={buildingStatusById.get(focusedBuildingId)}
                activeDemoRole={activeDemoRole}
                allowRolePreview
                onTraceRoute={(bld) => {
                  const map = mapInstanceRef.current;
                  const rg = customRouteGroupRef.current;
                  const mp = bld?.nearest_safe_meeting_point;
                  const orig = bld?.centroid;
                  if (!map || !rg || !mp || !orig) return;
                  rg.clearLayers();
                  L.polyline(
                    [
                      [orig.lat, orig.lon],
                      [mp.lat, mp.lon],
                    ],
                    { color: "#00B4D8", weight: 6, opacity: 0.35 }
                  ).addTo(rg);
                  L.polyline(
                    [
                      [orig.lat, orig.lon],
                      [mp.lat, mp.lon],
                    ],
                    { color: "#059669", weight: 3.5, dashArray: "8 6", opacity: 0.95 }
                  ).addTo(rg);
                  map.fitBounds(
                    [
                      [orig.lat, orig.lon],
                      [mp.lat, mp.lon],
                    ],
                    { padding: [60, 60], maxZoom: 18 }
                  );
                }}
                onClose={() => {
                  customRouteGroupRef.current?.clearLayers();
                  onSelectBuilding?.("");
                }}
              />
            )}

            {visibleLayers.sensores_iot && selectedSensor && (
              <SensorDetailPanel
                sensor={selectedSensor}
                activeHour={hydroActiveHour}
                disconnectedEntry={disconnectedSensors[selectedSensor.id]}
                onToggleDisconnect={onToggleDisconnectSensor}
                onClose={() => onSelectSensor?.("")}
                onCenterMap={(s) =>
                  mapInstanceRef.current?.setView([s.lat, s.lon], 18, { animate: true })
                }
                onOpenDynamicSim={() => onNavigate("hydro")}
                onOpenFacility={(facId) => onSelectBuilding?.(facId)}
                onOpenGuidance={() => onNavigate("continuity")}
              />
            )}

            {visibleLayers.sensores_iot && !selectedSensor && virtualSensors.length > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs dark:border-sky-900 dark:bg-sky-950/30">
                <div className="font-bold text-sky-950 dark:text-sky-200">
                  YAKU SENSE — 6 sensores IoT virtuales [SIM]
                </div>
                <p className="mt-0.5 text-[11px] text-sky-900/80 dark:text-sky-300/80">
                  Propuesta futura (sin hardware instalado). Selecciona un sensor para ver su ficha y evolución:
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {virtualSensors.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSensor?.(s.id)}
                      className="rounded-md border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-200"
                    >
                      {s.id} · {s.short_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-[#2563EB] dark:text-blue-400">
                Escenario seleccionado
              </div>
              <h3 className="mt-0.5 text-base font-bold text-[#101828] dark:text-white">
                {simResult?.spatial_analysis?.hazard_zone_name || "Seleccione un escenario"}
              </h3>
            </div>

            {isConditionsMode(simParams) && conditionsCatalog && (
              <ExternalConditionsPanel
                catalog={conditionsCatalog}
                active={simParams.external_conditions || []}
                onToggle={toggleCondition}
              />
            )}

            {simResult && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#F7F9FC] p-3 dark:bg-slate-900/70">
                    <div className="text-xs text-[#475467] dark:text-slate-400">Exposición ≥5%</div>
                    <div className="mt-0.5 text-2xl font-bold text-[#101828] tabular-nums dark:text-white">
                      {simResult.spatial_analysis.total_exposed_buildings}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#F7F9FC] p-3 dark:bg-slate-900/70">
                    <div className="text-xs text-[#475467] dark:text-slate-400">
                      Accesos dentro de la zona
                    </div>
                    <div className="mt-0.5 text-2xl font-bold text-[#101828] tabular-nums dark:text-white">
                      {simResult.spatial_analysis.total_restricted_accesses}
                    </div>
                  </div>
                </div>

                {/* Búsqueda universal y filtro por tipo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#101828] dark:text-white">
                      Explora tu campus
                    </span>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#475467] dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={onlyExposedFilter}
                        onChange={(e) => setOnlyExposedFilter(e.target.checked)}
                        className="rounded accent-[#2563EB]"
                      />
                      Solo en zona
                    </label>
                  </div>
                  <select
                    aria-label="Filtrar instalaciones del mapa por tipo"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-2.5 py-1.5 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {CAMPUS_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="search"
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    placeholder="Buscar facultad, biblioteca, puerta, cancha..."
                    aria-label="Buscar instalación en el mapa"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 py-2 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />

                  <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {campusCatalog
                      .filter((item) => (categoryFilter === "all" ? true : item.typeId === categoryFilter))
                      .filter((item) =>
                        onlyExposedFilter ? Boolean(item.exposure?.inside_hazard_zone) : true
                      )
                      .filter((item) =>
                        buildingFilter.trim()
                          ? item.searchText.includes(normalizeText(buildingFilter.trim()))
                          : true
                      )
                      .slice(0, 60)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectBuilding && onSelectBuilding(item.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition hover:border-[#2563EB] ${
                            focusedBuildingId === item.id
                              ? "border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/30"
                              : "border-[#E2E8F0] dark:border-slate-800"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[#101828] dark:text-slate-200">
                              {item.displayLabel}
                            </div>
                            <div className="text-[10px] text-[#475467] dark:text-slate-400">
                              {item.typeLabel} · {item.verificationStatus}
                            </div>
                          </div>
                          <span className="shrink-0 tabular-nums text-[#475467] dark:text-slate-400">
                            {item.exposure ? (
                              isExposedLevel(item.exposure.exposure_level) ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                                  style={{ background: LEVELS[item.exposure.exposure_level].color }}
                                >
                                  {LEVELS[item.exposure.exposure_level].label}
                                </span>
                              ) : item.exposure.inside_hazard_zone ? (
                                "En zona"
                              ) : (
                                "Fuera"
                              )
                            ) : (
                              "N/D"
                            )}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Accesos */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#101828] dark:text-white">Accesos</div>
                  {simResult.spatial_analysis.restricted_accesses.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-xs text-[#475467] dark:text-slate-300"
                    >
                      <span className="truncate">{a.name}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          a.inside_hazard_zone
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {a.inside_hazard_zone ? "Dentro de la zona" : "Fuera de la zona"}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] leading-relaxed text-[#64748B] dark:text-slate-400">
                    En B, C y D son zonas reportadas por testimonio; no confirman cierre.
                  </p>
                </div>
              </>
            )}

            {simResult?.spatial_analysis?.watch_buildings?.length > 0 && (
              <section className="space-y-1.5 rounded-lg border border-dashed border-fuchsia-500/60 bg-fuchsia-50/60 p-3 dark:bg-fuchsia-950/20">
                <div className="text-xs font-bold text-fuchsia-900 dark:text-fuchsia-200">
                  Edificios a vigilar ({simResult.spatial_analysis.watch_buildings.length})
                </div>
                <p className="text-[10px] leading-relaxed text-fuchsia-900 dark:text-fuchsia-200">
                  Agua reportada en un evento previo (prensa, por confirmar). No suman a «Exposición ≥5%».
                </p>
                {simResult.spatial_analysis.watch_buildings.map((w) => (
                  <div key={w.id} className="flex justify-between gap-2 text-[11px]">
                    <span className="truncate">{w.name}</span>
                    <span className="shrink-0 tabular-nums">{w.event_date || "s/f"}</span>
                  </div>
                ))}
              </section>
            )}

            {simResult?.spatial_analysis?.synthetic_exposure && (
              <section className="space-y-2 rounded-lg border border-dashed border-cyan-500/60 bg-cyan-50/60 p-3 dark:bg-cyan-950/20">
                <div className="text-xs font-bold text-cyan-800 dark:text-cyan-300">
                  Exposición en escenario sintético (alcance{" "}
                  {simResult.spatial_analysis.synthetic_exposure.reach_m} m, azimut{" "}
                  {simResult.spatial_analysis.synthetic_exposure.azimuth_deg}°)
                </div>
                <p className="text-[10px] leading-relaxed text-cyan-900 dark:text-cyan-200">
                  Parámetros arbitrarios de demostración; no es una predicción. El alcance no
                  depende de la lluvia.
                </p>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {simResult.spatial_analysis.synthetic_exposure.buildings
                    .filter((b) => isExposedLevel(b.exposure_level))
                    .map((b) => (
                      <div key={b.id} className="flex justify-between gap-2 text-[11px]">
                        <span className="truncate">{displayBuildingName(b)}</span>
                        <span className="shrink-0">
                          {b.exposure_level} · {b.overlap_pct}%
                        </span>
                      </div>
                    ))}
                  {simResult.spatial_analysis.synthetic_exposure.accesses
                    .filter((access) => access.inside_hazard_zone)
                    .map((access) => (
                      <div key={access.id} className="flex justify-between gap-2 text-[11px]">
                        <span className="truncate">{access.name}</span>
                        <span className="shrink-0">
                          {access.exposure_level} · {access.overlap_pct}%
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Explicación técnica expandible */}
            <div className="border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTechInfoOpen((v) => !v)}
                className="text-xs font-medium text-[#2563EB] hover:underline dark:text-blue-400"
              >
                {techInfoOpen ? "Ocultar nota técnica" : "Ver nota técnica y validación"}
              </button>
              {techInfoOpen && (
                <p className="mt-2 text-[11px] leading-relaxed text-[#475467] dark:text-slate-400">
                  Cálculo espacial real con Shapely sobre huellas OSM y geometrías experimentales
                  (DEM de 30 m y zonas reportadas por testimonio/prensa).
                  Las rutas y puntos de encuentro son referenciales hasta validación oficial UNT.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-xs font-semibold text-white transition hover:bg-[#122C46] dark:bg-[#2563EB]"
          >
            <ShieldAlert className="h-4 w-4" />
            Ajustar escenario en Simulador
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
