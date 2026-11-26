import React, { useState } from "react";

export default function PrecipitationChart({ points = [], height = 250 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!points.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B] dark:border-slate-800 dark:text-slate-400">
        No hay datos horarios disponibles para graficar.
      </div>
    );
  }

  const maxPrecip = Math.max(5, ...points.map((p) => p.precipitation_mm));
  const width = 820;
  const padL = 46;
  const padR = 36;
  const padT = 20;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barStep = innerW / points.length;
  const barW = Math.max(6, Math.min(20, barStep * 0.62));

  const probPath = points
    .map((pt, i) => {
      const x = padL + i * barStep + barStep / 2;
      const prob = pt.precipitation_probability_pct ?? 0;
      const y = padT + innerH - (prob / 100) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const labelInterval = points.length > 30 ? 6 : 3;

  return (
    <div className="space-y-2.5">
      <span className="sr-only">
        Pase el cursor o navegue con teclado sobre las barras para inspeccionar cada hora.
      </span>

      {/* Lectura interactiva compacta sin franja de instrucciones */}
      <div className="flex min-h-[24px] flex-wrap items-center justify-between gap-2 text-xs">
        {activePoint ? (
          <>
            <span className="font-semibold text-[#111827] dark:text-white">
              {activePoint.time.replace("T", " · ")}
            </span>
            <div className="flex flex-wrap gap-4 text-[#64748B] dark:text-slate-300">
              <span>
                Precipitación:{" "}
                <strong className="font-bold text-[#1D4ED8] dark:text-blue-400">
                  {activePoint.precipitation_mm.toFixed(1)} mm/h
                </strong>
              </span>
              <span>
                Probabilidad:{" "}
                <strong className="font-bold text-[#0F766E] dark:text-teal-400">
                  {activePoint.precipitation_probability_pct ?? "N/D"}%
                </strong>
              </span>
              <span>
                Humedad:{" "}
                <strong className="font-bold text-[#111827] dark:text-white">
                  {activePoint.relative_humidity_2m_pct ?? "N/D"}%
                </strong>
              </span>
            </div>
          </>
        ) : (
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Inspección horaria interactiva (cursor o teclado Tab)
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[580px] w-full select-none"
          role="img"
          aria-label="Gráfica horaria de precipitación en milímetros por hora y probabilidad de lluvia"
        >
          {/* Eje Y izquierdo (mm/h) y líneas guía */}
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
                  className="stroke-[#E2E8F0] dark:stroke-slate-800"
                  strokeDasharray={ratio === 0 ? undefined : "3 3"}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#64748B] text-xs dark:fill-slate-400"
                >
                  {mmLabel}
                </text>
                <text
                  x={width - padR + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-[#64748B] text-xs dark:fill-slate-400"
                >
                  {pctLabel}%
                </text>
              </g>
            );
          })}

          {/* Etiqueta unidad eje izquierdo */}
          <text x={8} y={12} className="fill-[#64748B] text-xs font-semibold dark:fill-slate-400">
            mm/h
          </text>
          <text
            x={width - 8}
            y={12}
            textAnchor="end"
            className="fill-[#64748B] text-xs font-semibold dark:fill-slate-400"
          >
            Prob.
          </text>

          {/* Barras */}
          {points.map((pt, i) => {
            const x = padL + i * barStep + (barStep - barW) / 2;
            const barH = Math.max(2, (pt.precipitation_mm / maxPrecip) * innerH);
            const y = padT + innerH - barH;
            const isHovered = hoveredIdx === i;

            const fillClass =
              pt.precipitation_mm >= 10
                ? "fill-rose-600"
                : pt.precipitation_mm >= 2
                ? "fill-amber-500"
                : pt.precipitation_mm > 0
                ? "fill-[#2563EB]"
                : "fill-slate-200 dark:fill-slate-700";

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
                  rx={3}
                  className={`${fillClass} transition-opacity duration-150 ${
                    isHovered ? "opacity-100" : "opacity-85"
                  }`}
                />
                {i % labelInterval === 0 && (
                  <text
                    x={padL + i * barStep + barStep / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#64748B] text-xs dark:fill-slate-400"
                  >
                    {pt.time.slice(11, 16)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Línea de probabilidad */}
          <path
            d={probPath}
            fill="none"
            stroke="#0D9488"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none opacity-90"
          />
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-[#64748B] dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Precipitación ligera (mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Moderada (≥2 mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" /> Intensa (≥10 mm/h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#0D9488]" /> Probabilidad de lluvia (%)
        </span>
      </div>
    </div>
  );
}
