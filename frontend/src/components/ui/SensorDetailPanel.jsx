import React, { useState } from "react";
import {
  Radio,
  WifiOff,
  RefreshCw,
  ChevronDown,
  MapPin,
  Waves,
  BookOpen,
  Building2,
  X,
  Cpu,
  AlertTriangle,
} from "lucide-react";
import {
  SENSOR_STATUS_STYLES,
  resolveSensorReading,
} from "../../utils/sensorFormatters";

export default function SensorDetailPanel({
  sensor,
  activeHour,
  disconnectedEntry,
  onToggleDisconnect,
  onClose,
  onCenterMap,
  onOpenDynamicSim,
  onOpenFacility,
  onOpenGuidance,
}) {
  const [archOpen, setArchOpen] = useState(false);

  if (!sensor) return null;

  const reading = resolveSensorReading(sensor, activeHour, disconnectedEntry);
  const statusStyle =
    SENSOR_STATUS_STYLES[reading.statusKey] || SENSOR_STATUS_STYLES.no_reading;
  const series = sensor.series || [];
  const maxSeriesVal = Math.max(...series.map((p) => Number(p.value) || 0), 1);
  const arch = sensor.iot_architecture;

  return (
    <section
      aria-label={`Ficha técnica del sensor ${sensor.id}`}
      className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0B1F33]"
    >
      {/* Encabezado compacto */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-200">
              <Radio className="h-3 w-3" />
              {sensor.id}
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Sensor virtual · SIM
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle.badgeClass}`}
            >
              {statusStyle.label}
            </span>
          </div>
          <h4 className="mt-1.5 text-sm font-bold text-[#101828] dark:text-white">
            {sensor.name}
          </h4>
          <p className="text-[11px] text-[#475467] dark:text-slate-400">
            {sensor.location_label}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha de sensor"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Bloque de lectura sincronizada */}
      <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#475467] dark:text-slate-400">
            {sensor.reading_label || "Lectura virtual"}
          </span>
          <span className="font-mono text-[11px] text-[#475467] dark:text-slate-400">
            Hora: {reading.hourLabel}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div className="text-xl font-bold text-[#101828] dark:text-white">
            {reading.displayValue}
          </div>
          {reading.accumulatedMm !== null && (
            <span className="text-xs font-medium text-[#475467] dark:text-slate-300">
              Acum.: {Number(reading.accumulatedMm).toFixed(1)} mm
            </span>
          )}
        </div>
        {reading.isFrozen && (
          <div className="mt-1.5 rounded bg-amber-100/80 px-2 py-1 text-[11px] font-medium text-amber-950 dark:bg-amber-950/60 dark:text-amber-200">
            Estado de comunicación simulado: interrumpida. Se conserva el último dato recibido ({reading.hourLabel}
            {reading.ageHours > 0 ? `, antigüedad: ${reading.ageHours} h simuladas` : ", sin nuevas actualizaciones"}). No altera el modelo hidrológico.
          </div>
        )}
        <div className="mt-1.5 text-[11px] text-[#475467] dark:text-slate-400">
          <strong>Origen:</strong> {sensor.reading_source}
        </div>
      </div>

      {/* Simulación de conectividad */}
      {onToggleDisconnect && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] dark:border-slate-700">
          <span className="text-[#475467] dark:text-slate-300">
            Estado de comunicación simulado
          </span>
          {!disconnectedEntry ? (
            <button
              type="button"
              onClick={() => onToggleDisconnect(sensor.id, reading)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            >
              <WifiOff className="h-3 w-3" />
              Simular desconexión
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleDisconnect(sensor.id, null)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              <RefreshCw className="h-3 w-3" />
              Restablecer comunicación
            </button>
          )}
        </div>
      )}

      {/* Gráfica de evolución horaria */}
      {series.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[#475467] dark:text-slate-400">
            <span className="font-semibold">Evolución horaria simulada ({sensor.unit})</span>
            <span>
              Máx: {sensor.peak_value !== null ? `${Number(sensor.peak_value).toFixed(1)} ${sensor.unit}` : "—"}
              {sensor.peak_hour ? ` (h+${sensor.peak_hour})` : ""}
            </span>
          </div>
          <div
            className="flex h-16 items-end gap-0.5 rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-1.5 dark:border-slate-800 dark:bg-slate-900/50"
            role="img"
            aria-label={`Serie temporal simulada del sensor ${sensor.id}`}
          >
            {series.map((pt) => {
              const pct = Math.max(4, Math.round(((Number(pt.value) || 0) / maxSeriesVal) * 100));
              const isCurrent = activeHour ? pt.hour === activeHour : false;
              const isAfterDisconnect =
                disconnectedEntry?.hour && pt.hour > disconnectedEntry.hour;
              return (
                <div
                  key={pt.hour}
                  title={`${pt.label}: ${Number(pt.value).toFixed(1)} ${sensor.unit}`}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    style={{ height: `${pct}%` }}
                    className={`w-full rounded-t-sm transition-all ${
                      isAfterDisconnect
                        ? "bg-slate-300/60 dark:bg-slate-700/50"
                        : isCurrent
                        ? "bg-[#2563EB] dark:bg-sky-400"
                        : "bg-sky-400/75 dark:bg-sky-600/80"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadatos técnicos */}
      <dl className="mt-3 grid grid-cols-1 gap-1.5 text-[11px] text-[#475467] dark:text-slate-400">
        <div>
          <dt className="inline font-semibold text-[#101828] dark:text-slate-200">Tipo: </dt>
          <dd className="inline">{sensor.sensor_type}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#101828] dark:text-slate-200">Ubicación: </dt>
          <dd className="inline">
            {sensor.location_status} ({Number(sensor.lat).toFixed(5)}, {Number(sensor.lon).toFixed(5)} · celda{" "}
            {sensor.grid_rc ? `${sensor.grid_rc[0]},${sensor.grid_rc[1]}` : "N/D"})
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#101828] dark:text-slate-200">Conexión futura: </dt>
          <dd className="inline">{sensor.connectivity_protocol}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#101828] dark:text-slate-200">Instalación real: </dt>
          <dd className="inline">No disponible (propuesta de despliegue futuro)</dd>
        </div>
      </dl>

      {/* Advertencias */}
      {sensor.warnings?.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-[11px] text-[#475467] dark:bg-slate-900/70 dark:text-slate-400">
          <div className="mb-0.5 flex items-center gap-1 font-semibold text-[#101828] dark:text-slate-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            Límites y transparencia
          </div>
          {sensor.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {/* Acordeón: ¿Cómo se conectaría físicamente? */}
      {arch && (
        <div className="mt-2.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setArchOpen((v) => !v)}
            aria-expanded={archOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-[#101828] dark:text-white"
          >
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[#2563EB]" />
              ¿Cómo se conectaría físicamente?
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${archOpen ? "rotate-180" : ""}`}
            />
          </button>
          {archOpen && (
            <div className="space-y-2 border-t border-[#E2E8F0] px-3 py-2.5 text-[11px] text-[#475467] dark:border-slate-800 dark:text-slate-300">
              <div className="font-semibold text-[#101828] dark:text-white">
                Tecnología propuesta: {sensor.physical_technology}
              </div>
              <ol className="list-decimal space-y-0.5 pl-4">
                {arch.pipeline.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <div className="rounded bg-amber-50 p-2 text-[10px] text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                <strong>Propuesta futura (no operativa):</strong> Requiere verificar frecuencias autorizadas en Perú (MTC), cobertura radioeléctrica real en UNT, energía/mantenimiento, calibración en campo y permisos institucionales.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {onCenterMap && (
          <button
            type="button"
            onClick={() => onCenterMap(sensor)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
          >
            <MapPin className="h-3 w-3" />
            Ver ubicación
          </button>
        )}
        {onOpenDynamicSim && (
          <button
            type="button"
            onClick={onOpenDynamicSim}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#101828] hover:border-[#2563EB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Waves className="h-3 w-3" />
            Simulación dinámica
          </button>
        )}
        {onOpenFacility && sensor.associated_facility_id && (
          <button
            type="button"
            onClick={() => onOpenFacility(sensor.associated_facility_id)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#101828] hover:border-[#2563EB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Building2 className="h-3 w-3" />
            Ver instalación
          </button>
        )}
        {onOpenGuidance && (
          <button
            type="button"
            onClick={onOpenGuidance}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#101828] hover:border-[#2563EB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <BookOpen className="h-3 w-3" />
            Orientaciones
          </button>
        )}
      </div>
    </section>
  );
}
