import React, { useState } from "react";

export default function PrecipitationChart({ points = [], height = 220 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!points.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-xs text-[#64748B] dark:border-slate-800 dark:text-slate-400">
        No hay puntos horarios disponibles.
      </div>
    );
  }

  const maxPrecip = Math.max(5, ...points.map((p) => p.precipitation_mm));
  const width = 760;
  const padL = 38;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barStep = innerW / points.length;
  const barW = Math.max(6, barStep * 0.62);

  // Línea de probabilidad (0..100%)
  const probPath = points
    .map((pt, i) => {
      const x = padL + i * barStep + barStep / 2;
      const prob = pt.precipitation_probability_pct ?? 0;
      const y = padT + innerH - (prob / 100) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="relative">
      {/* Tooltip flotante */}
      {activePoint && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/80">
          <span className="font-semibold text-[#0F172A] dark:text-white">
            Hora: {activePoint.time.replace("T", " ")}
          </span>
          <div className="flex flex-wrap gap-4 text-[#64748B] dark:text-slate-300">
            <span>
              Precipitación:{" "}
              <strong className="text-[#2563EB] dark:text-sky-400">
                {activePoint.precipitation_mm.toFixed(1)} mm/h
              </strong>
            </span>
            <span>
              Probabilidad:{" "}
              <strong className="text-[#14B8A6]">
                {activePoint.precipitation_probability_pct ?? "N/D"}%
              </strong>
            </span>
            <span>
              Humedad:{" "}
              <strong className="text-[#0F172A] dark:text-white">
                {activePoint.relative_humidity_2m_pct ?? "N/D"}%
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[560px] w-full select-none"
          role="img"
          aria-label="Gráfica de precipitación horaria en milímetros y probabilidad porcentual"
        >
          {/* Cuadrícula horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padT + innerH - ratio * innerH;
            const label = (maxPrecip * ratio).toFixed(1);
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className="stroke-[#E2E8F0] dark:stroke-slate-800"
                  strokeDasharray={ratio === 0 ? undefined : "3 3"}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#64748B] text-[10px] dark:fill-slate-400"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Barras de precipitación */}
          {points.map((pt, i) => {
            const x = padL + i * barStep + (barStep - barW) / 2;
            const barH = Math.max(2, (pt.precipitation_mm / maxPrecip) * innerH);
            const y = padT + innerH - barH;
            const isHovered = hoveredIdx === i;

            const fillClass =
              pt.precipitation_mm >= 10
                ? "fill-rose-500"
                : pt.precipitation_mm >= 2
                ? "fill-amber-500"
                : pt.precipitation_mm > 0
                ? "fill-[#2563EB]"
                : "fill-slate-300 dark:fill-slate-700";

            return (
              <g
                key={pt.time}
                tabIndex={0}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(i)}
                onBlur={() => setHoveredIdx(null)}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  className={`${fillClass} transition-opacity duration-150 ${
                    isHovered ? "opacity-100" : "opacity-85"
                  }`}
                />
                {i % 3 === 0 && (
                  <text
                    x={padL + i * barStep + barStep / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-[#64748B] text-[10px] dark:fill-slate-400"
                  >
                    {pt.time.slice(11, 16)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Curva de probabilidad */}
          <path
            d={probPath}
            fill="none"
            stroke="#14B8A6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none opacity-90"
          />
        </svg>
      </div>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap items-center gap-5 text-[11px] text-[#64748B] dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Precipitación (mm/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Moderada (≥2 mm/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#14B8A6]" /> Probabilidad de lluvia (%)
        </span>
      </div>
    </div>
  );
}
