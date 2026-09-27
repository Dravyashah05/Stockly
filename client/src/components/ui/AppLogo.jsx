import React from "react";

export default function AppLogo({
  size = "md",
  className = "",
  showText = false,
  showBadge = false,
  badgeText = "OS",
  textClassName = "",
  subtext = "",
  alt = "Stockly Logo",
  ...props
}) {
  const sizeMap = {
    xs: "w-6 h-6 rounded-lg",
    sm: "w-8 h-8 rounded-xl",
    md: "w-9 h-9 rounded-xl sm:w-10 sm:h-10 sm:rounded-2xl",
    lg: "w-12 h-12 rounded-2xl",
    xl: "w-16 h-16 rounded-3xl",
  };

  const dimClass = sizeMap[size] || size;

  const logoImg = (
    <img
      src="/favicon.svg"
      alt={alt}
      className={`shrink-0 object-contain shadow-xs select-none ${dimClass} ${className}`}
      loading="eager"
      {...props}
    />
  );

  if (!showText) return logoImg;

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {logoImg}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold tracking-tight text-zinc-900 dark:text-white ${textClassName || "text-base sm:text-lg"}`}>
            Stockly
          </span>
          {showBadge && (
            <span className="px-1.5 py-0.5 rounded-full bg-violet-600/10 dark:bg-violet-400/20 text-violet-700 dark:text-violet-300 text-[10px] font-extrabold uppercase tracking-wider">
              {badgeText}
            </span>
          )}
        </div>
        {subtext && (
          <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}
