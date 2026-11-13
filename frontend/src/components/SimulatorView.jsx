import React from "react";
import { Play, FlaskConical, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SimulatorView({
  simParams,
  onChangeSimParams,
  simResult,
  simLoading,
  onRunSimulation,
  onNavigate,
}) {
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
      onChangeSimParams(presets[scenarioId]);
      onRunSimulation(presets[scenarioId]);
    } else {
      onChangeSimParams({ ...simParams, scenario_id: "personalizado" });
    }
  };

  // Cronología sintética del evento simulado
  const timelineSteps = Array.from({ length: Math.min(6, simParams.duration_hours) }, (_, idx) => {
    const hour = idx + 1;
    const factor = hour === 1 ? 0.55 : hour === 2 ? 0.9 : hour === 3 ? 1.0 : 0.7;
    const estMm = (simParams.intensity_mm_h * factor).toFixed(1);
    return { hour, estMm };
  });

  return (
    <div className="space-y-6">
      {/* Banner explícito de Simulación */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-400/30 p-2">
            <FlaskConical className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider">
              MODO SIMULACIÓN OFFLINE — ESCENARIO SINTÉTICO
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              Funciona sin conexión a internet. Permite probar lluvias extremas, drenaje obstruido y
              exposición espacial en el campus UNT sin emitir alertas reales.
            </p>
          </div>
        </div>
        {simResult && (
          <span className="rounded-lg bg-amber-200 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-950 dark:bg-amber-900 dark:text-amber-100">
            {simResult.simulation_id}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controles del simulador */}
        <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-card dark:border-slate-800 dark:bg-[#0B1F33] lg:col-span-5">
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
            Parámetros del Escenario
          </h2>

          <div>
            <label htmlFor="sim-preset" className="block text-xs font-semibold text-[#64748B] dark:text-slate-300">
              Escenario predefinido
            </label>
            <select
              id="sim-preset"
              value={simParams.scenario_id}
              onChange={(e) => applyPreset(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs font-medium text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Escenario A — Lluvia Moderada (12 mm/h)</option>
              <option value="lluvia_intensa_fen">Escenario B — Lluvia Intensa FEN (28 mm/h)</option>
              <option value="escenario_extremo_fen">Escenario C — Escenario Extremo FEN (45 mm/h)</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="sim-intensity" className="font-semibold text-[#64748B] dark:text-slate-300">
                Intensidad máxima simulada
              </label>
              <span className="font-bold text-[#2563EB] dark:text-tealbrand-400">
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
                onChangeSimParams({
                  ...simParams,
                  scenario_id: "personalizado",
                  intensity_mm_h: Number(e.target.value),
                })
              }
              className="mt-2 w-full accent-[#2563EB]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="sim-duration" className="font-semibold text-[#64748B] dark:text-slate-300">
                Duración del evento
              </label>
              <span className="font-bold text-[#2563EB] dark:text-tealbrand-400">
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
                onChangeSimParams({
                  ...simParams,
                  scenario_id: "personalizado",
                  duration_hours: Number(e.target.value),
                })
              }
              className="mt-2 w-full accent-[#2563EB]"
            />
          </div>

          <div>
            <label htmlFor="sim-zone" className="block text-xs font-semibold text-[#64748B] dark:text-slate-300">
              Zona de peligro sintética (Shapely)
            </label>
            <select
              id="sim-zone"
              value={simParams.hazard_zone_id}
              onChange={(e) =>
                onChangeSimParams({
                  ...simParams,
                  scenario_id: "personalizado",
                  hazard_zone_id: e.target.value,
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs font-medium text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="lluvia_moderada">Zona A — Anegamiento menor oeste</option>
              <option value="lluvia_intensa_fen">Zona B — Escorrentía oeste-centro</option>
              <option value="escenario_extremo_fen">Zona C — Anegamiento amplio campus</option>
            </select>
          </div>

          <div className="space-y-2.5 pt-1 text-xs text-[#0F172A] dark:text-slate-200">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={simParams.drainage_obstructed}
                onChange={(e) =>
                  onChangeSimParams({
                    ...simParams,
                    scenario_id: "personalizado",
                    drainage_obstructed: e.target.checked,
                  })
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
                  onChangeSimParams({
                    ...simParams,
                    scenario_id: "personalizado",
                    antecedent_soil_saturated: e.target.checked,
                  })
                }
                className="rounded accent-[#2563EB]"
              />
              <span>Suelo o superficie previamente saturada</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => onRunSimulation(simParams)}
            disabled={simLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-xs font-bold text-white shadow-soft transition hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {simLoading ? "Calculando intersección Shapely..." : "Ejecutar Simulación Offline"}
          </button>
        </section>

        {/* Resultados y Cronología */}
        <section className="space-y-6 lg:col-span-7">
          {/* Cronología del evento simulado */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
              <Clock className="h-4 w-4 text-[#14B8A6]" />
              Cronología Sintética del Evento
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {timelineSteps.map((st) => (
                <div
                  key={st.hour}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                    Hora +{st.hour}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[#2563EB] dark:text-tealbrand-400">
                    {st.estMm}
                  </div>
                  <div className="text-[10px] text-[#64748B]">mm/h</div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel de resultados Shapely + Motor Preventivo */}
          {simResult && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-card dark:border-slate-800 dark:bg-[#0B1F33]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Resultado de Simulación
                  </span>
                  <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">
                    {simResult.preventive_evaluation.level_label}
                  </h3>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-slate-950"
                  style={{ backgroundColor: simResult.preventive_evaluation.level_color }}
                >
                  {simResult.preventive_evaluation.preventive_level}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F8FAFC] p-3 dark:bg-slate-900/70">
                  <div className="text-[11px] text-[#64748B] dark:text-slate-400">Acumulado sim.</div>
                  <div className="mt-1 text-lg font-bold text-[#0F172A] dark:text-white">
                    {simResult.simulated_accumulated_mm} mm
                  </div>
                </div>
                <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
                  <div className="text-[11px] text-orange-700 dark:text-orange-300">Edificios expuestos</div>
                  <div className="mt-1 text-lg font-bold text-orange-600 dark:text-orange-400">
                    {simResult.spatial_analysis.total_exposed_buildings}
                  </div>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                  <div className="text-[11px] text-rose-700 dark:text-rose-300">Accesos restringidos</div>
                  <div className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
                    {simResult.spatial_analysis.total_restricted_accesses}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-[#64748B] dark:text-slate-300">
                {simResult.preventive_evaluation.guidance.slice(0, 2).map((g, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14B8A6]" />
                    <span>{g}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onNavigate("map")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1F33] px-4 py-2 text-xs font-semibold text-white hover:bg-[#122C46] dark:bg-[#2563EB]"
                >
                  Ver en Mapa Interactivo <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("prevention")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                >
                  Ver Ficha Preventiva Completa
                </button>
              </div>
            </div>
          )}

          {!simResult && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-6 text-xs text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33]">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Presione "Ejecutar Simulación Offline" para calcular los resultados espaciales y preventivos.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
