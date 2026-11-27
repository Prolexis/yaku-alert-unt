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

// --- YAKU SENSE (Red de sensores IoT virtuales simulados) -------------------
export function fetchVirtualSensors() {
  return requestJson("/sensors/virtual");
}

// --- Experiencia pública Estudiante / Visitante (escenarios 2017 / 2023) ----
export function fetchPublicSimulation(presetId) {
  return requestJson(`/public/simulation/${encodeURIComponent(presetId)}`);
}

// --- Persistencia SQLite: Alertas Gestión ↔ Estudiante, Reportes y Fuentes --
export function fetchAlerts(activeOnly = false) {
  return requestJson(`/alerts?active_only=${activeOnly ? "true" : "false"}`);
}

export function issueAlert(payload) {
  return requestJson("/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveAlert(alertId) {
  return requestJson(`/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "PATCH",
  });
}

export function fetchReports() {
  return requestJson("/reports");
}

export function createReport(payload) {
  return requestJson("/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateReportStatus(reportId, status) {
  return requestJson(`/reports/${encodeURIComponent(reportId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchSourcesStatus() {
  return requestJson("/sources/status");
}

// --- Auth Demo (5 roles), Validación Humana, CAP 1.2, Confirmaciones y Continuidad
export function demoLogin(payload) {
  return requestJson("/auth/demo-login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function validateAlert(alertId, validatedByRole = "directivo", extra = {}) {
  return requestJson(`/alerts/${encodeURIComponent(alertId)}/validate`, {
    method: "PATCH",
    body: JSON.stringify({ validated_by_role: validatedByRole, ...extra }),
  });
}

export function fetchAlertCap(alertId) {
  return requestJson(`/alerts/${encodeURIComponent(alertId)}/cap?format=json`);
}

export function confirmAlertReceipt(alertId, role = "estudiante", status = "recibido") {
  return requestJson(`/alerts/${encodeURIComponent(alertId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ role, status }),
  });
}

export function fetchContinuityDecisions(activeOnly = false) {
  return requestJson(`/continuity/decisions?active_only=${activeOnly ? "true" : "false"}`);
}

export function createContinuityDecision(payload) {
  return requestJson("/continuity/decisions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveContinuityDecision(decisionId) {
  return requestJson(`/continuity/decisions/${encodeURIComponent(decisionId)}/resolve`, {
    method: "PATCH",
  });
}

export function recordSimulationRun(payload) {
  return requestJson("/simulations/history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSimulationHistory() {
  return requestJson("/simulations/history");
}

// --- WhatsApp Cloud API (Meta Graph API — Sandbox TRL 3-4) -----------------
export function fetchWhatsAppStatus() {
  return requestJson("/whatsapp/status");
}

export function sendAlertWhatsApp(alertId, payload = {}) {
  return requestJson(`/alerts/${encodeURIComponent(alertId)}/send-whatsapp`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- Simulación en vivo (Gestión -> Comunidad) + Estado dinámico por edificio
export function activateLiveSimulation(payload) {
  return requestJson("/simulation/live/activate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchLiveSimulation() {
  return requestJson("/simulation/live");
}

export function stopLiveSimulation() {
  return requestJson("/simulation/live/stop", {
    method: "POST",
  });
}

export function fetchCampusBuildingStatus(offline = false) {
  return requestJson(`/campus/building-status?offline=${offline ? "true" : "false"}`);
}
