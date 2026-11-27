import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  FlaskConical,
  ShieldCheck,
  Loader2,
  Waves,
  WifiOff,
  X,
  ChevronDown,
  ChevronUp,
  CloudRain,
} from "lucide-react";
import { fetchPublicSimulation } from "../services/api";
import { buildCampusCatalog, getFeatureDisplayName } from "../utils/campusCatalog";
import WhereAmISafeRouteBar from "./ui/WhereAmISafeRouteBar";
import { findNearestSafeRoute } from "../utils/safeRouteHelper";
import { renderEvacuationLayers, resolveAlternativeMeetingPoint } from "../utils/evacuationLayers";
import SimulationHyetograph from "./ui/SimulationHyetograph";

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

function detectAffectedGates(elements = [], activeHour = null, evaluation = null) {
  const gates = new Set();
  const hasRHid01 = Boolean(
    evaluation?.triggered_rules?.some((r) => String(r.id || "").toUpperCase() === "R-HID-01")
  );
  elements.forEach((el) => {
    if (el.first_hour_affected === null || el.first_hour_affected === undefined) return;
    if (activeHour !== null && el.first_hour_affected > activeHour) return;
    const depthCm = Number(el.max_depth_cm ?? 0);
    if (depthCm < 5 && !hasRHid01) return;
    const nm = String(el.name || "").toLowerCase();
    const id = String(el.id || "").toLowerCase();
    if (nm.includes("puerta 4") || id.includes("5052281066") || nm.includes("cidunt")) {
      gates.add("P4");
    }
    if (
      nm.includes("puerta 3") ||
      id.includes("4454081424") ||
      nm.includes("comedor") ||
      nm.includes("enfermer")
    ) {
      gates.add("P3");
    }
    if (nm.includes("puerta 2") || id.includes("11037474034") || nm.includes("derecho")) {
      gates.add("P2");
    }
    if (nm.includes("puerta 1")) {
      gates.add("P1");
    }
  });
  return gates;
}

const PUBLIC_SCENARIOS = [
  {
    id: "evento_2017_03",
    title: "El Niño Costero 2017",
    tag: "27.5 mm · Marzo 2017",
    description: "Referencia educativa basada en las lluvias intensas de marzo de 2017 en Trujillo.",
  },
  {
    id: "evento_2023_03_10",
    title: "Ciclón Yaku 2023",
    tag: "35.0 mm · Marzo 2023",
    description: "Referencia educativa basada en las lluvias extremas del 10 de marzo de 2023.",
  },
];

const WATER_STYLES = {
  leve: { label: "Leve (≈ 2–5 cm)", color: "#38BDF8", fillColor: "#BAE6FD", fillOpacity: 0.65 },
  moderada: { label: "Moderada (≈ 5–15 cm)", color: "#0284C7", fillColor: "#38BDF8", fillOpacity: 0.7 },
  alta: { label: "Alta (≥ 15 cm)", color: "#1E40AF", fillColor: "#1D4ED8", fillOpacity: 0.75 },
};

