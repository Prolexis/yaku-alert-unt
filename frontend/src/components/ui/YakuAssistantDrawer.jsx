import React, { useMemo, useState } from "react";
import { MessageSquare, X, Send, MapPin, Sliders, BookOpen } from "lucide-react";
import { buildCampusCatalog } from "../../utils/campusCatalog";
import { formatLimaTime, humanPreventiveTitle, normalizeText } from "../../utils/formatters";

const QUICK_PROMPTS = [
  "¿Va a llover hoy en la UNT?",
  "Ubicar Facultad de Ingeniería",
  "¿Dónde está el Comedor Universitario?",
  "Simular lluvia intensa FEN",
  "¿Qué hago durante lluvias intensas?",
];

export default function YakuAssistantDrawer({
  weather,
  campusLayers,
  simResult,
  liveEvaluation,
  onLocateInMap,
  onNavigate,
  onRunQuickSim,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hola, soy el asistente informativo de YAKU ALERT — UNT. Puedo consultar el pronóstico vigente, ubicar instalaciones del campus, abrir simulaciones o mostrarte orientaciones preventivas.",
      action: null,
    },
  ]);

  const catalog = useMemo(
    () => buildCampusCatalog(campusLayers, simResult),
    [campusLayers, simResult]
  );

  const handleQuery = (rawText) => {
    const text = rawText.trim();
    if (!text) return;

    const norm = normalizeText(text);
    const userMsg = { role: "user", text };
    let reply = {
      role: "assistant",
      text: "No encontré una coincidencia exacta. Puedes preguntarme por el clima de hoy, una facultad/edificio (ej. Ingeniería, Biblioteca, Comedor, Puerta) o por protocolos preventivos.",
      action: null,
    };

    // 1. Consulta de lluvia / clima / pronóstico
    if (
      norm.includes("llov") ||
      norm.includes("lluvia") ||
      norm.includes("clima") ||
      norm.includes("pronostico")
    ) {
      if (norm.includes("simul")) {
        reply = {
          role: "assistant",
          text: "Puedo abrir el Escenario B (Lluvia intensa FEN — datos sintéticos) en el Simulador Offline para ver qué edificios y accesos intersectan la zona experimental.",
          action: {
            label: "Ejecutar simulación FEN",
            type: "sim",
          },
        };
      } else if (weather?.summary) {
        const { local } = formatLimaTime(weather.fetched_at_utc);
        const acc = weather.summary.accumulated_24h_mm;
        const maxI = weather.summary.max_intensity_mm_h;
        const prob = weather.summary.max_probability_pct ?? "N/D";
        const src = weather.data_status === "LIVE_API" ? "Open-Meteo (en línea)" : "caché offline";
        reply = {
          role: "assistant",
          text: `Según ${src} (${local}), para las próximas 24h se prevé un acumulado de ${acc} mm (pico ${maxI} mm/h, probabilidad máx. ${prob}%). Estado informativo actual: ${
            liveEvaluation?.preventive_level
              ? humanPreventiveTitle(liveEvaluation.preventive_level, false)
              : "Estado informativo"
          }. Recuerda que es pronóstico numérico, no medición local.`,
          action: { label: "Ver monitoreo", type: "nav", target: "monitoring" },
        };
      }
    }
    // 2. Consulta de simulación
    else if (norm.includes("simul") || norm.includes("escenario") || norm.includes("fen")) {
      reply = {
        role: "assistant",
        text: "El Simulador Offline permite ensayar escenarios sintéticos (A, B, C o personalizado) y calcular intersecciones reales con Shapely sin emitir alertas reales.",
        action: { label: "Abrir Simulador", type: "sim" },
      };
    }
    // 3. Orientaciones / qué hacer / emergencia / protocolos
    else if (
      norm.includes("que hago") ||
      norm.includes("orientacion") ||
      norm.includes("protocolo") ||
      norm.includes("emergencia") ||
      norm.includes("clases") ||
      norm.includes("continuidad")
    ) {
      reply = {
        role: "assistant",
        text: "Ante lluvias intensas: evita cruzar zonas anegadas o cables húmedos, permanece en pisos superiores si hay anegamiento exterior y sigue únicamente comunicados oficiales de Defensa Civil UNT, SENAMHI e INDECI.",
        action: { label: "Ver orientaciones y canales", type: "nav", target: "continuity" },
      };
    }
    // 4. Búsqueda en el catálogo real del campus (facultad, biblioteca, comedor, puerta, cancha, etc.)
    else {
      const cleaned = norm
        .replace(/[¿?¡!.,;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(donde esta|donde queda|como llego a|como llegar a|ubicar|ubica|buscar|busca|muestrame|mostrar|ver)\s+/i, "")
        .replace(/^(el|la|los|las|al)\s+/i, "")
        .trim();
      const tokens = cleaned
        .split(" ")
        .filter((t) => t.length >= 3 && !["del", "las", "los", "una", "por", "para"].includes(t));
      const match =
        (cleaned && catalog.find((c) => normalizeText(c.displayLabel).includes(cleaned))) ||
        (cleaned && catalog.find((c) => c.searchText.includes(cleaned))) ||
        (tokens.length > 0 &&
          catalog.find((c) => tokens.every((tok) => c.searchText.includes(tok))));

      if (match) {
        const expText = match.exposure
          ? match.exposure.inside_hazard_zone
            ? `En el último escenario simulado intersecta la zona experimental (${match.exposure.overlap_pct}%).`
            : "En el último escenario simulado no intersecta el polígono (esto no garantiza seguridad real)."
          : "Exposición en escenario: Información no disponible para este tipo de instalación.";
        reply = {
          role: "assistant",
          text: `Encontré "${match.displayLabel}" (${match.typeLabel} · ${match.verificationStatus}). ${expText}`,
          action: { label: "Ver en Mapa UNT", type: "locate", buildingId: match.id },
        };
      }
    }

    setMessages((prev) => [...prev, userMsg, reply]);
    setInput("");
  };

  const executeAction = (action) => {
    if (!action) return;
    if (action.type === "locate") {
      onLocateInMap(action.buildingId);
      setOpen(false);
    } else if (action.type === "nav") {
      onNavigate(action.target);
      setOpen(false);
    } else if (action.type === "sim") {
      onRunQuickSim();
      onNavigate("simulator");
      setOpen(false);
    }
  };

  return (
    <>
      {/* Botón flotante discreto */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente informativo YAKU"
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#0B1F33] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1D4ED8] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Asistente YAKU</span>
        </button>
      )}

      {/* Panel del asistente */}
      {open && (
        <aside
          aria-label="Asistente informativo YAKU"
          className="fixed bottom-4 right-4 z-50 flex h-[500px] max-h-[82vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0B1F33]"
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#0B1F33] px-4 py-3 text-white dark:border-slate-800">
            <div>
              <div className="text-sm font-bold">Asistente YAKU</div>
              <div className="text-[11px] text-slate-300">
                Guía informativa offline · No reemplaza alertas oficiales
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar asistente"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Historial */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#2563EB] text-white"
                      : "bg-[#F7F9FC] text-[#101828] dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {m.text}
                </div>
                {m.action && (
                  <button
                    type="button"
                    onClick={() => executeAction(m.action)}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                  >
                    {m.action.type === "locate" && <MapPin className="h-3 w-3" />}
                    {m.action.type === "sim" && <Sliders className="h-3 w-3" />}
                    {m.action.type === "nav" && <BookOpen className="h-3 w-3" />}
                    {m.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Botones rápidos */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-[#E2E8F0] px-3 py-2 dark:border-slate-800">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleQuery(q)}
                className="shrink-0 rounded-full border border-[#E2E8F0] bg-[#F7F9FC] px-2.5 py-1 text-[11px] font-medium text-[#101828] hover:border-[#2563EB] hover:text-[#2563EB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(input);
            }}
            className="flex items-center gap-2 border-t border-[#E2E8F0] p-3 dark:border-slate-800"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta..."
              aria-label="Escribir consulta al asistente YAKU"
              className="h-9 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] px-3 text-xs text-[#101828] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              aria-label="Enviar consulta"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
