import React, { useState } from "react";
import {
  GraduationCap,
  Briefcase,
  ChevronDown,
  Sun,
  CloudRain,
  ShieldCheck,
  Laptop,
  FlaskConical,
  FileText,
  Map as MapIcon,
  Backpack,
  ArrowRight,
  FileCheck2,
} from "lucide-react";
import CommunityPreparednessSection from "./ui/CommunityPreparednessSection";
import OfficialChannelsSection from "./ui/OfficialChannelsSection";

const FALLBACK_PHASES = {
  antes: {
    title: "Antes",
    academic: [
      "Consultar el pronóstico diario y avisos oficiales de SENAMHI antes de iniciar la jornada.",
      "Ubicar el punto de encuentro y la ruta referencial cercana a tu pabellón o laboratorio.",
      "Mantener aulas virtuales UNT actualizadas y listas para transición rápida a modalidad remota.",
      "Resguardar materiales de estudio y equipos portátiles en pisos superiores o fundas impermeables.",
    ],
    administrative: [
      "Resguardar expedientes físicos, archivos documentarios y equipos de cómputo en oficinas de planta baja.",
      "Verificar la operatividad de la Mesa de Partes virtual UNT y canales digitales de atención.",
      "Identificar trámites críticos y asignar responsables de respaldo remoto.",
      "Revisar el estado de canaletas y drenajes cercanos a la oficina con mantenimiento UNT.",
    ],
  },
  durante: {
    title: "Durante",
    academic: [
      "Migrar clases teóricas a modalidad virtual (aula virtual UNT) si existe disposición institucional.",
      "Reprogramar prácticas de laboratorio y evaluaciones presenciales sin penalización para estudiantes.",
      "Evitar cruzar zonas anegadas o instalaciones eléctricas húmedas y permanecer en pisos superiores.",
      "Seguir únicamente comunicados oficiales de la UNT, SENAMHI e INDECI.",
    ],
    administrative: [
      "Activar la Mesa de Partes virtual UNT como canal preferente de ingreso y seguimiento documentario.",
      "Habilitar trabajo remoto temporal para oficinas en planta baja o sectores con exposición hídrica.",
      "Priorizar únicamente trámites críticos y suspender traslados físicos de legajos entre pabellones.",
      "Desconectar equipos eléctricos en oficinas con filtración o humedad superficial.",
    ],
  },
  despues: {
    title: "Después",
    academic: [
      "No ingresar a aulas ni laboratorios con filtraciones o tableros húmedos hasta la inspección técnica.",
      "Confirmar la reanudación de clases y el nuevo cronograma de laboratorios en canales oficiales de tu facultad.",
      "Reportar accesos o drenajes obstruidos al personal de vigilancia y mantenimiento.",
      "Facilitar la entrega flexible de trabajos o evaluaciones afectadas por cortes de energía o conectividad.",
    ],
    administrative: [
      "Inspeccionar oficinas de planta baja, archivos físicos y equipos antes de reconectar energía eléctrica.",
      "Sincronizar los expedientes recibidos por Mesa de Partes virtual y reanudar gradualmente la atención presencial.",
      "Documentar incidencias de infraestructura para el reporte a Defensa Civil UNT.",
      "Actualizar el inventario de equipos o mobiliario afectado en coordinación con Patrimonio UNT.",
    ],
  },
};

