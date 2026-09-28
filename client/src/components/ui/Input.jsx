import React from "react";

export function Input({ label, hint, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="input-label">{label}</label>}
      <input
        className={`input-field ${error ? "!border-red-400 focus:!border-red-500 focus:!ring-red-500/10" : ""}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function Textarea({ label, hint, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="input-label">{label}</label>}
      <textarea
        className={`input-field min-h-[88px] resize-y ${error ? "!border-red-400" : ""}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function Select({ label, hint, error, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="input-label">{label}</label>}
      <div className="relative">
        <select
          className={`input-field appearance-none pr-9 ${error ? "!border-red-400" : ""}`}
          {...props}
        >
          {children}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {hint && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative flex-1">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20 16.5 16.5" />
        </svg>
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field pl-10 !bg-zinc-50 dark:!bg-zinc-800/60 focus:!bg-white dark:focus:!bg-zinc-900"
      />
    </div>
  );
}
