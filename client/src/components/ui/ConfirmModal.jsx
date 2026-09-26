import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import Button from "./Button";

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  icon,
}){
  useEffect(()=>{
    if(open){
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    }
    return ()=> {
      document.body.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    };
  },[open]);

  if(!open) return null;
  const isDanger = variant === "danger";
  const content = (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-900/30 animate-fade-in will-change-[opacity]" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full sm:max-w-sm max-h-[92dvh] bg-white dark:bg-zinc-900 rounded-t-[24px] sm:rounded-[20px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden will-change-transform animate-slide-up sm:animate-scale-in"
        style={{ transform: "translateZ(0)", paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-0">
          <div className="sheet-handle" />
        </div>
        <button onClick={onClose} className="absolute right-3 top-3 sm:top-3 w-11 h-11 sm:w-8 sm:h-8 grid place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 active:scale-95 transition touch-manipulation z-10">
          <X size={16} className="sm:w-[14px] sm:h-[14px]"/>
        </button>
        <div className="p-6 pt-5 sm:pt-7 text-center">
          <div className={`w-14 h-14 sm:w-12 sm:h-12 rounded-2xl grid place-items-center mx-auto mb-4 ${isDanger ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"}`}>
            {icon || (isDanger ? <Trash2 size={22} className="sm:w-5 sm:h-5"/> : <AlertTriangle size={22} className="sm:w-5 sm:h-5"/>)}
          </div>
          <h3 className="text-[17px] sm:text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
          {description && <p className="text-[14px] sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed px-2 sm:px-0">{description}</p>}
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onClose} className="flex-1 py-3.5 sm:py-2.5 text-[15px] sm:text-sm" disabled={loading}>{cancelLabel}</Button>
            <Button
              onClick={onConfirm}
              loading={loading}
              className={`flex-1 py-3.5 sm:py-2.5 text-[15px] sm:text-sm ${isDanger ? "!bg-red-600 hover:!bg-red-700 !text-white border-red-600 shadow-lg shadow-red-500/20" : ""}`}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
  if(typeof document !== "undefined" && document.body){
    return createPortal(content, document.body);
  }
  return content;
}
