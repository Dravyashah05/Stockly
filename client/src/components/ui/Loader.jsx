export default function Loader({ size=20 }){
  return <div className="loader" style={{ width: size, height: size }} aria-label="Loading" role="status" />
}
export function FullPageLoader(){
  return (
    <div className="min-h-[50vh] grid place-items-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader size={28} />
        <p className="text-sm text-zinc-500 animate-pulse">Loading…</p>
      </div>
    </div>
  )
}
export function Skeleton({ className="" }){
  return <div className={`animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl ${className}`} />
}
export function CardSkeleton(){
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/5 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-2/5 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    </div>
  )
}
export function StatsSkeleton(){
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
      {[1,2,3,4].map(i=>(
        <div key={i} className="card p-3 sm:p-4 animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-5 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
export function TableSkeleton({ rows=3 }){
  return (
    <div className="card overflow-hidden p-0">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({length: rows}).map((_,i)=>(
          <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/5 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-3 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
            <div className="w-16 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
