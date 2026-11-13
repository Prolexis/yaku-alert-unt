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

export function fetchLiveEvaluation(offline = false) {
  return requestJson(`/preventive/evaluate?offline=${offline ? "true" : "false"}`);
}

export function runSimulation(payload) {
  return requestJson("/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchProtocols() {
  return requestJson("/protocols");
}