// Guía súper sencilla y amigable por perfil y momento (comprensible en segundos por cualquier usuario)
const SIMPLE_USER_CARDS = {
  estudiante: {
    antes: [
      {
        title: "Mira el clima antes de salir",
        text: "Revisa en Inicio si hoy habrá lluvia fuerte para decidir cómo ir al campus.",
      },
      {
        title: "Ubica tu lugar alto y seguro",
        text: "Mira en el Mapa UNT qué parque o explanada alta queda más cerca de tu salón.",
      },
      {
        title: "Ten a mano tu aula virtual",
        text: "Guarda tus accesos listos en el celular o laptop por si la clase pasa a internet.",
      },
    ],
    durante: [
      {
        title: "Conéctate a clases desde un lugar seguro",
        text: "Si hay alerta, las clases teóricas se dictan por Aula Virtual UNT sin que tengas que viajar.",
      },
      {
        title: "Tranquilo con tus prácticas y exámenes",
        text: "Los laboratorios o exámenes presenciales se cambian de fecha sin bajarte puntos ni poner falta.",
      },
      {
        title: "Sube a un segundo piso y evita charcos",
        text: "Si ya estás en la UNT, quédate bajo techo en pisos altos y no cruces Puerta 4 ni Puerta 3.",
      },
    ],
    despues: [
      {
        title: "Espera el aviso antes de volver al aula",
        text: "Ingresa a salones o laboratorios solo cuando tu facultad confirme que están secos y seguros.",
      },
      {
        title: "Revisa tus nuevas fechas de entrega",
        text: "Consulta con tu delegado o docente cuándo se recuperan las prácticas o tareas pendientes.",
      },
      {
        title: "Avisa si ves agua o puertas cerradas",
        text: "Si ves un charco grande o paso bloqueado, repórtalo desde el botón Reportar en el Mapa UNT.",
      },
    ],
  },
  docente: {
    antes: [
      {
        title: "Deja listo el enlace de clase virtual",
        text: "Publica con anticipación el link en Aula Virtual UNT por si toca enseñar a distancia.",
      },
      {
        title: "Conoce el punto alto de tu pabellón",
        text: "Revisa en el Mapa UNT a qué zona segura llevarías a tus alumnos si llueve en clase.",
      },
      {
        title: "Ten un plan flexible para laboratorios",
        text: "Coordina con tu escuela cómo reprogramar prácticas sin perjudicar a los estudiantes.",
      },
    ],
    durante: [
      {
        title: "Pasa tus clases teóricas a internet",
        text: "Dicta la sesión por Aula Virtual UNT y graba la clase para quienes tengan fallas de luz o red.",
      },
      {
        title: "No tomes asistencia estricta ni exámenes",
        text: "Posterga evaluaciones y laboratorios presenciales sin penalizar a ningún alumno.",
      },
      {
        title: "Guía a tu salón hacia pisos altos",
        text: "Si están en el campus, mantén la calma y sube con el grupo a pisos superiores.",
      },
    ],
    despues: [
      {
        title: "Verifica que el aula esté segura",
        text: "No uses proyectores ni enchufes si hubo filtraciones hasta que mantenimiento lo revise.",
      },
      {
        title: "Publica las nuevas fechas con calma",
        text: "Da facilidades de entrega a los estudiantes que sufrieron cortes de luz o internet.",
      },
      {
        title: "Comunica cualquier daño en tu salón",
        text: "Informa a tu decanato o en el Mapa UNT si hay goteras o accesos con barro.",
      },
    ],
  },
  administrativo: {
    antes: [
      {
        title: "Pon en alto computadoras y papeles",
        text: "Si tu oficina está en primer piso, sube equipos y carpetas lejos del suelo.",
      },
      {
        title: "Revisa Mesa de Partes virtual",
        text: "Comprueba que los correos y sistemas digitales funcionen bien para atender sin papeles.",
      },
      {
        title: "Avisa si ves canaletas tapadas",
        text: "Informa a mantenimiento antes de que llueva si ves rejillas con hojas o basura.",
      },
    ],
    durante: [
      {
        title: "Atiende trámites por internet",
        text: "Usa Mesa de Partes virtual UNT para que nadie tenga que caminar bajo la lluvia.",
      },
      {
        title: "Desconecta enchufes si entra agua",
        text: "Si ves humedad en el piso de tu oficina, apaga equipos y aléjate de tomacorrientes.",
      },
      {
        title: "Coordina trabajo remoto seguro",
        text: "Sigue las indicaciones de Recursos Humanos y Defensa Civil UNT para laborar a distancia.",
      },
    ],
    despues: [
      {
        title: "Revisa antes de prender equipos",
        text: "Espera a que personal técnico confirme que los enchufes estén secos antes de encender.",
      },
      {
        title: "Ordena los trámites recibidos en línea",
        text: "Actualiza el seguimiento de documentos enviados por Mesa de Partes virtual.",
      },
      {
        title: "Registra cualquier daño en oficina",
        text: "Avisa a Patrimonio y Defensa Civil UNT si se mojó mobiliario o archivo.",
      },
    ],
  },
};

