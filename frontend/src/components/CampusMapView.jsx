import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Layers, MapPin, ShieldAlert, Building2, Navigation, ArrowRight } from "lucide-react";

const UNT_CENTER = [-8.114656, -79.038595];

export default function CampusMapView({
  campusLayers,
  simParams,
  onChangeSimParams,
  simResult,
  onRunSimulation,
  onNavigate,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayGroupRef = useRef(null);

  const [visibleLayers, setVisibleLayers] = useState({
    edificios: true,
    accesos: true,
    puntos: true,
    rutas: true,
    peligro: true,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: UNT_CENTER,
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO | Capas UNT referenciales",
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    overlayGroupRef.current = group;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group || !campusLayers) return;
    group.clearLayers();

    const exposedIds = new Set(
      (simResult?.spatial_analysis?.exposed_buildings || [])
        .filter((b) => b.inside_hazard_zone)
        .map((b) => b.id)
    );
    const restrictedAccessIds = new Set(
      (simResult?.spatial_analysis?.restricted_accesses || [])
        .filter((a) => a.inside_hazard_zone)
        .map((a) => a.id)
    );
    const compromisedPointsIds = new Set(
      (simResult?.spatial_analysis?.meeting_points_status || [])
        .filter((p) => p.inside_hazard_zone)
        .map((p) => p.id)
    );

    // Polígono de peligro simulado
    if (visibleLayers.peligro && simResult?.hazard_geojson) {
      L.geoJSON(simResult.hazard_geojson, {
        style: {
          color: "#E11D48",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#F43F5E",
          fillOpacity: 0.24,
          className: "sim-hazard-polygon",
        },
      })
        .bindPopup(
          `<div class="space-y-1">
            <div class="font-bold text-rose-700">${simResult.hazard_geojson.properties.zone_name}</div>
            <div class="text-[11px] font-semibold uppercase text-amber-700">Escenario sintético (${simResult.hazard_geojson.properties.severity})</div>
            <div>${simResult.hazard_geojson.properties.description}</div>
          </div>`,
          { className: "yaku-popup" }
        )
        .addTo(group);
    }

    const features = campusLayers.campus?.features || [];
    features.forEach((feat) => {
      const { category, id, name } = feat.properties;

      if (category === "edificio" && visibleLayers.edificios) {
        const isExposed = exposedIds.has(id);
        L.geoJSON(feat, {
          style: {
            color: isExposed ? "#EA580C" : "#2563EB",
            weight: isExposed ? 2.5 : 1.5,
            fillColor: isExposed ? "#F97316" : "#3B82F6",
            fillOpacity: isExposed ? 0.55 : 0.25,
          },
        })
          .bindPopup(
            `<div>
              <strong>${name}</strong><br/>
              <span class="text-[11px]">${
                isExposed ? "⚠️ Expuesto en simulación (revisar 1.er nivel)" : "Fuera de zona simulada"
              }</span>
            </div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      } else if (category === "ruta_referencial" && visibleLayers.rutas) {
        L.geoJSON(feat, {
          style: {
            color: "#7C3AED",
            weight: 3,
            dashArray: "5 6",
          },
        })
          .bindPopup(
            `<div><strong>${name}</strong><br/><span class="text-[11px]">${feat.properties.disclaimer}</span></div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      } else if (category === "acceso" && visibleLayers.accesos) {
        const [lon, lat] = feat.geometry.coordinates;
        const isRestricted = restrictedAccessIds.has(id);
        L.circleMarker([lat, lon], {
          radius: 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: isRestricted ? "#E11D48" : "#10B981",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<div><strong>${name}</strong><br/><span class="text-[11px]">${
              isRestricted ? "Acceso restringido en simulación" : "Acceso transitable en simulación"
            }</span></div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      } else if (category === "punto_encuentro" && visibleLayers.puntos) {
        const [lon, lat] = feat.geometry.coordinates;
        const isCompromised = compromisedPointsIds.has(id);
        L.circleMarker([lat, lon], {
          radius: 8,
          color: "#0B1F33",
          weight: 2,
          fillColor: isCompromised ? "#F59E0B" : "#14B8A6",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<div><strong>${name}</strong><br/><span class="text-[11px]">${
              isCompromised ? "Comprometido en simulación" : "Disponible como referencia"
            }</span><br/><small>${feat.properties.note}</small></div>`,
            { className: "yaku-popup" }
          )
          .addTo(group);
      }
    });
  }, [campusLayers, simResult, visibleLayers]);

  const selectQuickScenario = (scenarioId) => {
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
    const next = presets[scenarioId];
    if (next) {
      onChangeSimParams(next);
      onRunSimulation(next);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Mapa protagonista */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-card dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#2563EB] dark:text-tealbrand-400" />
            <span className="text-sm font-bold text-[#0F172A] dark:text-white">
              Ciudad Universitaria UNT — Análisis Espacial Shapely
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "lluvia_moderada", label: "Escenario A" },
              { id: "lluvia_intensa_fen", label: "Escenario B (FEN)" },
              { id: "escenario_extremo_fen", label: "Escenario C (Extremo)" },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => selectQuickScenario(sc.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  simParams.hazard_zone_id === sc.id
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenedor Leaflet */}
        <div className="relative">
          <div ref={mapContainerRef} className="h-[460px] w-full bg-slate-100 dark:bg-slate-900 sm:h-[540px]" />

          {/* Control flotante de capas */}
          <div className="absolute right-3 top-3 z-[400] w-52 rounded-xl border border-[#E2E8F0] bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
            <div className="mb-2 flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-white">
              <Layers className="h-3.5 w-3.5 text-[#2563EB]" />
              Capas del mapa
            </div>
            <div className="space-y-1.5 text-[#64748B] dark:text-slate-300">
              {[
                { key: "peligro", label: "Polígono simulado" },
                { key: "edificios", label: "Edificios UNT" },
                { key: "accesos", label: "Accesos campus" },
                { key: "puntos", label: "Puntos encuentro ref." },
                { key: "rutas", label: "Rutas referenciales" },
              ].map((layer) => (
                <label key={layer.key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleLayers[layer.key]}
                    onChange={(e) =>
                      setVisibleLayers({ ...visibleLayers, [layer.key]: e.target.checked })
                    }
                    className="rounded accent-[#2563EB]"
                  />
                  <span>{layer.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Leyenda flotante inferior izquierda */}
          <div className="absolute bottom-3 left-3 z-[400] max-w-xs rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2.5 text-[11px] shadow-lg backdrop-blur dark:border-slate-700 dark:bg-[#0B1F33]/95">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#0F172A] dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" /> Edificio expuesto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Fuera de zona
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Acceso restringido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#14B8A6]" /> Punto encuentro ref.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral de información espacial */}
      <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#0B1F33] xl:col-span-4">
        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-tealbrand-400">
              Inspección Espacial (Shapely)
            </span>
            <h3 className="mt-1 text-base font-bold text-[#0F172A] dark:text-white">
              {simResult?.spatial_analysis?.hazard_zone_name || "Seleccione un escenario"}
            </h3>
          </div>

          {simResult && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-950/30">
                  <div className="text-[11px] font-medium text-orange-800 dark:text-orange-300">
                    Edificios expuestos
                  </div>
                  <div className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {simResult.spatial_analysis.total_exposed_buildings}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <div className="text-[11px] font-medium text-rose-800 dark:text-rose-300">
                    Accesos restringidos
                  </div>
                  <div className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {simResult.spatial_analysis.total_restricted_accesses}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />
                  Detalle por edificación
                </h4>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {simResult.spatial_analysis.exposed_buildings.map((b) => (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-2.5 text-xs ${
                        b.inside_hazard_zone
                          ? "border-orange-200 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20"
                          : "border-[#E2E8F0] bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-semibold text-[#0F172A] dark:text-white">
                        <span className="truncate">{b.name}</span>
                        <span className="shrink-0 text-[11px] text-[#64748B] dark:text-slate-400">
                          {b.overlap_pct}%
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400">
                        {b.status_in_scenario}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Navigation className="h-3.5 w-3.5 text-[#14B8A6]" />
                  Accesos y puntos de encuentro
                </h4>
                <div className="mt-2 space-y-1.5 text-xs">
                  {simResult.spatial_analysis.restricted_accesses.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-[#64748B] dark:text-slate-300">
                      <span className="truncate">{a.name}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          a.inside_hazard_zone
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {a.inside_hazard_zone ? "Restringido" : "Transitable"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[#E2E8F0] pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1F33] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#122C46] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
          >
            <ShieldAlert className="h-4 w-4" />
            Ajustar parámetros en Simulador
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
