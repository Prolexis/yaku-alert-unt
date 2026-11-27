import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Download,
  Printer,
  Info,
  ShieldCheck,
  Backpack,
  Radio,
  Map as MapIcon,
  BellRing,
  Mountain,
  Ban,
  SmartphoneCharging,
  Laptop,
  Users,
  HardDrive,
  FileCheck2,
  Wrench,
} from "lucide-react";
import PreventiveMessageCard from "./ui/PreventiveMessageCard";
import OfficialChannelsSection from "./ui/OfficialChannelsSection";
import CommunityPreparednessSection from "./ui/CommunityPreparednessSection";
import ExplainabilityStrip from "./ui/ExplainabilityStrip";
import ActiveAlertsBanner from "./ui/ActiveAlertsBanner";
import { AdminReportsInbox } from "./ui/CampusReportModal";
import { downloadBulletin, printBulletin } from "../utils/bulletin";
import { formatLimaTime } from "../utils/formatters";

// Tarjetas súper visuales y breves (máximo 8–10 palabras por tarjeta, escaneables en 3 segundos)
const VISUAL_ROLE_CARDS = {
  estudiante: {
    calmTitle: "3 pasos fáciles para hoy (Estudiante)",
    alertTitle: "Qué hacer ahora mismo (Estudiante)",
    cards: [
      {
        icon: Mountain,
        iconStyle: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300",
        stepBadge: "1",
        title: "Ubica una zona alta",
        caption: "Mira qué parque o explanada alta queda cerca de tu salón.",
      },
      {
        icon: Ban,
        iconStyle: "bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/70 dark:text-red-300",
        stepBadge: "2",
        title: "Evita Puerta 4 y Puerta 3",
        caption: "Si llueve fuerte, no cruces charcos y sube a un segundo piso.",
      },
      {
        icon: SmartphoneCharging,
        iconStyle: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
        stepBadge: "3",
        title: "Cuida tus cosas",
        caption: "Guarda tu carné en bolsita plástica y lleva batería cargada.",
      },
    ],
  },
  docente: {
    calmTitle: "3 pasos fáciles para hoy (Docente)",
    alertTitle: "Qué hacer con tu clase (Docente)",
    cards: [
      {
        icon: Laptop,
        iconStyle: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
        stepBadge: "1",
        title: "Ten listo el link virtual",
        caption: "Deja preparado tu enlace de Aula Virtual UNT por si llueve.",
      },
      {
        icon: Users,
        iconStyle: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300",
        stepBadge: "2",
        title: "Guía hacia pisos altos",
        caption: "Conoce el punto alto de tu pabellón para llevar a tu grupo.",
      },
      {
        icon: FileCheck2,
        iconStyle: "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300",
        stepBadge: "3",
        title: "No pongas faltas",
        caption: "Reprograma laboratorios o exámenes sin perjudicar notas.",
      },
    ],
  },
  administrativo: {
    calmTitle: "3 pasos fáciles para hoy (Administrativo)",
    alertTitle: "Qué hacer en tu oficina (Administrativo)",
    cards: [
      {
        icon: HardDrive,
        iconStyle: "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300",
        stepBadge: "1",
        title: "Sube equipos y papeles",
        caption: "En primer piso, coloca computadoras y carpetas lejos del suelo.",
      },
      {
        icon: Laptop,
        iconStyle: "bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]",
        stepBadge: "2",
        title: "Atiende por internet",
        caption: "Usa Mesa de Partes virtual para evitar traslados bajo lluvia.",
      },
      {
        icon: Wrench,
        iconStyle: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-300",
        stepBadge: "3",
        title: "Avisa si entra agua",
        caption: "Desconecta enchufes húmedos y reporta canaletas tapadas.",
      },
    ],
  },
};