const MOMENT_OPTIONS = [
  {
    id: "antes",
    stepNum: "1",
    title: "Antes de salir",
    subtitle: "Cuando todo está tranquilo",
    icon: Sun,
    activeStyle:
      "border-[#0369A1] bg-[#F0F9FF] text-[#0B2545] ring-2 ring-[#0369A1]/25 dark:border-[#38BDF8] dark:bg-sky-950/60 dark:text-white",
    iconBg: "bg-[#0369A1] text-white",
  },
  {
    id: "durante",
    stepNum: "2",
    title: "Si llueve fuerte",
    subtitle: "Qué hacer en ese momento",
    icon: CloudRain,
    activeStyle:
      "border-[#D97706] bg-[#FFFBEB] text-[#0F172A] ring-2 ring-[#D97706]/25 dark:border-amber-400 dark:bg-amber-950/50 dark:text-white",
    iconBg: "bg-[#D97706] text-white",
  },
  {
    id: "despues",
    stepNum: "3",
    title: "Después de la lluvia",
    subtitle: "Cómo volver con seguridad",
    icon: ShieldCheck,
    activeStyle:
      "border-[#059669] bg-[#ECFDF5] text-[#0F172A] ring-2 ring-[#059669]/25 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-white",
    iconBg: "bg-[#059669] text-white",
  },
];

const PROFILE_LABELS = {
  estudiante: "Estudiante",
  docente: "Docente",
  administrativo: "Administrativo",
  directivo: "Directivo UNT",
  operador_riesgos: "Operador de Riesgos",
};

