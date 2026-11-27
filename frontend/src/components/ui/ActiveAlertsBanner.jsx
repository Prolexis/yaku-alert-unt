import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  Map as MapIcon,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCode2,
  Users,
  Check,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { formatLimaTime } from "../../utils/formatters";

const SEVERITY_STYLES = {
  VERDE: {
    border: "border-[#059669]/40 dark:border-emerald-800",
    bg: "bg-[#ECFDF5] dark:bg-emerald-950/45",
    badge: "bg-[#059669] text-white",
    text: "text-[#065F46] dark:text-emerald-100",
    label: "VERDE · Informativo",
  },
  AMARILLO: {
    border: "border-[#0284C7]/40 dark:border-sky-800",
    bg: "bg-[#F0F9FF] dark:bg-sky-950/45",
    badge: "bg-[#0284C7] text-white",
    text: "text-[#075985] dark:text-sky-100",
    label: "AMARILLO · Vigilancia",
  },
  NARANJA: {
    border: "border-[#D97706]/45 dark:border-amber-700",
    bg: "bg-[#FFFBEB] dark:bg-amber-950/45",
    badge: "bg-[#D97706] text-white",
    text: "text-[#92400E] dark:text-amber-100",
    label: "NARANJA · Atención",
  },
  ROJO: {
    border: "border-[#DC2626]/45 dark:border-red-700",
    bg: "bg-[#FEF2F2] dark:bg-red-950/45",
    badge: "bg-[#DC2626] text-white",
    text: "text-[#991B1B] dark:text-red-100",
    label: "ROJO · Crítica",
  },
};

const ROLE_QUICK_NOTE = {
  estudiante:
    "Orientación Estudiante: prioriza puntos seguros de cota alta y evita cruzar calles anegadas (Puerta 4 / Puerta 3).",
  docente:
    "Orientación Docente: habilita aula virtual UNT para sesiones teóricas y reprograma laboratorios sin penalización.",
  administrativo:
    "Orientación Administrativo: activa Mesa de Partes virtual UNT y resguarda expedientes/equipos en planta baja.",
};

