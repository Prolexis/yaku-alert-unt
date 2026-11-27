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

  const safePoints = evacFeatures
    .filter((f) => f.properties?.zone_type === "safe_point" && f.geometry?.type === "Point")
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const straightM = haversineMeters(oLat, oLon, lat, lon);
      return {
        feature: f,
        id: f.properties?.id,
        name: f.properties?.name || "Punto seguro referencial",
        rationale:
          f.properties?.rationale ||
          "Zona abierta de cota elevada dentro de la Ciudad Universitaria UNT.",
        lat,
        lon,
        straightM,
      };
    });

  if (!safePoints.length) return null;

  const routes = evacFeatures.filter(
    (f) => f.properties?.zone_type === "evacuation_route"
  );

  // Ordenar puntos seguros por cercanía real
  safePoints.sort((a, b) => a.straightM - b.straightM);

  // Evaluar si existe una ruta referencial asociada al punto seguro más cercano
  // evitando rutas que dependan de una puerta comprometida si no son rutas alternas
  let chosenSafe = safePoints[0];
  let chosenRoute = null;

  for (const sp of safePoints) {
    const candidateRoutes = routes.filter(
      (r) => r.properties?.to_safe_point_id === sp.id
    );
    if (!candidateRoutes.length) {
      chosenSafe = sp;
      break;
    }

    // Si hay puertas afectadas, priorizar la ruta marcada como alternativa para esa puerta
    const altForAffected = candidateRoutes.find(
      (r) =>
        r.properties?.avoid_when_gate_affected &&
        affectedGates.has(r.properties.avoid_when_gate_affected)
    );
    if (altForAffected) {
      chosenSafe = sp;
      chosenRoute = altForAffected;
      break;
    }

    // Caso normal: usar la primera ruta disponible hacia este punto seguro
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