export default function ContinuityView({
  protocols,
  userRole = "student",
  activeDemoRole = "estudiante",
  continuityDecisions = [],
  onCreateDecision,
  onResolveDecision,
  onNavigate,
}) {
  const [selectedPhase, setSelectedPhase] = useState("antes");
  const [fullProtocolOpen, setFullProtocolOpen] = useState(false);
  const [mochilaOpen, setMochilaOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);

  const [decScope, setDecScope] = useState("academica");
  const [decArea, setDecArea] = useState("Todas las facultades UNT");
  const [decMeasure, setDecMeasure] = useState("");
  const [decValidUntil, setDecValidUntil] = useState("Hoy 22:00 (Lima)");
  const [savingDec, setSavingDec] = useState(false);

  const phasesMap = protocols?.continuity_phases || FALLBACK_PHASES;
  const currentPhase = phasesMap[selectedPhase] || FALLBACK_PHASES[selectedPhase];

  const isAdminProfile = activeDemoRole === "administrativo";
  const canManageDecisions = userRole === "admin" && activeDemoRole === "directivo";
  const profileLabel = PROFILE_LABELS[activeDemoRole] || "Estudiante";

  const roleKey =
    activeDemoRole === "docente"
      ? "docente"
      : activeDemoRole === "administrativo"
      ? "administrativo"
      : "estudiante";
  const friendlyCards =
    SIMPLE_USER_CARDS[roleKey]?.[selectedPhase] || SIMPLE_USER_CARDS.estudiante.antes;

  const officialAllItems = [
    ...(currentPhase.academic || []),
    ...(currentPhase.administrative || []),
  ];

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!decMeasure.trim() || !onCreateDecision) return;
    setSavingDec(true);
    try {
      await onCreateDecision({
        scope: decScope,
        target_area: decArea.trim() || "Campus UNT",
        measure: decMeasure.trim(),
        valid_until: decValidUntil.trim() || "Hasta nuevo aviso",
        decided_by_role: activeDemoRole === "operador_riesgos" ? "operador_riesgos" : "directivo",
      });
      setDecMeasure("");
    } finally {
      setSavingDec(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Medidas institucionales activas (SQLite) y formulario Directivo — 100% conservado */}
      {(continuityDecisions.length > 0 || userRole === "admin") && (
        <div className="rounded-2xl border border-[#0369A1]/30 bg-white p-4 shadow-subtle dark:border-sky-800 dark:bg-[#0B2545] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B2545] dark:text-white">
                Comunicados activos de la universidad
              </h3>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Medidas vigentes para clases y oficinas en la UNT.
              </p>
            </div>
            <span className="rounded-full bg-[#F0F9FF] px-2.5 py-0.5 font-mono text-xs font-bold text-[#0369A1] dark:bg-sky-950 dark:text-[#38BDF8]">
              {continuityDecisions.length} activa(s)
            </span>
          </div>

          {continuityDecisions.length > 0 && (
            <div className="mt-3 space-y-2">
              {continuityDecisions.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                >
                  <div>
                    <span className="font-extrabold text-[#0F172A] dark:text-white">
                      {d.target_area} ({d.scope})
                    </span>
                    <span className="ml-2 font-mono text-xs text-[#475569] dark:text-slate-400">
                      · Vigencia: {d.valid_until}
                    </span>
                    <p className="mt-0.5 font-medium text-[#0F172A] dark:text-slate-200">{d.measure}</p>
                  </div>
                  {canManageDecisions && onResolveDecision && (
                    <button
                      type="button"
                      onClick={() => onResolveDecision(d.id)}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#0F172A] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Finalizar medida
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {userRole === "admin" && !canManageDecisions && (
            <p className="mt-3 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              Modo consulta ({profileLabel}): la activación y cierre de medidas institucionales corresponde al perfil <strong>Directivo</strong>.
            </p>
          )}

          {canManageDecisions && onCreateDecision && (
            <form
              onSubmit={handleSubmitDecision}
              className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-700 md:grid-cols-12"
            >
              <select
                aria-label="Ámbito de continuidad"
                value={decScope}
                onChange={(e) => setDecScope(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-bold text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white md:col-span-2"
              >
                <option value="academica">Académica</option>
                <option value="administrativa">Administrativa</option>
              </select>
              <input
                type="text"
                value={decArea}
                onChange={(e) => setDecArea(e.target.value)}
                placeholder="Facultad / Oficina destino"
                aria-label="Facultad u oficina destino"
                className="h-10 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white md:col-span-3"
              />
              <input
                type="text"
                required
                value={decMeasure}
                onChange={(e) => setDecMeasure(e.target.value)}
                placeholder="Ej. Migrar clases teóricas a aula virtual UNT..."
                aria-label="Medida de continuidad"
                className="h-10 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white md:col-span-4"
              />
              <input
                type="text"
                value={decValidUntil}
                onChange={(e) => setDecValidUntil(e.target.value)}
                placeholder="Vigencia"
                aria-label="Vigencia de la medida"
                className="h-10 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white md:col-span-1"
              />
              <button
                type="submit"
                disabled={savingDec || !decMeasure.trim()}
                className="h-10 rounded-xl bg-[#0B2545] px-3 text-xs font-extrabold text-white transition hover:bg-[#0369A1] disabled:opacity-50 dark:bg-[#0369A1] md:col-span-2"
              >
                {savingDec ? "Guardando..." : "Activar medida"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* BLOQUE 1: Resumen súper visual en 3 tarjetas ("¿Qué pasa con mis clases y trámites si llueve?") */}
      <section
        aria-label="Qué pasa con tus clases y trámites si llueve fuerte"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
            <Laptop className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-bold text-[#0369A1] dark:bg-sky-950 dark:text-[#38BDF8]">
              Pasan a internet
            </span>
            <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
              Clases teóricas
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              Si hay alerta, te conectas desde casa por <strong>Aula Virtual UNT</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/70 dark:text-emerald-400">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#059669] dark:bg-emerald-950 dark:text-emerald-300">
              No pierdes nota
            </span>
            <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
              Laboratorios y exámenes
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              Se cambian de fecha automáticamente <strong>sin contar tardanza ni falta</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/70 dark:text-amber-300">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-bold text-[#B45309] dark:bg-amber-950 dark:text-amber-300">
              Sin ir en persona
            </span>
            <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
              Trámites y documentos
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
              Envía todo por <strong>Mesa de Partes virtual</strong> sin salir bajo la lluvia.
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2: Selector grande e intuitivo de 3 momentos + 3 pasos súper fáciles para tu rol */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-[#0B2545] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/70 dark:text-[#38BDF8]">
              {isAdminProfile ? (
                <Briefcase className="h-4.5 w-4.5" />
              ) : (
                <GraduationCap className="h-4.5 w-4.5" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white sm:text-xl">
                Elige el momento para ver qué hacer ({profileLabel})
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Toca una de las 3 tarjetas de abajo:
              </p>
            </div>
          </div>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate(userRole === "admin" ? "map" : "student_map")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B2545] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0369A1] dark:bg-[#0369A1]"
            >
              <MapIcon className="h-4 w-4" />
              <span>Ver mi ruta en el Mapa</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 3 Botones grandes, visuales y súper fáciles de tocar */}
        <div
          role="tablist"
          aria-label="Elige el momento"
          className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          {MOMENT_OPTIONS.map((m) => {
            const Icon = m.icon;
            const active = selectedPhase === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedPhase(m.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? m.activeStyle
                    : "border-slate-200 bg-[#F8FAFC]/70 text-[#475569] hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? m.iconBg
                      : "bg-white text-[#475569] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {m.stepNum}. {m.title}
                  </div>
                  <div className="truncate text-xs text-[#64748B] dark:text-slate-400">
                    {m.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3 Pasos en lenguaje cotidiano y directo */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {friendlyCards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B2545] font-mono text-xs font-bold text-white dark:bg-[#0369A1]">
                  {idx + 1}
                </span>
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  {card.title}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#475569] dark:text-slate-300 sm:text-sm">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* BLOQUE 3: Desplegables de ancho completo (nunca aplastados en columnas estrechas) */}
      <div className="space-y-2.5">
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <button
            type="button"
            onClick={() => setMochilaOpen((v) => !v)}
            aria-expanded={mochilaOpen}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400">
                <Backpack className="h-4.5 w-4.5" />
              </span>
              <div>
                <span className="text-sm font-bold text-[#0F172A] dark:text-white">
                  ¿Qué llevar en mi mochila de emergencia y quién ayuda en la UNT?
                </span>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Lista fácil para marcar lo que ya tienes listo + equipos de ayuda
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[#475569] transition-transform ${
                mochilaOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {mochilaOpen && (
            <div className="border-t border-slate-200 p-5 dark:border-slate-800">
              <CommunityPreparednessSection />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <button
            type="button"
            onClick={() => setChannelsOpen((v) => !v)}
            aria-expanded={channelsOpen}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0369A1] dark:bg-sky-950/60 dark:text-[#38BDF8]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </span>
              <div>
                <span className="text-sm font-bold text-[#0F172A] dark:text-white">
                  ¿Dónde ver noticias oficiales sin caer en rumores?
                </span>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Accesos directos a SENAMHI, COER La Libertad, INDECI y ENFEN
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[#475569] transition-transform ${
                channelsOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {channelsOpen && (
            <div className="border-t border-slate-200 p-5 dark:border-slate-800">
              <OfficialChannelsSection />
            </div>
          )}
        </section>

        {/* Acordeón discreto que conserva el texto normativo íntegro PLANAGERD 2022–2030 */}
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-subtle dark:border-slate-800 dark:bg-[#0B2545]">
          <button
            type="button"
            onClick={() => setFullProtocolOpen((v) => !v)}
            aria-expanded={fullProtocolOpen}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <div className="flex items-center gap-3">
              <FileCheck2 className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                Ver detalle normativo completo ({officialAllItems.length} lineamientos · PLANAGERD 2022–2030)
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[#475569] transition-transform ${
                fullProtocolOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {fullProtocolOpen && (
            <div className="grid grid-cols-1 gap-2.5 border-t border-slate-200 p-5 text-xs dark:border-slate-800 md:grid-cols-2">
              {officialAllItems.map((line, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200/70 bg-[#F8FAFC] p-3 text-[#334155] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
                >
                  {i + 1}. {line}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
