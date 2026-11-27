import L from "leaflet";

export const EVACUATION_ETHICAL_NOTE =
  "Referencial TRL 3–4 — sujeto a validación oficial de Defensa Civil UNT.";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export function normalizeGateList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v).toUpperCase());
  return [String(val).toUpperCase()];
}

const AREA_KIND_LABELS = {
  espacio_abierto_elevado: "Espacio abierto elevado",
  refugio_bajo_techo: "Refugio bajo techo (pisos altos)",
};

const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`;

/**
 * Resuelve el punto de encuentro alternativo habilitado cuando alguna puerta (P1-P4)
 * supera el umbral crítico (>= 5 cm o R-HID-01).
 */
export function resolveAlternativeMeetingPoint(evacuationData, affectedGates = new Set()) {
  const features = evacuationData?.features || [];
  const points = features.filter(
    (f) =>
      f.geometry?.type === "Point" &&
      (f.properties?.layer_type === "meeting_point" || f.properties?.zone_type === "safe_point")
  );
  if (!points.length) return null;

  const cleanPoints = points.filter((f) => {
    const avoid = normalizeGateList(f.properties?.avoid_when_gate_affected);
    return !avoid.some((g) => affectedGates.has(g));
  });
  return cleanPoints[0] || points[0];
}

/**
 * Renderiza en un LayerGroup de Leaflet las capas independientes de evacuación:
 * - Áreas seguras (Polygon verde esmeralda translúcido #10B981 con borde punteado)
 * - Rutas referenciales (LineString; ámbar/rojo discontinuo "Evitar paso" si puerta afectada)
 * - Puntos de encuentro (Point verde oscuro #059669 con ícono de bandera y pulso si es recomendado/alternativo)
 */
export function renderEvacuationLayers({
  group,
  evacuationData,
  showSafeAreas = true,
  showMeetingPoints = true,
  showRoutes = true,
  affectedGates = new Set(),
  recommendedPointId = "",
  onSelectFeature = null,
}) {
  if (!group || !evacuationData?.features?.length) return;
  group.clearLayers();

  const features = evacuationData.features;
  const demVal = evacuationData.dem_validation || {};
  const demBadgeText = demVal.verified_against_dem
    ? `Validado sobre malla DEM ${demVal.dem_resolution_m || 10} m — libre de aniego en 2017/2023 (máx. ${demVal.max_depth_at_safe_points_cm ?? "< 2"} cm)`
    : "Validado sobre malla DEM 10 m — libre de aniego en 2017/2023";

  const safeAreas = features.filter(
    (f) => f.properties?.layer_type === "safe_area" && f.geometry?.type === "Polygon"
  );
  const meetingPoints = features.filter(
    (f) =>
      f.geometry?.type === "Point" &&
      (f.properties?.layer_type === "meeting_point" || f.properties?.zone_type === "safe_point")
  );
  const routes = features.filter(
    (f) =>
      f.geometry?.type === "LineString" &&
      (f.properties?.layer_type === "evacuation_route" || f.properties?.zone_type === "evacuation_route")
  );

  const mpById = new Map(meetingPoints.map((f) => [f.properties.id, f.properties]));
  const routesByMpId = new Map();
  routes.forEach((r) => {
    const destId = r.properties?.to_meeting_point_id || r.properties?.to_safe_point_id;
    if (!destId) return;
    if (!routesByMpId.has(destId)) routesByMpId.set(destId, []);
    routesByMpId.get(destId).push(r.properties);
  });

  const altMp = affectedGates.size > 0 ? resolveAlternativeMeetingPoint(evacuationData, affectedGates) : null;
  const altMpId = altMp?.properties?.id || "";

  // 1. ÁREAS SEGURAS (Polígonos verde esmeralda #10B981 con borde punteado limpio)
  if (showSafeAreas) {
    safeAreas.forEach((f) => {
      const p = f.properties || {};
      const kindLabel = AREA_KIND_LABELS[p.area_kind] || "Área elevada referencial";
      L.geoJSON(f, {
        style: {
          color: "#059669",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#10B981",
          fillOpacity: 0.24,
        },
        onEachFeature: (_feat, lyr) => {
          lyr.bindTooltip(
            `<div style="min-width:155px;">
              <div style="font-weight:800;color:#065F46;font-size:11px;">${esc(p.name)}</div>
              <div style="font-size:10px;color:#047857;">${esc(kindLabel)}</div>
            </div>`,
            { sticky: true, direction: "top" }
          );
          lyr.bindPopup(
            `<div class="space-y-1.5 max-w-[255px]">
              <div class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-200">Área elevada referencial · ${esc(kindLabel)}</div>
              <div class="font-extrabold text-slate-900 text-xs">${esc(p.name)}</div>
              <div class="text-[11px] text-slate-700">${esc(p.rationale || p.elevation_note || "")}</div>
              <div class="rounded-md bg-emerald-50/90 px-2 py-1 text-[10px] font-semibold text-emerald-900 border border-emerald-200">${esc(demBadgeText)}</div>
              ${p.capacity_ref ? `<div class="text-[10px] text-slate-600"><strong>Capacidad ref.:</strong> ${esc(p.capacity_ref)}</div>` : ""}
              <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(EVACUATION_ETHICAL_NOTE)}</div>
            </div>`,
            { className: "yaku-popup" }
          );
          if (onSelectFeature) {
            lyr.on("click", () =>
              onSelectFeature({
                name: p.name,
                infoType: `Área elevada referencial · ${kindLabel}`,
                explanation: `${p.rationale || ""} ${demBadgeText}.`,
              })
            );
          }
        },
      }).addTo(group);
    });
  }

  // 2. RUTAS DE EVACUACIÓN (Verde libre; Ámbar/Rojo discontinuo "Evitar paso" si su acceso supera umbral)
  if (showRoutes) {
    routes.forEach((f) => {
      const p = f.properties || {};
      const destId = p.to_meeting_point_id || p.to_safe_point_id;
      const dest = mpById.get(destId);
      const destName = dest?.name || destId;
      const avoidGates = normalizeGateList(p.avoid_when_gate_affected);
      const hitGates = avoidGates.filter((g) => affectedGates.has(g));
      const isAvoidStep = hitGates.length > 0;

      if (isAvoidStep) {
        // Halo ámbar sutil para indicar precaución / evitar paso por acceso comprometido
        L.geoJSON(f, {
          interactive: false,
          style: {
            color: "#F59E0B",
            weight: 7,
            opacity: 0.35,
          },
        }).addTo(group);
      }

      L.geoJSON(f, {
        style: isAvoidStep
          ? {
              color: "#DC2626",
              weight: 3.5,
              dashArray: "6 6",
              opacity: 0.95,
            }
          : {
              color: "#059669",
              weight: 3,
              dashArray: "7 5",
              opacity: 0.9,
            },
        onEachFeature: (_feat, lyr) => {
          const walkStr = p.walk_min_approx
            ? `~${p.walk_min_approx} min a pie (~${p.distance_m_approx} m)`
            : `~${p.distance_m_approx} m`;
          const altNote =
            isAvoidStep && altMp
              ? `<div class="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-900 border border-rose-300">Evitar paso (${esc(hitGates.join(", "))} comprometida) — usar punto de encuentro alternativo: ${esc(altMp.properties.name)}.</div>`
              : "";
          lyr.bindTooltip(
            isAvoidStep
              ? `Evitar paso (${esc(hitGates.join(", "))} afectada) · usar ${esc(altMp?.properties?.name || "ruta alterna")}`
              : `${esc(p.from_zone)} → ${esc(destName)} (${walkStr})`,
            { sticky: true, direction: "top" }
          );
          lyr.bindPopup(
            `<div class="space-y-1.5 max-w-[255px]">
              <div class="text-[10px] font-bold uppercase ${isAvoidStep ? "text-rose-700" : "text-emerald-700"}">
                ${isAvoidStep ? "Evitar paso · Acceso comprometido" : "Ruta referencial de evacuación"}
              </div>
              <div class="font-extrabold text-slate-900 text-xs">${esc(p.from_zone)} → ${esc(destName)}</div>
              ${altNote}
              <div class="text-[11px] text-slate-700">${esc(p.recommendation || "")}</div>
              <div class="text-[10px] text-slate-600"><strong>Recorrido estimado:</strong> ${esc(walkStr)}</div>
              <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(EVACUATION_ETHICAL_NOTE)}</div>
            </div>`,
            { className: "yaku-popup" }
          );
          if (onSelectFeature) {
            lyr.on("click", () =>
              onSelectFeature({
                name: `${p.from_zone} → ${destName}`,
                infoType: isAvoidStep ? "Evitar paso (acceso afectado)" : "Ruta referencial (TRL 3–4)",
                explanation: `${p.recommendation || ""} (${walkStr}).`,
              })
            );
          }
        },
      }).addTo(group);
    });
  }

  // 3. PUNTOS DE ENCUENTRO (Marcadores verde oscuro #059669 con ícono bandera + pulso si es recomendado/alternativo)
  if (showMeetingPoints) {
    meetingPoints.forEach((f) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry.coordinates;
      const avoidGates = normalizeGateList(p.avoid_when_gate_affected);
      const isGateAffected = avoidGates.some((g) => affectedGates.has(g));
      const isRecommended = Boolean(
        (recommendedPointId && p.id === recommendedPointId) ||
          (!recommendedPointId && altMpId && p.id === altMpId)
      );
      const linkedRoutes = routesByMpId.get(p.id) || [];
      const minWalk = linkedRoutes.length
        ? Math.min(...linkedRoutes.map((r) => Number(r.walk_min_approx || 3)))
        : 3;

      const bg = isGateAffected ? "#D97706" : "#059669";
      const pulseCls = isRecommended && !isGateAffected ? "yaku-safe-pulse" : "";
      const ringShadow = isRecommended
        ? "0 0 0 3px rgba(16,185,129,0.4), 0 3px 10px rgba(5,150,105,0.5)"
        : "0 2px 7px rgba(5,150,105,0.4)";

      const icon = L.divIcon({
        className: "yaku-meeting-point-marker",
        html: `<div class="${pulseCls}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:${bg};color:#ffffff;border:2.5px solid #ffffff;box-shadow:${ringShadow};">${FLAG_SVG}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const badgeLabel = isRecommended
        ? "Punto de encuentro recomendado"
        : isGateAffected
        ? "Acceso cercano afectado — usar alternativa"
        : "Punto de encuentro referencial";

      L.marker([lat, lon], { icon, zIndexOffset: isRecommended ? 700 : 520 })
        .bindTooltip(
          `${esc(p.name)}${isRecommended ? " · Recomendado" : ""}`,
          { direction: "top", offset: [0, -12] }
        )
        .bindPopup(
          `<div class="space-y-1.5 max-w-[260px]">
            <div class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              isGateAffected
                ? "bg-amber-50 text-amber-800 border border-amber-300"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }">${esc(badgeLabel)}</div>
            <div class="font-extrabold text-slate-900 text-xs">${esc(p.name)}</div>
            ${p.landmark ? `<div class="text-[11px] font-medium text-slate-700"><strong>Referencia:</strong> ${esc(p.landmark)}</div>` : ""}
            <div class="text-[11px] text-slate-700">${esc(p.rationale || "")}</div>
            <div class="rounded-md bg-emerald-50/90 px-2 py-1 text-[10px] font-semibold text-emerald-900 border border-emerald-200">${esc(demBadgeText)}</div>
            <div class="text-[10px] text-slate-600"><strong>Tiempo estimado a pie:</strong> ~${minWalk}–${minWalk + 3} min desde sectores cercanos</div>
            <div class="pt-1 border-t border-slate-200 text-[10px] text-slate-500">${esc(EVACUATION_ETHICAL_NOTE)}</div>
          </div>`,
          { className: "yaku-popup" }
        )
        .on("click", () => {
          onSelectFeature?.({
            name: p.name,
            infoType: badgeLabel,
            explanation: `${p.rationale || ""} ${demBadgeText}.`,
          });
        })
        .addTo(group);
    });
  }
}
