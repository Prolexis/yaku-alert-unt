const MOBILE_BACKEND_STORAGE_KEY = "yaku_mobile_backend_url";
const ADMIN_TOKEN_STORAGE_KEY = "yaku_admin_token";
const DEFAULT_LAN_BACKEND =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_MOBILE_BACKEND_URL) ||
  "http://192.168.0.23:8000";

export function isNativeCapacitorApp() {
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  const proto = window.location?.protocol || "";
  return proto === "capacitor:" || proto === "ionic:";
}

export function isMobileAppEntry() {
  if (isNativeCapacitorApp()) return true;
  if (typeof window === "undefined") return false;
  if (import.meta.env?.VITE_MOBILE_APP === "true") return true;
  const params = new URLSearchParams(window.location.search || "");
  return params.get("mobile") === "1" || params.get("apk") === "1";
}

export function getMobileBackendOrigin() {
  if (typeof window !== "undefined") {
    try {
      const saved = (window.localStorage.getItem(MOBILE_BACKEND_STORAGE_KEY) || "").trim();
      if (saved) return saved.replace(/\/+$/, "");
    } catch {
      // ignore storage errors
    }
  }
  return DEFAULT_LAN_BACKEND.replace(/\/+$/, "");
}

export function setMobileBackendOrigin(url) {
  if (typeof window === "undefined") return;
  try {
    const clean = (url || "").trim().replace(/\/+$/, "");
    if (clean) {
      window.localStorage.setItem(MOBILE_BACKEND_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(MOBILE_BACKEND_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getApiBase() {
  if (isNativeCapacitorApp()) {
    return `${getMobileBackendOrigin()}/api`;
  }
  if (typeof window !== "undefined") {
    try {
      const custom = (window.localStorage.getItem(MOBILE_BACKEND_STORAGE_KEY) || "").trim();
      if (custom && isMobileAppEntry()) {
        return `${custom.replace(/\/+$/, "")}/api`;
      }
    } catch {
      // ignore
    }
  }
  return "/api";
}

export function getDrillWebSocketUrl() {
  if (isNativeCapacitorApp()) {
    const origin = getMobileBackendOrigin();
    const wsOrigin = origin.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
    return `${wsOrigin}/api/ws/drill`;
  }
  if (typeof window !== "undefined") {
    const custom = (() => {
      try {
        return (window.localStorage.getItem(MOBILE_BACKEND_STORAGE_KEY) || "").trim();
      } catch {
        return "";
      }
    })();
    if (custom && isMobileAppEntry()) {
      const wsOrigin = custom.replace(/\/+$/, "").replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
      return `${wsOrigin}/api/ws/drill`;
    }
    const isHttps = window.location.protocol === "https:";
    const wsProto = isHttps ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}/api/ws/drill`;
  }
  return "ws://localhost:8000/api/ws/drill";
}

async function requestJson(path, options = {}) {
  const base = getApiBase();
  const { headers: customHeaders, ...restOptions } = options;
  const res = await fetch(`${base}${path}`, {
    ...restOptions,
    headers: { "Content-Type": "application/json", ...(customHeaders || {}) },
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

export function updateReportStatus(reportId, status, verifiedByRole = null) {
  const body = { status };
  if (verifiedByRole) body.verified_by_role = verifiedByRole;
  return requestJson(`/reports/${encodeURIComponent(reportId)}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
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

export function fetchMobileLiveSimulation() {
  return requestJson("/public/live-simulation");
}

export function stopLiveSimulation() {
  return requestJson("/simulation/live/stop", {
    method: "POST",
  });
}

export function fetchCampusBuildingStatus(offline = false) {
  return requestJson(`/campus/building-status?offline=${offline ? "true" : "false"}`);
}

// --- Sincronización Web → APK Mobile (Simulacro Público + WebSockets + Push) --
export async function ensureAdminToken(role = "operador_riesgos") {
  const safeRole = role === "directivo" ? "directivo" : "operador_riesgos";
  if (typeof window !== "undefined") {
    try {
      const cached = window.sessionStorage.getItem(`${ADMIN_TOKEN_STORAGE_KEY}_${safeRole}`);
      if (cached && cached.includes(".")) return cached;
    } catch {
      // ignore
    }
  }
  const auth = await demoLogin({ quick_role: safeRole });
  if (typeof window !== "undefined" && auth?.token) {
    try {
      window.sessionStorage.setItem(`${ADMIN_TOKEN_STORAGE_KEY}_${safeRole}`, auth.token);
    } catch {
      // ignore
    }
  }
  return auth?.token || "";
}

export function fetchPublicDrillState() {
  return requestJson("/public/drill/state");
}

export async function publishDrillSession(
  { scenario_id, initial_hour = 1 },
  role = "operador_riesgos"
) {
  const token = await ensureAdminToken(role);
  return requestJson("/drill/publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Yaku-Admin-Token": token,
    },
    body: JSON.stringify({ scenario_id, initial_hour }),
  });
}

export async function controlDrillSession(
  { action, simulated_hour },
  role = "operador_riesgos"
) {
  const token = await ensureAdminToken(role);
  return requestJson("/drill/control", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Yaku-Admin-Token": token,
    },
    body: JSON.stringify({ action, simulated_hour }),
  });
}

export async function finishDrillSession(role = "operador_riesgos") {
  const token = await ensureAdminToken(role);
  return requestJson("/drill/finish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Yaku-Admin-Token": token,
    },
  });
}

export function registerMobileDevice(payload) {
  return requestJson("/public/devices/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchWebPushConfig() {
  return requestJson("/public/web-push/config");
}

export function saveWebPushSubscription(subscription, deviceId) {
  return requestJson("/public/web-push/subscribe", {
    method: "POST",
    body: JSON.stringify({ ...subscription, device_id: deviceId }),
  });
}

export function removeWebPushSubscription(subscription, deviceId) {
  return requestJson("/public/web-push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ ...subscription, device_id: deviceId }),
  });
}

export function fetchPushConfigStatus() {
  return requestJson("/public/devices/push-status");
}
