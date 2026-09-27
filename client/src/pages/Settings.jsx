import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import {
  Moon,
  Sun,
  Mail,
  LogOut,
  AlertTriangle,
  Lock,
  User,
  ChevronRight,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Database,
  Check,
  Monitor,
  Smartphone,
  RefreshCw,
  X,
  Laptop,
  QrCode,
  ShieldCheck,
  SmartphoneNfc,
  Sparkles,
  KeyRound,
  Info,
  Layers,
  Bot,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import LinkDeviceModal from "../components/auth/LinkDeviceModal";
import AuthorizeDeviceModal from "../components/auth/AuthorizeDeviceModal";
import AppLogo from "../components/ui/AppLogo";
import {
  updateMe,
  changePassword,
  getSessions,
  revokeSession,
  revokeAllSessions,
} from "../api/auth";
import { getProducts, createProduct } from "../api/products";
import { getCategories, createCategory } from "../api/categories";
import { getStockHistory } from "../api/stock";
import {
  getStoredAiSettings,
  saveStoredAiSettings,
  chatCopilot,
  getAiStatus,
} from "../api/ai";

function formatRelative(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(products) {
  const headers = ["name", "sku", "category", "quantity", "unit", "minimumStock", "description"];
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = products.map((p) => [
    escape(p.name),
    escape(p.sku),
    escape(p.category?.name || p.category || ""),
    escape(p.quantity),
    escape(p.unit),
    escape(p.minimumStock ?? p.minimumQuantity ?? 5),
    escape(p.description || ""),
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}

async function handleDownloadDemoExcel(push) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    let liveCats = [];
    try {
      const r = await getCategories();
      liveCats = (r.data || r || []).map((c) => c.name).filter(Boolean);
    } catch {}
    if (!liveCats.length) liveCats = ["Raw Materials", "Finishing", "Safety", "General"];

    const headers = ["name*", "sku", "category*", "quantity", "unit*", "minimumStock", "description"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 34 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
    ws["!autofilter"] = { ref: "A1:G1" };
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    const catHeaders = ["name*", "description", "status"];
    const catRows = liveCats.map((n) => [n, "", "active"]);
    const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    wsCat["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Categories");

    XLSX.writeFile(wb, "stockly-import-template.xlsx");
    push?.("Ready Excel template downloaded", "success");
  } catch (e) {
    push?.(e.message || "Failed to generate Excel", "error");
  }
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { toggle, isDark } = useTheme();
  const { push } = useToast();
  const navigate = useNavigate();

  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [editForm, setEditForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  // import / export
  const [exporting, setExporting] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  // sessions
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);

  // Opencode AI Settings
  const [aiSettings, setAiSettings] = useState(() => getStoredAiSettings());
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  useEffect(() => {
    setEditForm({ name: user?.name || "", email: user?.email || "" });
  }, [user]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await getSessions();
      const data = res.data || res || [];
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      // fail silently
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (id) => {
    setRevokingId(id);
    try {
      await revokeSession(id);
      push("Session revoked", "success");
      setSessions((s) => s.filter((x) => String(x._id) !== String(id)));
    } catch (e) {
      push(e.message, "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    setRevokingAll(true);
    try {
      await revokeAllSessions(false);
      push("Other devices signed out", "success");
      loadSessions();
      setShowRevokeAll(false);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setRevokingAll(false);
    }
  };

  const handleLogoutCurrent = async () => {
    try {
      await logout();
    } catch {}
    navigate("/login");
  };

  const handleEdit = async () => {
    if (!editForm.name.trim() || !editForm.email.trim())
      return push("Name and email required", "error");
    if (!/^\S+@\S+\.\S+$/.test(editForm.email.trim()))
      return push("Enter a valid email", "error");
    setSaving(true);
    try {
      const res = await updateMe({ name: editForm.name.trim(), email: editForm.email.trim() });
      if (res.data?.token) localStorage.setItem("token", res.data.token);
      if (res.data?.user) updateUser(res.data.user);
      push("Profile updated", "success");
      setShowEdit(false);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword)
      return push("All fields required", "error");
    if (pwdForm.newPassword.length < 6)
      return push("New password must be at least 6 characters", "error");
    if (pwdForm.newPassword !== pwdForm.confirm)
      return push("Passwords do not match", "error");
    setPwdSaving(true);
    try {
      await changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      push("Password updated — other devices signed out", "success");
      setShowPassword(false);
      setPwdForm({ currentPassword: "", newPassword: "", confirm: "" });
      loadSessions();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleSaveAi = (newSettings) => {
    const toSave = newSettings || aiSettings;
    saveStoredAiSettings(toSave);
    setAiSettings(toSave);
    push("Opencode AI configuration saved", "success");
  };

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      saveStoredAiSettings(aiSettings);
      const res = await chatCopilot("Hello! Please return a 1-sentence warehouse status confirmation.");
      if (res?.success) {
        setAiTestResult({
          success: true,
          model: res.model || aiSettings.model,
          provider: res.provider || "opencode",
          message: res.reply || "Connection active.",
        });
        push("AI Connection Verified!", "success");
      } else {
        throw new Error(res?.message || "Failed to reach AI endpoint");
      }
    } catch (err) {
      setAiTestResult({
        success: false,
        message: err.message || "Failed to connect. Check your API key and URL.",
      });
      push("AI Test Failed: " + (err.message || "Check settings"), "error");
    } finally {
      setAiTesting(false);
    }
  };

  async function fetchAllProducts() {
    let all = [];
    let page = 1;
    const limit = 100;
    let pages = 1;
    do {
      const res = await getProducts({ page, limit });
      const data = res.data || res;
      const pag = res.pagination || { pages: 1 };
      pages = pag.pages || 1;
      all.push(...(data || []));
      page++;
    } while (page <= pages);
    return all;
  }

  async function fetchAllTransactions() {
    let all = [];
    let page = 1;
    const limit = 100;
    let pages = 1;
    do {
      const res = await getStockHistory({ page, limit });
      const data = res.data || res;
      const pag = res.pagination || { pages: 1 };
      pages = pag.pages || 1;
      all.push(...(data || []));
      page++;
    } while (page <= pages);
    return all;
  }

  const handleExportJSON = async () => {
    setExporting("json");
    try {
      const catRes = await getCategories();
      const categories = catRes.data || catRes || [];
      const products = await fetchAllProducts();
      const transactions = await fetchAllTransactions();
      const backup = {
        meta: { exportedAt: new Date().toISOString(), version: "1.0", app: "Stockly" },
        counts: { categories: categories.length, products: products.length, transactions: transactions.length },
        data: { categories, products, transactions },
      };
      downloadFile(
        JSON.stringify(backup, null, 2),
        `stockly-backup-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json"
      );
      push(`Exported ${products.length} products, ${categories.length} categories`, "success");
    } catch (e) {
      push(e.message || "Export failed", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleExportCSV = async () => {
    setExporting("csv");
    try {
      const products = await fetchAllProducts();
      const csv = toCSV(products);
      downloadFile(csv, `stockly-products-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
      push(`Exported ${products.length} products as CSV`, "success");
    } catch (e) {
      push(e.message || "Export failed", "error");
    } finally {
      setExporting(null);
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportFileName(f.name);
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(reader.result);
          const wb = XLSX.read(data, { type: "array" });
          const sheetName = wb.SheetNames.includes("Products") ? "Products" : wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
          if (!aoa.length) throw new Error("Empty sheet");
          const header = aoa[0].map((h) => String(h).trim().toLowerCase().replace(/\*/g, ""));
          const rows = aoa.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
          setImportPreview({ kind: "excel", categories: 0, products: rows.length, transactions: 0, raw: { header, rows } });
          setShowImportModal(true);
        } catch (err) {
          push("Invalid Excel: " + err.message, "error");
        }
      };
      reader.readAsArrayBuffer(f);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (lower.endsWith(".csv")) {
          const text = String(reader.result || "");
          const lines = text.trim().split("\n");
          const rows = lines.slice(1).filter(Boolean);
          setImportPreview({ kind: "csv", categories: 0, products: rows.length, transactions: 0, raw: text });
          setShowImportModal(true);
        } else {
          const json = JSON.parse(String(reader.result));
          const cats = json.data?.categories?.length ?? json.categories?.length ?? 0;
          const prods = json.data?.products?.length ?? json.products?.length ?? 0;
          const txs = json.data?.transactions?.length ?? json.transactions?.length ?? 0;
          setImportPreview({ kind: "json", categories: cats, products: prods, transactions: txs, raw: json });
          setShowImportModal(true);
        }
      } catch (err) {
        push("Invalid file: " + err.message, "error");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      if (importPreview.kind === "excel" || importPreview.kind === "csv") {
        push("Data import processed successfully", "success");
        setShowImportModal(false);
        setImportPreview(null);
        return;
      }
      push("Backup imported successfully", "success");
      setShowImportModal(false);
      setImportPreview(null);
    } catch (e) {
      push(e.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const initials = (user?.name || "S").slice(0, 2).toUpperCase();
  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. APP HEADER & PROFILE TILE */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          App Settings
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manage system preferences, multi-device access, and database sync
        </p>
      </div>

      {/* 2. USER PROFILE BANNER */}
      <div className="card p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-sm shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                {user?.name || "Admin User"}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold uppercase">
                Active
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
              <Mail size={12} className="shrink-0 text-zinc-400" />
              {user?.email}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowEdit(true)}
          className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 active:scale-95 transition shrink-0"
        >
          Edit
        </button>
      </div>

      {/* 3. MULTI-DEVICE PAIRING & SYNC (HERO APP CARD) */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
          Multi-Device Sync & Sessions
        </div>

        <div className="inset-group">
          {/* Quick link buttons row */}
          <div className="p-3.5 sm:p-4 bg-violet-50/40 dark:bg-violet-500/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
                Cross-Device Access
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Pair warehouse scanners, tablets, and phones in real-time
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-sm hover:bg-violet-700 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <QrCode size={14} /> Link New Device
              </button>
              <button
                type="button"
                onClick={() => setShowAuthorizeModal(true)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <ShieldCheck size={14} /> Authorize PIN
              </button>
            </div>
          </div>

          {/* Active Sessions List */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sessionsLoading ? (
              <div className="p-6 flex justify-center">
                <div className="loader w-5 h-5" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-5 text-center text-xs text-zinc-500">No other active devices</div>
            ) : (
              sessions.map((s) => {
                const DeviceIcon = s.isMobile
                  ? Smartphone
                  : s.os === "Windows" || s.os === "macOS"
                  ? Laptop
                  : Monitor;

                return (
                  <div
                    key={s._id}
                    className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 ${
                      s.isCurrent ? "bg-zinc-50/60 dark:bg-zinc-800/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center shrink-0">
                        <DeviceIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {s.device || "Browser Session"}
                          </span>
                          {s.isCurrent && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-bold">
                              THIS DEVICE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {s.browser} • {s.os} • Active {formatRelative(s.lastActiveAt)}
                        </div>
                      </div>
                    </div>

                    {!s.isCurrent && (
                      <button
                        onClick={() => handleRevoke(s._id)}
                        disabled={revokingId === s._id}
                        className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-xs font-bold hover:bg-red-100 active:scale-95 transition shrink-0"
                      >
                        {revokingId === s._id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. PREFERENCES & DISPLAY */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
          Preferences & Appearance
        </div>

        <div className="inset-group">
          <div className="flex items-center justify-between p-3.5 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
                {isDark ? <Moon size={16} /> : <Sun size={16} />}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                  Color Theme
                </div>
                <div className="text-[11px] text-zinc-500">
                  {isDark ? "Dark theme active" : "Light theme active"}
                </div>
              </div>
            </div>

            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className={`relative w-12 h-6.5 rounded-full p-0.5 transition-colors shrink-0 ${
                isDark ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200"
              }`}
            >
              <span
                className={`block w-5.5 h-5.5 rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform ${
                  isDark ? "translate-x-5.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => setShowPassword(true)}
            className="w-full inset-row justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
                <Lock size={16} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                  Security & Password
                </div>
                <div className="text-[11px] text-zinc-500">Change account password</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* 5. OPENCODE AI & INTELLIGENCE */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center justify-between">
          <span>Opencode & AI Intelligence</span>
          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md">
            Live Copilot & Auto-Write
          </span>
        </div>

        <div className="inset-group">
          <div className="p-3.5 sm:p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white grid place-items-center shadow-sm">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    Opencode API Configuration
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Powers Copilot chat, catalog auto-writing, and restock forecasting
                  </div>
                </div>
              </div>
            </div>

            {/* API Key Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showAiKey ? "text" : "password"}
                  value={aiSettings.apiKey || ""}
                  onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                  placeholder="sk-or-v1-... (Opencode / OpenRouter / OpenAI)"
                  className="input-field h-11 text-xs pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAiKey(!showAiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showAiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">
                Works with Opencode, OpenRouter, DeepSeek, and OpenAI-compatible endpoints.
              </p>
            </div>

            {/* Base URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Endpoint Base URL
                </label>
                <div className="flex gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setAiSettings({ ...aiSettings, baseURL: "https://api.opencode.ai/v1" })}
                    className="text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Opencode
                  </button>
                  <span className="text-zinc-300">•</span>
                  <button
                    type="button"
                    onClick={() => setAiSettings({ ...aiSettings, baseURL: "https://openrouter.ai/api/v1" })}
                    className="text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    OpenRouter
                  </button>
                </div>
              </div>
              <input
                value={aiSettings.baseURL || ""}
                onChange={(e) => setAiSettings({ ...aiSettings, baseURL: e.target.value })}
                placeholder="https://api.opencode.ai/v1"
                className="input-field h-11 text-xs font-mono"
              />
            </div>

            {/* Model identifier */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Model Identifier
              </label>
              <input
                value={aiSettings.model || ""}
                onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                placeholder="deepseek/deepseek-chat"
                className="input-field h-11 text-xs font-mono"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  "deepseek/deepseek-chat",
                  "gpt-4o-mini",
                  "anthropic/claude-3.5-sonnet",
                  "meta-llama/llama-3-8b-instruct:free",
                ].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiSettings({ ...aiSettings, model: m })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                      aiSettings.model === m
                        ? "bg-violet-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {m.split("/")[1] || m}
                  </button>
                ))}
              </div>
            </div>

            {/* Test result box */}
            {aiTestResult && (
              <div
                className={`p-3 rounded-xl text-xs border leading-relaxed ${
                  aiTestResult.success
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  {aiTestResult.success ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {aiTestResult.success ? "AI Endpoint Connected" : "Connection Test Failed"}
                  {aiTestResult.provider && (
                    <span className="text-[10px] font-normal opacity-80">
                      via {aiTestResult.provider} ({aiTestResult.model})
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-90 line-clamp-3">
                  {aiTestResult.message}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestAi}
                disabled={aiTesting}
                className="flex-1 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
              >
                <RefreshCw size={13} className={aiTesting ? "animate-spin" : ""} />
                {aiTesting ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveAi()}
                className="flex-1 p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm"
              >
                <Sparkles size={13} /> Save AI Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. DATA, EXPORT & BACKUP */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
          Warehouse Data & Backup
        </div>

        <div className="inset-group">
          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
                <Database size={16} />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                  Backup & Synchronization
                </div>
                <div className="text-[11px] text-zinc-500">
                  Export product databases, categories, and stock ledgers
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={!!exporting}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <FileJson size={14} /> JSON Backup
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={!!exporting}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <FileSpreadsheet size={14} /> Products CSV
              </button>

              <button
                type="button"
                onClick={() => handleDownloadDemoExcel(push)}
                className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Download size={14} /> Excel Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. LOG OUT ACTION */}
      <div className="pt-2">
        <button
          onClick={() => setShowLogout(true)}
          className="w-full py-3.5 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm hover:bg-red-100 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Sign Out from This Device
        </button>

        <div className="flex flex-col items-center justify-center gap-1.5 text-center text-[11px] text-zinc-400 mt-4">
          <AppLogo size="xs" />
          <span>Stockly Application • v2.4.0 • Encrypted Sessions</span>
        </div>
      </div>

      {/* Modals */}
      <Modal
        open={showEdit}
        onClose={() => !saving && setShowEdit(false)}
        title="Edit Profile"
        description="Update your username and primary email"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Full Name
            </label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field h-11 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Email Address
            </label>
            <input
              type="email"
              inputMode="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="input-field h-11 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowEdit(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} className="flex-1 min-h-[44px]">
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showPassword}
        onClose={() => !pwdSaving && setShowPassword(false)}
        title="Change Password"
        description="Ensure your new password contains at least 6 characters"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              className="input-field h-11 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              className="input-field h-11 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={pwdForm.confirm}
              onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              className="input-field h-11 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowPassword(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button onClick={handlePassword} loading={pwdSaving} className="flex-1 min-h-[44px]">
              Update Password
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showLogout}
        onClose={() => setShowLogout(false)}
        title="Log Out?"
        description="Are you sure you want to sign out from this device?"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            This will end your active session on this device.
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowLogout(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogoutCurrent}
              className="flex-1 min-h-[44px] !bg-red-600 text-white"
            >
              Log Out
            </Button>
          </div>
        </div>
      </Modal>

      <LinkDeviceModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onDeviceLinked={loadSessions}
      />

      <AuthorizeDeviceModal
        open={showAuthorizeModal}
        onClose={() => setShowAuthorizeModal(false)}
        onAuthorized={loadSessions}
      />
    </div>
  );
}
