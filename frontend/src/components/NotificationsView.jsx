import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  BellRing,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCode2,
  HardDrive,
  Info,
  Laptop,
  Loader2,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Mountain,
  ShieldCheck,
  Users,
} from "lucide-react";
import { formatLimaTime } from "../utils/formatters";

const SEVERITY_STYLES = {
  ROJO: {
    cardBorder: "border-red-200/90 dark:border-red-900/70",
    headerBg: "bg-[#FEF2F2] border-b border-red-200/70 dark:bg-red-950/50 dark:border-red-900/60",
    badge: "bg-[#DC2626] text-white",
    humanLabel: "Alerta roja",
    simLabel: "Simulacro · Alerta roja",
  },
  NARANJA: {
    cardBorder: "border-amber-200/90 dark:border-amber-900/70",
    headerBg: "bg-[#FFFBEB] border-b border-amber-200/70 dark:bg-amber-950/50 dark:border-amber-900/60",
    badge: "bg-[#D97706] text-white",
    humanLabel: "Alerta naranja",
    simLabel: "Simulacro · Alerta naranja",
  },
  AMARILLO: {
    cardBorder: "border-sky-200/90 dark:border-sky-900/70",
    headerBg: "bg-[#F0F9FF] border-b border-sky-200/70 dark:bg-sky-950/50 dark:border-sky-900/60",
    badge: "bg-[#0284C7] text-white",
    humanLabel: "Aviso amarillo",
    simLabel: "Simulacro · Aviso",
  },
  VERDE: {
    cardBorder: "border-emerald-200/90 dark:border-emerald-900/70",
    headerBg: "bg-[#ECFDF5] border-b border-emerald-200/70 dark:bg-emerald-950/50 dark:border-emerald-900/60",
    badge: "bg-[#059669] text-white",
    humanLabel: "Informativo",
    simLabel: "Simulacro · Informativo",
  },
};

const QUICK_VISUAL_ACTIONS = {
  estudiante: [
    {
      icon: Mountain,
      iconCls: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300",
      title: "Ve a una zona alta",
      sub: "Sube a pisos altos o parques seguros del campus.",
    },
    {
      icon: Ban,
      iconCls: "bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/70 dark:text-red-300",
      title: "Evita Puerta 4 y 3",
      sub: "No cruces veredas ni calles con agua acumulada.",
    },
    {
      icon: Laptop,
      iconCls: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
      title: "Clases por internet",
      sub: "Conéctate a distancia y mantente bajo techo.",
    },
  ],
  docente: [
    {
      icon: Laptop,
      iconCls: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
      title: "Pasa a clase virtual",
      sub: "Dicta tu sesión teórica en Aula Virtual UNT.",
    },
    {
      icon: Mountain,
      iconCls: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300",
      title: "Sube con tu grupo",
      sub: "Guía con calma a tus alumnos hacia pisos altos.",
    },
    {
      icon: Ban,
      iconCls: "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300",
      title: "Sin faltas ni castigos",
      sub: "Posterga prácticas de laboratorio y exámenes.",
    },
  ],
  administrativo: [
    {
      icon: HardDrive,
      iconCls: "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300",
      title: "Sube equipos y papeles",
      sub: "Resguarda computadoras y carpetas en altura.",
    },
    {
      icon: Laptop,
      iconCls: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
      title: "Mesa de Partes virtual",
      sub: "Atiende trámites por canales digitales sin salir.",
    },
    {
      icon: Ban,
      iconCls: "bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/70 dark:text-red-300",
      title: "Evita Puerta 4 y 3",
      sub: "Desconecta enchufes si notas humedad en piso.",
    },
  ],
};

const SEVERITY_FILTERS = [
  { id: "TODAS", label: "Todas" },
  { id: "ROJO", label: "Roja" },
  { id: "NARANJA", label: "Naranja" },
  { id: "AMARILLO", label: "Amarilla" },
  { id: "VERDE", label: "Verde" },
];

