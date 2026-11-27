import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  confirmAlertReceipt,
  createContinuityDecision,
  demoLogin,
  fetchAlerts,
  fetchCampusBuildingStatus,
  fetchCampusLayers,
  fetchConditionsCatalog,
  fetchContinuityDecisions,
  fetchLiveEvaluation,
  fetchLiveSimulation,
  fetchProtocols,
  fetchReports,
  fetchVirtualSensors,
  fetchWeather,
  fetchWhatsAppStatus,
  issueAlert,
  resolveAlert,
  resolveContinuityDecision,
  runSimulation,
  sendAlertWhatsApp,
  updateReportStatus,
  validateAlert,
} from "./services/api";
import { mergeVirtualSensors } from "./utils/sensorFormatters";
import Sidebar from "./components/ui/Sidebar";
import TopHeader from "./components/ui/TopHeader";
import DataStatusBanner from "./components/ui/DataStatusBanner";
import HelpModal from "./components/ui/HelpModal";
import CampusReportModal from "./components/ui/CampusReportModal";
import YakuAssistantDrawer from "./components/ui/YakuAssistantDrawer";
import DashboardView from "./components/DashboardView";
import MonitoringView from "./components/MonitoringView";
import CampusMapView from "./components/CampusMapView";
import StudentMonitoringMap from "./components/StudentMonitoringMap";
import StudentSimpleSimulation from "./components/StudentSimpleSimulation";
import PreventionView from "./components/PreventionView";
import SimulatorView from "./components/SimulatorView";
import DynamicSimulationView from "./components/DynamicSimulationView";
import ContinuityView from "./components/ContinuityView";

const DEFAULT_SIM_PARAMS = {
  scenario_id: "lluvia_intensa_fen",
  intensity_mm_h: 28,
  duration_hours: 4,
  drainage_obstructed: true,
  antecedent_soil_saturated: false,
  hazard_zone_id: "lluvia_intensa_fen",
  synthetic_reach_m: 40,
  external_conditions: [],
};

