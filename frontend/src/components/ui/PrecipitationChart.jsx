import React, { useId, useState } from "react";
import { motion } from "framer-motion";

const PREVENTIVE_THRESHOLD_MM = 2.0;

export default function PrecipitationChart({ points = [], height = 250 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const uid = useId().replace(/:/g, "");

  if (!points.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm font-medium text-[#475569] dark:border-slate-700 dark:text-slate-300">
        No hay datos horarios disponibles para graficar.
      </div>
    );
  }

  const maxPrecip = Math.max(5, ...points.map((p) => p.precipitation_mm ?? 0));
  const width = 820;
  const padL = 48;
  const padR = 42;
  const padT = 22;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barStep = innerW / points.length;
  const barW = Math.max(7, Math.min(22, barStep * 0.62));

  const probPath = points
    .map((pt, i) => {
      const x = padL + i * barStep + barStep / 2;
      const prob = pt.precipitation_probability_pct ?? 0;
      const y = padT + innerH - (prob / 100) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const thresholdY =
    padT + innerH - Math.min(1, PREVENTIVE_THRESHOLD_MM / maxPrecip) * innerH;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const labelInterval = points.length > 30 ? 6 : 3;
  const chartKey = `${points.length}-${points[0]?.time || ""}-${maxPrecip.toFixed(1)}`;

  const gradCyanId = `grad-cyan-${uid}`;
  const gradAmberId = `grad-amber-${uid}`;
  const gradRedId = `grad-red-${uid}`;

  return (
    <div className="space-y-3">
      <span className="sr-only">
        Pase el cursor o navegue con la tecla Tab sobre las barras para inspeccionar precipitación y
        probabilidad de cada hora.
      </span>

      {/* Barra de inspección interactiva limpia (solo muestra valores al pasar el cursor, sin ruido fijo) */}
      {activePoint ? (
        <div className="flex min-h-[32px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0369A1]/25 bg-[#F0F9FF]/80 px-3.5 py-1.5 text-xs dark:border-sky-800 dark:bg-sky-950/50">
          <span className="font-mono font-bold text-[#0B2545] tabular-nums dark:text-white">
            {String(activePoint.time || "").replace("T", " · ")}
          </span>
          <div className="flex flex-wrap items-center gap-4 text-[#475569] dark:text-slate-300">
            <span>
              Lluvia:{" "}
              <strong className="font-mono font-extrabold text-[#0369A1] tabular-nums dark:text-[#38BDF8]">
                {(activePoint.precipitation_mm ?? 0).toFixed(1)} mm/h
              </strong>
            </span>
            <span>
              Probabilidad:{" "}
              <strong className="font-mono font-extrabold text-[#059669] tabular-nums dark:text-emerald-400">
                {activePoint.precipitation_probability_pct ?? "N/D"}%
              </strong>
            </span>
            <span>
              Humedad:{" "}
              <strong className="font-mono font-bold text-[#0F172A] tabular-nums dark:text-white">
                {activePoint.relative_humidity_2m_pct ?? "N/D"}%
              </strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-[#64748B] dark:text-slate-400">
          Pasa el cursor sobre cualquier hora para ver el detalle.
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          key={chartKey}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[560px] select-none"
          role="img"
          aria-label="Gráfica horaria de precipitación en milímetros por hora y probabilidad de lluvia"
        >
          <defs>
            <linearGradient id={gradCyanId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00B4D8" />
              <stop offset="100%" stopColor="#0B2545" />
            </linearGradient>
            <linearGradient id={gradAmberId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id={gradRedId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#B91C1C" />
            </linearGradient>
          </defs>

          {/* Eje Y izquierdo (mm/h) y derecho (Prob %) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padT + innerH - ratio * innerH;
            const mmLabel = (maxPrecip * ratio).toFixed(1);
            const pctLabel = Math.round(ratio * 100);
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className={
                    ratio === 0
                      ? "stroke-slate-300 dark:stroke-slate-700"
                      : "stroke-slate-200 dark:stroke-slate-800"
                  }
                  strokeDasharray={ratio === 0 ? undefined : "3 4"}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#475569] font-mono text-xs dark:fill-slate-400"
                >
                  {mmLabel}
                </text>
                <text
                  x={width - padR + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-[#475569] font-mono text-xs dark:fill-slate-400"
                >
                  {pctLabel}%
                </text>
              </g>
            );
          })}

          {/* Línea punteada horizontal de umbral preventivo (2.0 mm/h) */}
          <g>
            <line
              x1={padL}
              y1={thresholdY}
              x2={width - padR}
              y2={thresholdY}
              stroke="#D97706"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.8"
            />
            <rect
              x={padL + 6}
              y={thresholdY - 17}
              width={118}
              height={16}
              rx={4}
              className="fill-[#FFFBEB] dark:fill-amber-950/90"
            />
            <text
              x={padL + 12}
              y={thresholdY - 5}
              className="fill-[#B45309] font-mono text-[11px] font-bold dark:fill-amber-300"
            >
              Umbral {PREVENTIVE_THRESHOLD_MM.toFixed(0)} mm/h
            </text>
          </g>

          {/* Etiquetas superiores de ejes */}
          <text
            x={padL}
            y={13}
            textAnchor="start"
            className="fill-[#0B2545] font-mono text-xs font-bold dark:fill-slate-300"
          >
            mm/h
          </text>
          <text
            x={width - padR}
            y={13}
            textAnchor="end"
            className="fill-[#059669] font-mono text-xs font-bold dark:fill-emerald-400"
          >
            Prob. %
          </text>

          {/* Barras con animación suave de crecimiento */}
          {points.map((pt, i) => {
            const x = padL + i * barStep + (barStep - barW) / 2;
            const mm = pt.precipitation_mm ?? 0;
            const barH = Math.max(3, (mm / maxPrecip) * innerH);
            const y = padT + innerH - barH;
            const isHovered = hoveredIdx === i;

            const fillUrl =
              mm >= 10
                ? `url(#${gradRedId})`
                : mm >= PREVENTIVE_THRESHOLD_MM
                ? `url(#${gradAmberId})`
                : mm > 0
                ? `url(#${gradCyanId})`
                : undefined;

            return (
              <g
                key={pt.time || i}
                tabIndex={0}
                role="button"
                aria-label={`${String(pt.time || "").replace("T", " ")}: ${mm.toFixed(1)} mm/h, probabilidad ${pt.precipitation_probability_pct ?? "N/D"}%`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(i)}
                onBlur={() => setHoveredIdx(null)}
                className="cursor-pointer outline-none"
              >
                {/* Franja de enfoque / hover detrás de la barra */}
                <rect
                  x={padL + i * barStep + 1}
                  y={padT}
                  width={Math.max(4, barStep - 2)}
                  height={innerH}
                  rx={4}
                  className={
                    isHovered
                      ? "fill-[#00B4D8]/12 stroke-[#00B4D8]/40"
                      : "fill-transparent"
                  }
                />

                <motion.rect
                  x={x}
                  width={barW}
                  rx={4}
                  initial={{ y: padT + innerH, height: 0 }}
                  animate={{ y, height: barH }}
                  transition={{
                    duration: 0.36,
                    delay: Math.min(i * 0.012, 0.28),
                    ease: "easeOut",
                  }}
                  fill={fillUrl}
                  className={
                    !fillUrl
                      ? "fill-slate-300/80 dark:fill-slate-700"
                      : isHovered
                      ? "opacity-100"
                      : "opacity-90"
                  }
                />

                {i % labelInterval === 0 && (
                  <text
                    x={padL + i * barStep + barStep / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#475569] font-mono text-xs dark:fill-slate-400"
                  >
                    {String(pt.time || "").slice(11, 16)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Línea suavizada de probabilidad de lluvia (%) */}
          <motion.path
            d={probPath}
            fill="none"
            stroke="#059669"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0.3 }}
            animate={{ pathLength: 1, opacity: 0.95 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="pointer-events-none"
          />

          {/* Punto destacado en la línea de probabilidad al inspeccionar */}
          {activePoint && hoveredIdx !== null && (
            <circle
              cx={padL + hoveredIdx * barStep + barStep / 2}
              cy={
                padT +
                innerH -
                ((activePoint.precipitation_probability_pct ?? 0) / 100) * innerH
              }
              r={4.5}
              fill="#059669"
              stroke="#FFFFFF"
              strokeWidth="2"
              className="pointer-events-none"
            />
          )}
        </svg>
      </div>

      {/* Leyenda clara >= 12px */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#475569] dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: "linear-gradient(180deg, #00B4D8 0%, #0B2545 100%)" }}
          />
          Precipitación ligera (mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#F59E0B]" />
          Umbral preventivo (≥2 mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#DC2626]" />
          Intensa (≥10 mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[#059669]" />
          Probabilidad de lluvia (%)
        </span>
      </div>
    </div>
  );
}