export default function StudentSimpleSimulation({
  campusLayers,
  onPublicSimResult,
  onNavigate,
  offline = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const evacuationGroupRef = useRef(null);
  const myRouteGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);
  const waterLayersRef = useRef([]);
  const builtRunIdRef = useRef("");

  const [basemap, setBasemap] = useState(
    offline || (typeof navigator !== "undefined" && navigator.onLine === false)
      ? "vectorial"
      : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showSafeAreas, setShowSafeAreas] = useState(true);
  const [showMeetingPoints, setShowMeetingPoints] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("evento_2017_03");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [myLocationId, setMyLocationId] = useState("");
  const notifiedDetourRef = useRef("");

  // Blindaje offline: cambia automáticamente a Solo vectorial cuando no hay internet o se activa modo offline
  useEffect(() => {
    if (offline) {
      setBasemap("vectorial");
    }
  }, [offline]);

  const frames = result?.frames || [];
  const currentFrame = frames[Math.min(Math.max(hour - 1, 0), Math.max(frames.length - 1, 0))] || null;

  const affectedElements = useMemo(
    () => (result?.elements || []).filter((e) => e.first_hour_affected !== null),
    [result]
  );

  const affectedGates = useMemo(
    () => detectAffectedGates(result?.elements || [], result ? hour : null, result?.evaluation),
    [result, hour]
  );

  const alternativeMeetingPoint = useMemo(
    () =>
      affectedGates.size > 0
        ? resolveAlternativeMeetingPoint(campusLayers?.evacuation, affectedGates)
        : null,
    [campusLayers, affectedGates]
  );

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
    return findNearestSafeRoute({ originItem: origin, campusLayers, affectedGates });
  }, [myLocationId, catalog, campusLayers, affectedGates]);

  // Toast discreto cuando se activa desvío por acceso comprometido
  useEffect(() => {
    if (!result || !showMeetingPoints || affectedGates.size === 0) return;
    const key = `${result.run_id}-${Array.from(affectedGates).sort().join(",")}`;
    if (notifiedDetourRef.current === key) return;
    notifiedDetourRef.current = key;
    const altName = alternativeMeetingPoint?.properties?.name || "Explanada Sociales";
    toast.info(`Desvío preventivo activado (${Array.from(affectedGates).join(", ")})`, {
      description: `Evita las rutas en rojo discontinuo y dirígete al punto de encuentro habilitado: ${altName}.`,
    });
  }, [result, showMeetingPoints, affectedGates, alternativeMeetingPoint]);

  const accumulatedRainMm = useMemo(() => {
    if (!frames.length) return 0;
    const slice = frames.slice(0, Math.min(hour, frames.length));
    return slice.reduce((acc, fr) => acc + (fr.rain_mm ?? fr.precipitation_mm ?? 0), 0);
  }, [frames, hour]);

  // Inicializa Leaflet una sola vez (mapa base manejado aparte para soportar modo Solo vectorial offline)
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
    waterGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    myRouteGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      waterGroupRef.current = null;
      evacuationGroupRef.current = null;
      myRouteGroupRef.current = null;
      tileLayerRef.current = null;
      waterLayersRef.current = [];
    };
  }, []);

  // Mapa base seleccionable con degradación automática si fallan los mosaicos
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

  // Perímetro, vías, áreas verdes y edificios del campus (clickeables para ver resultado exploratorio)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = baseGroupRef.current;
    if (!map || !group || !campusLayers) return;
    group.clearLayers();

    const features = campusLayers.campus?.features || [];
    const byId = new Map((result?.elements || []).map((e) => [e.id, e]));

    features
      .filter((f) => f.properties?.category === "perimetro_campus")
      .forEach((f) => {
        const lyr = L.geoJSON(f, {
          interactive: false,
          style: {
            color: "#0B1F33",
            weight: 2,
            dashArray: "3 5",
            fill: true,
            fillColor: "#F8FAFC",
            fillOpacity: 0.4,
          },
        }).addTo(group);
        if (!fittedRef.current) {
          const b = lyr.getBounds();
          if (b.isValid()) {
            map.fitBounds(b, { padding: [18, 18] });
            fittedRef.current = true;
          }
        }
      });

    features
      .filter((f) => f.properties?.category === "via")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#94A3B8", weight: 1.1, opacity: 0.7 },
        }).addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "area_verde")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#86EFAC", weight: 0.8, fillColor: "#DCFCE7", fillOpacity: 0.45 },
        }).addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const fid = f.properties?.id;
        const name = getFeatureDisplayName(f.properties);
        const impact = byId.get(fid);
        const touched = Boolean(impact && impact.first_hour_affected !== null);

        L.geoJSON(f, {
          style: {
            color: touched ? "#D97706" : "#64748B",
            weight: touched ? 1.8 : 1,
            fillColor: touched ? "#FBBF24" : "#CBD5E1",
            fillOpacity: touched ? 0.55 : 0.35,
          },
          onEachFeature: (_feat, lyr) => {
            lyr.bindTooltip(esc(name), { sticky: true, direction: "top" });
            lyr.on("click", () => {
              setSelectedFacility({
                name,
                impact,
              });
            });
          },
        }).addTo(group);
      });
  }, [campusLayers, result]);

  // Capas independientes: Áreas seguras (#10B981) + Puntos de encuentro (#059669) + Rutas dinámicas
  useEffect(() => {
    const group = evacuationGroupRef.current;
    if (!group || !campusLayers) return;
    renderEvacuationLayers({
      group,
      evacuationData: campusLayers.evacuation,
      showSafeAreas,
      showMeetingPoints,
      showRoutes: showMeetingPoints,
      affectedGates,
      recommendedPointId: mySafeRoute?.safePoint?.id || "",
    });
  }, [campusLayers, showSafeAreas, showMeetingPoints, affectedGates, mySafeRoute]);

  // Dibujar ruta segura personalizada en la simulación
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
      { color: "#00B4D8", weight: 6, opacity: 0.35 }
    ).addTo(group);
    L.polyline(
      [
        [origin.lat, origin.lon],
        [safePoint.lat, safePoint.lon],
      ],
      { color: "#059669", weight: 3.5, dashArray: "8 6", opacity: 0.95 }
    ).addTo(group);
    L.circleMarker([origin.lat, origin.lon], {
      radius: 8,
      color: "#FFFFFF",
      weight: 2.5,
      fillColor: "#0B2545",
      fillOpacity: 1,
    })
      .bindTooltip(`Tu ubicación: ${esc(origin.name)}`, { direction: "top" })
      .addTo(group);

    map.flyTo([origin.lat, origin.lon], 18, { duration: 0.9 });
  }, [mySafeRoute]);

  // Pre-construir capas de agua por hora para animar sin parpadeos ni recargas
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group || !result) return;
    if (builtRunIdRef.current === result.run_id && waterLayersRef.current.length === frames.length) {
      return;
    }
    group.clearLayers();
    waterLayersRef.current = frames.map((fr) =>
      L.geoJSON(fr.geojson, {
        interactive: false,
        style: (feat) => {
          const cls = feat.properties?.depth_class || "leve";
          const st = WATER_STYLES[cls] || WATER_STYLES.leve;
          return {
            color: st.color,
            weight: 0.7,
            fillColor: st.fillColor,
            fillOpacity: st.fillOpacity,
          };
        },
      })
    );
    builtRunIdRef.current = result.run_id;
  }, [result, frames]);

  // Mostrar solo el marco de la hora activa (si la capa Zonas de riesgo está activa)
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showRiskZones || !waterLayersRef.current.length) return;
    const idx = Math.min(Math.max(hour - 1, 0), waterLayersRef.current.length - 1);
    const activeLayer = waterLayersRef.current[idx];
    if (activeLayer) activeLayer.addTo(group);
  }, [hour, result, showRiskZones]);

  // Animación Play / Pause
  useEffect(() => {
    if (!playing || !frames.length) return;
    const timer = setInterval(() => {
      setHour((prev) => {
        if (prev >= frames.length) {
          setPlaying(false);
          return frames.length;
        }
        return prev + 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [playing, frames.length]);

  const handleSelectScenario = (sc) => {
    setSelectedPreset(sc.id);
    toast.info(`Escenario seleccionado: ${sc.title}`, {
      description: `${sc.tag} · Pulsa "Ver simulación" para reproducir la evolución horaria.`,
    });
  };

  const handleRunScenario = async (presetId = selectedPreset) => {
    setPlaying(false);
    setLoading(true);
    setError("");
    setSelectedFacility(null);
    notifiedDetourRef.current = "";
    try {
      const data = await fetchPublicSimulation(presetId);
      setResult(data);
      onPublicSimResult?.(data);
      setHour(1);
      setPlaying(true);
    } catch (err) {
      setError(err.message || "No se pudo cargar la simulación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera inequívoca de SIMULACIÓN HISTÓRICA EDUCATIVA */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D97706]/40 bg-[#FFFBEB] px-3 py-1 text-xs font-extrabold text-[#92400E] dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
            <FlaskConical className="h-3.5 w-3.5 text-[#D97706]" />
            <span>Simulación histórica educativa — No es una alerta en curso</span>
          </div>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
            Simulación de lluvias (2017 / 2023)
          </h2>
          <p className="text-sm text-[#475569] dark:text-slate-300">
            Referencia visual interactiva para conocer zonas inundables y rutas seguras del campus.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("student_map")}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-[#0B2545] transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] dark:border-slate-700 dark:bg-[#0B2545] dark:text-white"
        >
          <span>Volver al pronóstico actual (48 h)</span>
        </button>
      </div>

      {/* Selector visual de escenarios históricos + botón reproducir */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-stretch">
        {PUBLIC_SCENARIOS.map((sc) => {
          const active = selectedPreset === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSelectScenario(sc)}
              aria-pressed={active}
              className={`rounded-2xl border p-4 text-left transition md:col-span-5 ${
                active
                  ? "border-[#0369A1] bg-[#F0F9FF] shadow-sm ring-1 ring-[#0369A1] dark:border-[#00B4D8] dark:bg-sky-950/40"
                  : "border-slate-200 bg-white hover:border-[#00B4D8] dark:border-slate-800 dark:bg-[#0B2545]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      active
                        ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                        : "bg-slate-100 text-[#0369A1] dark:bg-slate-800 dark:text-[#38BDF8]"
                    }`}
                  >
                    <CloudRain className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {sc.title}
                    </div>
                    <div className="font-mono text-xs font-bold text-[#0369A1] dark:text-[#38BDF8]">
                      {sc.tag}
                    </div>
                  </div>
                </div>
                {active && (
                  <span className="rounded-full bg-[#0B2545] px-2.5 py-0.5 text-xs font-bold text-white dark:bg-[#0369A1]">
                    Activo
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-snug text-[#475569] dark:text-slate-300">
                {sc.description}
              </p>
            </button>
          );
        })}

        <div className="flex items-stretch md:col-span-2">
          <button
            type="button"
            onClick={() => handleRunScenario(selectedPreset)}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2545] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] disabled:opacity-60 dark:bg-[#0369A1] dark:hover:bg-[#00B4D8]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Waves className="h-4 w-4" />
            )}
            <span>Ver simulación</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs font-semibold text-[#991B1B]">
          {error}
        </div>
      )}

      {/* Selector rápido: ¿Dónde estoy en la UNT? -> Mi Ruta Segura */}
      <WhereAmISafeRouteBar
        options={facultyOptions}
        selectedId={myLocationId}
        onSelectOrigin={setMyLocationId}
        safeRoute={mySafeRoute}
        onClear={() => setMyLocationId("")}
      />

      {/* Mapa principal Map-First + Reproductor moderno + Ficha lateral */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-[#0B2545] lg:col-span-9">
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="h-[460px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[600px] 2xl:h-[700px]"
            />

            {(basemap === "vectorial" || tilesFailed) && (
              <div className="absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-xl border border-[#D97706]/35 bg-[#FFFBEB]/95 px-3 py-1.5 text-xs font-bold text-[#92400E] shadow-sm backdrop-blur-md">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>Solo vectorial (sin internet). Capas locales activas.</span>
              </div>
            )}

            {/* Controles flotantes translúcidos — 3 capas independientes */}
            <div className="absolute right-3 top-3 z-[400] flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-slate-200/80 bg-white/92 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-[#0B2545]/92">
              <button
                type="button"
                onClick={() => setShowRiskZones((v) => !v)}
                aria-pressed={showRiskZones}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  showRiskZones
                    ? "bg-[#0284C7] text-white shadow-sm"
                    : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                }`}
              >
                Zonas de riesgo
              </button>
              <button
                type="button"
                onClick={() => setShowSafeAreas((v) => !v)}
                aria-pressed={showSafeAreas}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  showSafeAreas
                    ? "bg-[#10B981] text-white shadow-sm"
                    : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                }`}
              >
                Áreas seguras
              </button>
              <button
                type="button"
                onClick={() => setShowMeetingPoints((v) => !v)}
                aria-pressed={showMeetingPoints}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  showMeetingPoints
                    ? "bg-[#059669] text-white shadow-sm"
                    : "text-[#0F172A] hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
                }`}
              >
                Puntos de encuentro
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
                    title={cfg.title || cfg.label}
                    onClick={() => setBasemap(key)}
                    aria-pressed={basemap === key}
                    className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                      basemap === key
                        ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                        : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300"
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leyenda colapsable flotante */}
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
                    {Object.entries(WATER_STYLES).map(([k, st]) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-slate-400/50"
                          style={{ background: st.fillColor }}
                        />
                        {st.label}
                      </span>
                    ))}
                    {showSafeAreas && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#059669] bg-[#10B981]/35" /> Área segura (polígono)
                      </span>
                    )}
                    {showMeetingPoints && (
                      <>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" /> Punto de encuentro
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-4 border-t-2 border-dashed border-emerald-700" /> Ruta libre
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-4 border-t-2 border-dashed border-rose-600" /> Evitar paso
                        </span>
                      </>
                    )}
                  </div>
                  {campusLayers?.evacuation?.dem_validation?.verified_against_dem && (
                    <div className="text-[11px] font-semibold text-[#059669] dark:text-emerald-300">
                      Validado DEM 10 m (2017/2023): máx. {campusLayers.evacuation.dem_validation.max_depth_at_safe_points_cm} cm en puntos de encuentro.
                    </div>
                  )}
                </div>
              )}
              {showMeetingPoints && affectedGates.size > 0 && (
                <div className="mt-1.5 font-semibold text-[#B45309] dark:text-amber-300">
                  Evitar paso en {Array.from(affectedGates).join(", ")} (h+{hour}) · Punto alternativo habilitado:{" "}
                  {alternativeMeetingPoint?.properties?.name || "PE-1 Explanada Sociales"}.
                </div>
              )}
            </div>
          </div>

          {/* Reproductor moderno de simulación */}
          <div className="space-y-3 border-t border-slate-200 bg-[#F8FAFC] px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                  Hora simulada
                </div>
                <div className="font-mono text-lg font-extrabold text-[#0B2545] tabular-nums dark:text-white">
                  {currentFrame ? `${currentFrame.label} / ${frames.length}` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                  Lámina / Lluvia acum.
                </div>
                <div className="font-mono text-lg font-extrabold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                  {currentFrame
                    ? `${currentFrame.max_depth_cm} cm${
                        accumulatedRainMm > 0 ? ` · ${accumulatedRainMm.toFixed(1)} mm` : ""
                      }`
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-[#0B2545]">
                <div className="text-xs font-semibold text-[#475569] dark:text-slate-300">
                  Zonas afectadas
                </div>
                <div className="font-mono text-lg font-extrabold text-[#D97706] tabular-nums dark:text-amber-300">
                  {result ? `${affectedElements.length}` : "—"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                disabled={!frames.length}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] disabled:opacity-50 dark:bg-[#0369A1]"
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
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-100"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reiniciar</span>
              </button>

              <div className="flex min-w-[180px] flex-1 items-center gap-3">
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
                  aria-label="Barra temporal del escenario simulado"
                  className="h-2.5 flex-1 cursor-pointer accent-[#0369A1]"
                />
                <span className="shrink-0 rounded-lg bg-[#0B2545] px-2.5 py-1 font-mono text-xs font-extrabold text-white tabular-nums dark:bg-[#0369A1]">
                  {currentFrame ? currentFrame.label : "h+1"}
                </span>
              </div>
            </div>

            {/* Hietograma horario real (mm/h) sincronizado hora por hora */}
            {frames.length > 0 && (
              <SimulationHyetograph
                rainfallSeries={result?.parameters?.rainfall_mm_h || []}
                frames={frames}
                activeHour={hour}
                onSelectHour={(hr) => {
                  setPlaying(false);
                  setHour(hr);
                }}
                compact
              />
            )}
          </div>
        </div>

        {/* Columna derecha compacta: ficha de instalación seleccionada o guía breve */}
        <div className="space-y-3 lg:col-span-3">
          {selectedFacility ? (
            <section className="rounded-xl border border-[#2563EB]/40 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-[#0B1F33]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-[#101828] dark:text-white">
                  {selectedFacility.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedFacility(null)}
                  aria-label="Cerrar ficha de instalación"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 rounded-lg bg-[#F7F9FC] p-2.5 text-xs dark:bg-slate-900/60">
                {selectedFacility.impact && selectedFacility.impact.first_hour_affected !== null ? (
                  <>
                    <div className="font-semibold text-amber-800 dark:text-amber-300">
                      Contacto modelado desde h+{selectedFacility.impact.first_hour_affected}
                    </div>
                    <div className="mt-0.5 text-[#475467] dark:text-slate-300">
                      Lámina máxima modelada: <strong>{selectedFacility.impact.max_depth_cm} cm</strong>.
                    </div>
                  </>
                ) : (
                  <div className="text-[#475467] dark:text-slate-300">
                    Sin lámina visible en el perímetro exterior de esta instalación durante este escenario exploratorio.
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#64748B] dark:text-slate-400">
                Resultado exploratorio simplificado; no clasifica el edificio ni sustituye avisos oficiales.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("prevention")}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#2563EB]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Ver recomendaciones</span>
              </button>
            </section>
          ) : (
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs text-[#475467] dark:border-slate-800 dark:bg-[#0B1F33] dark:text-slate-300">
              <div className="font-bold text-[#101828] dark:text-white">
                Cómo explorar el escenario
              </div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                <li>Elige <strong>Escenario tipo 2017</strong> o <strong>tipo 2023</strong>.</li>
                <li>Pulsa <strong>Ver simulación</strong> y usa la barra temporal.</li>
                <li>Haz clic sobre cualquier pabellón del mapa para ver su resultado exploratorio.</li>
              </ol>
              {affectedElements.length > 0 && (
                <div className="mt-3 border-t border-[#E2E8F0] pt-2.5 dark:border-slate-800">
                  <div className="mb-1.5 text-[11px] font-semibold text-[#101828] dark:text-white">
                    Instalaciones destacadas en este escenario:
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {affectedElements.slice(0, 6).map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => setSelectedFacility({ name: el.name, impact: el })}
                        className="flex w-full items-center justify-between rounded-md bg-[#F7F9FC] px-2 py-1.5 text-left text-[11px] hover:bg-blue-50 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                      >
                        <span className="truncate font-medium text-[#101828] dark:text-slate-200">
                          {el.name}
                        </span>
                        <span className="ml-2 shrink-0 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {el.max_depth_cm} cm
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] p-3 text-xs leading-relaxed text-[#475467] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            {EVACUATION_DISCLAIMER}
          </div>
        </div>
      </div>
    </div>
  );
}
