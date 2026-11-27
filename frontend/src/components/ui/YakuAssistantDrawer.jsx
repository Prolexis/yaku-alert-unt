import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X, Send, MapPin, Sliders, BookOpen, Radio } from "lucide-react";
import { buildCampusCatalog } from "../../utils/campusCatalog";
import { formatLimaTime, humanPreventiveTitle, normalizeText } from "../../utils/formatters";
import { resolveSensorReading } from "../../utils/sensorFormatters";
import { YakuAlertLogo } from "./BrandLogo";

const STUDENT_QUICK_PROMPTS = [
  "¿Qué hago si se inunda Puerta 4?",
  "¿Dónde está el punto seguro más cercano?",
  "¿Cómo se decide pasar a clases virtuales?",
  "¿Cómo está el pronóstico de lluvia?",
  "¿Qué representa el escenario 2023?",
];

const ADMIN_QUICK_PROMPTS = [
  "¿Qué hago si se inunda Puerta 4?",
  "¿Cómo se decide pasar a clases virtuales?",
  "¿Dónde está el punto seguro más cercano?",
  "¿Dónde están los sensores?",
  "¿Qué indica el sensor de Puerta 4?",
];

export default function YakuAssistantDrawer({
  userRole = "student",
  weather,
  campusLayers,
  simResult,
  publicSimResult = null,
  liveEvaluation,
  virtualSensors = [],
  hydroActiveHour = 1,
  disconnectedSensors = {},
  onLocateInMap,
  onLocateSensor,
  onNavigate,
  onRunQuickSim,
}) {
  const quickPrompts = userRole === "admin" ? ADMIN_QUICK_PROMPTS : STUDENT_QUICK_PROMPTS;
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

    // 0. Consultas sobre YAKU SENSE (solo disponibles en modo Administrador)
    const idMatch = norm.match(/\bs0([1-6])\b/);
    const asksSensors =
      Boolean(idMatch) ||
      norm.includes("sensor") ||
      norm.includes("pluviometro") ||
      norm.includes("lorawan") ||
      norm.includes("mqtt") ||
      norm.includes("yaku sense") ||
      (userRole === "admin" && norm.includes("lamina") && (norm.includes("comedor") || norm.includes("puerta") || norm.includes("pabellon")));

    if (asksSensors && userRole !== "admin") {
      reply = {
        role: "assistant",
        text: "La vista pública para estudiantes y visitantes no muestra sensores ni diagnósticos técnicos. Puedes consultar el pronóstico vigente en el Mapa UNT o explorar la Simulación sencilla (2017 / 2023).",
        action: { label: "Abrir Mapa UNT", type: "nav", target: "student_map" },
      };
    } else if (asksSensors && virtualSensors.length > 0) {
      if (norm.includes("conectar") || norm.includes("lorawan") || norm.includes("fisica")) {
        reply = {
          role: "assistant",
          text: "Propuesta futura (no operativa): Sensor físico → MCU + LoRaWAN → Gateway del campus → Servidor LoRaWAN (ChirpStack/TTS) → MQTT/Webhook → FastAPI → Mapa Leaflet y Asistente YAKU. Hoy no existen sensores físicos instalados; requiere evaluar frecuencias MTC, cobertura RF, energía y permisos UNT.",
          action: { label: "Ver sensores en Mapa UNT", type: "sensor", sensorId: "S01" },
        };
      } else if (norm.includes("no tienen datos") || norm.includes("sin datos") || norm.includes("sin lectura")) {
        const noData = virtualSensors.filter(
          (s) => resolveSensorReading(s, hydroActiveHour, disconnectedSensors[s.id]).statusKey === "no_reading"
        );
        const list = noData.map((s) => `${s.id} (${s.short_name})`).join(", ");
        reply = {
          role: "assistant",
          text: noData.length
            ? `Sensores virtuales sin lectura en el modelo actual: ${list}. Por rigor científico no se inventan mediciones donde hydro.py o la API no producen esa variable.`
            : "Todos los sensores con serie compatible tienen lectura en la simulación activa.",
          action: { label: "Ver S05 en Mapa UNT", type: "sensor", sensorId: noData[0]?.id || "S05" },
        };
      } else {
        let targetSensor = null;
        if (idMatch) {
          targetSensor = virtualSensors.find((s) => s.id === `S0${idMatch[1]}`);
        } else if (norm.includes("comedor")) {
          targetSensor = virtualSensors.find((s) => s.id === "S03");
        } else if (norm.includes("puerta 4") || norm.includes("p4") || norm.includes("nazareth")) {
          targetSensor = virtualSensors.find((s) => s.id === "S02");
        } else if (norm.includes("lluvia") || norm.includes("pluviometro")) {
          targetSensor = virtualSensors.find((s) => s.id === "S01");
        } else if (norm.includes("pabellon") || norm.includes("materiales") || norm.includes("baja")) {
          targetSensor = virtualSensors.find((s) => s.id === "S04");
        } else if (norm.includes("suelo") || norm.includes("verde")) {
          targetSensor = virtualSensors.find((s) => s.id === "S05");
        } else if (norm.includes("temperatura") || norm.includes("ambiental") || norm.includes("biblioteca")) {
          targetSensor = virtualSensors.find((s) => s.id === "S06");
        }

        if (targetSensor) {
          const r = resolveSensorReading(
            targetSensor,
            hydroActiveHour,
            disconnectedSensors[targetSensor.id]
          );
          const statusDesc =
            r.statusKey === "disconnected_sim"
              ? `Comunicación interrumpida (simulada); último dato: ${r.displayValue} (${r.hourLabel}).`
              : r.statusKey === "active_virtual"
              ? `${targetSensor.reading_label}: ${r.displayValue} en ${r.hourLabel} (escenario simulado, no medición real).`
              : `Sin lectura disponible (${targetSensor.reading_source}).`;
          reply = {
            role: "assistant",
            text: `${targetSensor.name} [Sensor virtual · SIM]. Ubicación propuesta: ${targetSensor.location_label}. ${statusDesc}`,
            action: { label: `Ver ${targetSensor.id} en Mapa UNT`, type: "sensor", sensorId: targetSensor.id },
          };
        } else {
          const summaryList = virtualSensors
            .map((s) => `${s.id} (${s.short_name})`)
            .join(", ");
          reply = {
            role: "assistant",
            text: `YAKU SENSE propone 6 sensores IoT virtuales (sin hardware instalado): ${summaryList}. Puedes activar la capa «Sensores IoT [SIM]» en Mapa UNT o Simulación dinámica.`,
            action: { label: "Activar sensores en Mapa UNT", type: "sensor", sensorId: "S03" },
          };
        }
      }
    }
    // 0b. Preguntas frecuentes de demo/Q&A (Puerta 4, punto seguro, virtualidad, diferencia simulación vs real)
    else if (norm.includes("inunda") && (norm.includes("puerta 4") || norm.includes("p4"))) {
      reply = {
        role: "assistant",
        text: "Si Puerta 4 (Av. Jesús de Nazareth) presenta acumulación de agua, evita cruzar la vía anegada y utiliza la ruta alterna referencial hacia Explanada Sociales o Parque Max Díaz (cotas altas). En el mapa de simulación se activa automáticamente el desvío resaltado en verde/ámbar.",
        action: { label: "Ver rutas seguras en Mapa UNT", type: "nav", target: userRole === "admin" ? "map" : "student_map" },
      };
    } else if (norm.includes("punto seguro") || norm.includes("zona segura")) {
      reply = {
        role: "assistant",
        text: "El campus cuenta con 5 puntos seguros referenciales de cota elevada (marcados con «S» verde pulsante en el mapa): Explanada Sociales, Parque Max Díaz, Parque Economía, Explanada Ingeniería y Zona Deportiva Alta. Sigue siempre la señalización de Defensa Civil UNT.",
        action: { label: "Ubicar puntos seguros", type: "nav", target: userRole === "admin" ? "map" : "student_map" },
      };
    } else if (norm.includes("clases virtuales") || norm.includes("virtualidad") || norm.includes("como se decide")) {
      reply = {
        role: "assistant",
        text: "El Semáforo Ejecutivo traduce reglas explicables (R-MET y R-HID): Verde = operación normal; Ámbar = vigilancia y resguardo de laboratorios en planta baja; Rojo (Atención o Preparación Crítica) = recomienda activar virtualidad preventiva y reprogramar laboratorios, sujeto siempre a resolución oficial de la UNT.",
        action: { label: "Ver continuidad y reglas", type: "nav", target: "prevention" },
      };
    } else if (norm.includes("simulacion o una medicion") || norm.includes("medicion real")) {
      reply = {
        role: "assistant",
        text: "El Mapa de monitoreo UNT muestra el pronóstico numérico de Open-Meteo (no sensores locales instalados). En cambio, «Simulación sencilla» (tipo 2017 y tipo 2023) es una simulación experimental para explorar escenarios y no representa la situación actual del campus.",
        action: { label: "Ver Mapa UNT", type: "nav", target: userRole === "admin" ? "map" : "student_map" },
      };
    } else if (norm.includes("2017") || norm.includes("2023")) {
      const year = norm.includes("2023") ? "2023" : "2017";
      reply = {
        role: "assistant",
        text:
          year === "2017"
            ? "El Escenario tipo 2017 es una simulación experimental inspirada en los antecedentes documentados de marzo de 2017 (27,5 mm en 24 h; hietograma horario supuesto). No es una reconstrucción exacta del evento real."
            : "El Escenario tipo 2023 es una simulación experimental relacionada con los antecedentes documentados del 10 de marzo de 2023 (35 mm en el día; hietograma horario supuesto). No es una reconstrucción exacta del evento real.",
        action: { label: "Ir a Simulación sencilla", type: "nav", target: userRole === "admin" ? "hydro" : "student_sim" },
      };
    } else if (norm.includes("que zonas aparecen") || norm.includes("zonas de atencion")) {
      reply = {
        role: "assistant",
        text: "En el Mapa UNT aparecen las instalaciones registradas en OpenStreetMap, puntos de encuentro referenciales y las «Zonas de atención» basadas en antecedentes históricos documentados (2017/2023) y sectores de cota relativamente baja del DEM Copernicus GLO-30. Ninguna capa declara zonas seguras ni peligrosas oficiales.",
        action: { label: "Explorar Mapa UNT", type: "nav", target: userRole === "admin" ? "map" : "student_map" },
      };
    } else if (norm.includes("sucede") && norm.includes("comedor") && norm.includes("simul")) {
      const comedorEl = (publicSimResult?.elements || []).find((e) =>
        normalizeText(e.name).includes("comedor")
      );
      reply = {
        role: "assistant",
        text: comedorEl
          ? comedorEl.first_hour_affected !== null
            ? `En el escenario cargado, el entorno del Comedor Universitario muestra contacto modelado desde h+${comedorEl.first_hour_affected} (lámina máxima modelada: ${comedorEl.max_depth_cm} cm). Es un resultado exploratorio, no una medición real.`
            : "En el escenario cargado, el entorno del Comedor Universitario no muestra lámina visible. Recuerda que es un modelo exploratorio y no certifica condiciones reales."
          : "Abre «Simulación sencilla», elige Escenario tipo 2017 o tipo 2023, pulsa «Ver simulación» y haz clic sobre el Comedor Universitario en el mapa para consultar su resultado exploratorio.",
        action: { label: "Abrir Simulación sencilla", type: "nav", target: userRole === "admin" ? "hydro" : "student_sim" },
      };
    }
    // 1. Consulta de lluvia / clima / pronóstico
    else if (
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
          action: { label: userRole === "admin" ? "Ver monitoreo" : "Ver Mapa UNT", type: "nav", target: userRole === "admin" ? "monitoring" : "student_map" },
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
    } else if (action.type === "sensor") {
      onLocateSensor?.(action.sensorId, "map");
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
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir asistente informativo YAKU"
            className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-[#0B2545] px-4 text-sm font-bold text-white shadow-elevated ring-1 ring-white/15 transition hover:bg-[#0369A1] dark:bg-[#0369A1] dark:hover:bg-[#00B4D8]"
          >
            <MessageSquare className="h-4 w-4 text-[#38BDF8]" />
            <span>Asistente YAKU</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel del asistente con animación spring */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            aria-label="Asistente informativo YAKU"
            className="fixed bottom-4 right-4 z-50 flex h-[520px] max-h-[82vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0B2545] px-4 py-3 text-white">
              <div className="min-w-0">
                <YakuAlertLogo size="sm" variant="dark" />
                <div className="mt-1 text-xs text-slate-300">
                  Guía informativa offline · No reemplaza alertas oficiales
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar asistente"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
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
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#0B2545] font-medium text-white dark:bg-[#0369A1]"
                        : "border border-slate-200/80 bg-[#F8FAFC] text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.action && (
                    <button
                      type="button"
                      onClick={() => executeAction(m.action)}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[#0369A1]/40 bg-[#F0F9FF] px-3 py-1.5 text-xs font-bold text-[#0369A1] hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/60 dark:text-[#38BDF8]"
                    >
                      {m.action.type === "locate" && <MapPin className="h-3.5 w-3.5" />}
                      {m.action.type === "sensor" && <Radio className="h-3.5 w-3.5" />}
                      {m.action.type === "sim" && <Sliders className="h-3.5 w-3.5" />}
                      {m.action.type === "nav" && <BookOpen className="h-3.5 w-3.5" />}
                      {m.action.label}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Preguntas rápidas sugeridas (1 clic para Q&A) */}
            <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-[#F8FAFC] px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuery(q)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#0B2545] transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] hover:text-[#0369A1] dark:border-slate-700 dark:bg-[#0B2545] dark:text-slate-200"
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
              className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta..."
                aria-label="Escribir consulta al asistente YAKU"
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="submit"
                aria-label="Enviar consulta"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2545] text-white transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
