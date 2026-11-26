/**
 * Utilidades deterministas para YAKU SENSE (Red IoT virtual simulada).
 * Sincroniza las lecturas de S01-S06 con la hora activa de hydro.py y gestiona
 * el estado de comunicación simulado sin alterar los cálculos hidrológicos.
 */

export const SENSOR_STATUS_STYLES = {
  active_virtual: {
    label: "Conectado virtualmente",
    shortLabel: "Virtual con datos",
    stroke: "#0369A1",
    fill: "#0EA5E9",
    badgeClass:
      "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800",
  },
  no_reading: {
    label: "Sin lectura disponible",
    shortLabel: "Sin lectura",
    stroke: "#475569",
    fill: "#94A3B8",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  disconnected_sim: {
    label: "Comunicación interrumpida (simulada)",
    shortLabel: "Desconectado [SIM]",
    stroke: "#B45309",
    fill: "#F59E0B",
    badgeClass:
      "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
  },
};

export const CATEGORY_SHORT_CODE = {
  pluviometria: "LL",
  nivel_agua: "NV",
  humedad_suelo: "HS",
  ambiental: "TA",
};

/**
 * Combina el catálogo estático GeoJSON con las lecturas de la última corrida
 * dinámica (`hydroRun.virtual_sensors`) si existe.
 */
export function mergeVirtualSensors(catalog, hydroRun) {
  const features = catalog?.features || [];
  const runById = new Map((hydroRun?.virtual_sensors || []).map((s) => [s.id, s]));

  return features.map((feat) => {
    const props = feat.properties || {};
    const runData = runById.get(props.id);
    const coords = feat.geometry?.coordinates || runData?.coordinates || [0, 0];

    return {
      ...props,
      coordinates: coords,
      lon: coords[0],
      lat: coords[1],
      scenario_label: runData?.scenario_label || null,
      scenario_data_nature: runData?.scenario_data_nature || null,
      run_id: runData?.run_id || null,
      virtual_status: runData?.virtual_status || (props.id === "S05" || props.id === "S06" ? "no_reading" : "no_reading"),
      last_value: runData?.last_value ?? null,
      peak_value: runData?.peak_value ?? null,
      peak_hour: runData?.peak_hour ?? null,
      series: runData?.series || [],
      iot_architecture: runData?.iot_architecture || props.iot_architecture || catalog?.iot_architecture || null,
    };
  });
}

/**
 * Resuelve la lectura visible de un sensor para la hora `activeHour` (1-indexed),
 * respetando si tiene una desconexión simulada activa (conserva último valor sin
 * reemplazarlo por 0).
 */
export function resolveSensorReading(sensor, activeHour, disconnectedEntry) {
  if (!sensor) {
    return {
      statusKey: "no_reading",
      value: null,
      displayValue: "Sin lectura disponible",
      hourLabel: "—",
      ageHours: 0,
      isFrozen: false,
      accumulatedMm: null,
    };
  }

  const series = sensor.series || [];
  const hasSeries = series.length > 0 && sensor.virtual_status === "active_virtual";

  if (disconnectedEntry) {
    const frozenHour = disconnectedEntry.hour ?? activeHour ?? null;
    const ageHours =
      activeHour && frozenHour ? Math.max(0, Number(activeHour) - Number(frozenHour)) : 0;
    const val = disconnectedEntry.value;
    return {
      statusKey: "disconnected_sim",
      value: val,
      displayValue:
        val === null || val === undefined
          ? "Sin lectura previa"
          : formatSensorValue(val, sensor.unit),
      hourLabel: disconnectedEntry.label || (frozenHour ? `h+${frozenHour}` : "—"),
      ageHours,
      isFrozen: true,
      accumulatedMm: disconnectedEntry.accumulatedMm ?? null,
    };
  }

  if (!hasSeries) {
    return {
      statusKey: "no_reading",
      value: null,
      displayValue: "Sin lectura disponible",
      hourLabel: "—",
      ageHours: 0,
      isFrozen: false,
      accumulatedMm: null,
    };
  }

  const targetHour = activeHour || series[series.length - 1].hour;
  const point =
    series.find((p) => p.hour === targetHour) || series[series.length - 1];

  return {
    statusKey: "active_virtual",
    value: point.value,
    displayValue: formatSensorValue(point.value, sensor.unit),
    hourLabel: point.label || `h+${point.hour}`,
    ageHours: 0,
    isFrozen: false,
    accumulatedMm: point.accumulated_mm ?? null,
  };
}

export function formatSensorValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Sin lectura disponible";
  }
  const num = Number(value);
  const formatted = unit === "cm" ? num.toFixed(1) : num.toFixed(1);
  return `${formatted} ${unit}`;
}
