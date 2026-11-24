import React, { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, ArrowRight, Clock, Building2, Info } from "lucide-react";
import { humanPreventiveTitle } from "../utils/formatters";

const DEFAULT_RESET_PARAMS = {
  scenario_id: "lluvia_intensa_fen",
  intensity_mm_h: 28,
  duration_hours: 4,
  drainage_obstructed: true,
  antecedent_soil_saturated: false,
  hazard_zone_id: "lluvia_intensa_fen",
  synthetic_reach_m: 40,
};

const isUnnamed = (name) => /^Edificio sin nombre/.test(name || "");
const displayBuildingName = (building) => {
  if (!isUnnamed(building.name)) return building.name;
  const digits = String(building.osm_id || "").match(/\d+$/)?.[0] || "000000";
  return `Edificio sin nombre (OSM ${digits.slice(-6).padStart(6, "0")})`;
};

export default function SimulatorView({
  simParams,
  onChangeSimParams,
  simResult,
  simLoading,
  simError,
  lastSimAt,
  onRunSimulation,
  onNavigate,
}) {
  const debounceRef = useRef(null);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [demInfoOpen, setDemInfoOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateAndRun = (nextParams, delayMs = 0) => {
    onChangeSimParams(nextParams);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (delayMs === 0) {
      onRunSimulation(nextParams);
    } else {
      debounceRef.current = setTimeout(() => {
        onRunSimulation(nextParams);
      }, delayMs);
    }
  };

  const applyPreset = (scenarioId) => {
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
    if (presets[scenarioId]) {
      updateAndRun(presets[scenarioId], 0);
    } else {
      onChangeSimParams({ ...simParams, scenario_id: "personalizado" });
    }
  };

  const activeIntensity = simResult?.parameters?.intensity_mm_h ?? simParams.intensity_mm_h;
  const activeDuration = simResult?.parameters?.duration_hours ?? simParams.duration_hours;
  const rainfallPresetLabel = simResult?.rainfall_reference?.is_historical_reanalysis
    ? "lluvia histórica de referencia"
    : "supuesto de lluvia demostrativo";
  const timelineSteps = Array.from({ length: Math.min(6, activeDuration) }, (_, idx) => {
    const hour = idx + 1;
    const factor = hour === 1 ? 0.55 : hour === 2 ? 0.9 : hour === 3 ? 1.0 : 0.7;
    return { hour, estMm: (activeIntensity * factor).toFixed(1) };
  });

  const exposedOnly = (simResult?.spatial_analysis?.exposed_buildings || [])
    .filter((b) => b.inside_hazard_zone)
    .filter((b) =>
      buildingSearch.trim()
        ? b.name.toLowerCase().includes(buildingSearch.trim().toLowerCase())
        : true
    )
    .sort((a, b) => b.overlap_pct - a.overlap_pct);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#101828] dark:text-white">
            Centro Interactivo de Simulación
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Ensaya niveles preventivos según lluvia y drenaje. La lluvia no modifica los polígonos;
            el alcance de la influencia SINTÉTICA tampoco depende de los mm/h.
          </p>
        </div>
        {lastSimAt && (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Actualizado {lastSimAt}
          </span>
        )}
      </div>

      {simError && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          Error: {simError}
        </div>
      )}

      {/* Izquierda: Controles | Derecha: Resultados */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
          {/* 1. Escenario */}
          <div className="space-y-2">
            <label htmlFor="sim-preset" className="block text-xs font-semibold text-[#475467] dark:text-slate-400">
              1. Escenario
            </label>
            <select
              id="sim-preset"
              value={simParams.scenario_id}
              onChange={(e) => applyPreset(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 text-sm font-medium text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Escenario A — Relieve · {rainfallPresetLabel}</option>
              <option value="lluvia_intensa_fen">B — Ingreso reportado · {rainfallPresetLabel}</option>
              <option value="escenario_extremo_fen">C — Combinado · {rainfallPresetLabel}</option>
              <option value="personalizado">Personalizado</option>
            </select>
            <p className="text-[11px] leading-relaxed text-[#475467] dark:text-slate-400">
              La lluvia y la duración alimentan las reglas preventivas, pero NO cambian el polígono.
              Cada zona representa un mecanismo distinto. Canaletas nuevas de la UNT: no modeladas
              (sin datos).
            </p>
          </div>

          {/* 2. Intensidad y duración */}
          <div className="space-y-4 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <div className="text-xs font-semibold text-[#475467] dark:text-slate-400">
              2. Intensidad y duración
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-intensity" className="font-medium text-[#101828] dark:text-slate-200">
                  Intensidad de lluvia
                </label>
                <span className="font-bold text-[#2563EB] tabular-nums">{simParams.intensity_mm_h} mm/h</span>
              </div>
              <input
                id="sim-intensity"
                type="range"
                min="0"
                max="80"
                step="1"
                value={simParams.intensity_mm_h}
                onChange={(e) =>
                  updateAndRun(
                    { ...simParams, scenario_id: "personalizado", intensity_mm_h: Number(e.target.value) },
                    220
                  )
                }
                className="mt-2 w-full accent-[#2563EB]"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-duration" className="font-medium text-[#101828] dark:text-slate-200">
                  Duración del evento
                </label>
                <span className="font-bold text-[#2563EB] tabular-nums">{simParams.duration_hours} h</span>
              </div>
              <input
                id="sim-duration"
                type="range"
                min="1"
                max="24"
                step="1"
                value={simParams.duration_hours}
                onChange={(e) =>
                  updateAndRun(
                    { ...simParams, scenario_id: "personalizado", duration_hours: Number(e.target.value) },
                    220
                  )
                }
                className="mt-2 w-full accent-[#2563EB]"
              />
            </div>
          </div>

          {/* 3. Condiciones del terreno */}
          <div className="space-y-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label htmlFor="sim-zone" className="text-xs font-semibold text-[#475467] dark:text-slate-400">
                3. Zona de análisis (Shapely)
              </label>
              <button
                type="button"
                onClick={() => setDemInfoOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
              >
                <Info className="h-3 w-3" /> ¿Qué es esto?
              </button>
            </div>

            <select
              id="sim-zone"
              value={simParams.hazard_zone_id}
              onChange={(e) =>
                updateAndRun({ ...simParams, scenario_id: "personalizado", hazard_zone_id: e.target.value }, 0)
              }
              className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 text-sm font-medium text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Zona A — Acumulación por relieve (DEM)</option>
              <option value="lluvia_intensa_fen">Zona B — Ingreso por avenidas y puertas (reportado)</option>
              <option value="escenario_extremo_fen">Zona C — Combinado (relieve + reportado)</option>
            </select>

            {simParams.hazard_zone_id !== "lluvia_moderada" && (
              <div className="space-y-2 rounded-lg border border-dashed border-cyan-500/60 bg-cyan-50/50 p-3 dark:bg-cyan-950/20">
                <div className="flex justify-between gap-2 text-sm">
                  <label htmlFor="sim-synthetic-reach" className="font-medium text-[#101828] dark:text-slate-200">
                    Alcance de influencia SINTÉTICA
                  </label>
                  <span className="shrink-0 font-bold text-cyan-700 tabular-nums dark:text-cyan-300">
                    {simParams.synthetic_reach_m ?? (simParams.hazard_zone_id === "escenario_extremo_fen" ? 80 : 40)} m
                  </span>
                </div>
                <input
                  id="sim-synthetic-reach"
                  type="range"
                  min="20"
                  max="150"
                  step="1"
                  value={simParams.synthetic_reach_m ?? (simParams.hazard_zone_id === "escenario_extremo_fen" ? 80 : 40)}
                  onChange={(e) =>
                    updateAndRun(
                      {
                        ...simParams,
                        synthetic_reach_m: Number(e.target.value),
                      },
                      220
                    )
                  }
                  className="w-full accent-cyan-600"
                />
                <p className="text-[11px] leading-relaxed text-[#475467] dark:text-slate-400">
                  Supuesto sin base de campo; calibrar con datos de la UNT. El alcance es independiente
                  de la lluvia.
                </p>
              </div>
            )}

            {demInfoOpen && (
              <p className="rounded-lg bg-[#F7F9FC] p-3 text-xs leading-relaxed text-[#475467] dark:bg-slate-900/70 dark:text-slate-400">
                A usa sectores con cota bajo el percentil 15 del DEM Copernicus de 30 m dentro del
                campus. B usa zonas reportadas por testimonio y prensa; las franjas viales se limitan
                a 40 m alrededor del perímetro. C combina relieve p30 y reportes. La influencia
                punteada SINTÉTICA se calcula aparte y no cambia con la lluvia. Canaletas nuevas de la
                UNT: no modeladas (sin datos). Ninguna capa reemplaza estudios de
                CENEPRED/SIGRID/INDECI.
              </p>
            )}

            <div className="space-y-2 pt-1 text-sm text-[#101828] dark:text-slate-200">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={simParams.drainage_obstructed}
                  onChange={(e) =>
                    updateAndRun(
                      { ...simParams, scenario_id: "personalizado", drainage_obstructed: e.target.checked },
                      0
                    )
                  }
                  className="rounded accent-[#2563EB]"
                />
                <span>Drenaje obstruido</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={simParams.antecedent_soil_saturated}
                  onChange={(e) =>
                    updateAndRun(
                      { ...simParams, scenario_id: "personalizado", antecedent_soil_saturated: e.target.checked },
                      0
                    )
                  }
                  className="rounded accent-[#2563EB]"
                />
                <span>Suelo saturado por lluvia previa</span>
              </label>
            </div>
          </div>

          {/* 4. Ejecutar o reiniciar */}
          <div className="flex gap-2.5 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onRunSimulation(simParams)}
              disabled={simLoading}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {simLoading ? "Calculando..." : "Ejecutar"}
            </button>
            <button
              type="button"
              onClick={() => updateAndRun(DEFAULT_RESET_PARAMS, 0)}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3.5 text-sm font-semibold text-[#475467] hover:bg-slate-50 hover:text-[#101828] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>
          </div>
        </section>

        {/* Derecha: Resultados destacados */}
        <section className="flex flex-col justify-between space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-7">
          {simResult ? (
            <>
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-[#475467] dark:text-slate-400">
                      Resultado experimental (simulación)
                    </div>
                    <h3 className="mt-1 text-2xl font-bold text-[#101828] dark:text-white">
                      {humanPreventiveTitle(simResult.preventive_evaluation.preventive_level, true)}
                    </h3>
                  </div>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: simResult.preventive_evaluation.level_color }}
                    title={simResult.preventive_evaluation.preventive_level}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultKpi label="Intensidad" value={`${simResult.parameters.intensity_mm_h} mm/h`} />
                  <ResultKpi label="Acumulado" value={`${simResult.simulated_accumulated_mm} mm`} />
                  <ResultKpi
                    label="Edificios con exposición ≥5%"
                    value={simResult.spatial_analysis.total_exposed_buildings}
                  />
                  <ResultKpi
                    label="Accesos dentro de la zona"
                    value={simResult.spatial_analysis.total_restricted_accesses}
                  />
                </div>

                {simResult.rainfall_reference && (
                  <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                    {simResult.rainfall_reference.is_historical_reanalysis ? (
                      <p>
                        Lluvia de referencia: {simResult.rainfall_reference.label} (reanálisis,{" "}
                        {simResult.rainfall_reference.max_hourly_mm_h} mm/h máx.,{" "}
                        {simResult.rainfall_reference.max_rolling_24h_mm} mm en 24 h).
                      </p>
                    ) : (
                      <p>
                        Lluvia de referencia: supuesto de demostración (
                        {simResult.rainfall_reference.max_hourly_mm_h} mm/h; no es una observación).
                      </p>
                    )}
                    {simResult.rainfall_reference.note && <p>{simResult.rainfall_reference.note}</p>}
                    {simResult.rainfall_reference.is_historical_reanalysis &&
                      simResult.rainfall_reference.reanalysis_near_zero &&
                      simResult.rainfall_reference.demo_assumption_mm_h != null && (
                        <p>
                          Supuesto anterior de demostración (no reanálisis):{" "}
                          {simResult.rainfall_reference.demo_assumption_mm_h} mm/h.
                        </p>
                      )}
                  </div>
                )}

                <div className="rounded-lg bg-[#F7F9FC] p-4 text-sm text-[#101828] dark:bg-slate-900/70 dark:text-slate-200">
                  {simResult.preventive_evaluation.guidance[0]}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onNavigate("map")}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-xs font-semibold text-white hover:bg-[#122C46] dark:bg-[#2563EB]"
                >
                  Ver área en Mapa UNT <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("prevention")}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                >
                  Ver Ficha Preventiva
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#475467]">Presiona Ejecutar para ver resultados.</p>
          )}
        </section>
      </div>

      {/* Sección secundaria: Cronología y detalle de edificaciones */}
      {simResult && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#101828] dark:text-white">
              <Clock className="h-4 w-4 text-[#2563EB]" />
              Perfil horario simulado
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {timelineSteps.map((st) => (
                <div
                  key={st.hour}
                  className="rounded-lg bg-[#F7F9FC] p-2.5 text-center dark:bg-slate-900/60"
                >
                  <div className="text-xs text-[#475467] dark:text-slate-400">+{st.hour}h</div>
                  <div className="text-base font-bold text-[#101828] tabular-nums dark:text-white">
                    {st.estMm} mm/h
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#101828] dark:text-white">
                <Building2 className="h-4 w-4 text-[#2563EB]" />
                Edificaciones en zona analizada ({exposedOnly.length})
              </h3>
              <input
                type="search"
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                placeholder="Buscar edificio..."
                aria-label="Buscar edificio expuesto"
                className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 py-1.5 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="mt-3 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {exposedOnly.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs dark:border-slate-800"
                >
                  <span className="truncate font-medium text-[#101828] dark:text-slate-200">
                    {displayBuildingName(b)}
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-[#475467] tabular-nums dark:text-slate-400">
                    {b.overlap_pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {simResult?.spatial_analysis?.synthetic_exposure && (
        <section className="rounded-xl border border-dashed border-cyan-500/60 bg-cyan-50/60 p-5 dark:bg-cyan-950/20">
          <h3 className="text-sm font-bold text-cyan-900 dark:text-cyan-200">
            Exposición en escenario sintético (alcance{" "}
            {simResult.spatial_analysis.synthetic_exposure.reach_m} m, azimut{" "}
            {simResult.spatial_analysis.synthetic_exposure.azimuth_deg}°)
          </h3>
          <p className="mt-1 text-xs text-cyan-900 dark:text-cyan-200">
            Parámetros arbitrarios de demostración; no es una predicción. Umbral marginal/parcial: 5%
            de la huella; accesos son puntos y el porcentaje refleja intersección geométrica. El
            alcance no depende de la lluvia.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {simResult.spatial_analysis.synthetic_exposure.buildings
              .filter((building) => building.exposure_level !== "ninguna")
              .map((building) => (
                <div
                  key={building.id}
                  className="flex justify-between gap-2 rounded border border-cyan-200/70 px-3 py-2 text-xs dark:border-cyan-900/70"
                >
                  <span className="truncate">{displayBuildingName(building)}</span>
                  <span className="shrink-0">{building.exposure_level} · {building.overlap_pct}%</span>
                </div>
              ))}
            {simResult.spatial_analysis.synthetic_exposure.accesses
              .filter((access) => access.inside_hazard_zone)
              .map((access) => (
                <div
                  key={access.id}
                  className="flex justify-between gap-2 rounded border border-cyan-200/70 px-3 py-2 text-xs dark:border-cyan-900/70"
                >
                  <span className="truncate">{access.name}</span>
                  <span className="shrink-0">{access.exposure_level} · {access.overlap_pct}%</span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultKpi({ label, value }) {
  return (
    <div className="rounded-lg bg-[#F7F9FC] p-3 dark:bg-slate-900/70">
      <div className="text-xs text-[#475467] dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[#101828] tabular-nums dark:text-white">
        {value}
      </div>
    </div>
  );
}
