import React from "react";
import { NavLink } from "react-router-dom";
import { House, Package, ArrowLeftRight, Settings, Sparkles } from "lucide-react";
import { openAiCopilot } from "../api/ai";
import { hapticLight, hapticMedium } from "../utils/haptics";

function Tab({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      onClick={() => hapticLight()}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[56px] rounded-full text-[10px] font-semibold transition-all duration-200 active:scale-90 ${
          isActive
            ? "text-zinc-900 dark:text-white"
            : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`min-w-[52px] h-8 px-4 grid place-items-center rounded-full transition-all duration-200 ${
              isActive ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm" : "bg-transparent"
            }`}
          >
            <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
          </span>
          <span className="leading-none tracking-tight">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const handleCopilotClick = () => {
    hapticMedium();
    openAiCopilot();
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 select-none"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 gap-1 px-2 py-1.5 items-stretch rounded-[28px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]">
        <Tab to="/home" label="Home" icon={House} />
        <Tab to="/products" label="Catalog" icon={Package} />

        {/* Center AI orb */}
        <div className="flex flex-col items-center justify-center gap-1 py-1">
          <button
            type="button"
            onClick={handleCopilotClick}
            className="relative w-12 h-12 rounded-full grid place-items-center text-white bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-700 shadow-lg shadow-indigo-600/40 ring-1 ring-white/40 dark:ring-white/20 active:scale-90 transition-all duration-200 overflow-hidden"
            aria-label="Open Stockly AI"
          >
            <span className="absolute inset-x-3 top-1 h-3 rounded-full bg-white/40 blur-[3px] pointer-events-none" />
            <Sparkles size={20} className="relative" />
          </button>
          <span className="text-[10px] font-semibold leading-none tracking-tight text-zinc-500 dark:text-zinc-400">
            AI
          </span>
        </div>

        <Tab to="/stock" label="Ledger" icon={ArrowLeftRight} />
        <Tab to="/settings" label="Settings" icon={Settings} />
      </div>
    </nav>
  );
}
