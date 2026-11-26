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
} from "lucide-react";
import { formatLimaTime, normalizeText } from "../utils/formatters";
import { buildCampusCatalog } from "../utils/campusCatalog";

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
  vectorial: { label: "Offline" },
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export default function StudentMonitoringMap({
  weather,
  campusLayers,
  declaredConditions = [],
  focusedBuildingId = "",
  onSelectBuilding,
  onNavigate,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const attentionGroupRef = useRef(null);
  const focusLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorsRef = useRef(0);
  const fittedRef = useRef(false);

  const [basemap, setBasemap] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false ? "vectorial" : "calles"
  );
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showAttentionZones, setShowAttentionZones] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);

  const catalog = useMemo(() => buildCampusCatalog(campusLayers, null), [campusLayers]);

  const filteredCatalog = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return catalog.filter((c) => c.type === "facultad" || c.type === "comedor" || c.type === "biblioteca").slice(0, 8);
    return catalog.filter((c) => c.searchText.includes(q)).slice(0, 10);
  }, [catalog, query]);

  const { local: updatedLima } = formatLimaTime(weather?.fetched_at_utc);
  const isLive = weather?.data_status === "LIVE_API";

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
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      attentionGroupRef.current = null;
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

    // Edificios reales OSM
    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const name = f.properties?.name || "Edificio del campus";
        const isNamed = !/^Edificio sin nombre/.test(name);
        L.geoJSON(f, {
          style: {
            color: isNamed ? "#1D4ED8" : "#94A3B8",
            weight: 1.2,
            fillColor: isNamed ? "#3B82F6" : "#CBD5E1",
            fillOpacity: 0.45,
          },
          onEachFeature: (_feat, lyr) => {
            lyr.on("click", () => {
              onSelectBuilding?.(f.properties?.id || "");
              setSelectedCard({
                name,
                infoType: "Sin información suficiente",
                explanation:
                  "Instalación registrada en OpenStreetMap. Consulta las zonas de atención o la Simulación sencilla (2017 / 2023) para explorar escenarios referenciales.",
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
      {/* Cabecera clara de MONITOREO (distinta de Simulación) */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
            {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>
              {isLive
                ? "Monitoreo · Pronóstico Open-Meteo (no medición en tiempo real)"
                : "Monitoreo · Respaldo caché offline"}
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#101828] dark:text-white sm:text-3xl">
            Mapa de monitoreo UNT
          </h2>
          <p className="text-sm text-[#475467] dark:text-slate-400">
            Consulta el pronóstico vigente, ubica tu facultad y revisa las zonas de atención del campus.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("student_sim")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white transition hover:bg-[#1D4ED8]"
        >
          <Waves className="h-4 w-4" />
          <span>Ir a Simulación sencilla (2017 / 2023)</span>
        </button>
      </div>

      {/* Resumen compacto de Open-Meteo (sin datos inventados) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Lluvia prevista (24 h)
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {weather?.summary ? `${weather.summary.accumulated_24h_mm} mm` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Lluvia prevista (48 h)
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {weather?.summary ? `${weather.summary.accumulated_48h_mm} mm` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Intensidad máxima
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {weather?.summary ? `${weather.summary.max_intensity_mm_h} mm/h` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Actualización (Lima)
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-[#101828] dark:text-white">
            {updatedLima}
          </div>
          <div className="text-[10px] text-[#64748B] dark:text-slate-400">
            Fuente: Open-Meteo
          </div>
        </div>
      </div>

      {/* Aviso transparente si existen condiciones externas declaradas manualmente */}
      {declaredConditions.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Condición externa declarada manualmente ({declaredConditions.length}):</strong> registrada de forma manual en el sistema (no es una medición automática de sensores).
          </span>
        </div>
      )}

      {/* Mapa protagonista + Panel lateral sencillo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-8">
          <div
            ref={mapContainerRef}
            className="h-[420px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[540px]"
          />

          {(basemap === "vectorial" || tilesFailed) && (
            <div className="absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/95 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Modo vectorial offline</span>
            </div>
          )}

          {/* Controles compactos arriba a la derecha */}
          <div className="absolute right-3 top-3 z-[400] flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowAttentionZones((v) => !v)}
              aria-pressed={showAttentionZones}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold backdrop-blur transition ${
                showAttentionZones
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-[#E2E8F0] bg-white/95 text-[#101828] dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-white"
              }`}
            >
              Zonas de atención
            </button>
            <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white/95 p-0.5 backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
              {Object.entries(BASEMAPS).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBasemap(key)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                    basemap === key
                      ? "bg-[#2563EB] text-white"
                      : "text-[#475467] dark:text-slate-300"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leyenda simple */}
          <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-[11px] text-[#101828] backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-amber-600 bg-amber-400/70" /> Antecedente histórico
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-sky-600 bg-sky-400/60" /> Relieve bajo (DEM)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Punto de encuentro ref.
            </span>
          </div>
        </div>

        {/* Panel derecho: buscador + ficha breve de instalación o zona */}
        <div className="space-y-4 lg:col-span-4">
          {selectedCard && (
            <section className="rounded-xl border border-[#2563EB]/40 bg-white p-4 shadow-sm dark:border-blue-800 dark:bg-[#0B1F33]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] dark:bg-blue-950/60 dark:text-blue-300">
                    {selectedCard.infoType}
                  </span>
                  <h3 className="mt-1 text-sm font-bold text-[#101828] dark:text-white">
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
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#2563EB]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Ver recomendaciones</span>
              </button>
            </section>
          )}

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="text-sm font-bold text-[#101828] dark:text-white">
              Busca tu facultad o instalación
            </h3>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej. Comedor, Ingeniería, Biblioteca..."
                aria-label="Buscar facultad o instalación en el mapa"
                className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] pl-9 pr-3 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="mt-2.5 max-h-64 space-y-1 overflow-y-auto">
              {filteredCatalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectBuilding?.(item.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs transition hover:border-[#E2E8F0] hover:bg-[#F7F9FC] dark:hover:border-slate-700 dark:hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#101828] dark:text-white">
                      {item.displayLabel}
                    </div>
                    <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                      {item.typeLabel}
                    </div>
                  </div>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="py-4 text-center text-xs text-[#64748B]">
                  Sin coincidencias en el catálogo del campus.
                </div>
              )}
            </div>
          </section>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 text-[11px] leading-relaxed text-[#475467] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-[#101828] dark:text-slate-200">
              <CloudRain className="h-3.5 w-3.5 text-[#2563EB]" />
              Sobre los datos mostrados
            </div>
            <p className="mt-1">
              El pronóstico proviene de Open-Meteo (modelo numérico, no sensores locales instalados en la UNT). Esta vista no declara zonas seguras ni reemplaza comunicados de SENAMHI, INDECI o Defensa Civil UNT.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
