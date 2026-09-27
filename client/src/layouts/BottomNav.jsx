import React from "react";
import { NavLink } from "react-router-dom";
import {
  House,
  Package,
  ArrowLeftRight,
  Settings,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { openAiCopilot } from "../api/ai";
import { hapticLight, hapticMedium } from "../utils/haptics";

export default function BottomNav() {
  const handleCopilotClick = () => {
    hapticMedium();
    openAiCopilot();
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-200/80 dark:border-zinc-800/80 select-none shadow-2xl transition-all"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-0.5 items-center">
        {/* 1. Home */}
        <NavLink
          to="/home"
          onClick={() => hapticLight()}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl text-[10px] font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
              isActive
                ? "text-zinc-950 dark:text-white font-extrabold"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`w-10 h-7 grid place-items-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-105"
                    : "bg-transparent"
                }`}
              >
                <House size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className="leading-tight tracking-tight mt-0.5">Home</span>
            </>
          )}
        </NavLink>

        {/* 2. Products Catalog */}
        <NavLink
          to="/products"
          onClick={() => hapticLight()}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl text-[10px] font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
              isActive
                ? "text-zinc-950 dark:text-white font-extrabold"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`w-10 h-7 grid place-items-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-105"
                    : "bg-transparent"
                }`}
              >
                <Package size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className="leading-tight tracking-tight mt-0.5">Catalog</span>
            </>
          )}
        </NavLink>

        {/* 3. Center Featured Action: AI Copilot */}
        <div className="flex flex-col items-center justify-center -mt-2">
          <button
            type="button"
            onClick={handleCopilotClick}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white grid place-items-center shadow-lg shadow-violet-600/35 hover:scale-105 active:scale-90 transition-all duration-200 ring-4 ring-white dark:ring-zinc-950"
            aria-label="Open AI Copilot"
          >
            <Sparkles size={20} className="animate-pulse text-white" />
          </button>
          <span className="text-[9.5px] font-extrabold text-violet-700 dark:text-violet-400 mt-0.5 tracking-tight">
            Copilot
          </span>
        </div>

        {/* 4. Stock Ledger */}
        <NavLink
          to="/stock"
          onClick={() => hapticLight()}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl text-[10px] font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
              isActive
                ? "text-zinc-950 dark:text-white font-extrabold"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`w-10 h-7 grid place-items-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-105"
                    : "bg-transparent"
                }`}
              >
                <ArrowLeftRight size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className="leading-tight tracking-tight mt-0.5">Ledger</span>
            </>
          )}
        </NavLink>

        {/* 5. Settings */}
        <NavLink
          to="/settings"
          onClick={() => hapticLight()}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl text-[10px] font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
              isActive
                ? "text-zinc-950 dark:text-white font-extrabold"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`w-10 h-7 grid place-items-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-105"
                    : "bg-transparent"
                }`}
              >
                <Settings size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className="leading-tight tracking-tight mt-0.5">Settings</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
