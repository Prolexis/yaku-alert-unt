import React from "react";

const SIZE_CONFIG = {
  sm: {
    box: "h-8 w-8 rounded-lg p-1",
    wordmark: "text-sm",
    subtitle: "text-xs",
    gap: "gap-2.5",
  },
  md: {
    box: "h-10 w-10 rounded-xl p-1.5",
    wordmark: "text-base",
    subtitle: "text-xs",
    gap: "gap-3",
  },
  lg: {
    box: "h-12 w-12 rounded-2xl p-1.5",
    wordmark: "text-xl",
    subtitle: "text-xs",
    gap: "gap-3.5",
  },
};

export function YakuAlertLogo({
  size = "md",
  showSubtitle = false,
  variant = "light",
  iconOnly = false,
  className = "",
}) {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const isDark = variant === "dark";

  return (
    <div className={`inline-flex min-w-0 items-center ${cfg.gap} ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden ${cfg.box} ${
          isDark
            ? "bg-white shadow-sm ring-1 ring-white/25"
            : "bg-white shadow-sm ring-1 ring-slate-200/90 dark:bg-white dark:ring-white/20"
        }`}
      >
        <img
          src="/assets/yaku-alert-icon.png"
          alt="Yaku Alert"
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </div>

      {!iconOnly && (
        <div className="min-w-0 leading-tight">
          <div className={`flex items-baseline gap-1 font-extrabold tracking-tight ${cfg.wordmark}`}>
            <span className={isDark ? "text-white" : "text-[#0B2545] dark:text-white"}>
              YAKU
            </span>
            <span
              className={
                isDark
                  ? "bg-gradient-to-r from-[#38BDF8] to-[#00B4D8] bg-clip-text text-transparent"
                  : "bg-gradient-to-r from-[#0369A1] to-[#00B4D8] bg-clip-text text-transparent dark:from-[#38BDF8] dark:to-[#00B4D8]"
              }
            >
              ALERT
            </span>
          </div>
          {showSubtitle && (
            <div
              className={`truncate font-medium ${cfg.subtitle} ${
                isDark ? "text-slate-300" : "text-[#475569] dark:text-slate-300"
              }`}
            >
              UNT · Alerta Preventiva
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NexoRiskBadge({
  variant = "dark",
  compact = false,
  className = "",
}) {
  const isDark = variant === "dark";

  if (compact) {
    return (
      <div
        title="Desarrollado por NexoRisk"
        className={`inline-flex items-center justify-center rounded-lg p-1 ${
          isDark
            ? "bg-white/95 ring-1 ring-white/20"
            : "bg-white ring-1 ring-slate-200 dark:bg-white/95"
        } ${className}`}
      >
        <img
          src="/assets/nexorisk-icon.png"
          alt="NexoRisk"
          className="h-6 w-6 object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
        isDark
          ? "border-white/10 bg-white/[0.04] text-slate-200"
          : "border-slate-200 bg-[#F8FAFC] text-[#475569] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
      } ${className}`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80">
        <img
          src="/assets/nexorisk-icon.png"
          alt="NexoRisk"
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="min-w-0 leading-tight">
        <div
          className={`text-xs font-medium ${
            isDark ? "text-slate-300" : "text-[#475569] dark:text-slate-300"
          }`}
        >
          Desarrollado por{" "}
          <span
            className={`font-bold tracking-tight ${
              isDark ? "text-white" : "text-[#0B2545] dark:text-white"
            }`}
          >
            NexoRisk
          </span>
        </div>
      </div>
    </div>
  );
}

export default YakuAlertLogo;
