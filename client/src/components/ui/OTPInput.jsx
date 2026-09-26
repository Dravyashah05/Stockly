import { useRef, useEffect, useCallback } from "react";

export default function OTPInput({
  value = "",
  onChange,
  length = 8,
  separator = "-",
  separatorAt = 4,
  autoFocus = false,
  placeholder = "",
}) {
  const refs = useRef([]);
  const inputRef = useRef(null);

  const handleKeyDown = useCallback(
    (e, index) => {
      const val = e.target.value;
      const isBackspace = e.key === "Backspace";
      const isArrowLeft = e.key === "ArrowLeft";
      const isArrowRight = e.key === "ArrowRight";

      // Only allow alphanumeric keys and control keys
      if (
        !isBackspace &&
        !isArrowLeft &&
        !isArrowRight &&
        !/^[a-zA-Z0-9]$/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        return;
      }

      if (isBackspace) {
        if (!val && index > 0) {
          e.preventDefault();
          const prevIndex = index - 1;
          refs.current[prevIndex]?.focus();
          const chars = value.split("");
          chars[prevIndex] = "";
          onChange?.(chars.join(""));
        }
      } else if (isArrowLeft && index > 0) {
        e.preventDefault();
        refs.current[index - 1]?.focus();
      } else if (isArrowRight && index < length - 1) {
        e.preventDefault();
        refs.current[index + 1]?.focus();
      }
    },
    [length, value, onChange]
  );

  const handleChange = useCallback(
    (e, index) => {
      const inputVal = e.target.value;
      const cleanUpper = inputVal.toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (cleanUpper.length > 1) {
        // Handle multi-character input (e.g. mobile virtual keyboard suggestion / paste)
        const pastedChars = cleanUpper.slice(0, length).split("");
        const currentArr = value.split("").slice(0, length);
        while (currentArr.length < length) currentArr.push("");

        for (let i = 0; i < pastedChars.length && index + i < length; i++) {
          currentArr[index + i] = pastedChars[i];
        }

        const newValue = currentArr.join("");
        onChange?.(newValue);

        const nextFocus = Math.min(index + pastedChars.length, length - 1);
        setTimeout(() => refs.current[nextFocus]?.focus(), 0);
      } else {
        const char = cleanUpper.slice(-1);
        const chars = value.split("").slice(0, length);
        while (chars.length < length) chars.push("");
        chars[index] = char;
        const newValue = chars.join("");
        onChange?.(newValue);

        if (char && index < length - 1) {
          setTimeout(() => refs.current[index + 1]?.focus(), 0);
        }
      }
    },
    [value, onChange, length]
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, length);

      if (!pasted) return;

      onChange?.(pasted);
      const focusIndex = Math.min(pasted.length, length - 1);
      setTimeout(() => refs.current[focusIndex]?.focus(), 0);
    },
    [onChange, length]
  );

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Sync value to inputs
  const chars = value.split("").slice(0, length);
  while (chars.length < length) chars.push("");

  // Helper to render individual box
  const renderBox = (char, i) => (
    <input
      key={i}
      ref={(el) => {
        refs.current[i] = el;
        if (i === 0) inputRef.current = el;
      }}
      type="text"
      value={char}
      onFocus={(e) => e.target.select()}
      onChange={(e) => handleChange(e, i)}
      onKeyDown={(e) => handleKeyDown(e, i)}
      onPaste={handlePaste}
      maxLength={2}
      className="w-7 h-9 sm:w-10 sm:h-11 md:w-11 md:h-12 min-w-[26px] max-w-[40px] flex-1 sm:flex-initial text-center text-sm sm:text-lg font-mono font-bold bg-zinc-50 dark:bg-zinc-800/90 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700/80 rounded-lg sm:rounded-xl focus:border-violet-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all p-0 shadow-sm"
      placeholder={placeholder[i] || ""}
      aria-label={`Character ${i + 1}`}
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="one-time-code"
      autoCorrect="off"
      spellCheck={false}
    />
  );

  const hasSeparator = Boolean(separator && separatorAt && separatorAt < length);

  return (
    <div
      className="flex items-center justify-center gap-1 sm:gap-2 w-full max-w-full px-0.5 select-none"
      role="group"
      aria-label="Code input"
    >
      {hasSeparator ? (
        <>
          {/* Group 1 */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-initial justify-end max-w-[170px]">
            {chars.slice(0, separatorAt).map((char, i) => renderBox(char, i))}
          </div>

          {/* Separator */}
          <span className="text-zinc-400 dark:text-zinc-500 font-mono font-bold text-xs sm:text-base px-0.5 shrink-0 select-none">
            {separator}
          </span>

          {/* Group 2 */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-initial justify-start max-w-[170px]">
            {chars.slice(separatorAt).map((char, i) => renderBox(char, separatorAt + i))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full max-w-sm">
          {chars.map((char, i) => renderBox(char, i))}
        </div>
      )}
    </div>
  );
}