function resolveSimpleStatus(preventiveLevel, isSim) {
  if (isSim) {
    return {
      label: "Práctica: si llueve fuerte",
      dot: "bg-[#D97706]",
      pill: "bg-[#FFFBEB] text-[#92400E] ring-1 ring-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-800",
    };
  }
  if (preventiveLevel === "PREPARACION_CRITICA") {
    return {
      label: "Alerta roja en el campus",
      dot: "bg-[#DC2626]",
      pill: "bg-[#FEF2F2] text-[#991B1B] ring-1 ring-red-200 dark:bg-red-950/70 dark:text-red-200 dark:ring-red-800",
    };
  }
  if (preventiveLevel === "ATENCION_PREVENTIVA") {
    return {
      label: "Precaución por lluvias",
      dot: "bg-[#D97706]",
      pill: "bg-[#FFFBEB] text-[#92400E] ring-1 ring-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-800",
    };
  }
  if (preventiveLevel === "VIGILANCIA_PREVENTIVA") {
    return {
      label: "Atentos al clima hoy",
      dot: "bg-[#0284C7]",
      pill: "bg-[#F0F9FF] text-[#075985] ring-1 ring-sky-200 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-800",
    };
  }
  return {
    label: "Clima tranquilo hoy",
    dot: "bg-[#059669]",
    pill: "bg-[#ECFDF5] text-[#065F46] ring-1 ring-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-800",
  };
}

