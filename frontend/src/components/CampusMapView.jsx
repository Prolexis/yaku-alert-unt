import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Layers, MapPin, ShieldAlert, Building2, Navigation, ArrowRight, WifiOff } from "lucide-react";

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
  vectorial: { label: "Solo vectorial (sin internet)" },
};

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

const isUnnamed = (name) => /^Edificio sin nombre/.test(name || "");

const sourceLine = (props) =>
  `<div class="mt-1 text-[10px] text-slate-500">Fuente: ${esc(props.source || "referencial")} · ${
    props.verified ? "verificado" : "no verificado"
  }${props.osm_id ? " · " + esc(props.osm_id) : ""}</div>`;

export default function CampusMapView({
  campusLayers,
  simParams,
  onChangeSimParams,
  simResult,
  onRunSimulation,
  onNavigate,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const overlayGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);

  const [basemap, setBasemap] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false ? "vectorial" : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    edificios: true,
    accesos: true,
    puntos: true,
    rutas: true,
    peligro: true,
    senderos: true,
    deportes: true,
    reportes: true,
  });

  // Inicializa el mapa (sin mapa base: se maneja aparte para poder cambiarlo y degradar sin internet)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution("Datos del campus &copy; colaboradores de OpenStreetMap (ODbL)");

    baseGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      overlayGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Mapa base seleccionable; si los mosaicos fallan (sin internet) se informa y quedan las capas vectoriales
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
            <div class="text-[11px] font-semibold uppercase text-amber-700">Escenario sintético (${esc(hp.severity)})</div>
            <div>${esc(hp.description)}</div>
          </div>`,
          { className: "yaku-popup" }
        )
        .addTo(group);
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
        const unnamed = isUnnamed(name);
        const style = isExposed
          ? {
              color: LEVELS[lv].color,
              weight: LEVELS[lv].weight,
              fillColor: LEVELS[lv].fill,
              fillOpacity: LEVELS[lv].opacity,
            }
          : unnamed
          ? { color: "#64748B", weight: 1, fillColor: "#94A3B8", fillOpacity: 0.4 }
          : { color: "#2563EB", weight: 1.5, fillColor: "#3B82F6", fillOpacity: 0.3 };
        const layer = L.geoJSON(feat, { style })
          .bindPopup(
            `<div>
              <strong>${esc(name)}</strong><br/>
              <span class="text-[11px]">${
                isExposed
                  ? `⚠️ Exposición ${LEVELS[lv].label.toLowerCase()} en simulación (${exp.overlap_pct}% de la huella)`
                  : lv === "marginal"
                  ? `Contacto marginal (${exp.overlap_pct}% de la huella)`
                  : "Fuera de zona simulada"
              }</span>
              ${sourceLine(feat.properties)}
            </div>`,
            { className: "yaku-popup" }
          );
        if (!unnamed) layer.bindTooltip(esc(name), { sticky: true, direction: "top" });
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
              isRestricted ? "Acceso restringido en simulación" : "Acceso transitable en simulación"
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
  }, [campusLayers, simResult, visibleLayers]);

  const selectQuickScenario = (scenarioId) => {
    const presets = {
      lluvia_moderada: {
        scenario_id: "lluvia_moderada",
        intensity_mm_h: 12,
        duration_hours: 3,
        drainage_obstructed: false,
        antecedent_soil_saturated: false,
        hazard_zone_id: "lluvia_moderada",
      },
      lluvia_intensa_fen: {
        scenario_id: "lluvia_intensa_fen",
        intensity_mm_h: 28,
        duration_hours: 4,
        drainage_obstructed: true,
        antecedent_soil_saturated: false,
        hazard_zone_id: "lluvia_intensa_fen",
      },
      escenario_extremo_fen: {
        scenario_id: "escenario_extremo_fen",
        intensity_mm_h: 45,
        duration_hours: 6,
        drainage_obstructed: true,
        antecedent_soil_saturated: true,
        hazard_zone_id: "escenario_extremo_fen",
      },
    };
    const next = presets[scenarioId];
    if (next) {
      onChangeSimParams(next);
      onRunSimulation(next);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 border-b border-[#E2E8F0] pb-5 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Mapa Interactivo — Ciudad Universitaria UNT
          </h2>
          <p className="mt-1 text-[15px] text-[#64748B] dark:text-slate-300">
            Capas OpenStreetMap y análisis geométrico Shapely sobre zonas experimentales DEM.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Escenarios rápidos">
          {[
            { id: "lluvia_moderada", label: "Escenario A" },
            { id: "lluvia_intensa_fen", label: "Escenario B (FEN)" },
            { id: "escenario_extremo_fen", label: "Escenario C (Extremo)" },
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => selectQuickScenario(sc.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                simParams.hazard_zone_id === sc.id
                  ? "bg-[#2563EB] text-white"
                  : "border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#111827] dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-300"
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Mapa protagonista (~67% en desktop) */}
        <div className="relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-8">
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="h-[440px] w-full bg-slate-100 dark:bg-slate-900 sm:h-[560px] xl:h-[640px]"
            />

            {(basemap === "vectorial" || tilesFailed) && (
              <div
                role="status"
                className="absolute left-3 top-3 z-[400] flex max-w-[16rem] items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-900 shadow-panel"
              >
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Sin mapa base. Se muestran capas vectoriales locales del campus UNT.</span>
              </div>
            )}

            {/* Control flotante discreto y colapsable de capas */}
            <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setLayersOpen((v) => !v)}
                aria-expanded={layersOpen}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-xs font-semibold text-[#111827] shadow-panel backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-white"
              >
                <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
                <span>Capas y mapa base</span>
              </button>

              {layersOpen && (
                <div className="w-56 rounded-xl border border-[#E2E8F0] bg-white/95 p-3.5 text-xs shadow-panel backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
                  <div className="mb-2.5 flex gap-1" role="group" aria-label="Mapa base">
                    {Object.entries(BASEMAPS).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBasemap(key)}
                        aria-pressed={basemap === key}
                        title={cfg.label}
                        className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition ${
                          basemap === key
                            ? "bg-[#2563EB] text-white"
                            : "border border-[#E2E8F0] text-[#64748B] hover:text-[#111827] dark:border-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {key === "vectorial" ? "Offline" : cfg.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5 text-[#111827] dark:text-slate-200">
                    {[
                      { key: "peligro", label: "Polígono simulado" },
                      { key: "edificios", label: "Edificios UNT" },
                      { key: "reportes", label: "Zonas reportadas" },
                      { key: "senderos", label: "Vías y senderos" },
                      { key: "deportes", label: "Áreas verdes/deportivas" },
                      { key: "accesos", label: "Accesos campus" },
                      { key: "puntos", label: "Puntos encuentro ref." },
                      { key: "rutas", label: "Rutas referenciales" },
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

            {/* Leyenda flotante compacta */}
            <div className="absolute bottom-3 left-3 z-[400] max-w-xs rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-xs shadow-panel backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                aria-expanded={legendOpen}
                className="flex w-full items-center justify-between gap-4 font-semibold text-[#111827] dark:text-slate-100"
              >
                <span>Leyenda</span>
                <span className="text-[11px] font-medium text-[#64748B]">
                  {legendOpen ? "Ocultar" : "Mostrar"}
                </span>
              </button>
              {legendOpen && (
                <div className="mb-1.5 mt-1.5 text-[11px] font-semibold text-[#64748B] dark:text-slate-300">
                  Campus: OSM · Zona de peligro: SINTÉTICA
                </div>
              )}
              <div
                className={`${
                  legendOpen ? "grid" : "hidden"
                } grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#111827] dark:text-slate-200`}
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
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Sin nombre (OSM)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#0B1F33]" /> Perímetro UNT
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Acceso restringido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#14B8A6]" /> Punto encuentro
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel contextual lateral */}
        <div className="flex flex-col justify-between space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-4">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] dark:text-blue-400">
                Inspección Espacial (Shapely)
              </div>
              <h3 className="mt-1 text-base font-bold text-[#111827] dark:text-white">
                {simResult?.spatial_analysis?.hazard_zone_name || "Seleccione un escenario"}
              </h3>
            </div>

            {simResult && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 dark:border-orange-900/50 dark:bg-orange-950/30">
                    <div className="text-xs font-medium text-orange-900 dark:text-orange-300">
                      Edificios expuestos
                    </div>
                    <div className="mt-1 text-3xl font-bold text-orange-600 tabular-nums dark:text-orange-400">
                      {simResult.spatial_analysis.total_exposed_buildings}
                    </div>
                    <div className="mt-1 text-[11px] text-orange-800/80 dark:text-orange-300/80">
                      {simResult.spatial_analysis.exposure_counts?.total ?? 0} total ·{" "}
                      {simResult.spatial_analysis.exposure_counts?.alta ?? 0} alta ·{" "}
                      {simResult.spatial_analysis.exposure_counts?.parcial ?? 0} parcial
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                    <div className="text-xs font-medium text-rose-900 dark:text-rose-300">
                      Accesos restringidos
                    </div>
                    <div className="mt-1 text-3xl font-bold text-rose-600 tabular-nums dark:text-rose-400">
                      {simResult.spatial_analysis.total_restricted_accesses}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    <Building2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    Detalle por edificación
                  </h4>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {[...simResult.spatial_analysis.exposed_buildings]
                      .filter((b) => isExposedLevel(b.exposure_level) || !isUnnamed(b.name))
                      .sort((a, b) => b.overlap_pct - a.overlap_pct)
                      .map((b) => (
                        <div
                          key={b.id}
                          className={`rounded-lg border p-3 text-xs ${
                            isExposedLevel(b.exposure_level)
                              ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
                              : "border-[#E2E8F0] bg-[#F7F9FC] dark:border-slate-800 dark:bg-slate-900/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold text-[#111827] dark:text-white">
                            <span className="truncate">{b.name}</span>
                            <span className="shrink-0 tabular-nums text-[#64748B] dark:text-slate-400">
                              {isExposedLevel(b.exposure_level) && (
                                <span
                                  className="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                                  style={{ background: LEVELS[b.exposure_level].color }}
                                >
                                  {LEVELS[b.exposure_level].label}
                                </span>
                              )}
                              {b.overlap_pct}%
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">
                            {b.status_in_scenario}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    <Navigation className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    Accesos del campus
                  </h4>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {simResult.spatial_analysis.restricted_accesses.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-[#111827] dark:text-slate-200"
                      >
                        <span className="truncate">{a.name}</span>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                            a.inside_hazard_zone
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {a.inside_hazard_zone ? "Restringido" : "Transitable"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate("simulator")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#122C46] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
            >
              <ShieldAlert className="h-4 w-4" />
              Ajustar parámetros en Simulador
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
