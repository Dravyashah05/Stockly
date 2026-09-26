import React from "react";

export default function Badge({ status, size="md" }){
  const map={
    "In Stock":"bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-emerald-500/10",
    "Low Stock":"bg-amber-50 text-amber-700 border-amber-200/60 ring-amber-500/10",
    "Out of Stock":"bg-red-50 text-red-700 border-red-200/60 ring-red-500/10",
    "active":"bg-emerald-50 text-emerald-700 border-emerald-200/60",
    "inactive":"bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  const sz = size==="sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border shadow-sm ring-1 ring-inset ${sz} ${map[status]||"bg-zinc-50 text-zinc-600 border-zinc-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status==="In Stock"||status==="active" ? "bg-emerald-500" : status==="Low Stock" ? "bg-amber-500" : status==="Out of Stock" ? "bg-red-500" : "bg-zinc-400"}`} />
      {status}
    </span>
  )
}
export function getProductStatus(p){
  const min = p.minimumStock ?? p.minimumQuantity ?? 5;
  if(p.quantity===0) return "Out of Stock";
  if(p.quantity <= min) return "Low Stock";
  return "In Stock";
}
