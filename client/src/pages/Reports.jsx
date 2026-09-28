import { useEffect, useState } from "react";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Layers,
  FolderKanban,
  Package,
  User,
  Coins,
  Calendar,
  FileSpreadsheet,
  FileText,
  Download,
  Filter,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Button from "../components/ui/Button";
import { getCategories } from "../api/categories";
import { getProducts } from "../api/products";
import { getSuppliers } from "../api/suppliers";
import {
  dailyReport,
  stockInReport,
  stockOutReport,
  lowStockReport,
  categoryWiseReport,
  supplierWiseReport,
  productMovementReport,
  valuationReport,
  monthlyReport,
} from "../api/reports";
import { useToast } from "../context/ToastContext";
import { Link } from "react-router-dom";

const tabs = [
  { id: "daily", label: "Daily", icon: Clock },
  { id: "in", label: "Stock In", icon: TrendingUp },
  { id: "out", label: "Stock Out", icon: TrendingDown },
  { id: "low", label: "Low Stock", icon: AlertTriangle },
  { id: "category", label: "Categories", icon: FolderKanban },
  { id: "supplier", label: "Suppliers", icon: User },
  { id: "movement", label: "Movement", icon: Package },
  { id: "valuation", label: "Valuation", icon: Coins },
  { id: "monthly", label: "Monthly", icon: Calendar },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toCSV(rows, headers) {
  const head = headers.join(",");
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return head + "\n" + body;
}

function download(content, name, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportExcel(rows, headers, sheetName, filename) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    rows.map((r) => {
      const o = {};
      headers.forEach((h) => (o[h] = r[h]));
      return o;
    })
  );
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

async function exportPDF(title, headers, rows, filename) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 20);
  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 39, 42] },
  });
  doc.save(filename);
}

