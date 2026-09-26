import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

const ToastContext = createContext(null);
export function useToast(){ return useContext(ToastContext); }

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type="info")=>{
    const id = Date.now()+Math.random();
    setToasts(t=>[...t,{id,message,type}]);
    setTimeout(()=> setToasts(t=>t.filter(x=>x.id!==id)), 3200);
  },[]);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] lg:bottom-4 right-4 z-[100] flex flex-col gap-2 w-[92%] max-w-sm pointer-events-none">
        {toasts.map(t=>{
          const Icon = t.type==="error" ? AlertCircle : t.type==="success" ? CheckCircle2 : Info;
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-lg border backdrop-blur-xl animate-slide-in ${t.type==="error"?"bg-red-50/90 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-200 dark:border-red-900": t.type==="success"?"bg-emerald-50/90 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-900":"bg-white/90 text-zinc-800 border-zinc-200 dark:bg-zinc-900/90 dark:text-zinc-100 dark:border-zinc-800"}`}>
              <span className={`mt-0.5 w-7 h-7 grid place-items-center rounded-full shrink-0 ${t.type==="error"?"bg-red-500 text-white": t.type==="success"?"bg-emerald-500 text-white":"bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"}`}>
                <Icon size={14} />
              </span>
              <span className="flex-1 leading-snug pt-1">{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
