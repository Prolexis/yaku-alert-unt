import React, { useState } from "react";
import {
  CheckCircle2,
  GraduationCap,
  Briefcase,
  ChevronDown,
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

const DOCENTE_PHASES = {
  antes: [
    "Preparar el aula virtual UNT con enlaces de respaldo para migrar sesiones teóricas sin interrupciones.",
    "Identificar el punto de encuentro seguro más cercano a tu pabellón o laboratorio antes de iniciar clases.",
    "Coordinar con escuela profesional el protocolo de reprogramación de prácticas de laboratorio sin penalización.",
  ],
  durante: [
    "Migrar clases teóricas a modalidad virtual y suspender prácticas de laboratorio o evaluaciones presenciales sin penalización.",
    "Conducir ordenadamente a los estudiantes hacia el punto seguro del pabellón o aplicar refugio vertical en piso superior.",
    "Registrar asistencia de seguridad del grupo y seguir exclusivamente comunicados de Defensa Civil UNT y Decanato.",
  ],
  despues: [
    "Verificar inspección técnica del aula o laboratorio antes de reanudar actividades presenciales.",
    "Publicar el cronograma flexible de recuperación de laboratorios y entregas afectadas por cortes de energía.",
    "Reportar filtraciones o accesos obstruidos del pabellón al Operador de Gestión de Riesgos.",
  ],
};

const PROFILE_LABELS = {
  estudiante: "Estudiante",
  docente: "Docente",
  administrativo: "Personal administrativo",
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
}) {
  const [selectedPhase, setSelectedPhase] = useState("antes");
  const [showAllPhaseItems, setShowAllPhaseItems] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  const [decScope, setDecScope] = useState("academica");
  const [decArea, setDecArea] = useState("Todas las facultades UNT");
  const [decMeasure, setDecMeasure] = useState("");
  const [decValidUntil, setDecValidUntil] = useState("Hoy 22:00 (Lima)");
  const [savingDec, setSavingDec] = useState(false);

  const phasesMap = protocols?.continuity_phases || FALLBACK_PHASES;
  const currentPhase = phasesMap[selectedPhase] || FALLBACK_PHASES[selectedPhase];

  // Adaptación automática al perfil seleccionado (Estudiante vs Docente vs Administrativo)
  const isAdminProfile = activeDemoRole === "administrativo";
  const isDocenteProfile = activeDemoRole === "docente";
  const canManageDecisions = userRole === "admin" && activeDemoRole === "directivo";
  const profileLabel = PROFILE_LABELS[activeDemoRole] || "Estudiante";
  const primaryList = isAdminProfile
    ? currentPhase.administrative || []
    : isDocenteProfile
    ? DOCENTE_PHASES[selectedPhase] || currentPhase.academic || []
    : currentPhase.academic || [];
  const secondaryList = isAdminProfile
    ? currentPhase.academic || []
    : currentPhase.administrative || [];
  const allItems = [...primaryList, ...secondaryList];
  const visibleItems = showAllPhaseItems ? allItems : primaryList.slice(0, 3);

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
    <div className="space-y-6">
      {/* Cabecera + Selector compacto de Fase (Antes | Durante | Después) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#101828] dark:text-white sm:text-3xl">
            Continuidad académica
          </h2>
          <p className="mt-1 text-sm text-[#475467] dark:text-slate-400">
            Recomendaciones directas adaptadas a tu perfil ({profileLabel}) y a la fase seleccionada.
          </p>
        </div>

        {/* Selector de una sola fase a la vez */}
        <div
          role="tablist"
          aria-label="Fase de actuación"
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-subtle dark:border-slate-700 dark:bg-[#0B2545]"
        >
          {[
            { id: "antes", label: "Antes" },
            { id: "durante", label: "Durante" },
            { id: "despues", label: "Después" },
          ].map((ph) => (
            <button
              key={ph.id}
              type="button"
              role="tab"
              aria-selected={selectedPhase === ph.id}
              onClick={() => {
                setSelectedPhase(ph.id);
                setShowAllPhaseItems(false);
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-extrabold transition ${
                selectedPhase === ph.id
                  ? "bg-[#0B2545] text-white dark:bg-[#0369A1]"
                  : "text-[#475569] hover:text-[#0F172A] dark:text-slate-300"
              }`}
            >
              {ph.label}
            </button>
          ))}
        </div>
      </div>

      {/* Medidas institucionales activas (SQLite) */}
      {(continuityDecisions.length > 0 || userRole === "admin") && (
        <div className="rounded-2xl border border-[#0369A1]/30 bg-white p-5 shadow-panel dark:border-sky-800 dark:bg-[#0B2545]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#0B2545] dark:text-white">
                Medidas institucionales registradas (prototipo TRL 3–4)
              </h3>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Disposiciones de ejemplo registradas en el sistema local.
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
              Modo consulta ({profileLabel}): la activación y cierre de medidas institucionales de continuidad corresponde al perfil <strong>Directivo</strong>.
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

      {/* Tarjeta principal: Una sola fase a la vez + adaptada al perfil (máx. 3 iniciales) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isAdminProfile ? (
              <Briefcase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            ) : (
              <GraduationCap className="h-4 w-4 text-[#0369A1] dark:text-[#38BDF8]" />
            )}
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              Fase «{currentPhase.title}» · Recomendaciones para {profileLabel}
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-[#475569] dark:bg-slate-800 dark:text-slate-300">
            Orientaciones referenciales (PLANAGERD 2022–2030)
          </span>
        </div>

        <ul className="mt-4 space-y-2.5 text-sm text-[#0F172A] dark:text-slate-100">
          {visibleItems.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 rounded-xl bg-[#F8FAFC] p-3.5 dark:bg-slate-900/60"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowAllPhaseItems((v) => !v)}
            className="text-xs font-bold text-[#0369A1] hover:underline dark:text-[#38BDF8]"
          >
            {showAllPhaseItems ? "Mostrar resumen del perfil (3 principales)" : "Ver todas las recomendaciones"}
          </button>
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Cambia tu perfil (Estudiante / Docente / Administrativo) en la barra superior para adaptar esta lista.
          </span>
        </div>
      </section>

      {/* Documentación adicional y mochila bajo demanda */}
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0B2545]">
        <button
          type="button"
          onClick={() => setExtraOpen((v) => !v)}
          aria-expanded={extraOpen}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <span className="text-sm font-extrabold text-[#0F172A] dark:text-white">
              Mochila de emergencia y preparación comunitaria
            </span>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Checklist preventivo y brigadas universitarias
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-[#475569] transition-transform ${extraOpen ? "rotate-180" : ""}`}
          />
        </button>
        {extraOpen && (
          <div className="border-t border-slate-200 p-5 dark:border-slate-800">
            <CommunityPreparednessSection />
          </div>
        )}
      </section>

      <OfficialChannelsSection />
    </div>
  );
}
