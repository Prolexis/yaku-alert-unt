import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  CloudRain,
  FlaskConical,
  MapPin,
  Moon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  fetchCampusLayers,
  fetchLiveEvaluation,
  fetchPublicDrillState,
  fetchPublicSimulation,
  fetchWeather,
  getDrillWebSocketUrl,
  getMobileBackendOrigin,
  isNativeCapacitorApp,
  registerMobileDevice,
  setMobileBackendOrigin,
} from "../../services/api";
import { buildCampusCatalog, getFeatureDisplayName } from "../../utils/campusCatalog";
import { renderEvacuationLayers } from "../../utils/evacuationLayers";
import { formatLimaTime, normalizeText } from "../../utils/formatters";
import BrandLogo from "../ui/BrandLogo";

const UNT_CENTER = [-8.11473, -79.03923];

const WATER_STYLES = {
  leve: { label: "Leve (2–5 cm)", color: "#38BDF8", fillColor: "#BAE6FD", fillOpacity: 0.68 },
  moderada: { label: "Moderada (5–15 cm)", color: "#0284C7", fillColor: "#38BDF8", fillOpacity: 0.74 },
  alta: { label: "Alta (≥ 15 cm)", color: "#1E40AF", fillColor: "#1D4ED8", fillOpacity: 0.8 },
};

const QUICK_PLACES = [
  "Comedor Universitario",
  "Biblioteca Central",
  "Rectorado",
  "Ingeniería de Sistemas",
  "Puerta 4",
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

function getOrCreateDeviceId() {
  const key = "yaku_mobile_device_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `yaku-android-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return "yaku-android-session";
  }
}

function hasSeenNotification(notifId) {
  if (!notifId) return true;
  try {
    const raw = window.localStorage.getItem("yaku_seen_notif_ids") || "[]";
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(notifId);
  } catch {
    return false;
  }
}

function markSeenNotification(notifId) {
  if (!notifId) return;
  try {
    const raw = window.localStorage.getItem("yaku_seen_notif_ids") || "[]";
    const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    if (!list.includes(notifId)) {
      const next = [...list.slice(-40), notifId];
      window.localStorage.setItem("yaku_seen_notif_ids", JSON.stringify(next));
    }
  } catch {
    // ignore
  }
}

function loadCachedJson(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveCachedJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getGeometryCenter(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
  }
  const coords =
    geometry.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;
  if (!Array.isArray(coords) || !coords.length) return null;
  let sumLat = 0;
  let sumLon = 0;
  coords.forEach(([lon, lat]) => {
    sumLat += lat;
    sumLon += lon;
  });
  return { lat: sumLat / coords.length, lon: sumLon / coords.length };
}

function buildFacilityRecommendations({
  facility,
  mapContext,
  impact,
  displayHour,
  nearestMeetingPoint,
  nearReportedZone,
  liveEval,
}) {
  if (!facility) {
    return { badge: "", tone: "neutral", items: [] };
  }

  const mpText = nearestMeetingPoint
    ? `${nearestMeetingPoint.name} (~${nearestMeetingPoint.distM} m)`
    : "los puntos de encuentro verdes más cercanos en el mapa";

  // CONTEXTO B: SIMULACRO — recomendaciones dinámicas según la situación modelada del edificio y la hora
  if (mapContext === "drill") {
    const hasImpact = impact && impact.first_hour_affected !== null && impact.first_hour_affected !== undefined;
    const depth = Number(impact?.max_depth_cm || 0);
    const firstHour = Number(impact?.first_hour_affected || 0);

    if (hasImpact && firstHour <= displayHour) {
      if (depth >= 15) {
        return {
          badge: `Simulacro h+${displayHour} · Acumulación alta (${depth} cm)`,
          tone: "danger",
          items: [
            `Evita salir a nivel de calle desde ${facility.name}: el modelo estima ${depth} cm de agua en el entorno desde h+${firstHour}.`,
            "Resguárdate en pisos superiores del pabellón y mantente alejado de tableros eléctricos, tomas bajas o sótanos.",
            `Si Defensa Civil indica evacuación, desplázate por veredas altas hacia ${mpText}.`,
          ],
        };
      }
      if (depth >= 5) {
        return {
          badge: `Simulacro h+${displayHour} · Acumulación moderada (${depth} cm)`,
          tone: "warning",
          items: [
            `Evita transitar por accesos bajos alrededor de ${facility.name} (${depth} cm modelados desde h+${firstHour}).`,
            "Permanece bajo techo en un nivel seguro hasta que disminuya la escorrentía superficial.",
            `Punto de encuentro elevado más cercano: ${mpText}.`,
          ],
        };
      }
      return {
        badge: `Simulacro h+${displayHour} · Encharcamiento leve (${depth} cm)`,
        tone: "warning",
        items: [
          `Se modela acumulación leve (${depth} cm) en veredas o accesos de ${facility.name} desde h+${firstHour}.`,
          "Transita con precaución por zonas altas y evita cunetas o depresiones del pavimento.",
          `Si la lluvia persiste, prioriza el resguardo en pisos altos o en ${mpText}.`,
        ],
      };
    }

    if (hasImpact && firstHour > displayHour) {
      return {
        badge: `Simulacro h+${displayHour} · Impacto previsto en h+${firstHour}`,
        tone: "info",
        items: [
          `En h+${displayHour} el entorno de ${facility.name} aún no presenta aniego, pero el modelo proyecta hasta ${depth} cm desde h+${firstHour}.`,
          `Aprovecha esta ventana preventiva para trasladarte con calma hacia ${mpText} o ubicarte en pisos superiores.`,
          "Evita desplazarte hacia sectores bajos como Puerta 4 o Av. Jesús de Nazareth.",
        ],
      };
    }

    return {
      badge: `Simulacro h+${displayHour} · Sin acumulación significativa`,
      tone: "safe",
      items: [
        `${facility.name} no registra acumulación superficial significativa en el escenario simulado actual.`,
        "Puedes permanecer bajo resguardo en esta instalación; evita caminar innecesariamente hacia sectores bajos inundados.",
        `Punto de encuentro referencial más cercano: ${mpText}.`,
      ],
    };
  }

  // CONTEXTO A: MONITOREO ACTUAL — recomendaciones según tipo de punto, cercanía a zonas históricas y punto seguro más cercano
  if (facility.typeId === "meeting_point") {
    return {
      badge: "Zona referencial en cota alta",
      tone: "safe",
      items: [
        `${facility.name} fue verificado sobre el modelo de elevación (DEM 10 m) como sector libre de aniego en 2017 y 2023.`,
        "Úsalo como punto de reunión si te encuentras en pabellones cercanos durante una lluvia intensa.",
        "Recuerda que es una referencia técnica (TRL 3–4) y no reemplaza la señalización oficial de Defensa Civil UNT.",
      ],
    };
  }

  if (facility.typeId === "reported_zone" || nearReportedZone) {
    const zoneName =
      facility.typeId === "reported_zone"
        ? facility.name
        : nearReportedZone?.label || "un sector con antecedentes de aniego";
    return {
      badge: "Sector con antecedente histórico de aniego",
      tone: "warning",
      items: [
        facility.typeId === "reported_zone"
          ? `${facility.name} registra antecedentes documentados de acumulación superficial en lluvias pasadas (2017/2023).`
          : `${facility.name} se ubica muy cerca de ${zoneName} (~${nearReportedZone.distM} m), sector con antecedente de aniego.`,
        "Si el pronóstico escala a lluvia intensa, evita permanecer en exteriores o accesos a nivel de pista y resguárdate en pisos superiores.",
        `Ruta preventiva sugerida hacia cota alta: ${mpText}.`,
      ],
    };
  }

  if (facility.typeId === "acceso") {
    return {
      badge: "Acceso perimetral del campus",
      tone: "info",
      items: [
        `Durante lluvias fuertes, accesos como ${facility.name} pueden recibir escorrentía desde las avenidas colindantes.`,
        "Evita cruzar pistas con agua en movimiento y verifica si otro ingreso en cota más alta está despejado.",
        `Punto de encuentro interior más cercano: ${mpText}.`,
      ],
    };
  }

  const preventiveActive =
    liveEval?.preventive_level === "PREPARACION_CRITICA" ||
    liveEval?.preventive_level === "ATENCION_PREVENTIVA";

  let buildingTip = `En monitoreo actual no hay aniego en ${facility.name}. Puedes activar «Simulacro 2017/2023» para ver cómo responde este edificio ante lluvias extremas.`;
  if (facility.typeId === "biblioteca_auditorio") {
    buildingTip = `En ${facility.name}, ante lluvia intensa, resguarda equipos y permanece en niveles superiores alejado de ventanales o sótanos.`;
  } else if (facility.typeId === "comedor_servicios") {
    buildingTip = `En ${facility.name}, si inicia lluvia fuerte, evita patios abiertos o rampas húmedas y sigue las indicaciones del personal.`;
  }

  return {
    badge: preventiveActive ? "Monitoreo preventivo activo" : "Condición normal en monitoreo actual",
    tone: preventiveActive ? "warning" : "safe",
    items: [
      buildingTip,
      `Tu punto de encuentro elevado más cercano desde aquí es ${mpText}.`,
      "Sigue únicamente los comunicados oficiales de la UNT y Defensa Civil.",
    ],
  };
}