export default function App() {
  const [userRole, setUserRole] = useState("student"); // "student" (público) | "admin" (gestión UNT)
  const [activeView, setActiveView] = useState("dashboard");
  const [theme, setTheme] = useState("light"); // Modo claro priorizado para proyector y jurado
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [evalSourceMode, setEvalSourceMode] = useState("live"); // "live" | "simulated"
  const [forceOffline, setForceOffline] = useState(false);

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const [browserOffline, setBrowserOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );
  const [backendError, setBackendError] = useState("");

  const [campusLayers, setCampusLayers] = useState(null);
  const [protocols, setProtocols] = useState(null);
  // Catálogo de condiciones externas (escenario D y declaración manual en Prevención).
  const [conditionsCatalog, setConditionsCatalog] = useState(null);
  const [declaredConditions, setDeclaredConditions] = useState([]);
  const [liveEvaluation, setLiveEvaluation] = useState(null);

  const [simParams, setSimParams] = useState(DEFAULT_SIM_PARAMS);
  const [simResult, setSimResult] = useState(null);
  const [hydroResult, setHydroResult] = useState(null);
  const [publicSimResult, setPublicSimResult] = useState(null);
  const [hydroActiveHour, setHydroActiveHour] = useState(1);
  const [virtualSensorsCatalog, setVirtualSensorsCatalog] = useState(null);
  const [selectedSensorId, setSelectedSensorId] = useState("");
  const [disconnectedSensors, setDisconnectedSensors] = useState({});
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");
  const [lastSimAt, setLastSimAt] = useState("");
  const [focusedBuildingId, setFocusedBuildingId] = useState("");
  const [activeDemoRole, setActiveDemoRole] = useState("estudiante");
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [campusReports, setCampusReports] = useState([]);
  const [continuityDecisions, setContinuityDecisions] = useState([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [liveSimulation, setLiveSimulation] = useState(null);
  const [campusBuildingStatus, setCampusBuildingStatus] = useState([]);

  const buildingStatusById = useMemo(() => {
    const list =
      liveSimulation?.active && Array.isArray(liveSimulation.building_status)
        ? liveSimulation.building_status
        : campusBuildingStatus;
    const map = new Map();
    (list || []).forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return map;
  }, [liveSimulation, campusBuildingStatus]);

  const refreshAlertsAndReports = () => {
    fetchAlerts(false)
      .then((res) => {
        const visible = [
          ...(res.active_alerts || []),
          ...(res.draft_alerts || []),
        ];
        setActiveAlerts(visible);
      })
      .catch((err) => console.warn("Alertas SQLite no disponibles:", err));
    fetchReports()
      .then((res) => setCampusReports(res.reports || []))
      .catch((err) => console.warn("Reportes SQLite no disponibles:", err));
    fetchContinuityDecisions(true)
      .then((res) => setContinuityDecisions(res.active_decisions || []))
      .catch((err) => console.warn("Decisiones de continuidad no disponibles:", err));
  };

  const handleSelectDemoRole = async (roleId) => {
    setActiveDemoRole(roleId);
    const isAdminRole = roleId === "directivo" || roleId === "operador_riesgos";
    if (isAdminRole) {
      if (userRole !== "admin") {
        setUserRole("admin");
      }
      if (roleId === "directivo") {
        if (["student_map", "student_sim", "simulator"].includes(activeView)) {
          setActiveView("dashboard");
        }
      } else if (roleId === "operador_riesgos") {
        if (["student_map", "student_sim"].includes(activeView)) {
          setActiveView("hydro");
        }
      }
    } else {
      if (userRole !== "student") {
        setUserRole("student");
        setEvalSourceMode("live");
      }
      if (["map", "monitoring"].includes(activeView)) {
        setActiveView("student_map");
      } else if (["hydro", "simulator"].includes(activeView)) {
        setActiveView("student_sim");
      }
    }
    try {
      const auth = await demoLogin({ quick_role: roleId });
      toast.success(`Perfil activo: ${auth.user.display_name}`, {
        description: `${auth.user.email} · Sesión demo sintética (Ley N.° 29733).`,
      });
    } catch {
      // Operación offline segura
    }
  };

  const handleValidateAlert = async (alertId) => {
    try {
      const validated = await validateAlert(
        alertId,
        activeDemoRole === "operador_riesgos" ? "operador_riesgos" : "directivo",
        { send_whatsapp: true, offline: forceOffline || browserOffline }
      );
      setActiveAlerts((prev) => prev.map((a) => (a.id === alertId ? validated : a)));
      const wa = validated.whatsapp_dispatch;
      if (wa?.status === "sent") {
        toast.success("Alerta validada y enviada por WhatsApp (CAP 1.2)", {
          description: `${wa.first_message_id || "Enviado"} · ${wa.reason || ""}`,
        });
      } else {
        toast.success("Alerta validada y emitida (CAP 1.2)");
      }
    } catch (err) {
      toast.error("No se pudo validar la alerta", { description: err.message });
    }
  };

  const handleConfirmAlert = async (alertId, status) => {
    try {
      const res = await confirmAlertReceipt(alertId, activeDemoRole, status);
      setActiveAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, confirmations: res.confirmations } : a
        )
      );
      toast.success(
        status === "en_zona_segura"
          ? "Confirmado: estás en zona segura"
          : "Confirmación de recepción registrada",
        { description: `Total confirmaciones en tiempo real: ${res.confirmations.total}` }
      );
    } catch (err) {
      toast.error("No se pudo registrar la confirmación", { description: err.message });
    }
  };

  const handleCreateDecision = async (payload) => {
    const created = await createContinuityDecision(payload);
    setContinuityDecisions((prev) => [created, ...prev]);
    toast.success("Medida de continuidad activada para la comunidad UNT");
    return created;
  };

  const handleResolveDecision = async (decisionId) => {
    await resolveContinuityDecision(decisionId);
    setContinuityDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    toast.info("Medida de continuidad finalizada");
  };

  const handleIssueAlert = async (payload) => {
    const created = await issueAlert({
      ...payload,
      offline: forceOffline || browserOffline,
    });
    setActiveAlerts((prev) => [created, ...prev]);
    const wa = created.whatsapp_dispatch;
    if (wa) {
      if (wa.status === "sent") {
        toast.success("Alerta CAP emitida y enviada por WhatsApp (wamid registrado)", {
          description: `${wa.first_message_id || "Enviado"} · ${wa.reason}`,
        });
      } else if (wa.status === "simulated") {
        toast.info("Alerta CAP emitida · WhatsApp en modo simulado", {
          description: wa.reason,
        });
      } else {
        toast.warning("Alerta CAP emitida · Error en envío WhatsApp", {
          description: wa.reason,
        });
      }
    } else {
      toast.success("Aviso publicado en la vista Estudiante", {
        description: `${created.title} · Guardado en SQLite.`,
      });
    }
    return created;
  };

  const handleSendAlertWhatsApp = async (alertId) => {
    try {
      const res = await sendAlertWhatsApp(alertId, {
        offline: forceOffline || browserOffline,
      });
      if (res.alert) {
        setActiveAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? res.alert : a))
        );
      }
      const wa = res.whatsapp || {};
      if (wa.status === "sent") {
        toast.success("Alerta CAP enviada por WhatsApp (wamid registrado)", {
          description: `${wa.first_message_id || "OK"} · ${wa.reason || ""}`,
        });
      } else if (wa.status === "simulated") {
        toast.info("WhatsApp Cloud API en modo simulado / offline", {
          description: wa.reason || "Configura WHATSAPP_ENABLED=true y credenciales sandbox.",
        });
      } else {
        toast.error("No se pudo enviar por WhatsApp", {
          description: wa.reason || "Revisa ventana de 24 h o credenciales sandbox.",
        });
      }
      return res;
    } catch (err) {
      toast.error("Error al conectar con el canal WhatsApp", {
        description: err.message,
      });
      return null;
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await resolveAlert(alertId);
      setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.info("Aviso institucional cerrado");
    } catch (err) {
      toast.error("No se pudo cerrar el aviso", { description: err.message });
    }
  };

  const handleUpdateReportStatus = async (reportId, nextStatus) => {
    try {
      const updated = await updateReportStatus(
        reportId,
        nextStatus,
        activeDemoRole === "directivo" ? "directivo" : "operador_riesgos"
      );
      setCampusReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      toast.success(`Reporte #${reportId} marcado como ${nextStatus}`);
    } catch (err) {
      toast.error("No se pudo actualizar el reporte", { description: err.message });
    }
  };

  const virtualSensors = useMemo(
    () => mergeVirtualSensors(virtualSensorsCatalog, hydroResult),
    [virtualSensorsCatalog, hydroResult]
  );

  const handleLocateBuildingInMap = (buildingId) => {
    setFocusedBuildingId(buildingId);
    setActiveView(userRole === "admin" ? "map" : "student_map");
  };

  const handleChangeRole = (nextRole) => {
    if (nextRole === userRole) return;
    setUserRole(nextRole);
    if (nextRole === "student") {
      if (["directivo", "operador_riesgos"].includes(activeDemoRole)) {
        setActiveDemoRole("estudiante");
      }
      if (activeView === "map" || activeView === "monitoring") setActiveView("student_map");
      else if (activeView === "hydro" || activeView === "simulator") setActiveView("student_sim");
      setEvalSourceMode("live");
      toast.info("Vista Comunidad UNT activada", {
        description: "Interfaz simplificada para consulta rápida, confirmación de alertas y rutas seguras.",
      });
    } else {
      if (!["directivo", "operador_riesgos"].includes(activeDemoRole)) {
        setActiveDemoRole("operador_riesgos");
      }
      if (activeView === "student_map") setActiveView("map");
      else if (activeView === "student_sim") setActiveView("hydro");
      toast.success("Vista Gestión UNT activada", {
        description: "Operación técnica (Simulación en vivo 10 m) y Decisión ejecutiva habilitadas.",
      });
    }
  };

  const handleToggleOffline = (nextOffline) => {
    setForceOffline(nextOffline);
    if (nextOffline) {
      toast.info("Modo Respaldo Offline activado", {
        description: "Operando con caché local verificada de Open-Meteo.",
      });
    } else {
      toast.success("Reconectando pronóstico en vivo", {
        description: "Consultando servicio meteorológico Open-Meteo.",
      });
    }
  };

  const handleLocateSensorInMap = (sensorId, targetView = "map") => {
    setSelectedSensorId(sensorId);
    setActiveView(targetView);
  };

  const handleToggleDisconnectSensor = (sensorId, frozenReading) => {
    setDisconnectedSensors((prev) => {
      const next = { ...prev };
      if (!frozenReading) {
        delete next[sensorId];
      } else {
        next[sensorId] = {
          value: frozenReading.value,
          hour: hydroActiveHour,
          label: frozenReading.hourLabel,
          accumulatedMm: frozenReading.accumulatedMm ?? null,
        };
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const loadWeatherAndLiveEval = async (offlineFlag, conds = declaredConditions) => {
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const [wData, eData] = await Promise.all([
        fetchWeather(offlineFlag),
        fetchLiveEvaluation(offlineFlag, conds),
      ]);
      setWeather(wData);
      setLiveEvaluation(eData);
    } catch (err) {
      setWeatherError(err.message || "Error al conectar con el backend");
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleToggleDeclaredCondition = (condId) => {
    const next = declaredConditions.includes(condId)
      ? declaredConditions.filter((id) => id !== condId)
      : [...declaredConditions, condId];
    setDeclaredConditions(next);
    fetchLiveEvaluation(forceOffline, next).then(setLiveEvaluation).catch(console.error);
  };

  const handleRunSimulation = async (paramsToRun) => {
    setSimLoading(true);
    setSimError("");
    try {
      const res = await runSimulation(paramsToRun);
      setSimResult(res);
      setSimParams(res.parameters);
      setEvalSourceMode("simulated");
      setLastSimAt(new Date().toLocaleTimeString("es-PE", { hour12: false }));
    } catch (err) {
      setSimError(err.message || "Error al ejecutar la simulación");
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    loadWeatherAndLiveEval(forceOffline);
  }, [forceOffline]);

  // Si vuelve la red y no se forzó el modo sin conexión, se reintenta el pronóstico real.
  useEffect(() => {
    const goOnline = () => {
      setBrowserOffline(false);
      if (!forceOffline) loadWeatherAndLiveEval(false);
    };
    const goOffline = () => setBrowserOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [forceOffline]);

  useEffect(() => {
    const onFail = (err) => {
      console.error(err);
      setBackendError(
        "No se pudo contactar el servidor local (backend). El mapa y la simulación necesitan que Docker esté en marcha."
      );
    };
    fetchCampusLayers().then(setCampusLayers).catch(onFail);
    fetchProtocols().then(setProtocols).catch(onFail);
    fetchConditionsCatalog()
      .then(setConditionsCatalog)
      .catch((err) => console.warn("Condiciones externas no disponibles:", err));
    runSimulation(DEFAULT_SIM_PARAMS).then(setSimResult).catch(onFail);
    refreshAlertsAndReports();
    fetchLiveSimulation().then(setLiveSimulation).catch(() => {});
  }, []);

  // Estado dinámico por edificio (usa pronóstico si no hay simulación en vivo activa)
  useEffect(() => {
    if (liveSimulation?.active) return;
    fetchCampusBuildingStatus(forceOffline || browserOffline)
      .then((res) => setCampusBuildingStatus(res.buildings || []))
      .catch(() => {});
  }, [forceOffline, browserOffline, liveSimulation?.active]);

  // Polling ligero cada 3 segundos para sincronizar simulación en vivo y alertas CAP 1.2
  useEffect(() => {
    let mounted = true;
    const pollLive = () => {
      fetchLiveSimulation()
        .then((live) => {
          if (mounted) setLiveSimulation(live);
        })
        .catch(() => {});
      fetchAlerts(false)
        .then((res) => {
          if (!mounted) return;
          const visible = [
            ...(res.active_alerts || []),
            ...(res.draft_alerts || []),
          ];
          setActiveAlerts(visible);
        })
        .catch(() => {});
    };
    const timer = setInterval(pollLive, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // Solo el rol Administrador carga el catálogo técnico de sensores IoT virtuales y estado WhatsApp
  useEffect(() => {
    if (userRole !== "admin") return;
    fetchWhatsAppStatus()
      .then(setWhatsappStatus)
      .catch(() => setWhatsappStatus(null));
    if (virtualSensorsCatalog) return;
    fetchVirtualSensors()
      .then(setVirtualSensorsCatalog)
      .catch((err) => console.warn("Sensores virtuales no disponibles:", err));
  }, [userRole, virtualSensorsCatalog]);

  const currentEvaluation =
    evalSourceMode === "simulated" && simResult
      ? simResult.preventive_evaluation
      : liveEvaluation;

  const isSimulationContext =
    activeView === "student_sim" ||
    activeView === "hydro" ||
    activeView === "simulator" ||
    activeView === "map" ||
    (activeView === "prevention" && evalSourceMode === "simulated");

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#071524] dark:text-slate-100">
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          simActive={isSimulationContext}
          userRole={userRole}
          activeDemoRole={activeDemoRole}
          onChangeRole={handleChangeRole}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader
            activeView={activeView}
            weather={weather}
            forceOffline={forceOffline}
            onToggleOffline={handleToggleOffline}
            onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
            loading={weatherLoading}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            isSimulationContext={isSimulationContext}
            userRole={userRole}
            onChangeRole={handleChangeRole}
            activeDemoRole={activeDemoRole}
            onSelectDemoRole={handleSelectDemoRole}
            preventiveLevel={currentEvaluation?.preventive_level || currentEvaluation?.level}
          />

          <DataStatusBanner
            isSimulationContext={isSimulationContext}
            userRole={userRole}
            weatherStatus={weather?.data_status}
            fallbackReason={weather?.fallback_reason}
            cachePeriod={weather?.cache_period}
            browserOffline={browserOffline}
          />

          {backendError && !campusLayers && (
            <div
              role="alert"
              className="border-b border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2 text-xs font-semibold text-[#991B1B] dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200 sm:px-6 lg:px-8"
            >
              {backendError}
            </div>
          )}

          <main className="w-full flex-1 px-3 py-5 sm:px-5 lg:px-6 xl:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${userRole}-${activeView}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {activeView === "dashboard" && (
                  <DashboardView
                    weather={weather}
                    weatherLoading={weatherLoading}
                    weatherError={weatherError}
                    liveEvaluation={liveEvaluation}
                    campusLayers={campusLayers}
                    simResult={simResult}
                    hydroResult={hydroResult}
                    onLocateInMap={handleLocateBuildingInMap}
                    onNavigate={setActiveView}
                    onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
                    userRole={userRole}
                    activeDemoRole={activeDemoRole}
                    activeAlerts={
                      userRole === "admin"
                        ? activeAlerts
                        : activeAlerts.filter((a) => a.status === "emitida" && a.active)
                    }
                    campusReports={campusReports}
                    onOpenReportModal={() => setReportModalOpen(true)}
                    onResolveAlert={handleResolveAlert}
                    onValidateAlert={handleValidateAlert}
                    onConfirmAlert={handleConfirmAlert}
                    onSendWhatsApp={handleSendAlertWhatsApp}
                    whatsappStatus={whatsappStatus}
                    onUpdateReportStatus={handleUpdateReportStatus}
                    liveSimulation={liveSimulation}
                  />
                )}

                {activeView === "monitoring" && (
                  <MonitoringView
                    weather={weather}
                    loading={weatherLoading}
                    error={weatherError}
                    forceOffline={forceOffline}
                    onToggleOffline={handleToggleOffline}
                    onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
                  />
                )}

                {activeView === "student_map" && (
                  <StudentMonitoringMap
                    weather={weather}
                    liveEvaluation={liveEvaluation}
                    campusLayers={campusLayers}
                    declaredConditions={declaredConditions}
                    focusedBuildingId={focusedBuildingId}
                    onSelectBuilding={setFocusedBuildingId}
                    onNavigate={setActiveView}
                    offline={forceOffline || browserOffline}
                    activeAlerts={activeAlerts.filter((a) => a.status === "emitida" && a.active)}
                    activeDemoRole={activeDemoRole}
                    onConfirmAlert={handleConfirmAlert}
                    campusReports={campusReports}
                    onOpenReportModal={() => setReportModalOpen(true)}
                    liveSimulation={liveSimulation}
                    buildingStatusById={buildingStatusById}
                  />
                )}

                {activeView === "student_sim" && (
                  <StudentSimpleSimulation
                    campusLayers={campusLayers}
                    onPublicSimResult={setPublicSimResult}
                    onNavigate={setActiveView}
                    offline={forceOffline || browserOffline}
                  />
                )}

                {activeView === "map" && userRole === "admin" && (
                  <CampusMapView
                    campusLayers={campusLayers}
                    conditionsCatalog={conditionsCatalog}
                    simParams={simParams}
                    onChangeSimParams={setSimParams}
                    simResult={simResult}
                    focusedBuildingId={focusedBuildingId}
                    onSelectBuilding={setFocusedBuildingId}
                    onRunSimulation={handleRunSimulation}
                    onNavigate={setActiveView}
                    virtualSensors={virtualSensors}
                    hydroActiveHour={hydroActiveHour}
                    selectedSensorId={selectedSensorId}
                    onSelectSensor={setSelectedSensorId}
                    disconnectedSensors={disconnectedSensors}
                    onToggleDisconnectSensor={handleToggleDisconnectSensor}
                    offline={forceOffline || browserOffline}
                    activeDemoRole={activeDemoRole}
                    buildingStatusById={buildingStatusById}
                  />
                )}

                {activeView === "prevention" && (
                  <PreventionView
                    evaluation={currentEvaluation}
                    weather={weather}
                    simResult={simResult}
                    hydroResult={hydroResult}
                    evalSourceMode={evalSourceMode}
                    onChangeEvalSource={setEvalSourceMode}
                    conditionsCatalog={conditionsCatalog}
                    declaredConditions={declaredConditions}
                    onToggleCondition={handleToggleDeclaredCondition}
                    userRole={userRole}
                    activeDemoRole={activeDemoRole}
                    onIssueAlert={handleIssueAlert}
                    activeAlerts={
                      userRole === "admin"
                        ? activeAlerts
                        : activeAlerts.filter((a) => a.status === "emitida" && a.active)
                    }
                    onResolveAlert={handleResolveAlert}
                    onValidateAlert={handleValidateAlert}
                    onConfirmAlert={handleConfirmAlert}
                    onSendWhatsApp={handleSendAlertWhatsApp}
                    whatsappStatus={whatsappStatus}
                    campusReports={campusReports}
                    onUpdateReportStatus={handleUpdateReportStatus}
                  />
                )}

                {activeView === "simulator" && userRole === "admin" && (
                  <SimulatorView
                    conditionsCatalog={conditionsCatalog}
                    simParams={simParams}
                    onChangeSimParams={setSimParams}
                    simResult={simResult}
                    simLoading={simLoading}
                    simError={simError}
                    lastSimAt={lastSimAt}
                    onRunSimulation={handleRunSimulation}
                    onNavigate={setActiveView}
                  />
                )}

                {activeView === "hydro" && userRole === "admin" && (
                  <DynamicSimulationView
                    campusLayers={campusLayers}
                    onResultChange={setHydroResult}
                    onHourChange={setHydroActiveHour}
                    virtualSensors={virtualSensors}
                    selectedSensorId={selectedSensorId}
                    onSelectSensor={setSelectedSensorId}
                    disconnectedSensors={disconnectedSensors}
                    onToggleDisconnectSensor={handleToggleDisconnectSensor}
                    onLocateBuildingInMap={handleLocateBuildingInMap}
                    onNavigate={setActiveView}
                    offline={forceOffline || browserOffline}
                    activeDemoRole={activeDemoRole}
                    onIssueAlert={handleIssueAlert}
                    liveSimulation={liveSimulation}
                    onLiveSimulationChange={setLiveSimulation}
                    onRefreshAlerts={refreshAlertsAndReports}
                    onSwitchToOperator={() => handleSelectDemoRole("operador_riesgos")}
                  />
                )}

                {activeView === "continuity" && (
                  <ContinuityView
                    protocols={protocols}
                    campusLayers={campusLayers}
                    userRole={userRole}
                    activeDemoRole={activeDemoRole}
                    continuityDecisions={continuityDecisions}
                    onCreateDecision={handleCreateDecision}
                    onResolveDecision={handleResolveDecision}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs font-medium text-[#475569] dark:border-slate-800 dark:bg-[#0B2545] dark:text-slate-300">
            <span className="font-bold text-[#0B2545] dark:text-white">Yaku Alert — UNT</span> ·
            Desarrollado por <span className="font-semibold text-[#0369A1] dark:text-[#38BDF8]">NexoRisk</span> ·
            Prototipo TRL 3–4 · Sin recopilación de datos personales (Ley N.° 29733) · No sustituye alertas oficiales SINAGERD / SENAMHI / INDECI.
          </footer>
        </div>

        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <CampusReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          onCreated={refreshAlertsAndReports}
        />
        <YakuAssistantDrawer
          userRole={userRole}
          weather={weather}
          campusLayers={campusLayers}
          simResult={simResult}
          publicSimResult={publicSimResult}
          liveEvaluation={liveEvaluation}
          virtualSensors={userRole === "admin" ? virtualSensors : []}
          hydroActiveHour={hydroActiveHour}
          disconnectedSensors={disconnectedSensors}
          onLocateInMap={handleLocateBuildingInMap}
          onLocateSensor={handleLocateSensorInMap}
          onNavigate={setActiveView}
          onRunQuickSim={() => handleRunSimulation(DEFAULT_SIM_PARAMS)}
        />
        <Toaster position="bottom-right" richColors />
      </div>
    </MotionConfig>
  );
}
