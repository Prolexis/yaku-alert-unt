import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  FileCode2,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { formatLimaTime } from "../utils/formatters";

const SEVERITY_STYLES = {
  ROJO: {
    border: "border-[#DC2626]/45 dark:border-red-700",
    bg: "bg-[#FEF2F2]/75 dark:bg-red-950/35",
    badge: "bg-[#DC2626] text-white",
    label: "ROJO · Crítica",
  },
  NARANJA: {
    border: "border-[#D97706]/45 dark:border-amber-700",
    bg: "bg-[#FFFBEB]/80 dark:bg-amber-950/35",
    badge: "bg-[#D97706] text-white",
    label: "NARANJA · Atención",
  },
  AMARILLO: {
    border: "border-[#0284C7]/40 dark:border-sky-800",
    bg: "bg-[#F0F9FF]/80 dark:bg-sky-950/35",
    badge: "bg-[#0284C7] text-white",
    label: "AMARILLO · Vigilancia",
  },
  VERDE: {
    border: "border-[#059669]/40 dark:border-emerald-800",
    bg: "bg-[#ECFDF5]/80 dark:bg-emerald-950/35",
    badge: "bg-[#059669] text-white",
    label: "VERDE · Informativo",
  },
};

const ROLE_GUIDANCE = {
  estudiante:
    "Orientación Estudiante: prioriza puntos de encuentro en cota alta, evita accesos con aniego (Puerta 4 / Puerta 3) y confirma tu estado.",
  docente:
    "Orientación Docente: migra clases teóricas al aula virtual UNT, reprograma laboratorios y evaluaciones sin penalización y guía al grupo al punto seguro.",
  administrativo:
    "Orientación Personal Administrativo: activa Mesa de Partes virtual UNT, desconecta y resguarda equipos/expedientes en planta baja y prioriza trabajo remoto.",
};

const SEVERITY_FILTERS = [
  { id: "TODAS", label: "Todas" },
  { id: "ROJO", label: "Rojo" },
  { id: "NARANJA", label: "Naranja" },
  { id: "AMARILLO", label: "Amarillo" },
  { id: "VERDE", label: "Verde" },
];

