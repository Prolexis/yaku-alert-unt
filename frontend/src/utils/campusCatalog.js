import { normalizeText } from "./formatters";

export const CAMPUS_CATEGORIES = [
  { id: "all", label: "Todas las categorías" },
  { id: "facultad", label: "Facultades" },
  { id: "escuela_pabellon", label: "Escuelas y pabellones" },
  { id: "aula_lab", label: "Aulas y laboratorios" },
  { id: "biblioteca_auditorio", label: "Bibliotecas y auditorios" },
  { id: "comedor_servicios", label: "Comedor y servicios" },
  { id: "oficina", label: "Oficinas y centros" },
  { id: "deporte", label: "Instalaciones deportivas" },
  { id: "estacionamiento", label: "Estacionamientos" },
  { id: "acceso", label: "Accesos y puertas" },
  { id: "punto_encuentro", label: "Puntos de encuentro ref." },
  { id: "sin_identificar", label: "Sin identificar" },
];

const OFFICIAL_NAME_MAP = {
  "facultad de derecho y cc.pp.": "Facultad de Derecho y Ciencias Políticas",
  "facultad de derecho y ciencias politicas": "Facultad de Derecho y Ciencias Políticas",
  "facultad de economia": "Facultad de Ciencias Económicas",
  "facultad de ciencias fisicas y matematicas": "Facultad de Ciencias Físicas y Matemáticas",
  "rectorado ciencias biologicas": "Facultad de Ciencias Biológicas (Rectorado)",
  "escuela de igenieria mecatronica": "Escuela de Ingeniería Mecatrónica",
  "auditorio coopernico": "Auditorio Copérnico",
  "observatorio astronomico": "Observatorio Astronómico",
  "cafetin cecimost": "Cafetín CECIMOST",
  "cubiculo de docentes": "Cubículos de Docentes",
  "colegio narvaez": "C.E.E. Rafael Narváez Cadenillas",
};

const CATEGORY_KEYWORDS = {
  facultad: "facultad carrera decanato",
  escuela_pabellon: "escuela pabellon edificio facultad",
  aula_lab: "aula laboratorio pool clases practicas quimica",
  biblioteca_auditorio: "biblioteca auditorio libros lectura teatrin sala",
  comedor_servicios: "comedor cafetin almuerzo bienestar agua servicio",
  oficina: "oficina admision rectorado postgrado cepunt idiomas cidunt docentes",
  deporte: "deporte cancha estadio coliseo losa futbol voley",
  estacionamiento: "estacionamiento parqueo cochera autos bicicletas",
  acceso: "acceso puerta entrada salida avenida ingreso",
  punto_encuentro: "punto encuentro evacuacion referencia",
  sin_identificar: "edificio sin nombre osm",
};

export function isUnnamedName(name) {
  return !name || /^Edificio sin nombre/i.test(name) || name === "area_deportiva" || name === "estacionamiento";
}

function classifyFeature(props) {
  const cat = props.category || "";
  const norm = normalizeText(props.name || "");

  if (cat === "acceso") return "acceso";
  if (cat === "punto_encuentro") return "punto_encuentro";
  if (cat === "area_deportiva") return "deporte";
  if (cat === "estacionamiento") return "estacionamiento";

  if (cat === "edificio") {
    if (isUnnamedName(props.name)) return "sin_identificar";
    if (norm.startsWith("facultad") || norm === "rectorado ciencias biologicas") return "facultad";
    if (norm.includes("biblioteca") || norm.includes("auditorio") || norm.includes("teatrin") || norm.includes("lectura") || norm === "libunt") {
      return "biblioteca_auditorio";
    }
    if (norm.includes("laboratorio") || norm.includes("pool de aulas") || norm.includes("aula") || norm.includes("observatorio")) {
      return "aula_lab";
    }
    if (norm.includes("comedor") || norm.includes("cafetin") || norm.includes("bienestar") || norm.includes("torre agua")) {
      return "comedor_servicios";
    }
    if (norm.includes("oficina") || norm.includes("admision") || norm.includes("cepunt") || norm.includes("idiomas") || norm.includes("post-grado") || norm.includes("cubiculo")) {
      return "oficina";
    }
    if (norm.includes("coliseo")) return "deporte";
    return "escuela_pabellon";
  }

  return null;
}

