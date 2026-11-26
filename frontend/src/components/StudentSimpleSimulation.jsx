import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Play,
  Pause,
  RotateCcw,
  FlaskConical,
  ShieldCheck,
  Loader2,
  Waves,
  X,
} from "lucide-react";
import { fetchPublicSimulation } from "../services/api";

const UNT_CENTER = [-8.11473, -79.03923];

const PUBLIC_SCENARIOS = [
  {
    id: "evento_2017_03",
    title: "Escenario tipo 2017",
    description:
      "Explora cómo podría acumularse y desplazarse el agua bajo un escenario de lluvia de referencia inspirado en los antecedentes documentados de 2017.",
  },
  {
    id: "evento_2023_03_10",
    title: "Escenario tipo 2023",
    description:
      "Explora un escenario de lluvia de referencia relacionado con los antecedentes documentados de 2023.",
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
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const waterLayersRef = useRef([]);
  const builtRunIdRef = useRef("");

  const [selectedPreset, setSelectedPreset] = useState("evento_2017_03");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hour, setHour] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  const frames = result?.frames || [];
  const currentFrame = frames[Math.min(Math.max(hour - 1, 0), Math.max(frames.length - 1, 0))] || null;

  const affectedElements = useMemo(
    () => (result?.elements || []).filter((e) => e.first_hour_affected !== null),
    [result]
  );

  // Inicializa Leaflet una sola vez
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 17,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 20,
      maxNativeZoom: 19,
    }).addTo(map);

    baseGroupRef.current = L.layerGroup().addTo(map);
    waterGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseGroupRef.current = null;
      waterGroupRef.current = null;
      waterLayersRef.current = [];
    };
  }, []);

  // Perímetro y edificios del campus (clickeables para ver resultado exploratorio)
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
          style: { color: "#0B1F33", weight: 2, dashArray: "3 5", fill: false },
        }).addTo(group);
        const b = lyr.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [18, 18] });
      });

    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const fid = f.properties?.id;
        const name = f.properties?.name || "Edificio universitario";
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

  // Mostrar solo el marco de la hora activa
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group || !waterLayersRef.current.length) return;
    group.clearLayers();
    const idx = Math.min(Math.max(hour - 1, 0), waterLayersRef.current.length - 1);
    const activeLayer = waterLayersRef.current[idx];
    if (activeLayer) activeLayer.addTo(group);
  }, [hour, result]);

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

  const handleRunScenario = async (presetId = selectedPreset) => {
    setPlaying(false);
    setLoading(true);
    setError("");
    setSelectedFacility(null);
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
      {/* Cabecera clara de SIMULACIÓN EXPERIMENTAL */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
            <FlaskConical className="h-3 w-3" />
            <span>SIMULACIÓN EXPERIMENTAL · NO REPRESENTA LA SITUACIÓN ACTUAL</span>
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#101828] dark:text-white sm:text-3xl">
            Simulación de lluvias
          </h2>
          <p className="text-sm text-[#475467] dark:text-slate-400">
            Explora cómo podría acumularse el agua en la UNT bajo escenarios de referencia.
          </p>
        </div>
      </div>

      {/* Paso 1 y Paso 2: 2 tarjetas compactas + 1 botón principal */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-stretch">
        {PUBLIC_SCENARIOS.map((sc) => {
          const active = selectedPreset === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => setSelectedPreset(sc.id)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition md:col-span-5 ${
                active
                  ? "border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB] dark:border-blue-500 dark:bg-blue-950/35"
                  : "border-[#E2E8F0] bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B1F33]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#101828] dark:text-white">
                  {sc.title}
                </span>
                {active && (
                  <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-semibold text-white">
                    Seleccionado
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-snug text-[#475467] dark:text-slate-400">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-60"
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
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-900">
          {error}
        </div>
      )}

      {/* Máximo 3 indicadores básicos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Hora del escenario (simulada)
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {currentFrame ? `${currentFrame.label} de ${frames.length}` : "Información no disponible"}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Lámina máxima modelada (hora actual)
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {currentFrame ? `${currentFrame.max_depth_cm} cm` : "Información no disponible"}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="text-[11px] font-medium text-[#475467] dark:text-slate-400">
            Instalaciones con contacto modelado
          </div>
          <div className="mt-0.5 text-xl font-bold text-[#101828] tabular-nums dark:text-white">
            {result ? `${affectedElements.length}` : "Información no disponible"}
          </div>
        </div>
      </div>

      {/* Mapa principal + ficha compacta por instalación */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-9">
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="h-[420px] w-full bg-slate-100 dark:bg-slate-900 lg:h-[500px]"
            />

            {/* Leyenda sencilla con unidades */}
            <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-3 rounded-lg border border-[#E2E8F0] bg-white/95 px-3 py-2 text-[11px] text-[#101828] backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95 dark:text-slate-200">
              {Object.entries(WATER_STYLES).map(([k, st]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm border border-slate-400/50"
                    style={{ background: st.fillColor }}
                  />
                  {st.label}
                </span>
              ))}
            </div>
          </div>

          {/* Controles temporales inmediatamente debajo del mapa */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              disabled={!frames.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 dark:bg-[#2563EB]"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{playing ? "Pausar" : "Reproducir"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setHour(1);
              }}
              disabled={!frames.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
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
                className="h-2 flex-1 cursor-pointer accent-[#2563EB]"
              />
              <span className="shrink-0 font-mono text-xs font-bold text-[#101828] dark:text-white">
                {currentFrame ? currentFrame.label : "h+1"}
              </span>
            </div>
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
        </div>
      </div>
    </div>
  );
}