export default function PreventionView({
  evaluation,
  weather,
  simResult,
  hydroResult,
  evalSourceMode,
  onChangeEvalSource,
  conditionsCatalog,
  declaredConditions = [],
  onToggleCondition,
  userRole = "student",
  activeDemoRole = "estudiante",
  onIssueAlert,
  onNavigate,
  tabRequest = null,
  activeAlerts = [],
  onResolveAlert,
  onValidateAlert,
  onConfirmAlert,
  onSendWhatsApp,
  whatsappStatus = null,
  campusReports = [],
  onUpdateReportStatus,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [communityTab, setCommunityTab] = useState("accion");

  useEffect(() => {
    if (tabRequest?.tab) {
      setCommunityTab(tabRequest.tab);
    }
  }, [tabRequest]);

  const isSim = Boolean(evaluation?.is_synthetic);
  const { local } = formatLimaTime(weather?.fetched_at_utc);
  const rolePack = VISUAL_ROLE_CARDS[activeDemoRole] || VISUAL_ROLE_CARDS.estudiante;
  const isElevatedRisk =
    isSim ||
    ["VIGILANCIA_PREVENTIVA", "ATENCION_PREVENTIVA", "PREPARACION_CRITICA"].includes(
      evaluation?.preventive_level
    );
  const simpleStatus = resolveSimpleStatus(evaluation?.preventive_level, isSim);
  const topAlert = activeAlerts[0] || null;
  const topAlertRaw = String(topAlert?.what_happens || topAlert?.title || "");
  const isTopSim = /escenario|simulac/i.test(topAlertRaw);

  return (
    <div className="space-y-4">
      {/* Cabecera para Gestión UNT */}
      {userRole === "admin" && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-3xl">
              Análisis Preventivo y Avisos
            </h2>
            <p className="mt-1 text-sm text-[#475569] dark:text-slate-400">
              Mensaje accionable (qué, dónde, cuándo, qué hacer y quién informa) con boletín descargable.
            </p>
          </div>

          <div
            role="group"
            aria-label="Fuente evaluada"
            className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => onChangeEvalSource("live")}
              aria-pressed={evalSourceMode === "live"}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                evalSourceMode === "live"
                  ? "bg-white text-[#0B2545] shadow-sm dark:bg-[#0369A1] dark:text-white"
                  : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300"
              }`}
            >
              Pronóstico / Caché
            </button>
            <button
              type="button"
              onClick={() => onChangeEvalSource("simulated")}
              aria-pressed={evalSourceMode === "simulated"}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                evalSourceMode === "simulated"
                  ? "bg-[#D97706] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300"
              }`}
            >
              Simulación
            </button>
          </div>
        </div>
      )}

      {/* Condiciones externas declarables (solo editables en modo Administrador) */}
      {userRole === "admin" && evalSourceMode === "live" && conditionsCatalog?.conditions?.length > 0 && (
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#101828] dark:text-white">
                Condiciones externas observadas (declaración manual sí/no)
              </h3>
              <p className="mt-0.5 text-xs text-[#475467] dark:text-slate-400">
                No provienen de sensores: marca una condición solo si existe reporte verificado en calles o quebradas.
              </p>
            </div>
            {declaredConditions.length > 0 && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {declaredConditions.length} activa(s)
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {conditionsCatalog.conditions.map((cond) => {
              const checked = declaredConditions.includes(cond.id);
              return (
                <label
                  key={cond.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition ${
                    checked
                      ? "border-[#2563EB] bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30"
                      : "border-[#E2E8F0] bg-[#F7F9FC] dark:border-slate-800 dark:bg-slate-900/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCondition && onToggleCondition(cond.id)}
                    className="mt-0.5 rounded accent-[#2563EB]"
                  />
                  <div>
                    <div className="font-semibold text-[#101828] dark:text-white">{cond.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#475467] dark:text-slate-400">
                      {cond.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {!evaluation ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#475467] dark:border-slate-800 dark:bg-[#0B1F33]">
          Sin evaluación disponible.
        </div>
      ) : userRole !== "admin" ? (
        /* ===================================================================
           VISTA COMUNIDAD UNT: Mínimo texto, máximo apoyo visual (3 segundos de lectura)
           =================================================================== */
        <div className="space-y-4">
          {/* Franja corta de aviso activo */}
          {topAlert && (
            <section
              aria-label="Aviso activo en campus"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2 text-xs text-[#991B1B] dark:border-red-800 dark:bg-red-950/45 dark:text-red-100"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#DC2626] px-2 py-0.5 text-[11px] font-bold text-white">
                  <BellRing className="h-3 w-3" />
                  <span>{isTopSim ? "Simulacro" : "Aviso"}</span>
                </span>
                <span className="truncate font-semibold">
                  {topAlert.where_zone || "Ciudad Universitaria UNT"}
                </span>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("notifications")}
                    className="font-bold underline underline-offset-2"
                  >
                    Ver detalle →
                  </button>
                )}
              </div>
              {onConfirmAlert && (
                <button
                  type="button"
                  onClick={() => onConfirmAlert(topAlert.id, "en_zona_segura")}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#059669] px-3 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Estoy a salvo</span>
                </button>
              )}
            </section>
          )}

          {/* 3 Botones grandes e intuitivos */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="tablist" aria-label="Secciones de prevención">
            {[
              {
                id: "accion",
                title: "Qué hacer",
                sub: "3 pasos simples",
                icon: ShieldCheck,
                iconCls: "bg-[#0B2545] text-white dark:bg-[#0369A1]",
              },
              {
                id: "mochila",
                title: "Mi mochila",
                sub: "Marca tus cosas y brigadas",
                icon: Backpack,
                iconCls: "bg-[#059669] text-white",
              },
              {
                id: "canales",
                title: "Ayuda oficial",
                sub: "SENAMHI, COER e INDECI",
                icon: Radio,
                iconCls: "bg-[#0369A1] text-white",
              },
            ].map((t) => {
              const Icon = t.icon;
              const active = communityTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCommunityTab(t.id)}
                  className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[#0369A1] bg-white shadow-subtle ring-2 ring-[#0369A1]/20 dark:border-[#38BDF8] dark:bg-[#0B2545]"
                      : "border-slate-200/80 bg-white/75 hover:bg-white dark:border-slate-800 dark:bg-[#0B2545]/60"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      active
                        ? t.iconCls
                        : "bg-slate-100 text-[#475569] dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-[#0F172A] dark:text-white">
                      {t.title}
                    </div>
                    <div className="truncate text-xs text-[#64748B] dark:text-slate-400">
                      {t.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {communityTab === "accion" && (
            <div className="space-y-4">
              {/* ÚNICA TARJETA VISUAL AMPLIA Y PROTAGONISTA */}
              <section
                aria-label="Pasos simples para hoy"
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:p-7"
              >
                {/* Cabecera súper despejada */}
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${simpleStatus.pill}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${simpleStatus.dot}`} />
                        <span>{simpleStatus.label}</span>
                      </span>

                      {/* Selector corto: Hoy vs. Si llueve fuerte */}
                      <div
                        role="group"
                        aria-label="Cambiar modo"
                        className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-900"
                      >
                        <button
                          type="button"
                          onClick={() => onChangeEvalSource("live")}
                          aria-pressed={evalSourceMode === "live"}
                          className={`rounded-md px-3 py-1 font-bold transition ${
                            evalSourceMode === "live"
                              ? "bg-white text-[#0B2545] shadow-sm dark:bg-[#0369A1] dark:text-white"
                              : "text-[#64748B] dark:text-slate-400"
                          }`}
                        >
                          Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeEvalSource("simulated")}
                          aria-pressed={evalSourceMode === "simulated"}
                          className={`rounded-md px-3 py-1 font-bold transition ${
                            evalSourceMode === "simulated"
                              ? "bg-[#D97706] text-white shadow-sm"
                              : "text-[#64748B] dark:text-slate-400"
                          }`}
                        >
                          Si llueve fuerte
                        </button>
                      </div>
                    </div>

                    <h3 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-[28px]">
                      {isElevatedRisk ? rolePack.alertTitle : rolePack.calmTitle}
                    </h3>
                  </div>

                  {/* 1 Botón principal grande + íconos discretos de PDF / Imprimir */}
                  <div className="flex flex-wrap items-center gap-2">
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate("student_map")}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0B2545] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
                      >
                        <MapIcon className="h-4 w-4" />
                        <span>Ver mi ruta segura</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      title="Descargar guía en archivo"
                      aria-label="Descargar guía"
                      onClick={() => downloadBulletin({ evaluation, weather, simResult, hydroResult })}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-[#F8FAFC] text-[#0F172A] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Imprimir guía"
                      aria-label="Imprimir guía"
                      onClick={() => printBulletin({ evaluation, weather, simResult, hydroResult })}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-[#F8FAFC] text-[#0F172A] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 3 TARJETAS ILUSTRADAS AMPLIAS */}
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {rolePack.cards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={card.stepBadge}
                        className="flex flex-col items-start rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/70 p-6 dark:border-slate-800 dark:bg-slate-900/50"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span
                            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${card.iconStyle}`}
                          >
                            <CardIcon className="h-8 w-8" />
                          </span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-mono text-sm font-extrabold text-[#0B2545] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                            {card.stepBadge}
                          </span>
                        </div>

                        <h4 className="mt-5 text-lg font-extrabold text-[#0F172A] dark:text-white">
                          {card.title}
                        </h4>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#475569] dark:text-slate-300">
                          {card.caption}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Guía visual de colores tipo semáforo (enseña al usuario en 3 segundos qué significa cada color) */}
              <section
                aria-label="¿Qué significa cada color de alerta?"
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                    ¿Qué significa cada color en Yaku Alert?
                  </h4>
                  <span className="text-xs text-[#64748B] dark:text-slate-400">
                    Así sabes qué hacer al instante
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      id: "INFORMATIVO",
                      dot: "bg-[#059669]",
                      title: "Verde · Tranquilo",
                      text: "Clases normales en el campus.",
                      bg: "border-emerald-200/80 bg-[#ECFDF5]/60 dark:border-emerald-900/60 dark:bg-emerald-950/30",
                    },
                    {
                      id: "VIGILANCIA_PREVENTIVA",
                      dot: "bg-[#0284C7]",
                      title: "Azul · Atento",
                      text: "Puede llover; ubica tu punto alto.",
                      bg: "border-sky-200/80 bg-[#F0F9FF]/60 dark:border-sky-900/60 dark:bg-sky-950/30",
                    },
                    {
                      id: "ATENCION_PREVENTIVA",
                      dot: "bg-[#D97706]",
                      title: "Naranja · Precaución",
                      text: "Evita puertas con charcos.",
                      bg: "border-amber-200/80 bg-[#FFFBEB]/60 dark:border-amber-900/60 dark:bg-amber-950/30",
                    },
                    {
                      id: "PREPARACION_CRITICA",
                      dot: "bg-[#DC2626]",
                      title: "Rojo · Ponte a salvo",
                      text: "Sube a pisos altos y pasa a virtual.",
                      bg: "border-red-200/80 bg-[#FEF2F2]/60 dark:border-red-900/60 dark:bg-red-950/30",
                    },
                  ].map((item) => {
                    const isCurrent = evaluation?.preventive_level === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 transition ${
                          isCurrent
                            ? `${item.bg} ring-2 ring-[#0B2545]/15 dark:ring-white/20`
                            : "border-slate-200/80 bg-[#F8FAFC]/60 dark:border-slate-800 dark:bg-slate-900/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0F172A] dark:text-white">
                            <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                            <span>{item.title}</span>
                          </span>
                          {isCurrent && (
                            <span className="rounded-md bg-[#0B2545] px-2 py-0.5 text-[10px] font-bold text-white dark:bg-[#0369A1]">
                              Ahora
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#475569] dark:text-slate-300">
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Acordeón discreto para el jurado / detalle institucional (toda la data conservada sin ensuciar la vista) */}
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-expanded={detailsOpen}
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                >
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] dark:text-slate-400">
                    <Info className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
                    <span>
                      Más información técnica ({local}) · Ver ficha preventiva institucional completa
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#64748B] transition-transform ${
                      detailsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {detailsOpen && (
                  <div className="space-y-4 border-t border-slate-200 p-5 dark:border-slate-800">
                    <div className="rounded-xl bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#475569] dark:bg-slate-900/60 dark:text-slate-300">
                      <p>
                        <strong className="text-[#0F172A] dark:text-white">Evaluación actual:</strong>{" "}
                        {evaluation.hazard_assessment} {evaluation.exposure_assessment}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                        {evaluation.legal_disclaimer}
                      </p>
                    </div>

                    <PreventiveMessageCard
                      evaluation={evaluation}
                      weather={weather}
                      simResult={simResult}
                      hydroResult={hydroResult}
                      userRole={userRole}
                      activeDemoRole={activeDemoRole}
                    />
                    <ExplainabilityStrip
                      evaluation={evaluation}
                      hydroEvaluation={hydroResult?.evaluation}
                      weather={weather}
                      evalSourceMode={evalSourceMode}
                      hasVirtualSensors={false}
                    />
                  </div>
                )}
              </section>
            </div>
          )}

          {communityTab === "mochila" && <CommunityPreparednessSection />}

          {communityTab === "canales" && <OfficialChannelsSection />}
        </div>
      ) : (
        /* ===================================================================
           VISTA ADMINISTRADOR / GESTIÓN UNT (Conserva capacidad técnica total)
           =================================================================== */
        <div className="space-y-5">
          {activeAlerts.length > 0 && (
            <ActiveAlertsBanner
              alerts={activeAlerts}
              canResolve={true}
              onResolveAlert={onResolveAlert}
              onValidateAlert={onValidateAlert}
              onConfirmAlert={onConfirmAlert}
              onSendWhatsApp={onSendWhatsApp}
              whatsappStatus={whatsappStatus}
              activeDemoRole={activeDemoRole}
            />
          )}

          <PreventiveMessageCard
            evaluation={evaluation}
            weather={weather}
            simResult={simResult}
            hydroResult={hydroResult}
            userRole={userRole}
            activeDemoRole={activeDemoRole}
            onIssueAlert={onIssueAlert}
            whatsappStatus={whatsappStatus}
          />

          <AdminReportsInbox
            reports={campusReports}
            onUpdateStatus={onUpdateReportStatus}
          />

          <ExplainabilityStrip
            evaluation={evaluation}
            hydroEvaluation={hydroResult?.evaluation}
            weather={weather}
            evalSourceMode={evalSourceMode}
            hasVirtualSensors={true}
            defaultOpen
          />

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-slate-800 dark:bg-[#0B1F33]">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#101828] dark:text-white">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Fuentes, incertidumbre y límites
            </h3>
            <div className="mt-3 space-y-1.5 text-xs text-[#475467] dark:text-slate-400">
              {evaluation.sources_and_timestamps.map((src, i) => (
                <div key={i}>• {src}</div>
              ))}
              {evaluation.uncertainty_and_limits.map((u, i) => (
                <div key={`u-${i}`}>• {u}</div>
              ))}
            </div>
            <p className="mt-3 border-t border-[#E2E8F0] pt-2.5 text-xs font-medium text-[#101828] dark:border-slate-800 dark:text-slate-200">
              {evaluation.legal_disclaimer}
            </p>
          </section>

          <OfficialChannelsSection />

          <section className="rounded-xl border border-[#E2E8F0] bg-white dark:border-slate-800 dark:bg-[#0B1F33]">
            <button
              type="button"
              onClick={() => setRulesOpen((v) => !v)}
              aria-expanded={rulesOpen}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-[#101828] dark:text-white">
                Reglas técnicas activadas ({evaluation.rules_triggered.length}) · Código interno:{" "}
                <span className="font-mono text-xs text-[#475467]">{evaluation.preventive_level}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#475467] transition-transform ${rulesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {rulesOpen && (
              <div className="space-y-2 border-t border-[#E2E8F0] p-5 dark:border-slate-800">
                {evaluation.rules_triggered.map((rule) => (
                  <div
                    key={rule.rule_id}
                    className="flex flex-col justify-between gap-1 rounded-lg bg-[#F7F9FC] p-3 text-xs dark:bg-slate-900/60 sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="mr-2 font-mono font-bold text-[#2563EB]">{rule.rule_id}</span>
                      <span className="font-medium text-[#101828] dark:text-white">
                        {rule.description}
                      </span>
                      <div className="mt-0.5 text-[#475467] dark:text-slate-400">
                        {rule.threshold_note}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono font-semibold text-[#101828] dark:text-slate-200">
                      {rule.observed_value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
