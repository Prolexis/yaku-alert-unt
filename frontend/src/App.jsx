import React, { useEffect, useState } from "react";
import {
  fetchCampusLayers,
  fetchLiveEvaluation,
  fetchProtocols,
  fetchWeather,
  runSimulation,
} from "./services/api";
import Sidebar from "./components/ui/Sidebar";
import TopHeader from "./components/ui/TopHeader";
import DataStatusBanner from "./components/ui/DataStatusBanner";
import HelpModal from "./components/ui/HelpModal";
import DashboardView from "./components/DashboardView";
import MonitoringView from "./components/MonitoringView";
import CampusMapView from "./components/CampusMapView";
import PreventionView from "./components/PreventionView";
import SimulatorView from "./components/SimulatorView";
import ContinuityView from "./components/ContinuityView";

const DEFAULT_SIM_PARAMS = {
  scenario_id: "lluvia_intensa_fen",
  intensity_mm_h: 28,
  duration_hours: 4,
  drainage_obstructed: true,
  antecedent_soil_saturated: false,
  hazard_zone_id: "lluvia_intensa_fen",
};

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [theme, setTheme] = useState("light"); // Modo claro priorizado para jurado
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
  const [liveEvaluation, setLiveEvaluation] = useState(null);

  const [simParams, setSimParams] = useState(DEFAULT_SIM_PARAMS);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");
  const [lastSimAt, setLastSimAt] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const loadWeatherAndLiveEval = async (offlineFlag) => {
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const [wData, eData] = await Promise.all([
        fetchWeather(offlineFlag),
        fetchLiveEvaluation(offlineFlag),
      ]);
      setWeather(wData);
      setLiveEvaluation(eData);
    } catch (err) {
      setWeatherError(err.message || "Error al conectar con el backend");
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleRunSimulation = async (paramsToRun) => {
    setSimLoading(true);
    setSimError("");
    try {
      const res = await runSimulation(paramsToRun);
      setSimResult(res);
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
    runSimulation(DEFAULT_SIM_PARAMS).then(setSimResult).catch(onFail);
  }, []);

  const currentEvaluation =
    evalSourceMode === "simulated" && simResult
      ? simResult.preventive_evaluation
      : liveEvaluation;

  const isSimulationContext =
    activeView === "simulator" ||
    activeView === "map" ||
    (activeView === "prevention" && evalSourceMode === "simulated");

  return (
    <div className="flex min-h-screen bg-[#F6F8FC] text-[#111827] dark:bg-[#071524] dark:text-slate-100">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        simActive={isSimulationContext}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          activeView={activeView}
          weather={weather}
          forceOffline={forceOffline}
          onToggleOffline={setForceOffline}
          onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
          loading={weatherLoading}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          isSimulationContext={isSimulationContext}
        />

        <DataStatusBanner
          isSimulationContext={isSimulationContext}
          weatherStatus={weather?.data_status}
          fallbackReason={weather?.fallback_reason}
          cachePeriod={weather?.cache_period}
          browserOffline={browserOffline}
        />

        {backendError && !campusLayers && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-900 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200 sm:px-6 lg:px-8"
          >
            {backendError}
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeView === "dashboard" && (
            <DashboardView
              weather={weather}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              liveEvaluation={liveEvaluation}
              simResult={simResult}
              onNavigate={setActiveView}
              onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
            />
          )}

          {activeView === "monitoring" && (
            <MonitoringView
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              forceOffline={forceOffline}
              onToggleOffline={setForceOffline}
              onRefresh={() => loadWeatherAndLiveEval(forceOffline)}
            />
          )}

          {activeView === "map" && (
            <CampusMapView
              campusLayers={campusLayers}
              simParams={simParams}
              onChangeSimParams={setSimParams}
              simResult={simResult}
              onRunSimulation={handleRunSimulation}
              onNavigate={setActiveView}
            />
          )}

          {activeView === "prevention" && (
            <PreventionView
              evaluation={currentEvaluation}
              evalSourceMode={evalSourceMode}
              onChangeEvalSource={setEvalSourceMode}
            />
          )}

          {activeView === "simulator" && (
            <SimulatorView
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

          {activeView === "continuity" && (
            <ContinuityView protocols={protocols} campusLayers={campusLayers} />
          )}
        </main>

        <footer className="border-t border-[#E2E8F0] bg-white px-4 py-3 text-center text-[11px] text-[#64748B] dark:border-slate-800 dark:bg-[#0B1F33] dark:text-slate-400">
          YAKU ALERT — UNT · Prototipo TRL 3–4 · Sin recopilación de datos personales (Ley N.° 29733) ·
          No sustituye alertas oficiales SINAGERD / SENAMHI / INDECI.
        </footer>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