function buildShortHumanCopy(rawTitle, sevKey, isSimAlert, whereZone) {
  const hasTechJargon = /lámina|h\+\d+|mm\b|escenario/i.test(rawTitle);
  if (!hasTechJargon) {
    return {
      title: rawTitle,
      summary: "Sigue los pasos recomendados y avisa cuando estés en un lugar seguro.",
    };
  }

  const cleanZone = (whereZone || "el campus UNT")
    .replace(/^Ciudad Universitaria UNT\s*/i, "")
    .trim();
  const zoneLabel = cleanZone
    ? cleanZone.replace(/^\((.*)\)$/, "en $1")
    : "en el campus UNT";

  if (sevKey === "ROJO") {
    return {
      title: isSimAlert
        ? `Agua muy alta ${zoneLabel} (Simulacro)`
        : `Peligro: agua muy alta ${zoneLabel}`,
      summary: isSimAlert
        ? "Práctica preventiva: el agua subiría rápido en la entrada. Sube a pisos altos o busca una zona segura."
        : "El nivel de agua representa riesgo alto en accesos bajos. Resguárdate en pisos altos o zonas seguras.",
    };
  }
  if (sevKey === "NARANJA") {
    return {
      title: isSimAlert
        ? `Lluvia fuerte ${zoneLabel} (Simulacro)`
        : `Cuidado: lluvia fuerte ${zoneLabel}`,
      summary: "Evita zonas bajas, permanece bajo techo y revisa tu ruta segura en el mapa.",
    };
  }
  if (sevKey === "AMARILLO") {
    return {
      title: `Atentos a lluvias ${zoneLabel}`,
      summary: "Mantente atento a nuevos avisos y ubica tu punto de encuentro más cercano.",
    };
  }
  return {
    title: `Todo tranquilo ${zoneLabel}`,
    summary: "Sin emergencias activas en este momento.",
  };
}

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
  onNavigate,
  onOpenSafeRoutes,
}) {
  const [activeTab, setActiveTab] = useState("activas");
  const [severityFilter, setSeverityFilter] = useState("TODAS");
  const [sendingWaId, setSendingWaId] = useState(null);
  const [expandedAlertIds, setExpandedAlertIds] = useState({});

  const toggleAlertDetails = (id) => {
    setExpandedAlertIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      { id: "activas", label: "Avisos activos", count: activeList.length },
      { id: "historial", label: "Historial", count: historyList.length },
    ];
    if (isAdmin) {
      base.push({
        id: "pendientes",
        label: "Por validar",
        count: draftList.length,
      });
    }
    return base;
  }, [activeList.length, historyList.length, draftList.length, isAdmin]);

  const effectiveTab = !isAdmin && activeTab === "pendientes" ? "activas" : activeTab;

  const baseSource =
    effectiveTab === "historial"
      ? historyList
      : effectiveTab === "pendientes"
      ? draftList
      : activeList;

  const currentList = useMemo(() => {
    if (severityFilter === "TODAS") return baseSource;
    return baseSource.filter(
      (a) => String(a.severity || "AMARILLO").toUpperCase() === severityFilter
    );
  }, [baseSource, severityFilter]);

  const showSeverityFilter = baseSource.length > 1 || severityFilter !== "TODAS";

  return (
    <div className="space-y-5">
      {/* Barra superior limpia */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Categorías de notificaciones"
          className="inline-flex items-center gap-1 rounded-xl bg-white p-1 shadow-subtle ring-1 ring-slate-200/80 dark:bg-[#0B2545] dark:ring-slate-800"
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  isSel
                    ? "bg-[#0B2545] text-white shadow-sm dark:bg-[#0369A1]"
                    : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                    isSel
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-[#475569] dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {showSeverityFilter && (
          <div
            role="group"
            aria-label="Filtrar por severidad"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-[#0B2545]"
          >
            {SEVERITY_FILTERS.map((f) => {
              const active = severityFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSeverityFilter(f.id)}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
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
        )}
      </div>

      {/* Estado tranquilo o tarjetas amplias de notificación */}
      {currentList.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-16 text-center shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-300">
            <ShieldCheck className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-xl font-extrabold text-[#0F172A] dark:text-white">
            {effectiveTab === "activas"
              ? "Todo tranquilo hoy en el campus"
              : effectiveTab === "pendientes"
              ? "Sin borradores pendientes"
              : "Aún no hay avisos anteriores"}
          </h3>
          <p className="mt-1 text-sm text-[#64748B] dark:text-slate-300">
            Cuando haya algún aviso importante de lluvias, aparecerá aquí con pasos claros.
          </p>
          {onOpenSafeRoutes && (
            <button
              type="button"
              onClick={onOpenSafeRoutes}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2545] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
            >
              <MapIcon className="h-4 w-4" />
              <span>Explorar Mapa UNT</span>
            </button>
          )}
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
              const rawHeadline = String(alert.what_happens || alert.title || "");
              const isSimAlert = /escenario|simulac/i.test(rawHeadline);
              const detailsExpanded = isAdmin || Boolean(expandedAlertIds[alert.id]);
              const whereText = alert.where_zone || "Ciudad Universitaria UNT";
              const humanCopy = isCommunity
                ? buildShortHumanCopy(rawHeadline, sevKey, isSimAlert, whereText)
                : { title: rawHeadline, summary: "" };
              const visualCards =
                QUICK_VISUAL_ACTIONS[activeDemoRole] || QUICK_VISUAL_ACTIONS.estudiante;
              const confText =
                conf.total === 1 ? "1 confirmado" : `${conf.total} confirmados`;

              return (
                <motion.article
                  key={alert.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-subtle dark:bg-[#0B2545] ${st.cardBorder}`}
                >
                  {/* Franja superior amplia de estado + ubicación + hora */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 text-xs sm:text-sm ${st.headerBg}`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold ${st.badge}`}
                      >
                        <BellRing className="h-4 w-4" />
                        <span>
                          {isDraft
                            ? "Por validar"
                            : isResolved
                            ? "Cerrado"
                            : isSimAlert
                            ? st.simLabel
                            : st.humanLabel}
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1 font-semibold text-[#0F172A] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700">
                        <MapPin className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
                        <span>{whereText}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#475569] dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{local}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 font-mono font-semibold text-[#0F172A] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-slate-700">
                        <Users className="h-3.5 w-3.5 text-[#059669]" />
                        <span>{confText}</span>
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo principal amplio y equilibrado */}
                  <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-12 lg:items-center">
                    <div className="space-y-5 lg:col-span-8">
                      <div>
                        <h3 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-[28px] sm:leading-tight">
                          {humanCopy.title}
                        </h3>
                        {humanCopy.summary && (
                          <p className="mt-1.5 text-sm leading-relaxed text-[#475569] dark:text-slate-300">
                            {humanCopy.summary}
                          </p>
                        )}
                      </div>

                      {isCommunity ? (
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                          {visualCards.map((c, idx) => {
                            const Icon = c.icon;
                            return (
                              <div
                                key={idx}
                                className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/75 p-5 dark:border-slate-800 dark:bg-slate-900/50"
                              >
                                <span
                                  className={`flex h-13 w-13 items-center justify-center rounded-2xl ${c.iconCls}`}
                                >
                                  <Icon className="h-6 w-6" />
                                </span>
                                <div className="mt-3.5 text-base font-extrabold text-[#0F172A] dark:text-white">
                                  {c.title}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-[#475569] dark:text-slate-300 sm:text-sm">
                                  {c.sub}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-slate-900/60">
                          <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-[#0F172A] dark:text-slate-100">
                            {alert.what_to_do || alert.message}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Panel derecho amplio y cómodo al toque */}
                    <div className="space-y-3.5 rounded-2xl border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/70 lg:col-span-4">
                      <div>
                        <div className="text-base font-extrabold text-[#0F172A] dark:text-white">
                          {isAdmin ? "Acciones operativas" : "¿Cómo estás?"}
                        </div>
                        {isCommunity && (
                          <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
                            Toca un botón para avisar o ver a dónde ir:
                          </p>
                        )}
                      </div>

                      {isCommunity && !isDraft && !isResolved && onConfirmAlert && (
                        <div className="space-y-2.5">
                          <button
                            type="button"
                            onClick={() => onConfirmAlert(alert.id, "en_zona_segura")}
                            className={`inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-xl px-4 text-sm font-extrabold text-white shadow-sm transition sm:text-base ${
                              myStatus === "en_zona_segura"
                                ? "bg-emerald-700 ring-2 ring-emerald-500/40"
                                : "bg-[#059669] hover:bg-emerald-700"
                            }`}
                          >
                            <ShieldCheck className="h-5 w-5" />
                            <span>
                              {myStatus === "en_zona_segura" ? "Ya estás a salvo ✓" : "Estoy a salvo"}
                            </span>
                          </button>

                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => onConfirmAlert(alert.id, "recibido")}
                              className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition sm:text-sm ${
                                myStatus === "recibido"
                                  ? "bg-[#0369A1] text-white"
                                  : "border border-slate-200 bg-white text-[#0F172A] hover:border-[#0369A1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              }`}
                            >
                              <Check className="h-4 w-4" />
                              <span>{myStatus === "recibido" ? "Visto ✓" : "Ya lo vi"}</span>
                            </button>

                            {onOpenSafeRoutes && (
                              <button
                                type="button"
                                onClick={onOpenSafeRoutes}
                                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#0B2545] px-3 text-xs font-bold text-white transition hover:bg-[#0369A1] dark:bg-[#0369A1] sm:text-sm"
                              >
                                <MapIcon className="h-4 w-4" />
                                <span>Ver ruta</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
                            <span>En zona segura: <strong className="text-[#059669] dark:text-emerald-400">{conf.en_zona_segura}</strong></span>
                            <span>Vistos: <strong className="text-[#0F172A] dark:text-white">{conf.recibido}</strong></span>
                          </div>
                        </div>
                      )}

                      {isCommunity && isResolved && onOpenSafeRoutes && (
                        <button
                          type="button"
                          onClick={onOpenSafeRoutes}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-4 text-sm font-bold text-white transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
                        >
                          <MapIcon className="h-4 w-4" />
                          <span>Ver Mapa UNT</span>
                        </button>
                      )}

                      {/* Acciones Gestión UNT */}
                      {isAdmin && (
                        <div className="flex flex-col gap-2">
                          {isDraft && onValidateAlert && isDirectivo && (
                            <button
                              type="button"
                              onClick={() => onValidateAlert(alert.id)}
                              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              <span>Validar y emitir alerta</span>
                            </button>
                          )}

                          {isDraft && !isDirectivo && (
                            <span className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-center text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                              Pendiente de validación por Directivo
                            </span>
                          )}

                          {!isDraft && !isResolved && onSendWhatsApp && isDirectivo && (
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
                              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#075E54] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#059669] disabled:opacity-60"
                            >
                              {sendingWaId === alert.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                              <span>Enviar por WhatsApp</span>
                            </button>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            {onOpenSafeRoutes && !isResolved && (
                              <button
                                type="button"
                                onClick={onOpenSafeRoutes}
                                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-[#0B2545] px-2.5 text-xs font-bold text-white hover:bg-[#0369A1] dark:bg-[#0369A1]"
                              >
                                <MapIcon className="h-3.5 w-3.5" />
                                <span>Mapa</span>
                              </button>
                            )}
                            <a
                              href={`/api/alerts/${alert.id}/cap?format=xml`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#0B2545] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <FileCode2 className="h-3.5 w-3.5 text-[#0369A1]" />
                              <span>XML CAP</span>
                            </a>
                          </div>

                          {!isDraft && !isResolved && onResolveAlert && (
                            <button
                              type="button"
                              onClick={() => onResolveAlert(alert.id)}
                              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-[#0F172A] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                              <span>Marcar como resuelta</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enlace discreto para ficha técnica completa */}
                  {!isAdmin && (
                    <div className="border-t border-slate-100 px-6 py-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => toggleAlertDetails(alert.id)}
                        aria-expanded={detailsExpanded}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] transition hover:text-[#0369A1] dark:text-slate-400 dark:hover:text-[#38BDF8]"
                      >
                        <Info className="h-3.5 w-3.5 text-[#0369A1] dark:text-[#38BDF8]" />
                        <span>
                          {detailsExpanded ? "Ocultar datos técnicos" : "Más información técnica"}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            detailsExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {detailsExpanded && (
                    <div className="space-y-3 border-t border-slate-200/80 bg-[#F8FAFC]/60 px-6 py-4 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-200/70 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0B2545] dark:bg-slate-800 dark:text-[#38BDF8]">
                          OASIS CAP 1.2 · {alert.cap_identifier || `CAP-${alert.id}`}
                        </span>
                        {alert.validated_by_role && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            Validación Humana ({alert.validated_by_role})
                          </span>
                        )}
                        {alert.whatsapp_status === "enviado" && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-bold text-[#059669] ring-1 ring-[#059669]/30 dark:bg-emerald-950 dark:text-emerald-300">
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp enviado ✓
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70 dark:bg-[#0B2545] dark:ring-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                            1. Qué pasa
                          </div>
                          <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-white">
                            {rawHeadline}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70 dark:bg-[#0B2545] dark:ring-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                            2. Dónde
                          </div>
                          <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-white">
                            {whereText}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70 dark:bg-[#0B2545] dark:ring-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                            3. Cuándo
                          </div>
                          <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-white">
                            {alert.when_window || "Próximas 24 horas"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70 dark:bg-[#0B2545] dark:ring-slate-800">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369A1] dark:text-[#38BDF8]">
                            4. Disposición oficial
                          </div>
                          <p className="mt-0.5 font-semibold text-[#0F172A] dark:text-white">
                            {alert.what_to_do || alert.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[#64748B] dark:text-slate-400">
                        <div>
                          <strong className="text-[#0F172A] dark:text-white">5. Emisor:</strong>{" "}
                          {alert.issuer}
                        </div>
                        <div className="font-mono text-[11px]">
                          {isAdmin
                            ? `Estudiantes: ${byRole.estudiante?.total || 0} · Docentes: ${byRole.docente?.total || 0} · Administrativos: ${byRole.administrativo?.total || 0}`
                            : `Vistos: ${conf.recibido} · A salvo: ${conf.en_zona_segura} · Prototipo TRL 3–4`}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* BLOQUE INFERIOR VISUAL PARA EL USUARIO (elimina el hueco vacío y guía hacia zonas altas / clases) */}
      {isCommunity && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Guía visual rápida de lugares altos vs. puertas a evitar */}
          <section className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                ¿Por dónde moverme en la UNT?
              </h4>
              {onOpenSafeRoutes && (
                <button
                  type="button"
                  onClick={onOpenSafeRoutes}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
                >
                  <span>Abrir mapa</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/80 bg-[#ECFDF5]/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#065F46] dark:text-emerald-300">
                  <Mountain className="h-4 w-4 shrink-0" />
                  <span>Zonas altas seguras</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs font-medium text-[#065F46]/90 dark:text-emerald-100 sm:text-sm">
                  <li>• Explanada de Sociales</li>
                  <li>• Parque de Economía</li>
                  <li>• Parque Max Díaz</li>
                </ul>
              </div>

              <div className="rounded-xl border border-red-200/80 bg-[#FEF2F2]/60 p-4 dark:border-red-900/60 dark:bg-red-950/30">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#991B1B] dark:text-red-300">
                  <Ban className="h-4 w-4 shrink-0" />
                  <span>Puertas a evitar si llueve</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs font-medium text-[#991B1B]/90 dark:text-red-100 sm:text-sm">
                  <li>• Puerta 4 (Av. J. de Nazareth)</li>
                  <li>• Puerta 3 (Comedor UNT)</li>
                  <li>• Bajadas o estacionamientos</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2 Tarjetas grandes de acceso rápido */}
          <div className="flex flex-col justify-between gap-3.5 lg:col-span-5">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("continuity")}
                className="group flex flex-1 items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-subtle transition hover:border-[#0369A1] dark:border-slate-800 dark:bg-[#0B2545]"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
                    <BookOpen className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-base font-extrabold text-[#0F172A] group-hover:text-[#0369A1] dark:text-white dark:group-hover:text-[#38BDF8]">
                      ¿Qué pasa con mis clases?
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-slate-300 sm:text-sm">
                      Aula virtual, exámenes y trámites sin falta
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0369A1]" />
              </button>
            )}

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("prevention", { tab: "mochila" })}
                className="group flex flex-1 items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-subtle transition hover:border-[#0369A1] dark:border-slate-800 dark:bg-[#0B2545]"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                    <ShieldCheck className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-base font-extrabold text-[#0F172A] group-hover:text-[#0369A1] dark:text-white dark:group-hover:text-[#38BDF8]">
                      Mochila y pasos de cuidado
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-slate-300 sm:text-sm">
                      Arma tu kit y mira quién ayuda en el campus
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0369A1]" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
