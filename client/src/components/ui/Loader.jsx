export default function Loader({ size = 20 }) {
  return <div className="loader" style={{ width: size, height: size }} aria-label="Loading" role="status" />;
}

export function FullPageLoader({ label = "Loading…" }) {
  return (
    <div className="min-h-[40vh] grid place-items-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader size={28} />
        <p className="text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">{label}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton h-4 ${className}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3" aria-hidden="true">
      <div className="flex gap-3">
        <div className="skeleton w-11 h-11 !rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/5" />
          <div className="skeleton h-3 w-2/5" />
        </div>
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-4" aria-hidden="true">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 !rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-5 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="card overflow-hidden !p-0" aria-hidden="true">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3.5 flex items-center gap-3">
            <div className="skeleton w-10 h-10 !rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-2/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
            <div className="skeleton w-16 h-6 !rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="card py-14 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 grid place-items-center mx-auto text-zinc-400">
          <Icon size={24} />
        </div>
      )}
      <p className="mt-4 font-bold text-zinc-900 dark:text-white">{title}</p>
      {hint && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
