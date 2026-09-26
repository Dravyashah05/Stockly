import React from "react";

export function Input({ label, hint, error, className="", ...props }){
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</label>}
      <input className={`input-field ${error ? "!border-red-300 !ring-red-500/10" : ""}`} {...props} />
      {hint && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}

export function Textarea({ label, hint, error, className="", ...props }){
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</label>}
      <textarea className={`input-field min-h-[88px] resize-none ${error ? "!border-red-300" : ""}`} {...props} />
      {hint && <p className="text-xs text-zinc-500 mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className="", ...props }){
  return (
    <div className={className}>
      {label && <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</label>}
      <select className="input-field" {...props}>
        {children}
      </select>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder="Search..." }){
  return (
    <div className="relative flex-1">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20L16 16" /></svg>
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field pl-10 !bg-zinc-50 dark:!bg-zinc-900 !border-zinc-200/70 dark:!border-zinc-800 focus:!bg-white dark:focus:!bg-zinc-900"
      />
    </div>
  )
}
