/**
 * Utilidad geoespacial ligera (100 % offline) para el flujo:
 * "¿Dónde estoy en la UNT? -> Mi Ruta Segura"
 */

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Encuentra el punto seguro más cercano y la ruta referencial recomendada
 * desde una facultad/pabellón del campus UNT.
 */
export function findNearestSafeRoute({
  originItem,
  campusLayers,
  affectedGates = new Set(),
}) {
  if (!originItem?.center || !campusLayers?.evacuation?.features?.length) {
    return null;
  }

  const { lat: oLat, lon: oLon } = originItem.center;
  const evacFeatures = campusLayers.evacuation.features;

  const normalizeGates = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val.map((v) => String(v).toUpperCase()) : [String(val).toUpperCase()];
  };

  const safePoints = evacFeatures
    .filter(
      (f) =>
        f.geometry?.type === "Point" &&
        (f.properties?.layer_type === "meeting_point" || f.properties?.zone_type === "safe_point")
    )
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const straightM = haversineMeters(oLat, oLon, lat, lon);
      const avoidGates = normalizeGates(f.properties?.avoid_when_gate_affected);
      const isGateCompromised = avoidGates.some((g) => affectedGates.has(g));
      return {
        feature: f,
        id: f.properties?.id,
        name: f.properties?.name || "Punto de encuentro referencial",
        rationale:
          f.properties?.rationale ||
          "Zona abierta de cota elevada dentro de la Ciudad Universitaria UNT.",
        lat,
        lon,
        straightM,
        isGateCompromised,
      };
    });

  if (!safePoints.length) return null;

  const routes = evacFeatures.filter(
    (f) =>
      f.properties?.layer_type === "evacuation_route" || f.properties?.zone_type === "evacuation_route"
  );

  // Priorizar puntos de encuentro sin puertas comprometidas, y luego cercanía real
  safePoints.sort((a, b) => {
    if (a.isGateCompromised !== b.isGateCompromised) {
      return a.isGateCompromised ? 1 : -1;
    }
    return a.straightM - b.straightM;
  });

  // Evaluar si existe una ruta referencial asociada al punto de encuentro elegido
  let chosenSafe = safePoints[0];
  let chosenRoute = null;

  for (const sp of safePoints) {
    const candidateRoutes = routes.filter(
      (r) =>
        r.properties?.to_meeting_point_id === sp.id || r.properties?.to_safe_point_id === sp.id
    );
    if (!candidateRoutes.length) {
      chosenSafe = sp;
      break;
    }

    // Preferir una ruta que NO cruce puertas comprometidas
    const safeRouteCandidate = candidateRoutes.find((r) => {
      const avoid = normalizeGates(r.properties?.avoid_when_gate_affected);
      return !avoid.some((g) => affectedGates.has(g));
    });
    if (safeRouteCandidate) {
      chosenSafe = sp;
      chosenRoute = safeRouteCandidate;
      break;
    }

    chosenSafe = sp;
    chosenRoute = candidateRoutes[0];
    break;
  }

  // Factor 1.25 para recorrido peatonal realista por veredas internas
  const walkDistanceM = Math.max(
    25,
    Math.round(
      chosenRoute?.properties?.distance_m_approx && chosenSafe.straightM < 120
        ? (chosenSafe.straightM * 1.25 + Number(chosenRoute.properties.distance_m_approx)) / 2
        : chosenSafe.straightM * 1.25
    )
  );
  const walkMinutes = Math.max(1, Math.round(walkDistanceM / 72));

  const avoidedList = Array.from(affectedGates);
  const recommendation =
    avoidedList.length > 0
      ? `Evita acercarte a ${avoidedList.join(", ")} por acumulación modelada y desplázate por veredas altas hacia ${chosenSafe.name}.`
      : chosenRoute?.properties?.recommendation ||
        `Desplázate con calma por veredas internas elevadas hacia ${chosenSafe.name} y evita cruzar charcos o cables húmedos.`;

  return {
    origin: {
      id: originItem.id,
      name: originItem.displayLabel,
      lat: oLat,
      lon: oLon,
    },
    safePoint: chosenSafe,
    routeFeature: chosenRoute,
    distanceM: walkDistanceM,
    walkMinutes,
    recommendation,
    avoidedGates: avoidedList,
  };
}
