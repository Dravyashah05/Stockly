import React from "react";

export default function Button({ variant="primary", size="md", loading, children, className="", ...props }){
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none touch-manipulation will-change-transform";
  const variants = {
    primary: "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 hover:shadow-md dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100",
    secondary: "bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  };
  const sizes = {
    sm: "px-3 py-2 text-xs min-h-[36px]",
    md: "px-4 py-3 sm:py-2.5 text-sm min-h-[44px]",
    lg: "px-5 py-3.5 text-sm min-h-[48px]",
    icon: "w-11 h-11 sm:w-9 sm:h-9 p-0",
  };
  return (
    <button className={`${base} ${variants[variant]||variants.primary} ${sizes[size]||sizes.md} ${className}`} disabled={loading||props.disabled} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  )
}
