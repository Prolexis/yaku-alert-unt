import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Check, CheckCheck, Download, Printer, Send, Mail, MessageSquare } from "lucide-react";
import { formatLimaTime, humanPreventiveTitle } from "../../utils/formatters";
import { downloadBulletin, printBulletin } from "../../utils/bulletin";

const PROFILES = [
  { id: "estudiantes", label: "Estudiantes" },
  { id: "docentes", label: "Docentes" },
  { id: "administrativos", label: "Personal administrativo" },
];

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp / Telegram", icon: MessageSquare },
  { id: "email", label: "Correo institucional UNT", icon: Mail },
];

const PROFILE_CONTINUITY = {
  INFORMATIVO: {
    estudiantes:
      "Clases presenciales con normalidad. Revisa los puntos seguros y rutas referenciales del campus antes de desplazarte.",
    docentes:
      "Actividades lectivas regulares. Mantén habilitada el aula virtual UNT como respaldo preventivo ante cambios de pronóstico.",
    administrativos:
      "Atención presencial regular en oficinas y Mesa de Partes. Verifica el estado de drenajes y resguardo básico en primer nivel.",
  },
  VIGILANCIA_PREVENTIVA: {
    estudiantes:
      "Clases presenciales con flexibilidad de asistencia para quienes provienen de zonas periféricas. Evita zonas bajas o con acumulación superficial.",
    docentes:
      "Habilita grabación o transmisión sincrónica de sesiones teóricas y coordina facilidades para prácticas en primer nivel.",
    administrativos:
      "Prioriza la recepción de trámites por Mesa de Partes virtual UNT y resguarda expedientes físicos y equipos de cómputo en planta baja.",
  },
  ATENCION_PREVENTIVA: {
    estudiantes:
      "Transición temporal a modalidad virtual (aula virtual UNT) para cursos teóricos; prácticas y evaluaciones presenciales se reprograman sin penalización.",
    docentes:
      "Ejecuta sesiones teóricas en aula virtual UNT, suspende prácticas presenciales en pabellones expuestos y reprograma evaluaciones sin penalización.",
    administrativos:
      "Activa Mesa de Partes virtual UNT, habilita trabajo remoto temporal para oficinas en planta baja o zonas con exposición hídrica y asegura equipos críticos.",
  },
  PREPARACION_CRITICA: {
    estudiantes:
      "Suspensión preventiva de actividades presenciales y continuidad remota integral. Evita desplazamientos hacia o desde la Ciudad Universitaria.",
    docentes:
      "Migración integral a modalidad remota y suspensión de prácticas presenciales hasta comunicado oficial de reanudación de la UNT.",
    administrativos:
      "Trabajo remoto temporal obligatorio para oficinas expuestas, atención exclusiva por Mesa de Partes virtual y activación del protocolo de resguardo de archivos y servidores.",
  },
};

function buildEvacuationRecommendation(evaluation, simResult, hydroResult) {
  const affectedAccesses = [];
  if (hydroResult?.elements?.length) {
    hydroResult.elements
      .filter((e) => e.category === "acceso" && e.first_hour_affected !== null)
      .forEach((e) => affectedAccesses.push(e.name));
  } else if (simResult?.spatial_analysis?.restricted_accesses?.length) {
    simResult.spatial_analysis.restricted_accesses
      .filter((a) => a.inside_hazard_zone)
      .forEach((a) => affectedAccesses.push(a.name));
  }

  const uniqueAccesses = Array.from(new Set(affectedAccesses)).slice(0, 3);
  if (uniqueAccesses.length > 0) {
    return `Evitar tránsito por accesos con exposición modelada (${uniqueAccesses.join(", ")}) y priorizar rutas referenciales hacia puntos seguros de cota alta (Explanada Sociales, Parque Max Díaz o Parque Economía).`;
  }
  if (evaluation?.preventive_level === "INFORMATIVO") {
    return "Sin restricción modelada en accesos. Mantener identificadas las rutas referenciales hacia puntos seguros de cota alta en el campus.";
  }
  return "Priorizar vías internas de cota alta hacia puntos seguros referenciales (Explanada Sociales, Parque Max Díaz, Parque Economía) y evitar zonas bajas cercanas a Puerta 3, Comedor y estacionamientos.";
}

