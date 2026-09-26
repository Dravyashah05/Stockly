import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function TopProgress(){
  const loc = useLocation();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(()=>{
    setLoading(true);
    setProgress(30);
    const t1 = setTimeout(()=> setProgress(70), 150);
    const t2 = setTimeout(()=> { setProgress(100); setTimeout(()=> setLoading(false), 200); }, 350);
    return ()=> { clearTimeout(t1); clearTimeout(t2); };
  }, [loc.pathname]);

  if(!loading) return null;
  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[80] pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div
        className="h-full bg-zinc-900 dark:bg-white transition-all duration-300 ease-out"
        style={{ width: `${progress}%`, transform: "translateZ(0)" }}
      />
    </div>
  )
}
