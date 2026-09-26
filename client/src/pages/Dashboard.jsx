import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Package, Layers, AlertTriangle, FolderKanban, Coins, Calendar, Activity, Flame, BarChart3, PieChart, Lightbulb, ShieldCheck, RefreshCw, Target, Beaker, ArrowRight } from "lucide-react";
import { getProducts } from "../api/products";
import { getCategories, getCategoryStats } from "../api/categories";
import { getStockHistory, getRecentTransactions } from "../api/stock";
import { valuationReport, monthlyReport } from "../api/reports";

function Stat({ label, value, sub, icon: Icon, tone="zinc" }){
  const tones = {
    zinc: "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600",
    emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600",
    amber: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600",
    red: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600",
    violet: "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-600",
  };
  return (
    <div className="card p-4 flex items-center gap-3 hover:shadow-sm transition">
      <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 border ${tones[tone] || tones.zinc}`}><Icon size={16}/></div>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-widest uppercase text-zinc-500">{label}</div>
        <div className="text-xl font-bold leading-none mt-1 text-zinc-900 dark:text-white">{value}</div>
        <div className="text-xs text-zinc-500 truncate">{sub}</div>
      </div>
    </div>
  )
}

export default function Dashboard(){
  const [loading,setLoading]=useState(true);
  const [products,setProducts]=useState([]);
  const [cats,setCats]=useState([]);
  const [catStats,setCatStats]=useState([]);
  const [recent,setRecent]=useState([]);
  const [valuation,setValuation]=useState({ data:[], totals:{} });
  const [monthly,setMonthly]=useState({ months:[], totals:{} });
  const [demanded,setDemanded]=useState([]);

  useEffect(()=>{
    let m=true;
    async function load(){
      setLoading(true);
      try{
        const [pRes,cRes,sRes,rRes,vRes,moRes,hRes]=await Promise.all([
          getProducts({ limit:100 }),
          getCategories().catch(()=>({data:[]})),
          getCategoryStats().catch(()=>({data:[]})),
          getRecentTransactions().catch(()=>({data:[]})),
          valuationReport().catch(()=>({data:[], totals:{}})),
          monthlyReport(String(new Date().getFullYear())).catch(()=>({data:{ months:[] }})),
          getStockHistory({ limit:100 }).catch(()=>({data:[]})),
        ]);
        if(!m) return;
        setProducts(pRes.data||[]);
        setCats(cRes.data||[]);
        setCatStats(sRes.data||sRes||[]);
        setRecent((rRes.data||[]).slice(0,5));
        const v = vRes.data!==undefined ? vRes : { data:[] };
        setValuation({ data: v.data||v||[], totals: v.totals||{} });
        const mo = moRes.data!==undefined ? moRes.data : moRes;
        const moData = mo.data||mo;
        setMonthly({ months: moData.months||[], totals: moData.totals||{}, year: moData.year });
        const hist = hRes.data||[];
        const map=new Map();
        (Array.isArray(hist)?hist:[]).forEach(t=>{
          if(t.type!=="OUT") return;
          const pid=String(t.productId?._id||t.productId||"");
          if(!pid) return;
          const cur=map.get(pid)||{ product:t.productId, total:0, count:0 };
          if(t.productId && typeof t.productId==="object") cur.product=t.productId;
          cur.total+=Number(t.quantity||0); cur.count+=1; map.set(pid,cur);
        });
        const prodMap=new Map((pRes.data||[]).map(p=>[String(p._id),p]));
        const list=Array.from(map.values()).map(v=>{
          if(!v.product||typeof v.product==="string"){ const f=prodMap.get(String(v.product)); if(f) v.product=f; }
          return v;
        }).filter(v=>v.product?.name).sort((a,b)=>b.total-a.total).slice(0,5);
        setDemanded(list);
      }catch{}
      finally{ if(m) setLoading(false); }
    }
    load();
    const id=setInterval(load,60000);
    const onVis=()=>{ if(document.visibilityState==="visible") load(); };
    document.addEventListener("visibilitychange",onVis);
    return()=>{ m=false; clearInterval(id); document.removeEventListener("visibilitychange",onVis); };
  },[]);

  const totalUnits = products.reduce((a,b)=> a+Number(b.quantity||0),0);
  const totalValue = products.reduce((a,b)=> a+Number(b.quantity||0)*Number(b.price||0),0);
  const lowStock = products.filter(p=>{ const min=p.minimumStock??p.minimumQuantity??5; return p.quantity>0 && p.quantity<=min; });
  const outStock = products.filter(p=> p.quantity===0);
  const inStockCount = products.length - lowStock.length - outStock.length;
  const healthPct = products.length ? Math.round((inStockCount / products.length)*100) : 100;
  const turnover = (()=>{ const out30 = demanded.reduce((a,d)=> a+d.total,0) || monthly.months?.slice(-1)[0]?.outQty || 0; return out30 ? (out30 / Math.max(1,totalUnits)).toFixed(2) : "0.00"; })();
  const topCat = valuation.data?.[0];
  const topShare = topCat && totalValue ? Math.round((topCat.value/totalValue)*100) : 0;
  const reorderList = [...lowStock].sort((a,b)=> (a.quantity/(a.minimumStock||5)) - (b.quantity/(b.minimumStock||5))).slice(0,4);

  const maxVal = Math.max(...(valuation.data||[]).map(d=> d.value||0),1);
  const maxMonth = Math.max(...(monthly.months||[]).map(m=> Math.max(m.inQty,m.outQty)),1);

  const insights = [
    topCat ? { icon: Coins, title: `${topCat.category} • ${topShare}% value`, desc: `₹${topCat.value.toLocaleString('en-IN')} of total • ${products.filter(p=> String(p.category?._id||p.category)===String(catStats.find(c=>c.category.name===topCat.category)?._id||"")).length || topCat.products || 0} products`, color:"text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20" } : null,
    { icon: ShieldCheck, title: `Health ${healthPct}% • Turnover ${turnover}x`, desc: `${inStockCount} healthy • ${lowStock.length} low • ${outStock.length} out • ${Number(turnover)>1 ? "Fast moving" : "Slow moving"}`, color: healthPct>80 ? "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" : "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" },
    demanded[0] ? { icon: Flame, title: `Leader: ${demanded[0].product.name}`, desc: `${demanded[0].total} sold • ${demanded[0].count} orders${demanded[1] ? ` • Next ${demanded[1].product.name} (${demanded[1].total})` : ""}` , color:"text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20"} : { icon: Activity, title:"No demand yet", desc:"Stock OUT will rank here", color:"text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700" },
    { icon: Calendar, title: `Net ${monthly.totals.totalIn - monthly.totals.totalOut >=0 ? "+" : ""}${(monthly.totals.totalIn||0)-(monthly.totals.totalOut||0)} units YTD`, desc:`In ${monthly.totals.totalIn||0} • Out ${monthly.totals.totalOut||0} • ${monthly.totals.totalCount||0} tx`, color:"text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" },
  ].filter(Boolean);

  return (
    <div className="space-y-6 pb-6">
      {/* header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white"><BarChart3 size={18}/> Insights</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Research • Valuation • Trends • Health • Auto-synced every 30s • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300">₹{totalValue.toLocaleString('en-IN')} value</span>
            <span className="px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold">{healthPct}% healthy</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i=> <div key={i} className="card p-4 animate-pulse"><div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl"/></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Units" value={totalUnits} sub={`${products.length} products`} icon={Package} tone="zinc" />
          <Stat label="Value" value={`₹${(totalValue/1000).toFixed(0)}k`} sub={`${cats.length} categories`} icon={Coins} tone="emerald" />
          <Stat label="Low" value={lowStock.length} sub={lowStock.length?"reorder soon":"all good"} icon={AlertTriangle} tone={lowStock.length?"amber":"zinc"} />
          <Stat label="Out" value={outStock.length} sub={outStock.length?"action needed":"none"} icon={Layers} tone={outStock.length?"red":"zinc"} />
        </div>
      )}

      {/* Research Insights — 4 cards */}
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Lightbulb size={16} strokeWidth={2} className="text-amber-500"/> Research Insights</h2>
        {loading ? <div className="grid sm:grid-cols-2 gap-3">{[1,2,3,4].map(i=> <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse"/>)}</div> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {insights.map((ins,idx)=>{
              const Icon=ins.icon;
              return (
                <div key={idx} className="card p-4 flex gap-3 hover:shadow-sm transition">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 border ${ins.color}`}><Icon size={16}/></div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight text-zinc-900 dark:text-white">{ins.title}</div>
                    <div className="text-xs text-zinc-500 mt-1 leading-snug">{ins.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2"><PieChart size={16} strokeWidth={2} className="text-violet-500"/> Valuation by Category</h3>
          <p className="text-xs text-zinc-500 mt-1">Share of total stock value</p>
          {loading ? <div className="mt-4 space-y-3">{[1,2,3,4].map(i=> <div key={i} className="h-8 bg-zinc-100 rounded"/> )}</div>
          : !valuation.data.length ? <p className="text-sm text-zinc-500 text-center py-8">No valuation</p>
          : (
            <div className="mt-4 space-y-3">
              {valuation.data.slice(0,5).map(r=>{
                const pct = Math.round((r.value/maxVal)*100);
                return (
                  <div key={r.category} className="group">
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium truncate">{r.category}</span><span className="font-bold">₹{r.value.toLocaleString('en-IN')} • {pct}%</span></div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-zinc-900 dark:bg-white transition-all" style={{ width:`${pct}%` }} /></div>
                  </div>
                )
              })}
              <div className="pt-3 flex justify-between text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800"><span>Grand ₹{(valuation.totals.grandValue||totalValue).toLocaleString('en-IN')}</span><span>{valuation.data.length} categories</span></div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar size={16} strokeWidth={2} className="text-blue-500"/> Monthly Flow {monthly.year||new Date().getFullYear()}</h3>
          <p className="text-xs text-zinc-500 mt-1">In vs Out per month</p>
          {loading ? <div className="mt-4 h-32 bg-zinc-100 rounded-xl animate-pulse"/> : (
            <div className="mt-4">
              <div className="flex items-end gap-1.5 h-32">
                {(monthly.months||[]).map(m=>{
                  const hIn = Math.round((m.inQty / maxMonth)*80);
                  const hOut = Math.round((m.outQty / maxMonth)*80);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex gap-1 items-end h-24">
                        <div className="w-2.5 rounded-full bg-emerald-500" style={{ height:`${hIn}px` }} title={`In ${m.inQty}`} />
                        <div className="w-2.5 rounded-full bg-red-500" style={{ height:`${hOut}px` }} title={`Out ${m.outQty}`} />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500">{m.label.slice(0,3)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-emerald-500"/> In {monthly.totals.totalIn||0}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-red-500"/> Out {monthly.totals.totalOut||0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Health + Reorder + Category */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4"><ShieldCheck size={16} strokeWidth={2} className="text-emerald-500"/> Inventory Health</h3>
          {loading ? <div className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse"/> : (
            <>
              <div className="flex items-center gap-5">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-zinc-100 dark:stroke-zinc-800" />
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-emerald-500" strokeDasharray={`${healthPct * 2.64} 264`} />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="text-xl font-bold leading-none text-zinc-900 dark:text-white">{healthPct}%</div>
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500">Healthy</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <span className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><span className="w-2 h-2 rounded-full bg-emerald-500"/> In Stock</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{inStockCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <span className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300"><span className="w-2 h-2 rounded-full bg-amber-500"/> Low</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{lowStock.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <span className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-300"><span className="w-2 h-2 rounded-full bg-red-500"/> Out</span>
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">{outStock.length}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400"><Target size={12}/> Turnover {turnover}x /30d</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${Number(turnover)>1 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"}`}>{Number(turnover)>1 ? "Fast moving" : "Slow moving"}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2 text-center">{products.length} products • {totalUnits} units • Keep reorder threshold at minimum stock</p>
            </>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><RefreshCw size={16} strokeWidth={2}/> Category Research</h3>
          {loading ? <div className="space-y-2">{[1,2,3].map(i=> <div key={i} className="h-12 bg-zinc-100 rounded"/> )}</div> : (
            <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
              {(catStats.slice(0,6).length?catStats.slice(0,6):[]).map(r=>{
                const turnoverCat = (()=> {
                  const catProdIds = products.filter(p=> String(p.category?._id||p.category)===String(r.category._id)).map(p=> String(p._id));
                  const catOut = demanded.filter(d=> catProdIds.includes(String(d.product._id||d.product?._id))).reduce((a,d)=>a+d.total,0);
                  return catOut ? (catOut / Math.max(1, r.totalStock)).toFixed(2) : "0.00";
                })();
                return (
                  <div key={r.category._id} className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-bold">{r.category.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.category.name}</div>
                      <div className="text-xs text-zinc-500">{r.productCount} prod • {r.totalStock} units • ₹{Number(r.totalValue).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold">{turnoverCat}x</div>
                      <div className="text-[11px] text-zinc-500">Turnover</div>
                    </div>
                  </div>
                )
              })}
              {!catStats.length && <p className="text-sm text-zinc-500 text-center py-4">No categories</p>}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Target size={16} strokeWidth={2} className="text-red-500"/> Reorder Radar</h3>
          {loading ? <div className="space-y-2">{[1,2,3].map(i=> <div key={i} className="h-10 bg-zinc-100 rounded"/> )}</div>
          : reorderList.length===0 ? <p className="text-sm text-zinc-500 text-center py-6">No reorder needed</p>
          : (
            <div className="space-y-2">
              {reorderList.map(p=>{
                const demand = demanded.find(d=> String(d.product._id||d.product?._id)===String(p._id))?.total || 0;
                const daysLeft = demand ? Math.max(1, Math.ceil(Number(p.quantity)/ (demand/30))) : "∞";
                return (
                  <div key={p._id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10">
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border overflow-hidden grid place-items-center shrink-0">{p.image?<img src={p.image} alt="" className="w-full h-full object-cover"/>:"📦"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-zinc-600">Stock {p.quantity}/{p.minimumStock??5} • {demand}/30d • ~{daysLeft}d left</div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500 text-white">Reorder</span>
                  </div>
                )
              })}
              <Link to="/products" className="block text-center text-xs text-violet-600 hover:underline mt-1">View low stock →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Highly demanded + Recent */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Flame size={16} strokeWidth={2} className="text-orange-500"/> Highly Demanded</h3>
            <Link to="/reports" className="text-xs text-zinc-500 hover:text-zinc-900">Top 5</Link>
          </div>
          {loading ? <div className="p-4 space-y-3 animate-pulse">{[1,2,3].map(i=> <div key={i} className="h-12 bg-zinc-100 rounded-xl"/> )}</div>
          : demanded.length===0 ? <div className="p-8 text-center text-sm text-zinc-500">No OUT transactions yet</div>
          : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {demanded.map((d,i)=>{
                const p=d.product; const max=Math.max(...demanded.map(x=>x.total),1); const pct=Math.round((d.total/max)*100);
                return (
                  <div key={String(p._id||i)} className="p-3 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-bold">#{i+1}</div>
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 border overflow-hidden grid place-items-center shrink-0">{p.image?<img src={p.image} alt="" className="w-full h-full object-cover"/>:"📦"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1"><div className="h-full bg-zinc-900 dark:bg-white rounded-full" style={{ width:`${pct}%` }}/></div>
                    </div>
                    <div className="text-right shrink-0"><div className="text-sm font-bold">{d.total}</div><div className="text-xs text-zinc-500">{d.count} orders</div></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Activity size={16} strokeWidth={2} className="text-blue-500"/> Recent Activity</h3>
            <Link to="/stock" className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">View all <ArrowRight size={12}/></Link>
          </div>
          {loading ? <div className="space-y-3">{[1,2,3].map(i=> <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse"/> )}</div>
          : recent.length===0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 grid place-items-center mx-auto text-zinc-400"><Activity size={16}/></div>
              <p className="text-sm font-medium mt-3">No activity yet</p>
              <p className="text-xs text-zinc-500 mt-1">Stock IN/OUT will appear as timeline</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 space-y-0">
              {recent.map((t,idx)=>{
                const isLast = idx===recent.length-1;
                return (
                  <div key={t._id} className={`relative pb-5 ${isLast ? "pb-0" : ""}`}>
                    <div className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 bg-white dark:bg-zinc-900 ${t.type==="IN" ? "border-emerald-500" : "border-red-500"} ${idx===0 ? "ring-4 ring-emerald-500/10 dark:ring-red-500/10" : ""}`} />
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                        {t.productId?.image ? <img src={t.productId.image} alt="" className="w-full h-full object-cover"/> : <span className="text-sm">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium truncate text-zinc-900 dark:text-white">{t.productId?.name||"Product"}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${t.type==="IN" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20"}`}>
                            {t.type==="IN" ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {t.type} • {t.quantity}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{t.reason||"—"}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0"/>
                          <span>{new Date(t.createdAt).toLocaleDateString()} • {new Date(t.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
