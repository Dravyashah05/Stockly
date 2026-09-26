import { useEffect, useState } from "react";
import { getAuditLogs } from "../api/audit";
import {
  Clock,
  User,
  Package,
  FolderKanban,
  ArrowLeftRight,
  FileText,
  Shield,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Button from "../components/ui/Button";

function timeAgo(s) {
  if (!s) return "—";
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ entity: "", action: "" });
  const [expandedLogId, setExpandedLogId] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        page: p,
        limit: 20,
        entity: filter.entity || undefined,
        action: filter.action || undefined,
      });
      setLogs(res.data || []);
      setPagination(res.pagination);
      setPage(res.pagination?.page || p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [filter.entity, filter.action]);

  const iconFor = (entity) => {
    if (entity === "product") return Package;
    if (entity === "category") return FolderKanban;
    if (entity === "stock") return ArrowLeftRight;
    if (entity === "supplier") return User;
    return FileText;
  };

  const actionTone = (action = "") => {
    if (action === "create")
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    if (action === "delete")
      return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    if (action.includes("stock_in"))
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    if (action.includes("stock_out"))
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
            Security & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Immutable log of all user actions, product mutations, and stock entries
          </p>
        </div>

        <button
          onClick={() => load(1)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold shadow-xs hover:bg-zinc-50 active:scale-95 transition min-h-[40px]"
        >
          <RefreshCw size={13} /> Refresh Trail
        </button>
      </div>

      {/* 2. FILTER PILLS */}
      <div className="card p-3 space-y-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Filter Activities
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filter.entity}
            onChange={(e) => setFilter({ ...filter, entity: e.target.value })}
            className="input-field h-10 text-xs"
          >
            <option value="">All Entities</option>
            <option value="product">Products</option>
            <option value="category">Categories</option>
            <option value="stock">Stock Movements</option>
            <option value="supplier">Suppliers</option>
          </select>

          <select
            value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}
            className="input-field h-10 text-xs"
          >
            <option value="">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
            <option value="stock_in">Stock IN</option>
            <option value="stock_out">Stock OUT</option>
          </select>
        </div>
      </div>

      {/* 3. AUDIT LOG FEED */}
      {loading ? (
        <div className="card p-12 flex justify-center">
          <div className="loader w-6 h-6" />
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((l) => {
            const Icon = iconFor(l.entity);
            const isExpanded = expandedLogId === l._id;
            const hasDiff = l.before || l.after;

            return (
              <div
                key={l._id}
                className="card p-3.5 sm:p-4 border border-zinc-200/80 dark:border-zinc-800 hover:shadow-xs transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center shrink-0 shadow-xs">
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {l.userName || l.user?.name || "System"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${actionTone(
                          l.action
                        )}`}
                      >
                        {l.action?.replace("_", " ")}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold uppercase">
                        {l.entity}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{timeAgo(l.createdAt)}</span>
                      <span>•</span>
                      <span>{new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {l.ip && (
                        <>
                          <span>•</span>
                          <span>IP {l.ip}</span>
                        </>
                      )}
                    </div>

                    {/* Expandable change diff */}
                    {hasDiff && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : l._id)}
                          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
                        >
                          <span>{isExpanded ? "Hide change snapshot" : "View change snapshot"}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-slide-up">
                            {l.before && (
                              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs">
                                <div className="font-bold text-red-700 dark:text-red-400 mb-1">
                                  Previous State
                                </div>
                                <pre className="whitespace-pre-wrap break-all text-[11px] font-mono text-zinc-700 dark:text-zinc-300 max-h-36 overflow-auto">
                                  {JSON.stringify(l.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {l.after && (
                              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs">
                                <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                                  New State
                                </div>
                                <pre className="whitespace-pre-wrap break-all text-[11px] font-mono text-zinc-700 dark:text-zinc-300 max-h-36 overflow-auto">
                                  {JSON.stringify(l.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!logs.length && (
            <div className="card py-16 text-center">
              <Shield size={24} className="mx-auto text-zinc-400" />
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mt-2">
                No activity records
              </h3>
              <p className="text-xs text-zinc-500 mt-1">Audit trail entries will appear here.</p>
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="card p-3 flex items-center justify-between text-sm">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Prev
              </Button>
              <span className="text-xs font-medium text-zinc-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => load(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
