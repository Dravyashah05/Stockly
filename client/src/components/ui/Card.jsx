import React from "react";

export default function Card({ children, className="", hover, padding=true, ...props }){
  return (
    <div className={`card ${hover?"card-hover":""} ${padding?"p-4 sm:p-5":""} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }){
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        {title && <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>}
        {subtitle && <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, trend }){
  return (
    <div className="card p-5 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-2 text-zinc-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200/50 dark:border-violet-500/20 grid place-items-center text-violet-600 dark:text-violet-300">
            <Icon size={18} />
          </div>
        )}
      </div>
      {trend && <div className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">{trend}</div>}
    </div>
  )
}
