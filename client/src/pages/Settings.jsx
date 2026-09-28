import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import {
  Moon,
  Sun,
  LogOut,
  Lock,
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
  Laptop,
  QrCode,
  ShieldCheck,
  Sparkles,
  Bell,
  BellRing,
  ArrowUpCircle,
  Search,
  KeyRound,
  FileUp,
  X,
} from "lucide-react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import LinkDeviceModal from "../components/auth/LinkDeviceModal";
import AuthorizeDeviceModal from "../components/auth/AuthorizeDeviceModal";
import AppUpdateModal from "../components/app/AppUpdateModal";
import {
  updateMe,
  changePassword,
  getSessions,
  revokeSession,
  revokeAllSessions,
} from "../api/auth";
import { getProducts } from "../api/products";
import { getCategories } from "../api/categories";
import { getStockHistory } from "../api/stock";
import { getStoredAiSettings, saveStoredAiSettings, chatCopilot } from "../api/ai";
import { checkAppUpdate, APP_CURRENT_VERSION, dismissUpdateVersion, clearDismissedUpdateVersion } from "../api/appUpdate";
import {
  sendLocalNotification,
  requestNotificationPermission,
  checkNotificationPermission,
} from "../utils/notifications";

/* ---------- helpers ---------- */

function formatRelative(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const rows = products.map((p) =>
    [
      escape(p.name),
      escape(p.sku),
      escape(p.category?.name || p.category || ""),
      escape(p.quantity),
      escape(p.unit),
      escape(p.minimumStock ?? p.minimumQuantity ?? 5),
      escape(p.description || ""),
    ].join(",")
  );
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
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    const wsCat = XLSX.utils.aoa_to_sheet([
      ["name*", "description", "status"],
      ...liveCats.map((n) => [n, "", "active"]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsCat, "Categories");
    XLSX.writeFile(wb, "stockly-import-template.xlsx");
    push?.("Excel template downloaded", "success");
  } catch (e) {
    push?.(e.message || "Failed to generate Excel", "error");
  }
}

/* ---------- tiny UI primitives ---------- */

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{title}</h2>
        {hint && <span className="text-[11px] font-medium text-zinc-400">{hint}</span>}
      </div>
      <div className="inset-group">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, title, sub, right, onClick, last }) {
  const Inner = (
    <>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300 grid place-items-center shrink-0">
            <Icon size={15} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-zinc-900 dark:text-white leading-tight">{title}</div>
          {sub && <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">{right}</div>
    </>
  );
  const cls = `flex items-center justify-between gap-3 px-4 py-3 text-left w-full transition-colors ${
    onClick ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800 cursor-pointer" : ""
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {Inner}
        {!right && <ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600 shrink-0" />}
      </button>
    );
  }
  return <div className={cls}>{Inner}</div>;
}

function Toggle({ checked, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
        checked ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full shadow transition-all ${
          checked ? "left-[22px] bg-white dark:bg-zinc-900" : "left-[3px] bg-white"
        }`}
      />
    </button>
  );
}

