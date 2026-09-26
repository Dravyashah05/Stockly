import React, { createContext, useContext, useEffect, useState } from "react";
const ThemeContext = createContext(null);
export function useTheme(){ return useContext(ThemeContext); }
export function ThemeProvider({ children }){
  const [theme, setTheme] = useState(()=> {
    try{ const s=localStorage.getItem("theme"); return s==="dark"||s==="light"?s:"light"; }catch{ return "light"; }
  });
  useEffect(()=>{
    const root=document.documentElement;
    if(theme==="dark") root.classList.add("dark"); else root.classList.remove("dark");
    root.style.colorScheme=theme;
    try{ localStorage.setItem("theme",theme);}catch{}
  },[theme]);
  const toggle=()=> setTheme(t=> t==="dark"?"light":"dark");
  return <ThemeContext.Provider value={{ theme, isDark: theme==="dark", toggle, setTheme }}>{children}</ThemeContext.Provider>
}