export default function NotificationsView({
  alerts = [],
  userRole = "student",
  activeDemoRole = "estudiante",
  confirmedMap = {},
  onConfirmAlert,
  onValidateAlert,
  onResolveAlert,
  onSendWhatsApp,
  whatsappStatus = null,
  onOpenSafeRoutes,
}) {
  const [activeTab, setActiveTab] = useState("activas");
  const [severityFilter, setSeverityFilter] = useState("TODAS");
  const [sendingWaId, setSendingWaId] = useState(null);

  const isAdmin = userRole === "admin";
  const isDirectivo = activeDemoRole === "directivo";
  const isCommunity = ["estudiante", "docente", "administrativo"].includes(activeDemoRole);

  const activeList = useMemo(
    () => alerts.filter((a) => a.status === "emitida" && a.active),
    [alerts]
  );
  const draftList = useMemo(
    () => alerts.filter((a) => a.status === "borrador_pendiente_validacion"),
    [alerts]
  );
  const historyList = useMemo(
    () =>
      alerts.filter(
        (a) => a.status === "resuelta" || (!a.active && a.status !== "borrador_pendiente_validacion")
      ),
    [alerts]
  );

  const tabs = useMemo(() => {
    const base = [
      { id: "activas", label: "Activas", count: activeList.length },
      { id: "historial", label: "Historial", count: historyList.length },
    ];
    if (isAdmin) {
      base.push({
        id: "pendientes",
        label: "Pendientes de validación",
        count: draftList.length,
      });
    }
    return base;
  }, [activeList.length, historyList.length, draftList.length, isAdmin]);

  const effectiveTab = !isAdmin && activeTab === "pendientes" ? "activas" : activeTab;

  const currentList = useMemo(() => {
    const source =
      effectiveTab === "historial"
        ? historyList
        : effectiveTab === "pendientes"
        ? draftList
        : activeList;
    if (severityFilter === "TODAS") return source;
    return source.filter((a) => String(a.severity || "AMARILLO").toUpperCase() === severityFilter);
  }, [effectiveTab, activeList, historyList, draftList, severityFilter]);

  return (
    <div className="space-y-5">
      {/* Cabecera clara */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0369A1]/30 bg-[#F0F9FF] px-3 py-0.5 text-xs font-extrabold text-[#0369A1] dark:border-sky-800 dark:bg-sky-950/60 dark:text-[#38BDF8]">
              <BellRing className="h-3.5 w-3.5" />
              <span>{activeList.length} alerta(s) activa(s)</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#475569] dark:bg-slate-800 dark:text-slate-300">
              Estándar OASIS CAP 1.2 · TRL 3–4
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
            Centro de Notificaciones y Alertas CAP 1.2
          </h2>
          <p className="mt-0.5 text-sm text-[#475569] dark:text-slate-400">
            {isAdmin
              ? "Valida alertas con intervención humana, monitorea confirmaciones por perfil y gestiona el historial CAP 1.2."
              : "Consulta avisos institucionales vigentes, confirma tu estado y abre tu ruta segura hacia zonas altas."}
          </p>
        </div>

        {/* Filtro por severidad */}
        <div
          role="group"
          aria-label="Filtrar por severidad"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-subtle dark:border-slate-700 dark:bg-[#0B2545]"
        >
          {SEVERITY_FILTERS.map((f) => {
            const active = severityFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSeverityFilter(f.id)}
                aria-pressed={active}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  active
                    ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                    : "text-[#475569] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pestañas: Activas | Historial | Pendientes de validación (solo Gestión UNT) */}
      <div
        role="tablist"
        aria-label="Categorías de notificaciones"
        className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800"
      >
        {tabs.map((tab) => {
          const isSel = effectiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSel}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                isSel
                  ? "bg-[#0B2545] text-white shadow-sm dark:bg-[#0369A1]"
                  : "border border-slate-200 bg-white text-[#475569] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                  isSel
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-[#0B2545] dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido: Estado vacío tranquilo o tarjetas CAP 1.2 completas */}
      {currentList.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-[#059669]/30 bg-white px-6 py-12 text-center shadow-panel dark:border-emerald-800/70 dark:bg-[#0B2545]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-300">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-lg font-extrabold text-[#0F172A] dark:text-white">
            {effectiveTab === "activas"
              ? "Sin alertas activas en la UNT"
              : effectiveTab === "pendientes"
              ? "Sin borradores pendientes de validación"
              : "Sin registros en el historial"}
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[#475569] dark:text-slate-300">
            {severityFilter !== "TODAS"
              ? `No hay notificaciones con severidad ${severityFilter} en esta pestaña.`
              : "El campus opera con normalidad preventiva. Puedes consultar el Mapa UNT para ubicar tu facultad y los puntos de encuentro referenciales."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {severityFilter !== "TODAS" && (
              <button
                type="button"
                onClick={() => setSeverityFilter("TODAS")}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-[#0F172A] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                Ver todas las severidades
              </button>
            )}
            {onOpenSafeRoutes && (
              <button
                type="button"
                onClick={onOpenSafeRoutes}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
              >
                <MapIcon className="h-4 w-4" />
                <span>Ir al Mapa UNT</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {currentList.map((alert) => {
              const sevKey = String(alert.severity || "AMARILLO").toUpperCase();
              const st = SEVERITY_STYLES[sevKey] || SEVERITY_STYLES.AMARILLO;
              const { local } = formatLimaTime(alert.validated_at || alert.created_at);
              const conf = alert.confirmations || {
                total: 0,
                recibido: 0,
                en_zona_segura: 0,
                by_role: {},
              };
              const byRole = conf.by_role || {};
              const myStatus = confirmedMap[alert.id];
              const isDraft = alert.status === "borrador_pendiente_validacion";
              const isResolved = alert.status === "resuelta" || !alert.active;
              const certaintyMatch = String(alert.what_happens || alert.title || "").match(
                /Certeza(?:\s+modelada)?:\s*(\d{1,3})%/i
              );
              const certaintyPct = certaintyMatch ? certaintyMatch[1] : null;

              return (
                <motion.article
                  key={alert.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={`rounded-2xl border-2 p-5 shadow-panel ${st.border} ${st.bg}`}
                >
                  {/* Cabecera CAP 1.2 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-extrabold ${st.badge}`}
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        <span>
                          {isDraft
                            ? "BORRADOR PENDIENTE DE VALIDACIÓN"
                            : isResolved
                            ? `RESUELTA · ${st.label}`
                            : `ALERTA ${st.label}`}
                        </span>
                      </span>
                      <span className="rounded bg-white/90 px-2 py-0.5 font-mono text-xs font-bold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-900 dark:text-[#38BDF8] dark:ring-slate-700">
                        {alert.cap_identifier || `CAP-${alert.id}`}
                      </span>
                      {certaintyPct && (
                        <span className="rounded-full bg-[#0B2545] px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-white dark:bg-[#0369A1]">
                          Certeza modelada: {certaintyPct}%
                        </span>
                      )}
                      {alert.validated_by_role && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                          <ShieldCheck className="h-3 w-3" />
                          Validación Humana ({alert.validated_by_role})
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#475569] tabular-nums dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5" />
                        {local}
                      </span>
                    </div>

                    <span className="rounded-md bg-white/85 px-2.5 py-0.5 text-[11px] font-semibold text-[#475569] dark:bg-slate-900/75 dark:text-slate-300">
                      Mensaje de ejemplo, no oficial — Estándar CAP 1.2
                    </span>
                  </div>

                  {/* 5 campos oficiales CAP 1.2 */}
                  <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-white/95 p-3.5 dark:bg-[#0B2545]/95">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                        1. Qué pasa
                      </div>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-[#0F172A] dark:text-white">
                        {alert.what_happens || alert.title}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/95 p-3.5 dark:bg-[#0B2545]/95">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                        2. Dónde
                      </div>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-[#0F172A] dark:text-white">
                        {alert.where_zone || "Ciudad Universitaria UNT"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/95 p-3.5 dark:bg-[#0B2545]/95">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                        3. Cuándo
                      </div>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-[#0F172A] dark:text-white">
                        {alert.when_window || "Próximas 24 horas"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#0B2545]/20 bg-white p-4 shadow-subtle dark:border-sky-800 dark:bg-[#0B2545]">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#0B2545] dark:text-[#38BDF8]">
                      4. Qué hacer (Acción inmediata)
                    </div>
                    <p className="mt-1 whitespace-pre-line text-xs font-semibold leading-relaxed text-[#0F172A] dark:text-slate-100">
                      {alert.what_to_do || alert.message}
                    </p>
                    {isCommunity && ROLE_GUIDANCE[activeDemoRole] && (
                      <p className="mt-2.5 rounded-lg bg-[#F0F9FF] px-3 py-2 text-xs font-bold text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-200">
                        {ROLE_GUIDANCE[activeDemoRole]}
                      </p>
                    )}
                  </div>

                  {/* Bloque 5 + Confirmaciones + Acciones */}
                  <div className="mt-3.5 flex flex-col justify-between gap-3 border-t border-slate-200/80 pt-3.5 dark:border-slate-700/80 lg:flex-row lg:items-center">
                    <div className="space-y-1 text-xs text-[#475569] dark:text-slate-300">
                      <div>
                        <strong className="text-[#0F172A] dark:text-white">5. Quién lo emite:</strong>{" "}
                        {alert.issuer}
                        {alert.whatsapp_status === "enviado" && (
                          <span
                            title={
                              alert.whatsapp_message_id
                                ? `wamid: ${alert.whatsapp_message_id}`
                                : "Enviado por WhatsApp Sandbox"
                            }
                            className="ml-2 inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#059669] ring-1 ring-[#059669]/30 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp enviado ✓
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1 font-bold text-[#0B2545] dark:text-white">
                          <Users className="h-3.5 w-3.5 text-[#0369A1]" />
                          Confirmaciones: {conf.total}
                        </span>
                        {isAdmin ? (
                          <span className="text-[11px]">
                            (Estudiantes: {byRole.estudiante?.total || 0} · Docentes:{" "}
                            {byRole.docente?.total || 0} · Administrativos:{" "}
                            {byRole.administrativo?.total || 0})
                          </span>
                        ) : (
                          <span className="text-[11px]">
                            (Recibido: {conf.recibido} · En zona segura: {conf.en_zona_segura})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Acciones Comunidad UNT */}
                      {isCommunity && !isDraft && !isResolved && onConfirmAlert && (
                        <>
                          <button
                            type="button"
                            onClick={() => onConfirmAlert(alert.id, "recibido")}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
                              myStatus === "recibido"
                                ? "bg-[#0369A1] text-white"
                                : "border border-[#0369A1]/40 bg-white text-[#0369A1] hover:bg-[#F0F9FF] dark:border-sky-700 dark:bg-slate-900 dark:text-[#38BDF8]"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>
                              {myStatus === "recibido" ? "Recibido ✓" : "Confirmar recibido"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onConfirmAlert(alert.id, "en_zona_segura")}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
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

                      {onOpenSafeRoutes && !isResolved && (
                        <button
                          type="button"
                          onClick={onOpenSafeRoutes}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0B2545] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
                        >
                          <MapIcon className="h-3.5 w-3.5" />
                          <span>Ver ruta segura en el mapa</span>
                        </button>
                      )}

                      {/* Acciones Gestión UNT */}
                      {isAdmin && isDraft && onValidateAlert && isDirectivo && (
                        <button
                          type="button"
                          onClick={() => onValidateAlert(alert.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Validar y emitir</span>
                        </button>
                      )}

                      {isAdmin && isDraft && !isDirectivo && (
                        <span className="inline-flex h-9 items-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                          Pendiente de validación por Directivo
                        </span>
                      )}

                      {isAdmin && !isDraft && !isResolved && onSendWhatsApp && isDirectivo && (
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
                              ? "Envío restringido a números autorizados del equipo (Sandbox Meta)."
                              : "WhatsApp Cloud API en modo simulado."
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#075E54] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#059669] disabled:opacity-60"
                        >
                          {sendingWaId === alert.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          <span>Enviar por WhatsApp</span>
                        </button>
                      )}

                      {isAdmin && (
                        <a
                          href={`/api/alerts/${alert.id}/cap?format=xml`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0B2545] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <FileCode2 className="h-3.5 w-3.5 text-[#0369A1]" />
                          <span>Ver / Descargar CAP 1.2</span>
                        </a>
                      )}

                      {isAdmin && !isDraft && !isResolved && onResolveAlert && (
                        <button
                          type="button"
                          onClick={() => onResolveAlert(alert.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                          <span>Marcar como resuelta</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