export default function YakuMobileApp() {
  // Tema claro / oscuro
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem("yaku_theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem("yaku_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Datos base de monitoreo y cartografía (con caché offline honesta)
  const [weather, setWeather] = useState(() => loadCachedJson("yaku_mobile_cache_weather"));
  const [liveEval, setLiveEval] = useState(() => loadCachedJson("yaku_mobile_cache_eval"));
  const [campusLayers, setCampusLayers] = useState(() => loadCachedJson("yaku_mobile_cache_layers"));
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine === false : false
  );
  const [wsConnected, setWsConnected] = useState(false);

  // Contexto del mapa: "monitoring" (Contexto A) | "drill" (Contexto B)
  const [mapContext, setMapContext] = useState("monitoring");

  // Estado del simulacro sincronizado desde el servidor
  const [drillSession, setDrillSession] = useState(null);
  const lastRevisionRef = useRef(-1);
  const simCacheRef = useRef({});
  const [activeSimData, setActiveSimData] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [displayHour, setDisplayHour] = useState(1);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localScenarioId, setLocalScenarioId] = useState("evento_2017_03");

  // Buscador y selección de instalación
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Bottom sheet: "collapsed" | "expanded"
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // Notificaciones y configuración de conexión
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("yaku_mobile_notif_enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [notifPermission, setNotifPermission] = useState("prompt");
  const [activeBannerNotif, setActiveBannerNotif] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(() => getMobileBackendOrigin());
  const [pushStatusInfo, setPushStatusInfo] = useState(null);

  // Referencias Leaflet
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseGroupRef = useRef(null);
  const attentionGroupRef = useRef(null);
  const evacuationGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const focusGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const fittedRef = useRef(false);
  const waterLayersRef = useRef([]);
  const builtWaterKeyRef = useRef("");

  const catalog = useMemo(() => buildCampusCatalog(campusLayers, null), [campusLayers]);

  const filteredCatalog = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) {
      return catalog
        .filter(
          (c) =>
            c.typeId === "facultad" ||
            c.typeId === "comedor_servicios" ||
            c.typeId === "biblioteca_auditorio" ||
            c.typeId === "acceso"
        )
        .slice(0, 8);
    }
    return catalog.filter((c) => c.searchText.includes(q)).slice(0, 8);
  }, [catalog, query]);

  // Cargar un escenario de simulación (con caché en memoria y localStorage para no recargar mallas)
  const ensureSimulationLoaded = useCallback(async (scenarioId) => {
    if (!scenarioId) return null;
    if (simCacheRef.current[scenarioId]) {
      setActiveSimData(simCacheRef.current[scenarioId]);
      return simCacheRef.current[scenarioId];
    }
    const localCached = loadCachedJson(`yaku_mobile_sim_${scenarioId}`);
    if (localCached) {
      simCacheRef.current[scenarioId] = localCached;
      setActiveSimData(localCached);
    }
    setSimLoading(true);
    try {
      const data = await fetchPublicSimulation(scenarioId);
      simCacheRef.current[scenarioId] = data;
      saveCachedJson(`yaku_mobile_sim_${scenarioId}`, data);
      setActiveSimData(data);
      return data;
    } catch {
      return localCached || null;
    } finally {
      setSimLoading(false);
    }
  }, []);

  // Enfocar una instalación en el mapa y abrir su ficha en el bottom sheet
  const focusFacilityOnMap = useCallback(
    (facilityIdOrName, customExplanation = null, targetHour = null) => {
      if (!catalog.length) return;
      const needle = normalizeText(String(facilityIdOrName || ""));
      const item =
        catalog.find((c) => String(c.id) === String(facilityIdOrName)) ||
        catalog.find((c) => normalizeText(c.displayLabel).includes(needle)) ||
        catalog[0];

      if (!item) return;

      if (targetHour !== null && targetHour !== undefined) {
        setDisplayHour(Number(targetHour) || 1);
      }

      setSelectedFacility({
        id: item.id,
        name: item.displayLabel,
        typeId: item.typeId,
        typeLabel: item.typeLabel,
        verified: item.verificationStatus === "Verificado",
        geometry: item.geometry,
        center: item.center,
        customExplanation,
      });
      setShowRecommendations(false);
      setSheetExpanded(true);
      setSearchOpen(false);

      const map = mapInstanceRef.current;
      const focusGroup = focusGroupRef.current;
      if (map && focusGroup && item.geometry) {
        focusGroup.clearLayers();
        const lyr = L.geoJSON(item.geometry, {
          style: {
            color: "#00B4D8",
            weight: 3.5,
            fillColor: "#0284C7",
            fillOpacity: 0.55,
          },
          pointToLayer: (_f, latlng) =>
            L.circleMarker(latlng, {
              radius: 10,
              color: "#FFFFFF",
              weight: 3,
              fillColor: "#0284C7",
              fillOpacity: 0.95,
            }),
        }).addTo(focusGroup);

        if (item.center) {
          map.flyTo([item.center.lat, item.center.lon], 18, { duration: 0.75 });
        } else {
          const b = lyr.getBounds();
          if (b.isValid()) map.fitBounds(b, { maxZoom: 18, padding: [40, 40] });
        }
      }
    },
    [catalog]
  );

  // Abrir directamente la ubicación y hora simulada al tocar una notificación
  const handleOpenFromNotification = useCallback(
    async (notif) => {
      if (!notif) return;
      setActiveBannerNotif(null);
      const scenarioId = notif.scenario_id || "evento_2017_03";
      const hr = Number(notif.simulated_hour) || 1;
      setLocalScenarioId(scenarioId);
      setMapContext("drill");
      setDisplayHour(hr);
      setSheetExpanded(true);
      await ensureSimulationLoaded(scenarioId);

      if (notif.facility_id || notif.facility_name) {
        focusFacilityOnMap(
          notif.facility_id || notif.facility_name,
          notif.body,
          hr
        );
      } else if (notif.lat && notif.lon && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([Number(notif.lat), Number(notif.lon)], 17, {
          duration: 0.75,
        });
      }
    },
    [ensureSimulationLoaded, focusFacilityOnMap]
  );

  // Disparar notificación nativa (Capacitor LocalNotifications / Web Notification) + banner táctil
  const triggerDeviceNotification = useCallback(
    async (notif) => {
      if (!notif || !notif.notification_id) return;
      if (hasSeenNotification(notif.notification_id)) return;
      markSeenNotification(notif.notification_id);

      // Siempre mostrar aviso interactivo dentro de la app si está abierta
      setActiveBannerNotif(notif);

      if (!notificationsEnabled) return;

      // 1. Si corre en Android nativo con Capacitor LocalNotifications
      if (isNativeCapacitorApp() && LocalNotifications) {
        try {
          let perm = await LocalNotifications.checkPermissions();
          if (perm?.display !== "granted") {
            perm = await LocalNotifications.requestPermissions();
          }
          if (perm?.display === "granted") {
            const numericId = Math.abs(
              Array.from(String(notif.notification_id)).reduce(
                (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
                7
              )
            );
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: numericId || 1001,
                  title: notif.title || "YAKU ALERT · SIMULACRO",
                  body: `${notif.body}\n${notif.subtitle || "Simulación educativa. No es una emergencia real."}`,
                  extra: notif,
                },
              ],
            });
            return;
          }
        } catch {
          // fallback a Web Notification
        }
      }

      // 2. Fallback Web Notification API
      if (typeof window !== "undefined" && "Notification" in window) {
        if (window.Notification.permission === "granted") {
          try {
            const n = new window.Notification(notif.title || "YAKU ALERT · SIMULACRO", {
              body: `${notif.body} (${notif.subtitle || "Simulación educativa"})`,
              tag: notif.notification_id,
            });
            n.onclick = () => {
              window.focus?.();
              handleOpenFromNotification(notif);
            };
          } catch {
            // ignore
          }
        }
      }
    },
    [notificationsEnabled, handleOpenFromNotification]
  );

  // Configurar listeners nativos de Capacitor (notificaciones tocadas, barra de estado y botón Atrás de Android)
  useEffect(() => {
    const listeners = [];

    if (isNativeCapacitorApp()) {
      StatusBar.setBackgroundColor({ color: "#0B2545" }).catch(() => {});
      StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch(() => {});
    }

    if (LocalNotifications?.addListener) {
      Promise.resolve(
        LocalNotifications.addListener("localNotificationActionPerformed", (evt) => {
          const extra = evt?.notification?.extra;
          if (extra) handleOpenFromNotification(extra);
        })
      )
        .then((h) => listeners.push(h))
        .catch(() => {});
    }

    if (isNativeCapacitorApp() && PushNotifications?.addListener) {
      Promise.resolve(
        PushNotifications.addListener("pushNotificationActionPerformed", (evt) => {
          const data = evt?.notification?.data;
          if (data) handleOpenFromNotification(data);
        })
      )
        .then((h) => listeners.push(h))
        .catch(() => {});

      Promise.resolve(
        PushNotifications.addListener("registration", (token) => {
          if (token?.value) {
            registerMobileDevice({
              device_id: getOrCreateDeviceId(),
              fcm_token: token.value,
              platform: "android",
              notifications_enabled: notificationsEnabled,
            }).catch(() => {});
          }
        })
      )
        .then((h) => listeners.push(h))
        .catch(() => {});
    }

    if (CapApp?.addListener) {
      Promise.resolve(
        CapApp.addListener("backButton", () => {
          if (settingsModalOpen) {
            setSettingsModalOpen(false);
          } else if (searchOpen) {
            setSearchOpen(false);
          } else if (selectedFacility) {
            setSelectedFacility(null);
            setSheetExpanded(false);
          } else if (sheetExpanded) {
            setSheetExpanded(false);
          } else if (mapContext === "drill") {
            setMapContext("monitoring");
          }
        })
      )
        .then((h) => listeners.push(h))
        .catch(() => {});
    }

    return () => {
      listeners.forEach((h) => h?.remove?.());
    };
  }, [
    handleOpenFromNotification,
    notificationsEnabled,
    settingsModalOpen,
    searchOpen,
    selectedFacility,
    sheetExpanded,
    mapContext,
  ]);

  // Solicitar permiso de notificaciones de forma contextual (Android 13+ / Web)
  const handleRequestAndToggleNotifications = async (nextEnabled) => {
    setNotificationsEnabled(nextEnabled);
    try {
      window.localStorage.setItem("yaku_mobile_notif_enabled", nextEnabled ? "true" : "false");
    } catch {
      // ignore
    }

    if (nextEnabled) {
      if (isNativeCapacitorApp() && LocalNotifications?.requestPermissions) {
        try {
          const perm = await LocalNotifications.requestPermissions();
          setNotifPermission(perm?.display || "granted");
        } catch {
          // ignore
        }
      } else if (typeof window !== "undefined" && "Notification" in window) {
        try {
          const perm = await window.Notification.requestPermission();
          setNotifPermission(perm);
        } catch {
          // ignore
        }
      }
    }

    try {
      const resp = await registerMobileDevice({
        device_id: getOrCreateDeviceId(),
        platform: isNativeCapacitorApp() ? "android" : "web",
        notifications_enabled: nextEnabled,
      });
      if (resp?.push_status) setPushStatusInfo(resp.push_status);
    } catch {
      // ignore offline
    }
  };

  // Carga inicial de datos meteorológicos, capas GIS y registro del dispositivo
  const loadInitialData = useCallback(async () => {
    try {
      const [w, ev, layers, drillSnap] = await Promise.all([
        fetchWeather(false),
        fetchLiveEvaluation(false, []),
        fetchCampusLayers(),
        fetchPublicDrillState().catch(() => null),
      ]);
      setWeather(w);
      setLiveEval(ev);
      setCampusLayers(layers);
      setIsOffline(false);
      saveCachedJson("yaku_mobile_cache_weather", w);
      saveCachedJson("yaku_mobile_cache_eval", ev);
      saveCachedJson("yaku_mobile_cache_layers", layers);

      if (drillSnap?.push_status) {
        setPushStatusInfo(drillSnap.push_status);
      }
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    registerMobileDevice({
      device_id: getOrCreateDeviceId(),
      platform: isNativeCapacitorApp() ? "android" : "web",
      notifications_enabled: notificationsEnabled,
    })
      .then((r) => {
        if (r?.push_status) setPushStatusInfo(r.push_status);
      })
      .catch(() => {});
  }, [loadInitialData, notificationsEnabled]);

  // Aplicar un snapshot de estado de simulacro (con control de revisión monótona)
  const applyDrillSnapshot = useCallback(
    async (payload) => {
      const sess = payload?.session;
      if (!sess) return;
      const rev = Number(sess.revision ?? 0);
      if (rev < lastRevisionRef.current && sess.session_id === drillSession?.session_id) {
        return; // Ignorar evento antiguo fuera de orden
      }
      lastRevisionRef.current = rev;
      setDrillSession(sess);

      if (sess.is_public && sess.scenario_id) {
        setLocalPlaying(false);
        setLocalScenarioId(sess.scenario_id);
        setDisplayHour(Number(sess.simulated_hour) || 1);
        setMapContext("drill");
        await ensureSimulationLoaded(sess.scenario_id);
      }

      if (payload?.notification && sess.is_public) {
        triggerDeviceNotification(payload.notification);
      }
    },
    [drillSession?.session_id, ensureSimulationLoaded, triggerDeviceNotification]
  );

  // Conexión WebSocket en tiempo real + reconexión controlada + respaldo HTTP
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let pollTimer = null;
    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      try {
        const wsUrl = getDrillWebSocketUrl();
        ws = new WebSocket(wsUrl);
      } catch {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3500);
        return;
      }

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        setIsOffline(false);
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data?.session) {
            applyDrillSnapshot(data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        if (unmounted) return;
        setWsConnected(false);
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        // Al reconectar, consultar el estado vigente por HTTP inmediatamente
        fetchPublicDrillState()
          .then((snap) => {
            if (!unmounted && snap?.session) applyDrillSnapshot(snap);
          })
          .catch(() => {});
        reconnectTimer = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    // Respaldo ligero cada 4 s por si la red móvil bloquea WebSockets
    pollTimer = setInterval(() => {
      fetchPublicDrillState()
        .then((snap) => {
          if (!unmounted && snap?.session) {
            setIsOffline(false);
            applyDrillSnapshot(snap);
          }
        })
        .catch(() => {
          if (!unmounted && !wsConnected) setIsOffline(true);
        });
    }, 4000);

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [applyDrillSnapshot, wsConnected]);

  // Inicializar mapa Leaflet una sola vez
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 16.5,
      maxZoom: 20,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.addAttribution("&copy; OpenStreetMap");

    baseGroupRef.current = L.layerGroup().addTo(map);
    attentionGroupRef.current = L.layerGroup().addTo(map);
    waterGroupRef.current = L.layerGroup().addTo(map);
    evacuationGroupRef.current = L.layerGroup().addTo(map);
    focusGroupRef.current = L.layerGroup().addTo(map);

    const tile = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      maxNativeZoom: 19,
    });
    tile.addTo(map);
    tile.bringToBack();
    tileLayerRef.current = tile;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Ajustar tamaño del mapa cuando se abre/cierra el bottom sheet
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize?.();
    }, 220);
    return () => clearTimeout(timer);
  }, [sheetExpanded, mapContext]);

  // Renderizar campus UNT, instalaciones principales y puntos de encuentro referenciales
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = baseGroupRef.current;
    const evacGroup = evacuationGroupRef.current;
    if (!map || !group || !campusLayers) return;

    group.clearLayers();
    const features = campusLayers.campus?.features || [];
    const byId = new Map((activeSimData?.elements || []).map((e) => [e.id, e]));

    features
      .filter((f) => f.properties?.category === "perimetro_campus")
      .forEach((f) => {
        const lyr = L.geoJSON(f, {
          interactive: false,
          style: {
            color: "#0B2545",
            weight: 2,
            dashArray: "4 5",
            fillColor: "#F8FAFC",
            fillOpacity: 0.25,
          },
        }).addTo(group);
        if (!fittedRef.current) {
          const b = lyr.getBounds();
          if (b.isValid()) {
            map.fitBounds(b, { padding: [16, 16] });
            fittedRef.current = true;
          }
        }
      });

    features
      .filter((f) => f.properties?.category === "via")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#94A3B8", weight: 1.1, opacity: 0.7 },
        }).addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "area_verde")
      .forEach((f) => {
        L.geoJSON(f, {
          interactive: false,
          style: { color: "#86EFAC", weight: 0.7, fillColor: "#DCFCE7", fillOpacity: 0.45 },
        }).addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "edificio")
      .forEach((f) => {
        const fid = f.properties?.id;
        const name = getFeatureDisplayName(f.properties);
        const isNamed = !/^Edificio sin nombre/i.test(f.properties?.name || "");
        const impact = mapContext === "drill" ? byId.get(fid) : null;
        const touchedAtHour = Boolean(
          mapContext === "drill" &&
            impact &&
            impact.first_hour_affected !== null &&
            impact.first_hour_affected <= displayHour
        );

        L.geoJSON(f, {
          style: {
            color: touchedAtHour ? "#D97706" : isNamed ? "#1D4ED8" : "#94A3B8",
            weight: touchedAtHour ? 2 : 1.1,
            fillColor: touchedAtHour ? "#FBBF24" : isNamed ? "#3B82F6" : "#CBD5E1",
            fillOpacity: touchedAtHour ? 0.65 : 0.42,
          },
          onEachFeature: (_feat, lyr) => {
            lyr.on("click", () => {
              focusFacilityOnMap(fid || name);
            });
          },
        }).addTo(group);
      });

    features
      .filter((f) => f.properties?.category === "acceso")
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], {
          radius: 6,
          color: "#FFFFFF",
          weight: 1.5,
          fillColor: "#0369A1",
          fillOpacity: 0.95,
        })
          .on("click", () => {
            focusFacilityOnMap(f.properties?.id || f.properties?.name);
          })
          .addTo(group);
      });

    if (evacGroup && campusLayers.evacuation) {
      renderEvacuationLayers({
        group: evacGroup,
        evacuationData: campusLayers.evacuation,
        showSafeAreas: true,
        showMeetingPoints: true,
        showRoutes: mapContext === "drill",
        affectedGates: new Set(),
        bindPopups: false,
        onSelectFeature: (card) => {
          mapInstanceRef.current?.closePopup?.();
          if (card.lat && card.lon && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([card.lat - 0.0005, card.lon], 17.5, {
              duration: 0.65,
            });
          }
          setSelectedFacility({
            id: card.name,
            name: card.name,
            typeId: "meeting_point",
            typeLabel: card.infoType,
            verified: true,
            center: card.lat && card.lon ? { lat: card.lat, lon: card.lon } : null,
            customExplanation: card.explanation,
          });
          setShowRecommendations(false);
          setSheetExpanded(true);
        },
      });
    }
  }, [campusLayers, mapContext, activeSimData, displayHour, focusFacilityOnMap]);

  // Capa de zonas de atención documentadas (solo en Contexto A — Monitoreo)
  useEffect(() => {
    const group = attentionGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();
    if (mapContext !== "monitoring") return;

    const reported = campusLayers.reported_zones?.features || [];
    reported.forEach((f) => {
      const label = f.properties?.label || f.properties?.name || "Zona de atención documentada";
      L.geoJSON(f, {
        style: {
          color: "#D97706",
          weight: 1.8,
          dashArray: "5 4",
          fillColor: "#F59E0B",
          fillOpacity: 0.22,
        },
        onEachFeature: (_feat, lyr) => {
          lyr.on("click", () => {
            setSelectedFacility({
              id: label,
              name: label,
              typeId: "reported_zone",
              typeLabel: "Zona de atención (antecedente documentado)",
              verified: true,
              center: getGeometryCenter(f.geometry),
              customExplanation:
                "Sector con antecedentes documentados de acumulación superficial en lluvias pasadas (2017/2023). No representa una emergencia en curso.",
            });
            setShowRecommendations(false);
            setSheetExpanded(true);
          });
        },
      }).addTo(group);
    });
  }, [campusLayers, mapContext]);

  // Pre-construir capas de agua por hora (Contexto B — Simulacro) sin parpadeos ni fugas de memoria
  useEffect(() => {
    const frames = activeSimData?.frames || [];
    if (!activeSimData || !frames.length) {
      waterLayersRef.current = [];
      builtWaterKeyRef.current = "";
      return;
    }
    const key = `${activeSimData.run_id}_${frames.length}`;
    if (builtWaterKeyRef.current === key) return;

    waterLayersRef.current = frames.map((fr) =>
      L.geoJSON(fr.geojson, {
        interactive: false,
        style: (feat) => {
          const cls = feat.properties?.depth_class || "leve";
          const st = WATER_STYLES[cls] || WATER_STYLES.leve;
          return {
            color: st.color,
            weight: 0.8,
            fillColor: st.fillColor,
            fillOpacity: st.fillOpacity,
          };
        },
      })
    );
    builtWaterKeyRef.current = key;
  }, [activeSimData]);

  // Actualizar cuadro horario activo en el mapa (estrictamente separado del monitoreo actual)
  useEffect(() => {
    const group = waterGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (mapContext !== "drill" || !waterLayersRef.current.length) return;
    const idx = Math.min(Math.max(displayHour - 1, 0), waterLayersRef.current.length - 1);
    const activeLayer = waterLayersRef.current[idx];
    if (activeLayer) activeLayer.addTo(group);
  }, [mapContext, displayHour, activeSimData]);

  // Reproducción local cuando el estudiante explora por su cuenta (sin sesión admin activa)
  useEffect(() => {
    const frames = activeSimData?.frames || [];
    if (!localPlaying || mapContext !== "drill" || drillSession?.is_public || !frames.length) {
      return;
    }
    const timer = setInterval(() => {
      setDisplayHour((prev) => {
        if (prev >= frames.length) {
          setLocalPlaying(false);
          return frames.length;
        }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [localPlaying, mapContext, drillSession?.is_public, activeSimData]);

  const { local: updatedLima } = formatLimaTime(weather?.fetched_at_utc);
  const frames = activeSimData?.frames || [];
  const currentFrame =
    frames[Math.min(Math.max(displayHour - 1, 0), Math.max(frames.length - 1, 0))] || null;

  const selectedFacilityImpact = useMemo(() => {
    if (!selectedFacility || !activeSimData?.elements) return null;
    return (
      activeSimData.elements.find((e) => String(e.id) === String(selectedFacility.id)) ||
      activeSimData.elements.find(
        (e) => normalizeText(e.name) === normalizeText(selectedFacility.name)
      ) ||
      null
    );
  }, [selectedFacility, activeSimData]);

  const nearestMeetingPoint = useMemo(() => {
    const center = selectedFacility?.center || getGeometryCenter(selectedFacility?.geometry);
    const evacFeatures = campusLayers?.evacuation?.features || [];
    if (!center || !evacFeatures.length) return null;

    const meetingPoints = evacFeatures.filter(
      (f) =>
        f.geometry?.type === "Point" &&
        (f.properties?.layer_type === "meeting_point" || f.properties?.zone_type === "safe_point")
    );
    if (!meetingPoints.length) return null;

    let best = null;
    meetingPoints.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const distM = distanceMeters(center.lat, center.lon, lat, lon);
      const label = f.properties?.code
        ? `${f.properties.code} · ${f.properties.name || "Punto de encuentro"}`
        : f.properties?.name || "Punto de encuentro";
      if (!best || distM < best.distM) {
        best = { id: f.properties?.id, name: label, distM };
      }
    });
    return best;
  }, [selectedFacility, campusLayers]);

  const nearReportedZone = useMemo(() => {
    if (!selectedFacility || selectedFacility.typeId === "meeting_point") return null;
    const center = selectedFacility?.center || getGeometryCenter(selectedFacility?.geometry);
    const reported = campusLayers?.reported_zones?.features || [];
    if (!center || !reported.length) return null;

    let closest = null;
    reported.forEach((f) => {
      const zCenter = getGeometryCenter(f.geometry);
      if (!zCenter) return;
      const distM = distanceMeters(center.lat, center.lon, zCenter.lat, zCenter.lon);
      if (distM <= 95 && (!closest || distM < closest.distM)) {
        closest = {
          label: f.properties?.label || f.properties?.name || "zona con antecedente de aniego",
          distM,
        };
      }
    });
    return closest;
  }, [selectedFacility, campusLayers]);

  const facilityRecommendations = useMemo(
    () =>
      buildFacilityRecommendations({
        facility: selectedFacility,
        mapContext,
        impact: selectedFacilityImpact,
        displayHour,
        nearestMeetingPoint,
        nearReportedZone,
        liveEval,
      }),
    [
      selectedFacility,
      mapContext,
      selectedFacilityImpact,
      displayHour,
      nearestMeetingPoint,
      nearReportedZone,
      liveEval,
    ]
  );

  const topAffectedFacilities = useMemo(() => {
    if (!activeSimData?.elements) return [];
    return activeSimData.elements
      .filter((e) => e.first_hour_affected !== null && !/^Edificio sin nombre/i.test(e.name || ""))
      .sort((a, b) => (b.max_depth_cm || 0) - (a.max_depth_cm || 0))
      .slice(0, 5);
  }, [activeSimData]);

  const isLiveAdminDrill = Boolean(drillSession?.is_public);
  const isFinishedAdminDrill = drillSession?.status === "finished";

  const handleStartLocalDrill = async (scenarioId = localScenarioId) => {
    setLocalScenarioId(scenarioId);
    setMapContext("drill");
    setDisplayHour(1);
    await ensureSimulationLoaded(scenarioId);
  };

  const handleReturnToMonitoring = () => {
    setLocalPlaying(false);
    setMapContext("monitoring");
    setSheetExpanded(false);
  };

  return (
    <div
      data-testid="yaku-mobile-app"
      className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] select-none dark:bg-[#071524] dark:text-slate-100"
    >
      {/* 2.1 ENCABEZADO MÍNIMO */}
      <header className="z-30 flex items-center justify-between gap-1.5 border-b border-slate-200/80 bg-[#0B2545] px-3 py-2 text-white shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrandLogo iconOnly variant="dark" size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-baseline gap-1 text-sm font-extrabold tracking-tight">
              <span className="text-white">YAKU</span>
              <span className="text-[#38BDF8]">ALERT</span>
            </div>
            <div className="text-[10.5px] font-medium leading-tight text-sky-200/95">
              Universidad Nacional de Trujillo
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Indicador de estado de conexión compacto */}
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            aria-label="Estado de conexión y configuración"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold transition ${
              isOffline
                ? "border-amber-400/50 bg-amber-950/80 text-amber-200"
                : wsConnected
                ? "border-emerald-400/40 bg-emerald-950/70 text-emerald-200"
                : "border-sky-400/40 bg-sky-950/70 text-sky-200"
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="h-3 w-3 text-amber-400" />
                <span>Offline</span>
              </>
            ) : (
              <>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    wsConnected ? "bg-emerald-400" : "bg-sky-400"
                  }`}
                />
                <span>{wsConnected ? "Conectado" : "En línea"}</span>
              </>
            )}
          </button>

          {/* Botón de notificaciones */}
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            aria-label="Configurar notificaciones de simulacros"
            className={`rounded-xl p-1.5 transition ${
              notificationsEnabled
                ? "bg-white/10 text-sky-300 hover:bg-white/20"
                : "bg-white/5 text-slate-400 hover:bg-white/15"
            }`}
          >
            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>

          {/* Modo claro / oscuro */}
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Cambiar modo claro u oscuro"
            className="rounded-xl bg-white/10 p-1.5 text-white transition hover:bg-white/20"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* CINTILLO PERSISTENTE DE CONTEXTO B: SIMULACRO EDUCATIVO */}
      {mapContext === "drill" && (
        <div
          role="status"
          data-testid="drill-persistent-banner"
          className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/50 bg-[#FFFBEB] px-3.5 py-2 text-xs font-extrabold text-[#92400E] dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-100"
        >
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span>SIMULACRO EDUCATIVO — NO ES UNA EMERGENCIA REAL</span>
          </div>
          <button
            type="button"
            onClick={handleReturnToMonitoring}
            className="rounded-lg bg-[#0B2545] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
          >
            Volver al monitoreo
          </button>
        </div>
      )}

      {/* AVISO CUANDO EL ADMINISTRADOR FINALIZA EL SIMULACRO */}
      {isFinishedAdminDrill && mapContext === "drill" && (
        <div
          role="status"
          data-testid="drill-finished-banner"
          className="z-20 flex items-center justify-between gap-2 border-b border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
        >
          <span>El simulacro publicado ha finalizado.</span>
          <button
            type="button"
            onClick={handleReturnToMonitoring}
            className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-extrabold text-white"
          >
            Volver al monitoreo
          </button>
        </div>
      )}

      {/* BANNER TÁCTIL DE NOTIFICACIÓN RECIBIDA (abre mapa, hora e instalación al tocarlo) */}
      {activeBannerNotif && (
        <div
          role="alert"
          data-testid="mobile-push-banner"
          className="z-30 mx-3 mt-2 flex items-start justify-between gap-2.5 rounded-2xl border border-[#0369A1] bg-[#0B2545] p-3 text-white shadow-xl"
        >
          <button
            type="button"
            onClick={() => handleOpenFromNotification(activeBannerNotif)}
            className="flex-1 text-left"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#38BDF8]">
              <Radio className="h-3.5 w-3.5" />
              <span>{activeBannerNotif.title || "YAKU ALERT · SIMULACRO"}</span>
            </div>
            <div className="mt-0.5 text-xs font-bold text-white">{activeBannerNotif.body}</div>
            <div className="mt-1 text-[11px] text-sky-200/90">
              {activeBannerNotif.subtitle || "Simulación educativa. No es una emergencia real."} ·{" "}
              <span className="font-extrabold underline">Seguir simulacro (h+{activeBannerNotif.simulated_hour})</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveBannerNotif(null)}
            aria-label="Cerrar notificación"
            className="rounded-lg p-1 text-slate-300 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2.2 MAPA COMO PROTAGONISTA (70-80% de la pantalla) */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={mapContainerRef} className="h-full w-full bg-slate-100 dark:bg-slate-900" />

        {/* 2.4 BUSCADOR FLOTANTE: «¿Qué lugar de la UNT buscas?» */}
        <div className="absolute left-3 right-3 top-3 z-[400]">
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-[#0B2545]/95">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
              <input
                type="text"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="¿Qué lugar de la UNT buscas?"
                aria-label="¿Qué lugar de la UNT buscas?"
                className="h-10 w-full rounded-xl bg-[#F8FAFC] pl-9 pr-8 text-xs font-semibold text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0369A1] dark:bg-slate-900 dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="mt-2 max-h-52 overflow-y-auto border-t border-slate-100 pt-1.5 dark:border-slate-800">
                <div className="mb-1 flex flex-wrap gap-1 px-1">
                  {QUICK_PLACES.map((place) => (
                    <button
                      key={place}
                      type="button"
                      onClick={() => {
                        setQuery(place);
                        focusFacilityOnMap(place);
                      }}
                      className="rounded-full bg-[#F0F9FF] px-2.5 py-1 text-[11px] font-bold text-[#0369A1] dark:bg-sky-950/70 dark:text-sky-200"
                    >
                      {place}
                    </button>
                  ))}
                </div>
                {filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setQuery(item.displayLabel);
                      focusFacilityOnMap(item.id);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition hover:bg-[#F0F9FF] dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#0F172A] dark:text-white">
                        {item.displayLabel}
                      </div>
                      <div className="text-[10px] text-[#64748B] dark:text-slate-400">
                        {item.typeLabel}
                      </div>
                    </div>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Píldora flotante del estado del simulacro sobre el mapa */}
        {mapContext === "drill" && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 font-mono text-xs font-extrabold text-[#0B2545] shadow-md dark:border-slate-700 dark:bg-[#0B2545]/95 dark:text-white">
              <span>
                {activeSimData?.public_preset?.title ||
                  drillSession?.scenario_title ||
                  "Escenario simulado"}
              </span>
              <span className="text-[#0369A1] dark:text-[#38BDF8]">
                · h+{displayHour} ({currentFrame?.max_depth_cm ?? 0} cm)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 2.3 PANEL INFERIOR INTELIGENTE (Bottom Sheet con 2 posiciones: Contraído / Expandido) */}
      <section
        aria-label="Panel contextual del campus"
        data-testid="mobile-bottom-sheet"
        className={`z-30 flex flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl transition-all duration-200 dark:border-slate-800 dark:bg-[#0B2545] ${
          sheetExpanded ? "max-h-[54dvh]" : "max-h-[168px]"
        }`}
      >
        {/* Tirador táctil para contraer / expandir */}
        <button
          type="button"
          onClick={() => setSheetExpanded((v) => !v)}
          aria-expanded={sheetExpanded}
          className="flex w-full flex-col items-center pt-2 pb-1 text-xs font-bold text-[#475569] dark:text-slate-300"
        >
          <span className="mb-1 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="flex w-full items-center justify-between px-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
              {mapContext === "drill"
                ? isLiveAdminDrill
                  ? `Simulacro sincronizado · ${drillSession?.status === "playing" ? "En reproducción" : "Publicado"}`
                  : "Simulacro educativo"
                : "Monitoreo actual UNT"}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
              {sheetExpanded ? "Contraer" : "Detalles"}
              {sheetExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </span>
          </div>
        </button>

        {/* Contenido del Bottom Sheet */}
        <div className="overflow-y-auto px-4 pb-4 pt-1">
          {/* RESUMEN COMPACTO (siempre visible en posición contraída) */}
          {mapContext === "monitoring" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {liveEval?.preventive_level === "PREPARACION_CRITICA" ||
                    liveEval?.preventive_level === "ATENCION_PREVENTIVA"
                      ? "Atención preventiva en sectores bajos"
                      : "Pronóstico sin lluvias críticas"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-[#475569] dark:text-slate-300">
                  Lluvia 24 h:{" "}
                  <strong>
                    {weather?.summary ? `${weather.summary.accumulated_24h_mm} mm` : "—"}
                  </strong>{" "}
                  · Máx.:{" "}
                  <strong>
                    {weather?.summary ? `${weather.summary.max_intensity_mm_h} mm/h` : "—"}
                  </strong>{" "}
                  ·{" "}
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                    {isOffline ? "Dato almacenado" : "Open-Meteo"} ({updatedLima})
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecommendations(true);
                    setSheetExpanded(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-3 py-2 text-xs font-extrabold text-white shadow-sm dark:bg-[#0369A1]"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#38BDF8] dark:text-white" />
                  <span>Recomendaciones</span>
                </button>

                {isLiveAdminDrill ? (
                  <button
                    type="button"
                    onClick={() => setMapContext("drill")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#D97706] px-3 py-2 text-xs font-extrabold text-white shadow-sm"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Seguir simulacro</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartLocalDrill("evento_2017_03")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-[#0B2545] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-[#0369A1]" />
                    <span>Simulacro 2017/2023</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Resumen compacto en Contexto B (Simulacro) */
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {activeSimData?.public_preset?.title ||
                      drillSession?.scenario_title ||
                      "Escenario tipo 2017"}
                  </div>
                  <div className="font-mono text-xs text-[#0369A1] dark:text-[#38BDF8]">
                    Hora simulada: <strong>h+{displayHour}</strong> de {frames.length || 24} ·
                    Lámina máx.: <strong>{currentFrame?.max_depth_cm ?? 0} cm</strong>
                  </div>
                </div>

                {!isLiveAdminDrill && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocalPlaying((p) => !p)}
                      disabled={!frames.length || simLoading}
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#0B2545] px-3 text-xs font-extrabold text-white dark:bg-[#0369A1]"
                    >
                      {localPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      <span>{localPlaying ? "Pausar" : "Reproducir"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalPlaying(false);
                        setDisplayHour(1);
                      }}
                      aria-label="Reiniciar hora"
                      className="rounded-xl border border-slate-200 p-2 text-[#0F172A] dark:border-slate-700 dark:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTENIDO EXPANDIDO DEL BOTTOM SHEET */}
          {sheetExpanded && (
            <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
              {/* FICHA DE INSTALACIÓN SELECCIONADA */}
              {selectedFacility ? (
                <div
                  data-testid="mobile-facility-card"
                  className="rounded-2xl border border-[#0369A1]/40 bg-[#F0F9FF]/60 p-3.5 dark:border-sky-800 dark:bg-sky-950/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#0369A1] dark:bg-slate-900 dark:text-[#38BDF8]">
                        {selectedFacility.typeLabel || "Instalación UNT"}
                      </span>
                      <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
                        {selectedFacility.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFacility(null)}
                      aria-label="Cerrar ficha de instalación"
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {selectedFacility.customExplanation ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-[#0F172A] dark:text-slate-200">
                      {selectedFacility.customExplanation}
                    </p>
                  ) : null}

                  {mapContext === "drill" ? (
                    <div className="mt-2 rounded-xl bg-white p-2.5 text-xs dark:bg-[#0B2545]">
                      {selectedFacilityImpact &&
                      selectedFacilityImpact.first_hour_affected !== null ? (
                        <>
                          <div className="font-extrabold text-[#B45309] dark:text-amber-300">
                            Acumulación modelada en entorno: {selectedFacilityImpact.max_depth_cm} cm
                            (desde h+{selectedFacilityImpact.first_hour_affected})
                          </div>
                          <p className="mt-1 text-[11px] text-[#475569] dark:text-slate-300">
                            Resultado del modelo exploratorio en h+{displayHour}. No certifica daño en
                            la edificación ni es una alerta real.
                          </p>
                        </>
                      ) : (
                        <div className="text-[#475569] dark:text-slate-300">
                          Sin acumulación superficial significativa en el entorno inmediato durante
                          este escenario simulado.
                        </div>
                      )}
                    </div>
                  ) : !selectedFacility.customExplanation ? (
                    <p className="mt-1.5 text-xs text-[#475569] dark:text-slate-300">
                      Instalación georreferenciada de la Ciudad Universitaria UNT (OpenStreetMap).
                      Ubica los puntos de encuentro verdes más cercanos en el mapa.
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRecommendations((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-3 py-2 text-xs font-extrabold text-white dark:bg-[#0369A1]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>
                        {showRecommendations ? "Ocultar recomendaciones" : "Ver recomendaciones"}
                      </span>
                    </button>
                  </div>

                  {showRecommendations && facilityRecommendations.items.length > 0 && (
                    <div
                      data-testid="facility-recommendations-box"
                      className={`mt-2.5 rounded-xl border p-3 text-xs ${
                        facilityRecommendations.tone === "danger"
                          ? "border-red-300 bg-red-50/90 text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
                          : facilityRecommendations.tone === "warning"
                          ? "border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
                          : facilityRecommendations.tone === "info"
                          ? "border-sky-300 bg-sky-50/90 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
                          : "border-emerald-200 bg-white text-[#0F172A] dark:border-emerald-800/80 dark:bg-[#0B2545] dark:text-slate-200"
                      }`}
                    >
                      {facilityRecommendations.badge && (
                        <div className="mb-1.5 font-extrabold">
                          {facilityRecommendations.badge}
                        </div>
                      )}
                      <ul className="space-y-1.5">
                        {facilityRecommendations.items.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}

              {/* CONTROLES E INFORMACIÓN DEL CONTEXTO ACTIVO */}
              {mapContext === "drill" ? (
                <div className="space-y-3">
                  {/* Si no es un simulacro gobernado en vivo por el admin, permitir cambiar escenario y barra horaria */}
                  {!isLiveAdminDrill ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "evento_2017_03", label: "Escenario tipo 2017 (27.5 mm)" },
                          { id: "evento_2023_03_10", label: "Escenario tipo 2023 (35.0 mm)" },
                        ].map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => handleStartLocalDrill(sc.id)}
                            className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                              localScenarioId === sc.id
                                ? "border-[#0369A1] bg-[#F0F9FF] text-[#0B2545] dark:border-[#00B4D8] dark:bg-sky-950/60 dark:text-white"
                                : "border-slate-200 bg-white text-[#475569] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                          Hora:
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(frames.length, 24)}
                          value={displayHour}
                          onChange={(e) => {
                            setLocalPlaying(false);
                            setDisplayHour(Number(e.target.value));
                          }}
                          aria-label="Hora simulada"
                          className="h-2 flex-1 accent-[#0369A1]"
                        />
                        <span className="font-mono text-xs font-extrabold text-[#0B2545] dark:text-white">
                          h+{displayHour}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
                      <strong>Sincronizado en tiempo real con el simulacro UNT:</strong> el avance de
                      la hora (h+{displayHour}) se actualiza automáticamente desde la consola
                      administrativa.
                    </div>
                  )}

                  {topAffectedFacilities.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-extrabold text-[#0F172A] dark:text-white">
                        Instalaciones con acumulación modelada (toca para ubicar):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topAffectedFacilities.map((el) => (
                          <button
                            key={el.id}
                            type="button"
                            onClick={() => focusFacilityOnMap(el.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
                          >
                            <span>{el.name}</span>
                            <span className="font-mono text-[11px] text-[#B45309] dark:text-amber-300">
                              {el.max_depth_cm} cm (h+{el.first_hour_affected})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/80 dark:bg-emerald-950/35">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="h-4 w-4 text-[#059669]" />
                      <span>Recomendaciones generales durante el simulacro</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#0F172A] dark:text-slate-200">
                      <li>• Evita desplazarte hacia accesos con acumulación modelada (Puerta 4 / Av. Jesús de Nazareth).</li>
                      <li>• Prioriza las áreas elevadas referenciales (Explanada de Sociales, Rectorado o pisos altos).</li>
                      <li>• Recuerda que este escenario es educativo y no reemplaza avisos oficiales de SENAMHI/COER.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800/80 dark:bg-emerald-950/35">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="h-4 w-4 text-[#059669]" />
                      <span>Recomendaciones generales para el campus UNT</span>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#0F172A] dark:text-slate-200">
                      <li>
                        <strong>1. Antes de desplazarte:</strong> revisa el pronóstico de 24 h y ubica en el mapa las banderas verdes (puntos de encuentro referenciales en cotas altas).
                      </li>
                      <li>
                        <strong>2. Si inicia lluvia intensa:</strong> evita sectores bajos con antecedentes de aniego (Puerta 4, Av. Jesús de Nazareth y entorno del Comedor) y resguárdate en pisos superiores.
                      </li>
                      <li>
                        <strong>3. Continuidad y seguridad:</strong> aléjate de tableros eléctricos o sótanos húmedos y sigue únicamente los comunicados oficiales de la UNT y Defensa Civil.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-extrabold text-[#0F172A] dark:text-white">
                      Accesos rápidos del campus:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PLACES.map((place) => (
                        <button
                          key={place}
                          type="button"
                          onClick={() => focusFacilityOnMap(place)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#0B2545] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <MapPin className="h-3 w-3 text-[#0369A1]" />
                          <span>{place}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MODAL COMPACTO DE NOTIFICACIONES Y CONEXIÓN */}
      {settingsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notificaciones y estado de conexión"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#071524]/70 p-3 backdrop-blur-sm sm:items-center"
        >
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                Notificaciones y conexión
              </h2>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                aria-label="Cerrar configuración"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Permiso consentido de notificaciones */}
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-[#0F172A] dark:text-white">
                    Avisos de simulacros educativos
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#475569] dark:text-slate-300">
                    Recibe notificaciones cuando se publique un simulacro autorizado en la UNT.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  onClick={() => handleRequestAndToggleNotifications(!notificationsEnabled)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                    notificationsEnabled
                      ? "bg-[#059669] text-white"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {notificationsEnabled ? "Activadas" : "Desactivadas"}
                </button>
              </div>
              {pushStatusInfo && (
                <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                  {pushStatusInfo.honest_status}
                </p>
              )}
            </div>

            {/* Configuración de servidor backend para pruebas en red local */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 dark:border-slate-700 dark:bg-slate-900/70">
              <label
                htmlFor="mobile-backend-url"
                className="block text-xs font-extrabold text-[#0F172A] dark:text-white"
              >
                Servidor YAKU ALERT (Red local / Demostración)
              </label>
              <div className="flex gap-2">
                <input
                  id="mobile-backend-url"
                  type="url"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder="http://192.168.0.23:8000"
                  className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs text-[#0F172A] dark:border-slate-700 dark:bg-[#0B2545] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMobileBackendOrigin(backendUrlInput);
                    loadInitialData();
                    setSettingsModalOpen(false);
                  }}
                  className="rounded-xl bg-[#0B2545] px-3.5 text-xs font-extrabold text-white dark:bg-[#0369A1]"
                >
                  Guardar
                </button>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Estado canal sincronización:{" "}
                <strong>{wsConnected ? "WebSocket conectado en vivo" : "Reconectando / HTTP"}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