export default function ActiveAlertsBanner({
  alerts = [],
  onOpenSafeRoutes,
  canResolve = false,
  onResolveAlert,
  onValidateAlert,
  onConfirmAlert,
  onSendWhatsApp,
  whatsappStatus = null,
  activeDemoRole = "estudiante",
}) {
  const [confirmedMap, setConfirmedMap] = useState({});
  const [sendingWaId, setSendingWaId] = useState(null);

  if (!alerts.length) return null;

  const isCommunity = ["estudiante", "docente", "administrativo"].includes(activeDemoRole);

  const handleConfirm = async (alertId, status) => {
    if (!onConfirmAlert) return;
    await onConfirmAlert(alertId, status);
    setConfirmedMap((prev) => ({ ...prev, [alertId]: status }));
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        aria-label="Avisos institucionales activos (Estándar CAP 1.2)"
        className="space-y-3"
      >
        {alerts.slice(0, 3).map((alert) => {
          const sevKey = alert.severity || "AMARILLO";
          const st = SEVERITY_STYLES[sevKey] || SEVERITY_STYLES.AMARILLO;
          const { local } = formatLimaTime(alert.validated_at || alert.created_at);
          const conf = alert.confirmations || { total: 0, recibido: 0, en_zona_segura: 0, by_role: {} };
          const myStatus = confirmedMap[alert.id];
          const isDraft = alert.status === "borrador_pendiente_validacion";
          const certaintyMatch = String(alert.what_happens || alert.title || "").match(
            /Certeza(?:\s+modelada)?:\s*(\d{1,3})%/i
          );
          const certaintyPct = certaintyMatch ? certaintyMatch[1] : null;

          return (
            <div
              key={alert.id}
              className={`rounded-2xl border-2 p-4 shadow-panel ${st.border} ${st.bg}`}
            >
              {/* Cabecera CAP 1.2 + timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${st.badge}`}
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    <span>{isDraft ? "BORRADOR PENDIENTE DE VALIDACIÓN" : `ALERTA ${st.label}`}</span>
                  </span>
                  <span className="rounded bg-white/90 px-2 py-0.5 font-mono text-xs font-bold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-900 dark:text-[#38BDF8] dark:ring-slate-700">
                    {alert.cap_identifier || `CAP-${alert.id}`}
                  </span>
                  {certaintyPct && (
                    <span className="rounded-full bg-[#0B2545] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-white dark:bg-[#0369A1]">
                      Certeza modelada: {certaintyPct}%
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#475569] tabular-nums dark:text-slate-300">
                    <Clock className="h-3.5 w-3.5" />
                    {local}
                  </span>
                </div>

                <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold text-[#475569] dark:bg-slate-900/70 dark:text-slate-300">
                  Mensaje de ejemplo, no oficial — Estándar CAP 1.2
                </span>
              </div>

              {/* Anatomía oficial de 5 bloques CAP 1.2 */}
              <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                <div className="rounded-xl bg-white/90 p-3 dark:bg-[#0B2545]/90">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                    1. Qué pasa
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-[#0F172A] dark:text-white">
                    {alert.what_happens || alert.title}
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 p-3 dark:bg-[#0B2545]/90">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                    2. Dónde
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-[#0F172A] dark:text-white">
                    {alert.where_zone || "Ciudad Universitaria UNT"}
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 p-3 dark:bg-[#0B2545]/90">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                    3. Cuándo
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-[#0F172A] dark:text-white">
                    {alert.when_window || "Próximas 24 horas"}
                  </div>
                </div>
              </div>

              {/* Bloque 4 destacado: Qué hacer */}
              <div className="mt-2.5 rounded-xl border border-[#0B2545]/20 bg-white p-3.5 shadow-subtle dark:border-sky-800 dark:bg-[#0B2545]">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-[#38BDF8]">
                  4. Qué hacer (Acción inmediata)
                </div>
                <p className="mt-1 whitespace-pre-line text-xs font-semibold leading-relaxed text-[#0F172A] dark:text-slate-100">
                  {(alert.what_to_do || alert.message || "").slice(0, 320)}
                </p>
                {isCommunity && ROLE_QUICK_NOTE[activeDemoRole] && (
                  <p className="mt-2 rounded-lg bg-[#F0F9FF] px-3 py-1.5 text-xs font-bold text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-200">
                    {ROLE_QUICK_NOTE[activeDemoRole]}
                  </p>
                )}
              </div>

              {/* Bloque 5: Quién lo emite + acciones de Confirmación / Validación / CAP 1.2 */}
              <div className="mt-3 flex flex-col justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/80 lg:flex-row lg:items-center">
                <div className="space-y-0.5 text-xs text-[#475569] dark:text-slate-300">
                  <div>
                    <strong className="text-[#0F172A] dark:text-white">5. Quién lo emite:</strong>{" "}
                    {alert.issuer}
                    {alert.validated_by_role && (
                      <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        Validado por: {alert.validated_by_role}
                      </span>
                    )}
                    {alert.whatsapp_status === "enviado" && (
                      <span
                        title={alert.whatsapp_message_id ? `wamid: ${alert.whatsapp_message_id}` : "Enviado por WhatsApp Sandbox"}
                        className="ml-1.5 inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#059669] ring-1 ring-[#059669]/30 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Enviado por WhatsApp ✓
                      </span>
                    )}
                    {alert.whatsapp_status === "simulado" && canResolve && (
                      <span className="ml-1.5 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#475569] dark:bg-slate-800 dark:text-slate-300">
                        WhatsApp: Simulado
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1 font-bold text-[#0B2545] dark:text-white">
                      <Users className="h-3.5 w-3.5 text-[#0369A1]" />
                      Confirmaciones: {conf.total}
                    </span>
                    <span>(Recibido: {conf.recibido} · En zona segura: {conf.en_zona_segura})</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Botones de Confirmación de Recepción (Etapa 5 SAT) para Comunidad UNT */}
                  {isCommunity && onConfirmAlert && !isDraft && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleConfirm(alert.id, "recibido")}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
                          myStatus === "recibido"
                            ? "bg-[#0369A1] text-white"
                            : "border border-[#0369A1]/40 bg-white text-[#0369A1] hover:bg-[#F0F9FF] dark:border-sky-700 dark:bg-slate-900 dark:text-[#38BDF8]"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{myStatus === "recibido" ? "Recibido ✓" : "Confirmar recibido"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirm(alert.id, "en_zona_segura")}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
                          myStatus === "en_zona_segura"
                            ? "bg-[#059669] text-white"
                            : "bg-[#059669] text-white hover:bg-emerald-700"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>
                          {myStatus === "en_zona_segura"
                            ? "En zona segura ✓"
                            : "Estoy en zona segura"}
                        </span>
                      </button>
                    </>
                  )}

                  {onOpenSafeRoutes && (
                    <button
                      type="button"
                      onClick={onOpenSafeRoutes}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0B2545] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      <span>Ver rutas seguras</span>
                    </button>
                  )}

                  {/* Acciones de Gestión (Validación Humana + Descargar CAP 1.2 + Cerrar) */}
                  {canResolve && isDraft && onValidateAlert && (
                    <button
                      type="button"
                      onClick={() => onValidateAlert(alert.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Validar y emitir (Humano)</span>
                    </button>
                  )}

                  {canResolve && !isDraft && onSendWhatsApp && (
                    <button
                      type="button"
                      disabled={sendingWaId === alert.id}
                      onClick={async () => {
                        setSendingWaId(alert.id);
                        try {
                          await onSendWhatsApp(alert.id);
                        } finally {
                          setSendingWaId(null);
                        }
                      }}
                      title={
                        whatsappStatus?.configured
                          ? "Envío restringido a números de prueba autorizados del equipo (Sandbox Meta — TRL 3–4)."
                          : "WhatsApp Cloud API en modo simulado (sin credenciales sandbox)."
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#075E54] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#059669] disabled:opacity-60"
                    >
                      {sendingWaId === alert.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {alert.whatsapp_status === "enviado"
                          ? "Reenviar WhatsApp (CAP 1.2)"
                          : "Enviar por WhatsApp (CAP 1.2)"}
                      </span>
                    </button>
                  )}

                  {canResolve && (
                    <a
                      href={`/api/alerts/${alert.id}/cap?format=xml`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0B2545] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <FileCode2 className="h-3.5 w-3.5 text-[#0369A1]" />
                      <span>Descargar CAP 1.2</span>
                    </a>
                  )}

                  {canResolve && onResolveAlert && !isDraft && (
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                      <span>Cerrar aviso</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </motion.section>
    </AnimatePresence>
  );
}
