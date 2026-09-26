import { NavLink } from "react-router-dom";
import {
  House,
  Package,
  ArrowLeftRight,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/home", label: "Home", icon: House },
  { to: "/products", label: "Catalog", icon: Package },
  { to: "/stock", label: "Ledger", icon: ArrowLeftRight },
  { to: "/dashboard", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl border-t border-zinc-200/80 dark:border-zinc-800/80 select-none shadow-lg transition-all"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      <div className="grid grid-cols-5 px-1.5 pt-1.5 pb-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl text-[10.5px] font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
                isActive
                  ? "text-zinc-950 dark:text-white"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-11 h-7 grid place-items-center rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-105"
                      : "bg-transparent"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="transition-transform duration-150"
                  />
                </div>
                <span className="leading-tight tracking-tight mt-0.5 font-semibold">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