export function getFeatureDisplayName(props = {}) {
  const raw = String(props?.name || "").trim();
  const cat = props?.category || "";
  if (cat === "area_deportiva" && isUnnamedName(raw)) {
    return "Instalación deportiva — Campus UNT";
  }
  if (cat === "estacionamiento" && isUnnamedName(raw)) {
    return "Estacionamiento — Campus UNT";
  }
  if (isUnnamedName(raw)) {
    return "Pabellón académico — Ciudad Universitaria UNT";
  }
  const norm = normalizeText(raw);
  return OFFICIAL_NAME_MAP[norm] || raw;
}

function formatDisplayLabel(props, typeId) {
  const raw = props.name || "";
  if (typeId === "deporte" && isUnnamedName(raw)) {
    const idTail = String(props.osm_id || props.id || "").match(/\d+$/)?.[0]?.slice(-4) || "";
    return idTail ? `Instalación deportiva — Sector ${idTail}` : "Instalación deportiva — Campus UNT";
  }
  if (typeId === "estacionamiento" && isUnnamedName(raw)) {
    const idTail = String(props.osm_id || props.id || "").match(/\d+$/)?.[0]?.slice(-4) || "";
    return idTail ? `Estacionamiento — Sector ${idTail}` : "Estacionamiento — Campus UNT";
  }
  if (isUnnamedName(raw)) {
    return "Pabellón académico — Ciudad Universitaria UNT";
  }
  const norm = normalizeText(raw);
  return OFFICIAL_NAME_MAP[norm] || raw;
}

function extractCenter(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
  }
  const ring =
    geometry.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : null;
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const pt of ring) {
    sumLon += pt[0];
    sumLat += pt[1];
  }
  return { lon: sumLon / ring.length, lat: sumLat / ring.length };
}

export function buildCampusCatalog(campusLayers, simResult) {
  const features = campusLayers?.campus?.features || [];

  const exposureMap = new Map();
  (simResult?.spatial_analysis?.exposed_buildings || []).forEach((b) => exposureMap.set(b.id, b));
  (simResult?.spatial_analysis?.restricted_accesses || []).forEach((a) => exposureMap.set(a.id, a));
  (simResult?.spatial_analysis?.meeting_points_status || []).forEach((p) => exposureMap.set(p.id, p));

  const typeLabelMap = Object.fromEntries(CAMPUS_CATEGORIES.map((c) => [c.id, c.label]));
  const items = [];

  for (const feat of features) {
    const props = feat.properties || {};
    const typeId = classifyFeature(props);
    if (!typeId) continue;

    const displayLabel = formatDisplayLabel(props, typeId);
    const unnamed = typeId === "sin_identificar" || isUnnamedName(props.name);
    const verificationStatus = unnamed
      ? "Sin identificar"
      : props.verified
      ? "Verificado"
      : "Referencial";

    const center = extractCenter(feat.geometry);
    const exp = exposureMap.get(props.id) || null;

    items.push({
      id: props.id,
      displayLabel,
      rawName: props.name || "",
      typeId,
      typeLabel: typeLabelMap[typeId] || "Instalación",
      verificationStatus,
      source: props.source || "OpenStreetMap / capa curada UNT",
      osmId: props.osm_id || null,
      center,
      geometry: feat.geometry || null,
      exposure: exp,
      searchText: normalizeText(
        `${displayLabel} ${props.name || ""} ${typeLabelMap[typeId] || ""} ${CATEGORY_KEYWORDS[typeId] || ""}`
      ),
    });
  }

  // Deduplicar solo nombres oficiales repetidos en facultades/escuelas (conservando mayor exposición)
  const byKey = new Map();
  for (const item of items) {
    const dedupeKey =
      item.typeId === "sin_identificar" || item.typeId === "deporte" || item.typeId === "estacionamiento"
        ? item.id
        : `${item.typeId}:${normalizeText(item.displayLabel)}`;
    const prev = byKey.get(dedupeKey);
    const currOverlap = item.exposure?.overlap_pct ?? -1;
    const prevOverlap = prev?.exposure?.overlap_pct ?? -1;
    if (!prev || currOverlap > prevOverlap) {
      byKey.set(dedupeKey, item);
    }
  }

  const orderRank = {
    facultad: 0,
    escuela_pabellon: 1,
    biblioteca_auditorio: 2,
    aula_lab: 3,
    comedor_servicios: 4,
    oficina: 5,
    acceso: 6,
    punto_encuentro: 7,
    deporte: 8,
    estacionamiento: 9,
    sin_identificar: 10,
  };

  return [...byKey.values()].sort((a, b) => {
    const ra = orderRank[a.typeId] ?? 99;
    const rb = orderRank[b.typeId] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.displayLabel.localeCompare(b.displayLabel, "es");
  });
}
