import React from "react";

const STYLES = {
  "In Stock":
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  "Low Stock":
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  "Out of Stock":
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
  active:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  inactive:
    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  info: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-500/10 dark:text-primary-300 dark:border-primary-500/20",
  neutral:
    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

const DOTS = {
  "In Stock": "bg-emerald-500",
  "Low Stock": "bg-amber-500",
  "Out of Stock": "bg-red-500",
  active: "bg-emerald-500",
  inactive: "bg-zinc-400",
  info: "bg-primary-500",
  neutral: "bg-zinc-400",
};

export default function Badge({ status, size = "md" }) {
  const sz = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${sz} ${
        STYLES[status] || STYLES.neutral
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[status] || DOTS.neutral}`} />
      {status}
    </span>
  );
}

export function getProductStatus(p) {
  const min = p.minimumStock ?? p.minimumQuantity ?? 5;
  if (p.quantity === 0) return "Out of Stock";
  if (p.quantity <= min) return "Low Stock";
  return "In Stock";
}
