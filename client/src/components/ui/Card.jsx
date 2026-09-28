import React from "react";

export default function Card({ children, className = "", hover = false, padding = true, ...props }) {
  return (
    <div
      className={`card ${hover ? "card-hover" : ""} ${padding ? "p-4 sm:p-5" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        {title && (
          <h3 className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, trend, tone = "primary" }) {
  const tones = {
    primary:
      "bg-primary-50 dark:bg-primary-500/10 border-primary-200/60 dark:border-primary-500/20 text-primary-600 dark:text-primary-400",
    emerald:
      "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    amber:
      "bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/20 text-red-600 dark:text-red-400",
    zinc: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
  };
  return (
    <div className="card p-4 sm:p-5 card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5 text-zinc-900 dark:text-white tabular-nums">
            {value}
          </p>
          {sub && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">{sub}</p>}
        </div>
        {Icon && (
          <div
            className={`w-10 h-10 rounded-xl border grid place-items-center shrink-0 ${tones[tone] || tones.primary}`}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{trend}</div>
      )}
    </div>
  );
}
