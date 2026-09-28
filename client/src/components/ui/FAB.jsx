import React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

export default function FAB({ onClick, label = "Add", className = "" }){
  // Render as portal to body to avoid being trapped by parent transform
  // Now visible on all screen sizes (removed sm:hidden) since top buttons removed
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={`fixed right-4 sm:right-6 w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg grid place-items-center hover:scale-105 active:scale-95 transition-all touch-manipulation ${className}`}
      style={{ bottom: "calc(88px + env(safe-area-inset-bottom))", zIndex: 80 }}
      aria-label={label}
    >
      <Plus size={26} strokeWidth={2.2} />
    </button>
  );
  if(typeof document !== "undefined" && document.body){
    return createPortal(content, document.body);
  }
  return content;
}
