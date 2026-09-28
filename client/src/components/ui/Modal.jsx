import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  description,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    };
  }, [open]);

  if (!open) return null;

  const maxW =
    size === "lg"
      ? "sm:max-w-2xl"
      : size === "sm"
      ? "sm:max-w-sm"
      : "sm:max-w-lg";

  const content = (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md animate-fade-in will-change-[opacity]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxW} max-h-[92dvh] sm:max-h-[90vh] bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden will-change-transform animate-slide-up sm:animate-scale-in`}
        style={{
          transform: "translateZ(0)",
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        }}
      >
        {/* Mobile Bottom Sheet Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="sheet-handle" />
        </div>

        {/* Modal Header */}
        <div className="shrink-0 px-5 sm:px-6 pt-2 sm:pt-5 pb-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3
              id="modal-title"
              className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-white leading-snug"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-normal">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}