function buildBroadcastDraft({ evaluation, weather, simResult, hydroResult, profileId, channelId }) {
  const levelKey = evaluation?.preventive_level || "INFORMATIVO";
  const isSim = Boolean(evaluation?.is_synthetic);
  const title = humanPreventiveTitle(levelKey, isSim);
  const { local } = formatLimaTime(weather?.fetched_at_utc);
  const profileLabel = PROFILES.find((p) => p.id === profileId)?.label || "Comunidad UNT";

  const metRules = (evaluation?.rules_triggered || []).map((r) => r.rule_id);
  const hidRules = (hydroResult?.evaluation?.rules_triggered || []).map((r) => r.rule_id);
  const allRules = Array.from(new Set([...metRules, ...hidRules]));
  const rulesText = allRules.length > 0 ? allRules.join(", ") : "R-MET-00";

  const evacText = buildEvacuationRecommendation(evaluation, simResult, hydroResult);
  const continuityText =
    PROFILE_CONTINUITY[levelKey]?.[profileId] ||
    (evaluation?.academic_continuity?.[0] ?? "Seguir disposiciones oficiales de la UNT.");

  const disclaimer =
    "Aviso generado en modo simulación (TRL 3–4). No reemplaza alertas oficiales de SENAMHI, COEN, INDECI ni Defensa Civil UNT.";

  if (channelId === "whatsapp") {
    return [
      `[YAKU ALERT — UNT | ${levelKey}]`,
      `Dirigido a: ${profileLabel}`,
      `Estado: ${title}`,
      `Referencia: ${local}`,
      "",
      `• Situación: ${evaluation.hazard_assessment}`,
      `• Reglas activadas: ${rulesText}`,
      `• Accesos y evacuación ref.: ${evacText}`,
      `• Continuidad (${profileLabel}): ${continuityText}`,
      "",
      `Nota: ${disclaimer}`,
    ].join("\n");
  }

  return [
    `Asunto: [YAKU ALERT UNT — ${levelKey}] Orientación preventiva para ${profileLabel} (${local})`,
    "",
    `Estimado(a) integrante del estamento de ${profileLabel} de la Universidad Nacional de Trujillo:`,
    "",
    `En el marco del monitoreo preventivo experimental (TRL 3–4), se comparte la siguiente orientación correspondiente al nivel ${title} (${levelKey}):`,
    "",
    `1. Situación evaluada: ${evaluation.hazard_assessment}`,
    `2. Exposición en campus: ${evaluation.exposure_assessment}`,
    `3. Reglas técnicas activadas: ${rulesText}`,
    `4. Recomendación de accesos y evacuación referencial: ${evacText}`,
    `5. Pauta de continuidad (${profileLabel}): ${continuityText}`,
    "",
    "Se recuerda consultar únicamente los canales oficiales de la UNT, SENAMHI, INDECI y COEN para decisiones operativas.",
    "",
    "Atentamente,",
    "Módulo de Apoyo Preventivo — YAKU ALERT UNT (Prototipo TRL 3–4)",
    `Nota legal: ${disclaimer}`,
  ].join("\n");
}

async function copyToClipboardSafe(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback debajo
    }
  }
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
  return false;
}

