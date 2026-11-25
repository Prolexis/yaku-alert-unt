export function normalizeText(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formatLimaTime(isoString) {
  if (!isoString) return { local: "Sincronizando...", utc: "" };
  // Extract ISO part if string includes "(usando caché local verificada)"
  const cleanIso = String(isoString).split(" ")[0];
  const date = new Date(cleanIso);
  if (Number.isNaN(date.getTime())) {
    return { local: String(isoString), utc: String(isoString) };
  }
  const local = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const utc = date.toISOString().slice(0, 19).replace("T", " ") + " UTC";
  return { local: `${local} (Lima)`, utc };
}

export function humanPreventiveTitle(level, isSynthetic) {
  const suffix = isSynthetic ? "escenario simulado" : "pronóstico actual";
  switch (level) {
    case "INFORMATIVO":
      return `Estado informativo — ${suffix}`;
    case "VIGILANCIA_PREVENTIVA":
      return `Vigilancia preventiva — ${suffix}`;
    case "ATENCION_PREVENTIVA":
      return `Atención preventiva — ${suffix}`;
    case "PREPARACION_CRITICA":
      return `Preparación crítica — ${suffix}`;
    default:
      return `Evaluación preventiva — ${suffix}`;
  }
}
