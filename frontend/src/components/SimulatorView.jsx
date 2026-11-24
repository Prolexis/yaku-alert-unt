import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  RotateCcw,
  FlaskConical,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Building2,
  FileText,
} from "lucide-react";

const DEFAULT_RESET_PARAMS = {
  scenario_id: "lluvia_intensa_fen",
  intensity_mm_h: 28,
  duration_hours: 4,
  drainage_obstructed: true,
  antecedent_soil_saturated: false,
  hazard_zone_id: "lluvia_intensa_fen",
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
    if (presets[scenarioId]) {
      updateAndRun(presets[scenarioId], 0);
    } else {
      onChangeSimParams({ ...simParams, scenario_id: "personalizado" });
    }
  };

  const timelineSteps = Array.from({ length: Math.min(6, simParams.duration_hours) }, (_, idx) => {
    const hour = idx + 1;
    const factor = hour === 1 ? 0.55 : hour === 2 ? 0.9 : hour === 3 ? 1.0 : 0.7;
    const estMm = (simParams.intensity_mm_h * factor).toFixed(1);
    return { hour, estMm };
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
      {/* Encabezado Simulation Control Center */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-5 dark:border-slate-800 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
            <FlaskConical className="h-3.5 w-3.5" />
            MODO SIMULACIÓN — DATOS SINTÉTICOS
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#111827] dark:text-white sm:text-3xl">
            Simulation Control Center
          </h2>
          <p className="mt-1 text-[15px] text-[#64748B] dark:text-slate-300">
            Ensaye escenarios de lluvia extrema 100% offline con cálculo geométrico Shapely.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSimAt && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Actualizado {lastSimAt}
            </span>
          )}
          {simResult && (
            <span className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[#111827] dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-200">
              {simResult.simulation_id}
            </span>
          )}
        </div>
      </div>

      {simError && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          Error al ejecutar la simulación: {simError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Panel izquierdo: Controles agrupados */}
        <section className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#111827] dark:text-white">
              Controles de Escenario
            </h3>
            <button
              type="button"
              onClick={() => updateAndRun(DEFAULT_RESET_PARAMS, 0)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:bg-slate-50 hover:text-[#111827] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </button>
          </div>

          {/* Grupo 1: Preset */}
          <div className="space-y-2 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <label
              htmlFor="sim-preset"
              className="block text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400"
            >
              1. Escenario base
            </label>
            <select
              id="sim-preset"
              value={simParams.scenario_id}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 py-2.5 text-sm font-medium text-[#111827] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Escenario A — Lluvia Moderada (12 mm/h)</option>
              <option value="lluvia_intensa_fen">Escenario B — Lluvia Intensa FEN (28 mm/h)</option>
              <option value="escenario_extremo_fen">Escenario C — Escenario Extremo FEN (45 mm/h)</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {/* Grupo 2: Parámetros meteorológicos */}
          <div className="space-y-4 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
              2. Variables meteorológicas sintéticas
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-intensity" className="font-medium text-[#111827] dark:text-slate-200">
                  Intensidad máxima
                </label>
                <span className="font-bold text-[#1D4ED8] tabular-nums dark:text-blue-400">
                  {simParams.intensity_mm_h} mm/h
                </span>
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
                    {
                      ...simParams,
                      scenario_id: "personalizado",
                      intensity_mm_h: Number(e.target.value),
                    },
                    220
                  )
                }
                className="mt-2 w-full accent-[#2563EB]"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <label htmlFor="sim-duration" className="font-medium text-[#111827] dark:text-slate-200">
                  Duración del evento
                </label>
                <span className="font-bold text-[#1D4ED8] tabular-nums dark:text-blue-400">
                  {simParams.duration_hours} horas
                </span>
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
                    {
                      ...simParams,
                      scenario_id: "personalizado",
                      duration_hours: Number(e.target.value),
                    },
                    220
                  )
                }
                className="mt-2 w-full accent-[#2563EB]"
              />
            </div>
          </div>

          {/* Grupo 3: Terreno y DEM */}
          <div className="space-y-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
            <label
              htmlFor="sim-zone"
              className="block text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400"
            >
              3. Condiciones del terreno
            </label>
            <select
              id="sim-zone"
              value={simParams.hazard_zone_id}
              onChange={(e) =>
                updateAndRun(
                  {
                    ...simParams,
                    scenario_id: "personalizado",
                    hazard_zone_id: e.target.value,
                  },
                  0
                )
              }
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F6F8FC] px-3 py-2.5 text-sm font-medium text-[#111827] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Zona A — Sectores más bajos del campus (p15 DEM)</option>
              <option value="lluvia_intensa_fen">Zona B — Sectores bajos y medios (p30 DEM)</option>
              <option value="escenario_extremo_fen">Zona C — Cobertura amplia del campus (p50 DEM)</option>
            </select>
            <p className="rounded-lg bg-[#F6F8FC] p-2.5 text-[11px] leading-relaxed text-[#64748B] dark:bg-slate-900/60 dark:text-slate-400">
              <strong>¿Qué significa DEM (p15, p30, p50)?</strong> Es un mapa satelital de altura
              del terreno (Modelo Digital de Elevación). <em>p15</em> agrupa el 15% más bajo del
              campus donde el agua tiende a acumularse primero; <em>p30</em> y <em>p50</em> amplían
              esa área de ensayo. No representa una predicción oficial.
            </p>

            <div className="space-y-2 pt-1 text-sm text-[#111827] dark:text-slate-200">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={simParams.drainage_obstructed}
                  onChange={(e) =>
                    updateAndRun(
                      {
                        ...simParams,
                        scenario_id: "personalizado",
                        drainage_obstructed: e.target.checked,
                      },
                      0
                    )
                  }
                  className="rounded accent-[#2563EB]"
                />
                <span>Drenaje pluvial obstruido</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={simParams.antecedent_soil_saturated}
                  onChange={(e) =>
                    updateAndRun(
                      {
                        ...simParams,
                        scenario_id: "personalizado",
                        antecedent_soil_saturated: e.target.checked,
                      },
                      0
                    )
                  }
                  className="rounded accent-[#2563EB]"
                />
                <span>Suelo o superficie previamente saturada</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRunSimulation(simParams)}
            disabled={simLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${simLoading ? "animate-pulse" : ""}`} />
            {simLoading ? "Calculando intersección Shapely..." : "Ejecutar Simulación Offline"}
          </button>
        </section>

        {/* Panel derecho: Cronología + Resultados sin saltos */}
        <section className="space-y-6 lg:col-span-7">
          {/* Cronología */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
              <Clock className="h-4 w-4 text-[#1D4ED8]" />
              Cronología Sintética del Evento
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {timelineSteps.map((st) => (
                <div
                  key={st.hour}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3 text-center dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
                    Hora +{st.hour}
                  </div>
                  <div className="mt-1 text-lg font-bold text-[#1D4ED8] tabular-nums dark:text-blue-400">
                    {st.estMm}
                  </div>
                  <div className="text-[11px] text-[#64748B]">mm/h</div>
                </div>
              ))}
            </div>
          </div>

          {/* Resultados */}
          {simResult ? (
            <div className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-panel dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    {simResult.spatial_analysis.hazard_zone_name}
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-[#111827] dark:text-white">
                    {simResult.preventive_evaluation.level_label}
                  </h3>
                </div>
                <span
                  className="rounded-md px-3 py-1 text-xs font-bold text-slate-950"
                  style={{ backgroundColor: simResult.preventive_evaluation.level_color }}
                >
                  {simResult.preventive_evaluation.preventive_level}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="text-xs text-[#64748B] dark:text-slate-400">Acumulado sim.</div>
                  <div className="mt-1 text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
                    {simResult.simulated_accumulated_mm} mm
                  </div>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3.5 dark:border-orange-900/50 dark:bg-orange-950/30">
                  <div className="text-xs text-orange-900 dark:text-orange-300">Edificios en zona</div>
                  <div className="mt-1 text-2xl font-bold text-orange-600 tabular-nums dark:text-orange-400">
                    {simResult.spatial_analysis.total_exposed_buildings}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <div className="text-xs text-rose-900 dark:text-rose-300">Accesos restringidos</div>
                  <div className="mt-1 text-2xl font-bold text-rose-600 tabular-nums dark:text-rose-400">
                    {simResult.spatial_analysis.total_restricted_accesses}
                  </div>
                </div>
              </div>

              {/* Lista consultable de edificios expuestos */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                    <Building2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    Edificios que intersectan la zona ({exposedOnly.length})
                  </h4>
                  <input
                    type="search"
                    value={buildingSearch}
                    onChange={(e) => setBuildingSearch(e.target.value)}
                    placeholder="Filtrar edificio..."
                    aria-label="Filtrar edificio expuesto"
                    className="rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-2.5 py-1 text-xs text-[#111827] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {exposedOnly.length === 0 ? (
                  <p className="mt-2 text-sm text-[#64748B] dark:text-slate-400">
                    No hay edificaciones expuestas que coincidan con el filtro.
                  </p>
                ) : (
                  <div className="mt-2.5 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {exposedOnly.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2.5 text-xs dark:border-orange-900/50 dark:bg-orange-950/20"
                      >
                        <div className="flex items-center justify-between gap-2 font-semibold text-[#111827] dark:text-white">
                          <span className="truncate">{b.name}</span>
                          <span className="shrink-0 font-mono font-bold text-orange-700 tabular-nums dark:text-orange-300">
                            {b.overlap_pct}%
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400">
                          {b.status_in_scenario}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reglas activadas */}
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B] dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5 text-[#1D4ED8]" />
                  Reglas activadas ({simResult.preventive_evaluation.rules_triggered.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {simResult.preventive_evaluation.rules_triggered.map((r) => (
                    <span
                      key={r.rule_id}
                      title={`${r.description}: ${r.observed_value}`}
                      className="rounded-md border border-[#E2E8F0] bg-[#F7F9FC] px-2.5 py-1 text-xs font-medium text-[#111827] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <strong className="text-[#1D4ED8] dark:text-blue-400">{r.rule_id}</strong> ·{" "}
                      {r.observed_value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-[#111827] dark:text-slate-200">
                {simResult.preventive_evaluation.guidance.slice(0, 2).map((g, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{g}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onNavigate("map")}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F33] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#122C46] dark:bg-[#2563EB]"
                >
                  Ver en Mapa UNT <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("prevention")}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-xs font-semibold text-[#111827] transition hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                >
                  Ver Ficha Preventiva Completa
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33]">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Presione "Ejecutar Simulación Offline" para calcular los resultados.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
