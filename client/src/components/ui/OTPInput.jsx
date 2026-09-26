import { useRef, useEffect, useCallback } from "react";

export default function OTPInput({ value, onChange, length = 8, separator = "-", separatorAt = 4, autoFocus = false, placeholder = "" }) {
  const refs = useRef([]);
  const inputRef = useRef(null);

  const handleKeyDown = useCallback((e, index) => {
    const val = e.target.value;
    const isBackspace = e.key === "Backspace";
    const isArrowLeft = e.key === "ArrowLeft";
    const isArrowRight = e.key === "ArrowRight";

    // Only allow alphanumeric
    if(!isBackspace && !isArrowLeft && !isArrowRight && !/^[a-zA-Z0-9]$/.test(e.key)){
      e.preventDefault();
      return;
    }

    if(isBackspace && !val && index > 0){
      // Move to previous input
      const prevIndex = index - 1 === separatorAt ? index - 2 : index - 1;
      refs.current[prevIndex]?.focus();
    }else if(!isBackspace && val.length === 1 && index < length - 1){
      // Move to next input
      const nextIndex = index + 1 === separatorAt ? index + 2 : index + 1;
      refs.current[nextIndex]?.focus();
    }else if(isArrowLeft && index > 0){
      const prevIndex = index - 1 === separatorAt ? index - 2 : index - 1;
      refs.current[prevIndex]?.focus();
    }else if(isArrowRight && index < length - 1){
      const nextIndex = index + 1 === separatorAt ? index + 2 : index + 1;
      refs.current[nextIndex]?.focus();
    }
  }, [length, separatorAt]);

  const handleChange = useCallback((e, index) => {
    const val = e.target.value.toUpperCase();
    if(val.length > 1){
      // Handle paste - distribute characters
      const chars = val.split("").filter(c => /^[A-Z0-9]$/.test(c)).slice(0, length);
      const newValue = chars.join("");
      onChange(newValue);
      // Focus next empty input
      const nextEmpty = chars.findIndex((_, i) => i >= chars.length);
      if(nextEmpty >= 0){
        const focusIndex = nextEmpty >= separatorAt ? nextEmpty + 1 : nextEmpty;
        setTimeout(() => refs.current[focusIndex]?.focus(), 0);
      }
    }else{
      const chars = value.split("");
      chars[index] = val;
      onChange(chars.join(""));
    }
  }, [value, onChange, length, separatorAt]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, length);
    onChange(pasted);
    const focusIndex = pasted.length >= separatorAt ? pasted.length + 1 : pasted.length;
    if(focusIndex < length){
      setTimeout(() => refs.current[focusIndex]?.focus(), 0);
    }
  }, [onChange, length, separatorAt]);

  useEffect(() => {
    if(autoFocus){
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Sync value to inputs
  const chars = value.split("").slice(0, length);
  while(chars.length < length) chars.push("");

  return (
    <div className="flex items-center justify-center gap-0" role="group" aria-label="Invite code">
      {chars.map((char, i) => (
        <div key={i} className="flex items-center">
          {i === separatorAt && <span className="text-2xl font-mono text-zinc-400 dark:text-zinc-500 px-1 select-none">{separator}</span>}
          <input
            ref={(el) => { refs.current[i] = el; if(i === 0) inputRef.current = el; }}
            type="text"
            value={char}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            maxLength={1}
            className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-mono font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
            placeholder={placeholder[i] || ""}
            aria-label={`Character ${i + 1}`}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ))}
    </div>
  );
}