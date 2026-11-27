import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  Megaphone,
  Lock,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Loader2,
} from "lucide-react";
import { createReport } from "../../services/api";
import { formatLimaTime } from "../../utils/formatters";

export const REPORT_CATEGORIES = [
  { id: "aniego", label: "Aniego / agua acumulada", color: "#0284C7" },
  { id: "drenaje_obstruido", label: "Drenaje o canaleta obstruida", color: "#D97706" },
  { id: "acceso_bloqueado", label: "Acceso o puerta bloqueada", color: "#DC2626" },
  { id: "zona_segura_ok", label: "Zona segura despejada (OK)", color: "#059669" },
];

export const CAMPUS_REPORT_ZONES = [
  { name: "Puerta 4 (Av. Jesús de Nazareth)", lat: -8.11167, lon: -79.03599 },
  { name: "Puerta 3 y Comedor Universitario", lat: -8.11695, lon: -79.04125 },
  { name: "Puerta 2 (Av. Juan Pablo II)", lat: -8.11595, lon: -79.03705 },
  { name: "Centro de Idiomas — CIDUNT", lat: -8.11245, lon: -79.03685 },
  { name: "Facultad de Ingeniería", lat: -8.11375, lon: -79.03895 },
  { name: "Facultad de Derecho y Ciencias Políticas", lat: -8.11515, lon: -79.03785 },
  { name: "Biblioteca Central UNT", lat: -8.11465, lon: -79.03915 },
  { name: "Explanada Ciencias Sociales (Punto seguro)", lat: -8.1149, lon: -79.0402 },
  { name: "Parque Max Díaz (Punto seguro)", lat: -8.1134, lon: -79.0396 },
  { name: "Facultad de Medicina / Enfermería", lat: -8.11635, lon: -79.0405 },
];

export function CampusReportModal({ open, onClose, onCreated }) {
  const [category, setCategory] = useState("aniego");
  const [zoneName, setZoneName] = useState(CAMPUS_REPORT_ZONES[0].name);
  const [severity, setSeverity] = useState("media");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const zoneObj = CAMPUS_REPORT_ZONES.find((z) => z.name === zoneName);
      const created = await createReport({
        category,
        zone_name: zoneName,
        lat: zoneObj?.lat ?? -8.11473,
        lon: zoneObj?.lon ?? -79.03923,
        severity,
        note: note.trim(),
      });
      toast.success("Reporte anónimo registrado en el mapa", {
        description: `${zoneName} · Visible en mapa y bandeja de Gestión UNT.`,
      });
      setNote("");
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      toast.error("No se pudo enviar el reporte", {
        description: err.message || "Verifica conexión con el servidor local.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071524]/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0B2545]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2545] px-5 py-4 text-white dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00B4D8]/20 text-[#38BDF8]">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <h2 id="report-modal-title" className="text-sm font-extrabold">
                    Reportar incidente en el campus
                  </h2>
                  <p className="text-xs text-slate-300">
                    Colaboración comunitaria en tiempo real
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar formulario de reporte"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {/* Nota obligatoria Ley 29733 */}
              <div className="flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-3.5 py-2 text-xs font-bold text-[#065F46] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Reporte 100 % anónimo — Ley N.° 29733 (no solicita nombre, DNI ni GPS).</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  Tipo de incidente
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      aria-pressed={category === cat.id}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                        category === cat.id
                          ? "border-[#0369A1] bg-[#F0F9FF] text-[#0B2545] ring-1 ring-[#0369A1] dark:border-[#00B4D8] dark:bg-sky-950/60 dark:text-white"
                          : "border-slate-200 bg-[#F8FAFC] text-[#475569] hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="report-zone-select"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200"
                  >
                    Facultad / puerta / sector
                  </label>
                  <select
                    id="report-zone-select"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {CAMPUS_REPORT_ZONES.map((z) => (
                      <option key={z.name} value={z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="report-severity-select"
                    className="block text-xs font-bold text-[#0F172A] dark:text-slate-200"
                  >
                    Severidad
                  </label>
                  <select
                    id="report-severity-select"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] dark:text-slate-200">
                  <label htmlFor="report-note">Detalle breve (opcional)</label>
                  <span className="font-mono text-xs font-normal text-[#475569] tabular-nums dark:text-slate-400">
                    {note.length}/180
                  </span>
                </div>
                <textarea
                  id="report-note"
                  rows={2}
                  maxLength={180}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. Agua acumulada en vereda externa dificulta ingreso peatonal..."
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-[#475569] hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B2545] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0369A1] disabled:opacity-60 dark:bg-[#0369A1]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  <span>Enviar reporte anónimo</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const STATUS_BADGE = {
  pendiente: "bg-[#FFFBEB] text-[#B45309] border-[#D97706]/35",
  verificado: "bg-[#F0F9FF] text-[#0369A1] border-[#0284C7]/35",
  atendido: "bg-[#ECFDF5] text-[#059669] border-[#059669]/35",
};

export function AdminReportsInbox({ reports = [], onUpdateStatus }) {
  return (
    <section
      aria-label="Bandeja de reportes comunitarios anónimos"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-[#0B2545]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
              Reportes comunitarios anónimos (SQLite en vivo)
            </h3>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Enviados desde la vista Estudiante (0 PII · Ley N.° 29733). Valida o marca como atendido.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-[#0B2545] tabular-nums dark:bg-slate-800 dark:text-[#38BDF8]">
          {reports.length} registro(s)
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-[#F8FAFC] p-4 text-center text-xs font-medium text-[#475569] dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          Sin reportes comunitarios registrados aún. Cuando un estudiante reporte un incidente, aparecerá aquí y en el mapa al instante.
        </div>
      ) : (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {reports.slice(0, 12).map((rep) => {
            const cat = REPORT_CATEGORIES.find((c) => c.id === rep.category);
            const { local } = formatLimaTime(rep.created_at);
            return (
              <div
                key={rep.id}
                className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-3 text-xs dark:border-slate-700/80 dark:bg-slate-900/60 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-[#0F172A] dark:text-white">
                      {rep.zone_name}
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-[#0369A1] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-[#38BDF8] dark:ring-slate-700">
                      {cat?.label || rep.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${
                        STATUS_BADGE[rep.status] || STATUS_BADGE.pendiente
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  {rep.note && (
                    <p className="text-xs text-[#475569] dark:text-slate-300">{rep.note}</p>
                  )}
                  <div className="font-mono text-xs text-[#475569] tabular-nums dark:text-slate-400">
                    Severidad: {rep.severity} · {local}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {rep.status !== "verificado" && rep.status !== "atendido" && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus?.(rep.id, "verificado")}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#0284C7]/40 bg-[#F0F9FF] px-2.5 py-1.5 text-xs font-bold text-[#0369A1] hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verificar</span>
                    </button>
                  )}
                  {rep.status !== "atendido" && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus?.(rep.id, "atendido")}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#059669] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Atendido</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CampusReportModal;