export default function PreventiveMessageCard({
  evaluation,
  weather,
  simResult,
  hydroResult,
  userRole = "student",
}) {
  const [profileId, setProfileId] = useState("estudiantes");
  const [channelId, setChannelId] = useState("whatsapp");
  const [copied, setCopied] = useState(false);

  const draftText = useMemo(() => {
    if (!evaluation || userRole !== "admin") return "";
    return buildBroadcastDraft({
      evaluation,
      weather,
      simResult,
      hydroResult,
      profileId,
      channelId,
    });
  }, [evaluation, weather, simResult, hydroResult, profileId, channelId, userRole]);

  if (!evaluation) return null;

  const isSim = Boolean(evaluation.is_synthetic);
  const title = humanPreventiveTitle(evaluation.preventive_level, isSim);
  const { local, utc } = formatLimaTime(weather?.fetched_at_utc);

  const badge = isSim
    ? { text: "Escenario simulado", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200" }
    : weather?.data_status === "LIVE_API"
    ? { text: "Evaluación experimental · Pronóstico", cls: "bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200" }
    : { text: "Evaluación sobre caché offline", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200" };

  const handleCopy = async () => {
    const ok = await copyToClipboardSafe(draftText);
    if (ok) {
      setCopied(true);
      toast.success("Aviso preventivo copiado al portapapeles");
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      aria-label="Mensaje preventivo estructurado"
      className="rounded-xl border border-l-4 border-[#E2E8F0] bg-white p-6 dark:border-slate-800 dark:bg-[#0B1F33]"
      style={{ borderLeftColor: evaluation.level_color }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
            {badge.text}
          </span>
          <h3 className="mt-2 text-2xl font-bold text-[#101828] dark:text-white">{title}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadBulletin({ evaluation, weather, simResult, hydroResult })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5 text-[#2563EB]" />
            Descargar boletín
          </button>
          <button
            type="button"
            onClick={() => printBulletin({ evaluation, weather, simResult, hydroResult })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Printer className="h-3.5 w-3.5 text-[#2563EB]" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Estructura QUÉ → DÓNDE → CUÁNDO → QUÉ HACER → QUIÉN INFORMA */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Qué ocurre</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            {evaluation.hazard_assessment}
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Dónde</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            Ciudad Universitaria UNT · {evaluation.exposure_assessment}
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Cuándo</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200" title={utc}>
            Referencia: {local}. Vigente hasta la próxima actualización de datos o cambio de escenario.
          </p>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3.5 dark:bg-slate-900/60">
          <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">Quién informa</div>
          <p className="mt-1 text-sm text-[#101828] dark:text-slate-200">
            Prototipo informativo YAKU ALERT — UNT (TRL 3–4). No sustituye avisos oficiales de
            SENAMHI, INDECI, COEN ni Defensa Civil UNT.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#E2E8F0] p-4 dark:border-slate-800">
        <div className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">
          Qué hacer (Orientaciones preventivas)
        </div>
        <ul className="mt-2 space-y-2 text-sm text-[#101828] dark:text-slate-200">
          {evaluation.guidance.map((g, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Generador de avisos preventivos por perfil y canal (solo vista Gestión / Administrador) */}
      {userRole === "admin" && (
        <div className="mt-5 rounded-xl border border-blue-200/80 bg-[#F7F9FC] p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#101828] dark:text-white">
                <Send className="h-4 w-4 text-[#2563EB]" />
                <span>Generador de avisos preventivos por perfil y canal</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                Simulación de difusión (TRL 3–4) — No envía mensajes a sistemas reales ni reemplaza alertas oficiales de SENAMHI/COEN.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copiado" : "Copiar aviso"}</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* Selector de perfil */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Perfil destinatario">
              <span className="mr-1 text-xs font-semibold text-[#475467] dark:text-slate-400">
                Perfil:
              </span>
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfileId(p.id)}
                  aria-pressed={profileId === p.id}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    profileId === p.id
                      ? "bg-[#0B1F33] text-white dark:bg-[#2563EB]"
                      : "border border-[#E2E8F0] bg-white text-[#475467] hover:text-[#101828] dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Selector de canal */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Canal de difusión simulado">
              <span className="mr-1 text-xs font-semibold text-[#475467] dark:text-slate-400">
                Canal:
              </span>
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChannelId(ch.id)}
                    aria-pressed={channelId === ch.id}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      channelId === ch.id
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] bg-white text-[#475467] hover:text-[#101828] dark:border-slate-700 dark:bg-[#0B1F33] dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vista previa estilizada tipo WhatsApp o Correo institucional UNT */}
          {channelId === "whatsapp" ? (
            <div className="mt-3.5 overflow-hidden rounded-2xl border border-emerald-200 bg-[#EFEAE2] shadow-subtle dark:border-emerald-900/60 dark:bg-slate-950">
              <div className="flex items-center justify-between bg-[#075E54] px-4 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-extrabold">
                    YA
                  </span>
                  <div>
                    <div className="text-xs font-bold leading-tight">Yaku Alert · Difusión UNT</div>
                    <div className="text-[11px] text-emerald-100">
                      Vista previa WhatsApp / Telegram · {PROFILES.find((p) => p.id === profileId)?.label}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold">
                  SIM
                </span>
              </div>
              <div className="p-3.5">
                <div className="ml-auto max-w-2xl rounded-2xl rounded-tr-sm bg-[#DCF8C6] p-3.5 shadow-sm dark:bg-emerald-950/80">
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#0F172A] dark:text-emerald-50">
                    {draftText}
                  </pre>
                  <div className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[11px] text-[#475569] dark:text-emerald-300/80">
                    <span>{local.split(" ")[0] || "Ahora"}</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#0284C7]" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-subtle dark:border-slate-700 dark:bg-[#0B2545]">
              <div className="flex items-center justify-between bg-[#0B2545] px-4 py-2.5 text-white dark:bg-[#071524]">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Mail className="h-4 w-4 text-[#38BDF8]" />
                  <span>Correo Institucional UNT — Borrador Preventivo</span>
                </div>
                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#38BDF8]">
                  TRL 3–4
                </span>
              </div>
              <div className="border-b border-slate-200 bg-[#F8FAFC] px-4 py-2 text-xs text-[#475569] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <div>
                  <strong className="text-[#0F172A] dark:text-white">Para:</strong>{" "}
                  {PROFILES.find((p) => p.id === profileId)?.label} — Universidad Nacional de Trujillo
                </div>
              </div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap p-4 font-sans text-xs leading-relaxed text-[#0F172A] dark:text-slate-100">
                {draftText}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
