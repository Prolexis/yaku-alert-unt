const API_BASE = "/api";

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${res.status}: ${text}`);
  }
  return res.json();
}

export function fetchWeather(offline = false) {
  return requestJson(`/weather?offline=${offline ? "true" : "false"}`);
}

export function fetchCampusLayers() {
  return requestJson("/campus/layers");
}

export function fetchLiveEvaluation(offline = false, conditions = []) {
  const params = new URLSearchParams({ offline: offline ? "true" : "false" });
  conditions.forEach((c) => params.append("conditions", c));
  return requestJson(`/preventive/evaluate?${params.toString()}`);
}

export function fetchConditionsCatalog() {
  return requestJson("/conditions");
}

export const fetchConditions = fetchConditionsCatalog;

export function runSimulation(payload) {
  return requestJson("/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchProtocols() {
  return requestJson("/protocols");
}

// --- Simulación dinámica (agua modelada por hora, capa exploratoria) ---------
export function fetchHydroPresets() {
  return requestJson("/hydro/presets");
}

export function fetchHydroForecast(offline = false, params = {}) {
  const query = new URLSearchParams({ offline: offline ? "true" : "false" });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });
  return requestJson(`/hydro/forecast?${query.toString()}`);
}

export function fetchHydroRun(payload) {
  return requestJson("/hydro/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
