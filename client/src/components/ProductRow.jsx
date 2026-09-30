import React, { memo } from "react";
import { Link } from "react-router-dom";
import Badge, { getProductStatus } from "./ui/Badge";

function ProductRow({ product }) {
  const status = getProductStatus(product);
  return (
    <Link to={`/products/${product._id}`} className="flex items-center gap-3 py-3 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition group">
      <div className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 grid place-items-center overflow-hidden shrink-0 group-hover:shadow-sm transition">
        {product.image ? <img src={product.image} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" /> : <span className="text-zinc-400">📦</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold tracking-tight truncate text-zinc-900 dark:text-white">{product.name}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{product.sku ? `${product.sku} · `:""}{product.category?.name || "Uncategorized"}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">{product.quantity} <span className="text-xs font-normal text-zinc-500">{product.unit}</span></div>
        <div className="mt-1 flex justify-end"><Badge status={status} size="sm" /></div>
      </div>
    </Link>
  );
}

export default memo(ProductRow);