/* ---------- page ---------- */

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { push } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [exporting, setExporting] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);

  const [aiSettings, setAiSettings] = useState(() => getStoredAiSettings());
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(() => {
    try {
      return localStorage.getItem("stockly_auto_update") !== "false";
    } catch {
      return true;
    }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem("stockly_notifications_enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [hasNotifPerm, setHasNotifPerm] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [sendingTestNotif, setSendingTestNotif] = useState(false);

  useEffect(() => {
    checkNotificationPermission().then(setHasNotifPerm);
  }, []);

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
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const matches = (text) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return text.toLowerCase().includes(q);
  };

  /* ----- actions ----- */

  const handleToggleAutoUpdate = () => {
    const next = !autoUpdateEnabled;
    setAutoUpdateEnabled(next);
    try {
      localStorage.setItem("stockly_auto_update", String(next));
    } catch {}
    push(next ? "Auto-update enabled" : "Auto-update disabled", "info");
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setHasNotifPerm(granted);
      setNotificationsEnabled(true);
      try {
        localStorage.setItem("stockly_notifications_enabled", "true");
      } catch {}
      push(granted ? "Notifications enabled" : "Permission needed in system settings", granted ? "success" : "info");
    } else {
      setNotificationsEnabled(false);
      try {
        localStorage.setItem("stockly_notifications_enabled", "false");
      } catch {}
      push("Notifications disabled", "info");
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      // Manual check bypasses the "Later" dismissal for this version.
      const res = await checkAppUpdate(true);
      if (res?.hasUpdate) {
        clearDismissedUpdateVersion();
        setUpdateInfo(res);
        setUpdateModalOpen(true);
        push(`Update v${res.latestVersion} available`, "info");
      } else {
        setUpdateInfo(null);
        setUpdateModalOpen(false);
        push(`v${APP_CURRENT_VERSION} is up to date`, "success");
      }
    } catch (e) {
      setUpdateInfo(null);
      setUpdateModalOpen(false);
      push("Update check failed: " + e.message, "error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSendTestNotification = async () => {
    setSendingTestNotif(true);
    try {
      const perm = await requestNotificationPermission();
      setHasNotifPerm(perm);
      const res = await sendLocalNotification({
        title: "Stockly test notification",
        body: "Alerts are working on this device.",
      });
      push(res.success ? "Test notification sent" : res.message || "Failed to send", res.success ? "success" : "error");
    } catch (err) {
      push("Notification error: " + err.message, "error");
    } finally {
      setSendingTestNotif(false);
    }
  };

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
    if (!editForm.name.trim() || !editForm.email.trim()) return push("Name and email required", "error");
    if (!/^\S+@\S+\.\S+$/.test(editForm.email.trim())) return push("Enter a valid email", "error");
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
    if (!pwdForm.currentPassword || !pwdForm.newPassword) return push("All fields required", "error");
    if (pwdForm.newPassword.length < 6) return push("New password must be at least 6 characters", "error");
    if (pwdForm.newPassword !== pwdForm.confirm) return push("Passwords do not match", "error");
    setPwdSaving(true);
    try {
      await changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      push("Password updated", "success");
      setShowPassword(false);
      setPwdForm({ currentPassword: "", newPassword: "", confirm: "" });
      loadSessions();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleSaveAi = (next) => {
    const toSave = next || aiSettings;
    saveStoredAiSettings(toSave);
    setAiSettings(toSave);
    push("AI settings saved", "success");
  };

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      saveStoredAiSettings(aiSettings);
      const res = await chatCopilot("Reply with a 1-sentence warehouse status confirmation.");
      if (res?.success) {
        setAiTestResult({ success: true, message: res.reply || "Connected." });
        push("AI connected", "success");
      } else throw new Error(res?.message || "Failed to reach AI");
    } catch (err) {
      setAiTestResult({ success: false, message: err.message });
      push("AI test failed: " + (err.message || ""), "error");
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
      pages = (res.pagination || { pages: 1 }).pages || 1;
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
      pages = (res.pagination || { pages: 1 }).pages || 1;
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
      downloadFile(
        JSON.stringify(
          {
            meta: { exportedAt: new Date().toISOString(), app: "Stockly" },
            counts: { categories: categories.length, products: products.length, transactions: transactions.length },
            data: { categories, products, transactions },
          },
          null,
          2
        ),
        `stockly-backup-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json"
      );
      push(`Exported ${products.length} products`, "success");
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
      downloadFile(toCSV(products), `stockly-products-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
      push(`Exported ${products.length} products`, "success");
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
          const wb = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          const sheet = wb.SheetNames.includes("Products") ? "Products" : wb.SheetNames[0];
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", blankrows: false });
          if (!aoa.length) throw new Error("Empty sheet");
          const header = aoa[0].map((h) => String(h).trim().toLowerCase().replace(/\*/g, ""));
          const rows = aoa.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
          setImportPreview({ kind: "excel", products: rows.length, raw: { header, rows } });
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
          const rows = text.trim().split("\n").slice(1).filter(Boolean);
          setImportPreview({ kind: "csv", products: rows.length, raw: text });
        } else {
          const json = JSON.parse(String(reader.result));
          setImportPreview({
            kind: "json",
            categories: json.data?.categories?.length ?? json.categories?.length ?? 0,
            products: json.data?.products?.length ?? json.products?.length ?? 0,
            transactions: json.data?.transactions?.length ?? json.transactions?.length ?? 0,
            raw: json,
          });
        }
        setShowImportModal(true);
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
      push("Import completed", "success");
      setShowImportModal(false);
      setImportPreview(null);
    } catch (e) {
      push(e.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const initials = (user?.name || "S").slice(0, 2).toUpperCase();
  const aiConfigured = Boolean(aiSettings?.apiKey);
  const showAccount = matches("profile account name email password security edit");
  const showPrefs = matches("theme dark light appearance notification alert update auto");
  const showDevices = matches("device session sync link authorize qr pair phone tablet");
  const showAi = matches("ai opencode model api key intelligence copilot");
  const showData = matches("data backup export import json csv excel template");
  const showAbout = matches("about android app version apk download mobile");
  const anyVisible = showAccount || showPrefs || showDevices || showAi || showData;

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-28 animate-fade-in">
      {/* header + search */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Preferences, devices, AI and backups</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings…"
            className="input-field pl-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {query && !anyVisible && !showAbout && (
          <div className="text-center py-6 text-sm text-zinc-500">
            No settings match "<span className="font-medium text-zinc-700 dark:text-zinc-200">{query}</span>"
          </div>
        )}
      </div>

      {/* profile */}
      {showAccount && (
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-200 text-white dark:text-zinc-900 grid place-items-center font-bold text-sm shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user?.name || "User"}</div>
            <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Active session</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
        </div>
      )}

      {/* preferences */}
      {showPrefs && (
        <Section title="General">
          <Row
            icon={isDark ? Moon : Sun}
            title="Appearance"
            sub={isDark ? "Dark" : "Light"}
            right={
              <div className="segmented-control">
                <button
                  onClick={() => setTheme("light")}
                  className={`segmented-item ${!isDark ? "segmented-item-active" : "segmented-item-inactive"}`}
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`segmented-item ${isDark ? "segmented-item-active" : "segmented-item-inactive"}`}
                >
                  <Moon size={13} /> Dark
                </button>
              </div>
            }
          />
          <Row
            icon={notificationsEnabled ? BellRing : Bell}
            title="Notifications"
            sub={notificationsEnabled ? (hasNotifPerm ? "On" : "On · system permission needed") : "Off"}
            right={<Toggle checked={notificationsEnabled} onClick={handleToggleNotifications} label="Notifications" />}
          />
          {notificationsEnabled && (
            <Row
              icon={Bell}
              title="Test notification"
              sub="Send a sample alert to this device"
              right={
                <button
                  onClick={handleSendTestNotification}
                  disabled={sendingTestNotif}
                  className="text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {sendingTestNotif ? "Sending…" : "Send test"}
                </button>
              }
            />
          )}
          <Row
            icon={ArrowUpCircle}
            title="App version"
            sub={`v${APP_CURRENT_VERSION}`}
            right={
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={checkingUpdate ? "animate-spin" : ""} />
                {checkingUpdate ? "Checking…" : "Check for updates"}
              </button>
            }
          />
          <Row
            icon={RefreshCw}
            title="Auto-update check"
            sub="Check for new releases on startup"
            right={<Toggle checked={autoUpdateEnabled} onClick={handleToggleAutoUpdate} label="Auto update" />}
          />
        </Section>
      )}

      {/* security + devices */}
      {showDevices && (
        <Section title="Security & devices" hint={sessions.length ? `${sessions.length} active` : ""}>
          <Row
            icon={Lock}
            title="Password"
            sub="Change account password"
            onClick={() => setShowPassword(true)}
            right={<ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600" />}
          />
          <Row
            icon={Smartphone}
            title="Sessions & linked devices"
            sub={
              sessionsLoading
                ? "Loading…"
                : sessions.length
                ? `${sessions.filter((s) => !s.isCurrent).length} other · active ${formatRelative(sessions.find((s) => s.isCurrent)?.lastActiveAt || sessions[0]?.lastActiveAt)}`
                : "No other devices"
            }
            onClick={() => setShowSessions(true)}
            right={<ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600" />}
          />
          <div className="flex gap-2 px-4 py-3">
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold py-2.5 active:scale-[0.98] transition"
            >
              <QrCode size={14} /> Link device
            </button>
            <button
              onClick={() => setShowAuthorizeModal(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition"
            >
              <ShieldCheck size={14} /> Authorize PIN
            </button>
          </div>
        </Section>
      )}

      {/* AI */}
      {showAi && (
        <Section title="AI assistant" hint={aiConfigured ? "Configured" : "Not set up"}>
          <Row
            icon={Sparkles}
            title="Opencode AI"
            sub={aiConfigured ? (aiSettings.model || "Custom model") : "Connect API key to enable chat"}
            onClick={() => setAiOpen((v) => !v)}
            right={
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${aiConfigured ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                />
                <ChevronRight
                  size={15}
                  className={`text-zinc-300 dark:text-zinc-600 transition-transform ${aiOpen ? "rotate-90" : ""}`}
                />
              </span>
            }
          />
          {aiOpen && (
            <div className="px-4 py-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="input-label">API key</label>
                <div className="relative">
                  <input
                    type={showAiKey ? "text" : "password"}
                    value={aiSettings.apiKey || ""}
                    onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                    placeholder="sk-…"
                    className="input-field pr-16 font-mono text-[13px]"
                  />
                  <button
                    onClick={() => setShowAiKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    {showAiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Base URL</label>
                <input
                  value={aiSettings.baseURL || ""}
                  onChange={(e) => setAiSettings({ ...aiSettings, baseURL: e.target.value })}
                  placeholder="https://api.opencode.ai/v1"
                  className="input-field font-mono text-[13px]"
                />
                <div className="flex gap-3 mt-1.5 text-[11px]">
                  <button
                    onClick={() => setAiSettings({ ...aiSettings, baseURL: "https://api.opencode.ai/v1" })}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium"
                  >
                    Opencode
                  </button>
                  <button
                    onClick={() => setAiSettings({ ...aiSettings, baseURL: "https://openrouter.ai/api/v1" })}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium"
                  >
                    OpenRouter
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Model</label>
                <input
                  value={aiSettings.model || ""}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  placeholder="deepseek/deepseek-chat"
                  className="input-field font-mono text-[13px]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["deepseek/deepseek-chat", "gpt-4o-mini", "meta-llama/llama-3-8b-instruct:free"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setAiSettings({ ...aiSettings, model: m })}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                        aiSettings.model === m
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {m.split("/")[1] || m}
                    </button>
                  ))}
                </div>
              </div>
              {aiTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    aiTestResult.success
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {aiTestResult.success ? <Check size={13} /> : null}
                    {aiTestResult.success ? "Connected" : "Failed"}
                  </div>
                  <div className="mt-0.5 opacity-90 line-clamp-3">{aiTestResult.message}</div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={handleTestAi} loading={aiTesting}>
                  Test
                </Button>
                <Button size="sm" className="flex-1" onClick={() => handleSaveAi()}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* data */}
      {showData && (
        <Section title="Data & backup">
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 grid place-items-center">
                <Database size={15} />
              </div>
              <div className="text-[11.5px] text-zinc-500">Export inventory, or import from file</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportJSON}
                disabled={!!exporting}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                <FileJson size={13} /> {exporting === "json" ? "Exporting…" : "JSON backup"}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={!!exporting}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                <FileSpreadsheet size={13} /> {exporting === "csv" ? "Exporting…" : "CSV"}
              </button>
              <button
                onClick={() => handleDownloadDemoExcel(push)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Download size={13} /> Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <Upload size={13} /> Import
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              className="hidden"
              onChange={onPickFile}
            />
            {importFileName && !showImportModal && (
              <div className="text-[11px] text-zinc-400 mt-2 truncate">Last file: {importFileName}</div>
            )}
          </div>
        </Section>
      )}

      {/* about */}
      {(showAbout || !query) && (
        <Section title="About">
          <Row
            icon={Smartphone}
            title="Android app"
            sub="Offline sync · barcode scanner"
            right={
            <span className="flex items-center gap-2">
              <a
                href="/stockly.apk"
                download={`stockly-v${APP_CURRENT_VERSION}.apk`}
                className="text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                APK
              </a>
              <Link
                to="/app-store"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                Store
              </Link>
            </span>
          }
        />
        <Row icon={KeyRound} title="Version" sub={`Stockly v${APP_CURRENT_VERSION} · encrypted sessions`} />
      </Section>
      )}

      {/* sign out */}
      <button
        onClick={() => setShowLogout(true)}
        className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[13px] hover:bg-red-50 active:scale-[0.99] transition flex items-center justify-center gap-2"
      >
        <LogOut size={15} /> Sign out
      </button>
      <p className="text-center text-[11px] text-zinc-400">Stockly v{APP_CURRENT_VERSION}</p>

      {/* ----- modals ----- */}

      <Modal open={showEdit} onClose={() => !saving && setShowEdit(false)} title="Edit profile">
        <div className="space-y-3">
          <div>
            <label className="input-label">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowEdit(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showPassword} onClose={() => !pwdSaving && setShowPassword(false)} title="Change password">
        <div className="space-y-3">
          {[
            ["Current password", "currentPassword"],
            ["New password", "newPassword"],
            ["Confirm password", "confirm"],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input
                type="password"
                value={pwdForm[key]}
                onChange={(e) => setPwdForm({ ...pwdForm, [key]: e.target.value })}
                className="input-field"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowPassword(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handlePassword} loading={pwdSaving} className="flex-1">
              Update
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showSessions} onClose={() => setShowSessions(false)} title="Sessions" description="Devices signed in to your account">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                setShowSessions(false);
                setShowLinkModal(true);
              }}
            >
              <QrCode size={14} /> Link device
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowSessions(false);
                setShowAuthorizeModal(true);
              }}
            >
              <ShieldCheck size={14} /> PIN
            </Button>
          </div>
          {sessionsLoading ? (
            <div className="py-8 flex justify-center">
              <div className="loader w-5 h-5" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">No active sessions</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {sessions.map((s) => {
                const Icon = s.isMobile ? Smartphone : s.os === "Windows" || s.os === "macOS" ? Laptop : Monitor;
                return (
                  <div key={s._id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {s.device || "Browser"} {s.isCurrent && <span className="text-emerald-600">· this device</span>}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          {s.browser} · {s.os} · {formatRelative(s.lastActiveAt)}
                        </div>
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        onClick={() => handleRevoke(s._id)}
                        disabled={revokingId === s._id}
                        className="text-[11px] font-semibold text-red-600 hover:underline shrink-0"
                      >
                        {revokingId === s._id ? "…" : "Revoke"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {sessions.some((s) => !s.isCurrent) && (
            <Button variant="secondary" size="sm" className="w-full" onClick={handleRevokeAllOther} loading={revokingAll}>
              Sign out other devices
            </Button>
          )}
        </div>
      </Modal>

      <Modal
        open={showImportModal}
        onClose={() => !importing && setShowImportModal(false)}
        title="Import preview"
        description={importFileName}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <FileUp size={14} /> {importPreview?.kind?.toUpperCase()} file
            </div>
            {importPreview?.products != null && <div>{importPreview.products} products found</div>}
            {importPreview?.categories != null && <div>{importPreview.categories} categories found</div>}
            {importPreview?.transactions != null && <div>{importPreview.transactions} transactions found</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowImportModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importing} className="flex-1">
              Confirm import
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLogout} onClose={() => setShowLogout(false)} title="Sign out?" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">This ends your session on this device.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowLogout(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLogoutCurrent} className="flex-1">
              Sign out
            </Button>
          </div>
        </div>
      </Modal>

      <LinkDeviceModal open={showLinkModal} onClose={() => setShowLinkModal(false)} onDeviceLinked={loadSessions} />
      <AuthorizeDeviceModal
        open={showAuthorizeModal}
        onClose={() => setShowAuthorizeModal(false)}
        onAuthorized={loadSessions}
      />
      <AppUpdateModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onRemindLater={(info) => {
          if (info?.latestVersion) dismissUpdateVersion(info.latestVersion);
          setUpdateModalOpen(false);
        }}
      />
    </div>
  );
}
