// Condiciones externas declaradas (escenario D). Funciones puras: construyen los parámetros
// de simulación que se envían al backend. El backend rechaza (400) external_conditions con
// cualquier otra zona, por eso al salir de D la lista siempre se vacía.

export const CONDITIONS_ZONE_ID = "condiciones_externas";

export const isConditionsMode = (params) => params?.hazard_zone_id === CONDITIONS_ZONE_ID;

// Entrar a D: sin lluvia (0 mm/h) para evaluar solo las condiciones; el alcance lo definen las reglas.
export const conditionsModeParams = (base = {}) => ({
  ...base,
  scenario_id: "personalizado",
  intensity_mm_h: 0,
  duration_hours: 1,
  drainage_obstructed: false,
  antecedent_soil_saturated: false,
  hazard_zone_id: CONDITIONS_ZONE_ID,
  synthetic_reach_m: undefined,
  external_conditions: [],
});

// Activar/desactivar una condición, manteniéndose en D.
export const toggledConditionParams = (params, conditionId) => {
  const current = params.external_conditions || [];
  const next = current.includes(conditionId)
    ? current.filter((id) => id !== conditionId)
    : [...current, conditionId];
  return {
    ...params,
    scenario_id: "personalizado",
    hazard_zone_id: CONDITIONS_ZONE_ID,
    synthetic_reach_m: undefined,
    external_conditions: next,
  };
};

// Cambiar a otra zona (A/B/C) o a D desde el selector de zona.
export const zoneChangeParams = (params, zoneId) => {
  if (zoneId === CONDITIONS_ZONE_ID) {
    return {
      ...params,
      scenario_id: "personalizado",
      hazard_zone_id: zoneId,
      synthetic_reach_m: undefined,
      external_conditions: params.external_conditions || [],
    };
  }
  const next = { ...params, scenario_id: "personalizado", hazard_zone_id: zoneId, external_conditions: [] };
  if (isConditionsMode(params)) next.synthetic_reach_m = undefined; // el alcance de D no se hereda
  return next;
};

// Solo se enlazan URL https (las fuentes vienen de un archivo de datos editable).
export const safeHttpsUrl = (url) => (/^https:\/\//.test(url || "") ? url : null);
