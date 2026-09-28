import React from "react";

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none touch-manipulation select-none";
  const variants = {
    primary:
      "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:shadow dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100",
    accent:
      "bg-primary-600 text-white shadow-sm shadow-primary-600/25 hover:bg-primary-700 active:bg-primary-800",
    secondary:
      "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-700 shadow-sm",
    ghost:
      "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
    danger:
      "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20 active:bg-red-700",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:bg-emerald-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[34px]",
    md: "px-4 py-2.5 text-sm min-h-[42px]",
    lg: "px-5 py-3 text-sm min-h-[48px]",
    icon: "w-9 h-9 p-0",
  };
  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
