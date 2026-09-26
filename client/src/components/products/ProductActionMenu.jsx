import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export default function ProductActionMenu({
  product,
  onEdit,
  onDelete,
  onCopySku,
  copiedSku,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const handleStockIn = (e) => {
    e.stopPropagation();
    setOpen(false);
    navigate(`/stock?product=${product._id}&type=IN`);
  };

  const handleStockOut = (e) => {
    e.stopPropagation();
    setOpen(false);
    navigate(`/stock?product=${product._id}&type=OUT`);
  };

  const isCopied = copiedSku === product.sku;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Actions for ${product.name}`}
        className={`w-8 h-8 sm:w-9 sm:h-9 grid place-items-center rounded-xl transition-all duration-150 active:scale-95 ${
          open
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
            : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
        }`}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop for easy dismissal */}
          <div
            className="fixed inset-0 z-30 sm:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />

          <div
            className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-950/10 dark:shadow-zinc-950/40 p-1.5 z-40 animate-scale-in origin-top-right focus:outline-none"
            role="menu"
            aria-orientation="vertical"
          >
            {/* View Details */}
            <Link
              to={`/products/${product._id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              role="menuitem"
            >
              <ExternalLink size={14} className="text-zinc-500 shrink-0" />
              <span>View Details</span>
            </Link>

            {/* Edit */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit?.(product);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              role="menuitem"
            >
              <Edit2 size={14} className="text-zinc-500 shrink-0" />
              <span>Edit Product</span>
            </button>

            {/* Stock IN */}
            <button
              type="button"
              onClick={handleStockIn}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
              role="menuitem"
            >
              <ArrowDownLeft size={14} className="text-emerald-600 shrink-0" />
              <span>Stock IN (Receive)</span>
            </button>

            {/* Stock OUT */}
            <button
              type="button"
              onClick={handleStockOut}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
              role="menuitem"
            >
              <ArrowUpRight size={14} className="text-amber-600 shrink-0" />
              <span>Stock OUT (Dispatch)</span>
            </button>

            {/* Copy SKU */}
            {product.sku && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopySku?.(product.sku);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                role="menuitem"
              >
                {isCopied ? (
                  <Check size={14} className="text-emerald-600 shrink-0" />
                ) : (
                  <Copy size={14} className="text-zinc-500 shrink-0" />
                )}
                <span>{isCopied ? "SKU Copied!" : "Copy SKU"}</span>
              </button>
            )}

            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

            {/* Delete */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete?.(product);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              role="menuitem"
            >
              <Trash2 size={14} className="text-red-500 shrink-0" />
              <span>Delete Product</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