export default function Reports() {
  const { push } = useToast();
  const [active, setActive] = useState("daily");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({
    date: todayISO(),
    startDate: "",
    endDate: "",
    category: "",
    supplier: "",
    productId: "",
    year: String(new Date().getFullYear()),
  });

  useEffect(() => {
    getCategories()
      .then((r) => setCats(r.data || []))
      .catch(() => {});
    getSuppliers()
      .then((r) => setSuppliers(r.data || []))
      .catch(() => {});
    getProducts({ limit: 100 })
      .then((r) => setProducts(r.data || []))
      .catch(() => {});
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let res;
      if (active === "daily") res = await dailyReport(filters.date);
      else if (active === "in")
        res = await stockInReport({
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          category: filters.category || undefined,
          supplier: filters.supplier || undefined,
        });
      else if (active === "out")
        res = await stockOutReport({
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          category: filters.category || undefined,
        });
      else if (active === "low") res = await lowStockReport();
      else if (active === "category") res = await categoryWiseReport();
      else if (active === "supplier")
        res = await supplierWiseReport({
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        });
      else if (active === "movement") {
        if (!filters.productId) {
          push("Select a product for movement report", "error");
          setLoading(false);
          return;
        }
        res = await productMovementReport({
          productId: filters.productId,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        });
      } else if (active === "valuation") res = await valuationReport();
      else if (active === "monthly") res = await monthlyReport(filters.year);
      setData(res.data !== undefined ? res : { data: res });
    } catch (e) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [active]);

  const handleExport = async (type) => {
    try {
      let headers = [],
        rows = [],
        title = "Report";
      if (active === "daily") {
        const tx = data?.data?.transactions || data?.transactions || [];
        headers = ["Product", "Type", "Quantity", "Reason", "Time"];
        rows = tx.map((t) => ({
          Product: t.productId?.name || "",
          Type: t.type,
          Quantity: t.quantity,
          Reason: t.reason,
          Time: new Date(t.createdAt).toLocaleString(),
        }));
        title = `Daily Stock ${data?.data?.date || filters.date}`;
      } else if (active === "in") {
        const tx = data?.data || data || [];
        const list = Array.isArray(tx) ? tx : tx.data || [];
        headers = ["Product", "SKU", "Quantity", "Reason", "Supplier", "Date"];
        rows = list.map((t) => ({
          Product: t.productId?.name || "",
          SKU: t.productId?.sku || "",
          Quantity: t.quantity,
          Reason: t.reason,
          Supplier: t.supplier?.name || t.productId?.supplier?.name || "",
          Date: new Date(t.createdAt).toLocaleString(),
        }));
        title = "Stock In Report";
      } else if (active === "out") {
        const tx = data?.data || data || [];
        const list = Array.isArray(tx) ? tx : tx.data || [];
        headers = ["Product", "Quantity", "Reason", "Date"];
        rows = list.map((t) => ({
          Product: t.productId?.name || "",
          Quantity: t.quantity,
          Reason: t.reason,
          Date: new Date(t.createdAt).toLocaleString(),
        }));
        title = "Stock Out Report";
      } else if (active === "low") {
        const low = data?.data?.low || data?.low || [];
        const out = data?.data?.out || data?.out || [];
        const all = [...low, ...out];
        headers = ["Product", "Category", "Quantity", "Unit", "Status"];
        rows = all.map((p) => ({
          Product: p.name,
          Category: p.category?.name || "",
          Quantity: p.quantity,
          Unit: p.unit,
          Status: p.quantity === 0 ? "Out" : "Low",
        }));
        title = "Low Stock Report";
      } else if (active === "category") {
        const list = data?.data || data || [];
        const arr = Array.isArray(list) ? list : [];
        headers = ["Category", "Products", "Stock Units", "Value"];
        rows = arr.map((r) => ({
          Category: r.category?.name || r.category,
          Products: r.productCount,
          "Stock Units": r.totalStock,
          Value: r.totalValue,
        }));
        title = "Category-wise Inventory";
      } else if (active === "supplier") {
        const list = data?.data || data || [];
        headers = ["Supplier", "Purchases", "Total Qty", "Total Value"];
        rows = list.map((s) => ({
          Supplier: s.supplier?.name || s.supplier,
          Purchases: s.count,
          "Total Qty": s.totalQty,
          "Total Value": s.totalValue,
        }));
        title = "Supplier-wise Purchases";
      } else if (active === "movement") {
        const tx = data?.data || data || [];
        const list = Array.isArray(tx) ? tx : tx.data || [];
        headers = ["Date", "Type", "Quantity", "Reason", "Notes"];
        rows = list.map((t) => ({
          Date: new Date(t.createdAt).toLocaleString(),
          Type: t.type,
          Quantity: t.quantity,
          Reason: t.reason,
          Notes: t.notes || "",
        }));
        title = "Product Movement";
      } else if (active === "valuation") {
        const list = data?.data || data || [];
        headers = ["Category", "Products", "Units", "Value"];
        rows = list.map((r) => ({
          Category: r.category,
          Products: r.products,
          Units: r.units,
          Value: r.value,
        }));
        title = "Stock Valuation";
      } else if (active === "monthly") {
        const months = data?.data?.months || data?.months || [];
        headers = ["Month", "In Qty", "Out Qty", "Transactions"];
        rows = months.map((m) => ({
          Month: m.label,
          "In Qty": m.inQty,
          "Out Qty": m.outQty,
          Transactions: m.count,
        }));
        title = `Monthly Summary ${data?.data?.year || filters.year}`;
      }

      if (type === "csv")
        download(toCSV(rows, headers), `${title.replace(/\s+/g, "_")}.csv`, "text/csv");
      else if (type === "excel")
        await exportExcel(rows, headers, active, `${title.replace(/\s+/g, "_")}.xlsx`);
      else if (type === "pdf")
        await exportPDF(title, headers, rows, `${title.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      push(e.message, "error");
    }
  };

  const renderContent = () => {
    if (loading)
      return (
        <div className="py-12 flex justify-center">
          <div className="loader w-6 h-6" />
        </div>
      );
    if (!data) return <div className="py-10 text-center text-sm text-zinc-500">No data found</div>;

    if (active === "daily") {
      const d = data.data || data;
      const tx = d.transactions || [];
      const s = d.summary || {};
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Total Events", v: s.total ?? 0, color: "text-zinc-900 dark:text-white" },
              { label: "Total In", v: `+${s.inQty ?? 0}`, color: "text-emerald-600" },
              { label: "Total Out", v: `-${s.outQty ?? 0}`, color: "text-red-600" },
              {
                label: "Net Balance",
                v: `${s.net >= 0 ? "+" : ""}${s.net ?? 0}`,
                color: "text-zinc-900 dark:text-white",
              },
            ].map((x) => (
              <div
                key={x.label}
                className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl p-3 text-center"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {x.label}
                </div>
                <div className={`text-lg font-black mt-0.5 ${x.color}`}>{x.v}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {tx.map((t) => (
              <div
                key={t._id}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {t.productId?.name || "Inventory item"}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {t.reason} • {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                    t.type === "IN"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {t.type === "IN" ? "+" : "-"}{t.quantity}
                </span>
              </div>
            ))}
            {!tx.length && (
              <div className="p-8 text-center text-xs text-zinc-500">
                No movements recorded on this day.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (active === "in" || active === "out") {
      const list = Array.isArray(data.data)
        ? data.data
        : data.data?.data || data.data || data || [];
      const arr = Array.isArray(list) ? list : [];
      return (
        <div className="space-y-3">
          <div className="text-xs font-bold text-zinc-500">
            {arr.length} movements found
          </div>
          <div className="space-y-2">
            {arr.map((t) => (
              <div
                key={t._id}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {t.productId?.name || "Product"}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                    {t.reason} {t.supplier?.name && `• ${t.supplier.name}`} • {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-zinc-900 dark:text-white">
                    {active === "in" ? "+" : "-"}{t.quantity} units
                  </div>
                </div>
              </div>
            ))}
            {!arr.length && (
              <div className="p-8 text-center text-xs text-zinc-500">No records found.</div>
            )}
          </div>
        </div>
      );
    }

    if (active === "low") {
      const d = data.data || data;
      const low = d.low || [];
      const out = d.out || [];
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-center">
              <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                Low Stock
              </div>
              <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5">
                {d.totalLow ?? low.length}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-center">
              <div className="text-[10px] font-bold uppercase text-red-700 dark:text-red-400">
                Out of Stock
              </div>
              <div className="text-xl font-black text-red-700 dark:text-red-400 mt-0.5">
                {d.totalOut ?? out.length}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[...low, ...out].map((p) => (
              <div
                key={p._id}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden grid place-items-center shrink-0">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {p.category?.name || "General"} • {p.quantity} {p.unit} (Min: {p.minimumStock ?? 5})
                    </div>
                  </div>
                </div>

                <Link
                  to={`/stock?product=${p._id}&type=IN`}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold active:scale-95 transition shrink-0"
                >
                  Restock
                </Link>
              </div>
            ))}
            {!low.length && !out.length && (
              <div className="p-8 text-center text-xs text-zinc-500">
                All catalog inventory is at healthy stock levels!
              </div>
            )}
          </div>
        </div>
      );
    }

    if (active === "valuation") {
      const list = data.data || data || [];
      const totals = data.totals || {};
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <div className="text-[10px] font-bold uppercase opacity-70">Catalog</div>
              <div className="text-base font-black mt-0.5">{totals.productCount || 0}</div>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <div className="text-[10px] font-bold uppercase text-zinc-500">Units</div>
              <div className="text-base font-black mt-0.5">{totals.grandUnits || 0}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <div className="text-[10px] font-bold uppercase">Value</div>
              <div className="text-base font-black mt-0.5">
                ₹{Number(totals.grandValue || 0).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.category}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">
                    {r.category}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {r.products} items • {r.units} units
                  </div>
                </div>
                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ₹{Number(r.value).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (active === "monthly") {
      const months = data.data?.months || data.months || [];
      const totals = data.data?.totals || data.totals || {};
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <div className="text-[10px] font-bold uppercase">Total In</div>
              <div className="text-base font-black mt-0.5">{totals.totalIn || 0}</div>
            </div>
            <div className="p-3 rounded-2xl bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
              <div className="text-[10px] font-bold uppercase">Total Out</div>
              <div className="text-base font-black mt-0.5">{totals.totalOut || 0}</div>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <div className="text-[10px] font-bold uppercase text-zinc-500">Activity</div>
              <div className="text-base font-black mt-0.5">{totals.totalCount || 0}</div>
            </div>
          </div>

          <div className="space-y-2">
            {months.map((m) => (
              <div
                key={m.month}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-xs"
              >
                <div className="text-xs font-bold text-zinc-900 dark:text-white">
                  {m.label}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-emerald-600">+{m.inQty}</span>
                  <span className="text-zinc-400">•</span>
                  <span className="text-red-600">-{m.outQty}</span>
                  <span className="text-zinc-400">•</span>
                  <span className="text-zinc-500">{m.count} tx</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="p-8 text-center text-xs text-zinc-500">
        Report generated successfully. Use the export buttons above for spreadsheets and PDFs.
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-violet-600 dark:text-violet-400" />
            Reports & Exports
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Audit sheets & compliance exports
          </p>
        </div>
      </div>

      {/* 2. REPORT TABS SCROLLER */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                isActive
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 3. FILTER & EXPORT BAR */}
      <div className="card p-3.5 space-y-3 border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2 items-end">
          {active === "daily" && (
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                Select Date
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="input-field h-10 text-xs"
              />
            </div>
          )}

          {(active === "in" ||
            active === "out" ||
            active === "supplier" ||
            active === "movement") && (
            <>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="input-field h-10 text-xs"
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="input-field h-10 text-xs"
                />
              </div>
            </>
          )}

          {active === "movement" && (
            <div className="w-full">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                Select SKU Product *
              </label>
              <select
                value={filters.productId}
                onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
                className="input-field h-10 text-xs"
              >
                <option value="">Choose product...</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button size="sm" onClick={fetchReport} className="h-10 min-w-[90px] font-bold text-xs">
            <Filter size={13} /> Run
          </Button>
        </div>

        {/* 1-Tap Export Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold shadow-xs active:scale-95 transition"
          >
            <FileText size={13} /> PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs active:scale-95 transition"
          >
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold active:scale-95 transition"
          >
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* 4. REPORT CONTENT */}
      <div className="card p-3.5 sm:p-5 border border-zinc-200/80 dark:border-zinc-800">
        {renderContent()}
      </div>
    </div>
  );
}
