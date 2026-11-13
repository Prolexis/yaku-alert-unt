import React from "react";

export default function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-[#0B1F33] ${className}`}
    >
      <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-4 h-7 w-24 rounded bg-slate-200 dark:bg-slate-700" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="mt-3 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}
