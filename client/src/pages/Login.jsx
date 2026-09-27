import React, { useState, useEffect, useRef, useCallback } from "react";
import { login, register, claimPairingCode, createLoginTicket, pollLoginTicket } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Eye,
  EyeOff,
  QrCode,
  KeyRound,
  Camera,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User,
  Sun,
  Moon,
  Layers,
  Activity,
  Download,
} from "lucide-react";
import OTPInput from "../components/ui/OTPInput";
import QRScannerModal from "../components/auth/QRScannerModal";
import QRCodeDisplay from "../components/auth/QRCodeDisplay";
import Button from "../components/ui/Button";
import AppLogo from "../components/ui/AppLogo";

export default function Login() {
  const { setAuth } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { push } = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: "password" | "pairing"
  const [authMode, setAuthMode] = useState("password");
  const [isRegister, setIsRegister] = useState(false);

  // Password login form
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Pairing code state
  const [pairingTab, setPairingTab] = useState("code"); // "code" | "ticket_qr"
  const [pairingCode, setPairingCode] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Quick QR (ticket) state
  const [ticketData, setTicketData] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketTimeLeft, setTicketTimeLeft] = useState(120);
  const [pinCopied, setPinCopied] = useState(false);
  const ticketPollRef = useRef(null);
  const ticketTimerRef = useRef(null);

  // Auto-claim from URL query params (?code=...&key=...)
  const [urlClaiming, setUrlClaiming] = useState(false);

  // Auto-fill demo account helper
  const fillDemoCredentials = () => {
    setForm({
      name: "Demo Admin",
      email: "admin@stockly.com",
      password: "admin123",
    });
    setIsRegister(false);
    push?.("Demo credentials filled: admin@stockly.com", "info");
  };

  // Handle URL query params (?code=...&key=...)
  useEffect(() => {
    const codeParam = searchParams.get("code");
    const keyParam = searchParams.get("key");
    if (codeParam) {
      setUrlClaiming(true);
      setAuthMode("pairing");
      setPairingTab("code");
      const cleanCode = codeParam.toUpperCase().replace(/[^A-Z0-9]/g, "");
      setPairingCode(cleanCode);

      claimPairingCode({ code: cleanCode, key: keyParam || "" })
        .then((res) => {
          const { token, user } = res.data || res;
          setAuth(token, user);
          push?.("Logged in successfully via device pairing!", "success");
          nav("/");
        })
        .catch((err) => {
          push?.(err.message || "Failed to pair device", "error");
          setUrlClaiming(false);
        });
    }
  }, [searchParams, nav, push, setAuth]);

  // Submit standard password / register form
  const submitPassword = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      return push?.("Please fill in all required fields", "error");
    }
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const payload = isRegister ? form : { email: form.email, password: form.password };
      const res = await fn(payload);
      setAuth(res.data.token, res.data.user);
      push(isRegister ? "Account created successfully! Welcome to Stockly." : "Welcome back!", "success");
      nav("/");
    } catch (err) {
      push(err.message || "Authentication failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Submit pairing code
  const submitPairingCode = async (codeToSubmit) => {
    const code = (codeToSubmit || pairingCode).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) {
      return push?.("Please enter the complete 8-character pairing code", "error");
    }
    setPairingLoading(true);
    try {
      const res = await claimPairingCode({ code });
      const { token, user } = res.data || res;
      setAuth(token, user);
      push?.("Device authenticated successfully!", "success");
      nav("/");
    } catch (err) {
      push?.(err.message || "Invalid or expired pairing code", "error");
    } finally {
      setPairingLoading(false);
    }
  };

  // Handle QR scanner result
  const handleScanResult = async (parsed) => {
    setShowScanner(false);
    if (!parsed) return;
    if (parsed.code) {
      setPairingCode(parsed.code);
      setPairingLoading(true);
      try {
        const res = await claimPairingCode({ code: parsed.code, key: parsed.key || "" });
        const { token, user } = res.data || res;
        setAuth(token, user);
        push?.("Logged in successfully via QR code!", "success");
        nav("/");
      } catch (err) {
        push?.(err.message || "Failed to redeem pairing QR", "error");
      } finally {
        setPairingLoading(false);
      }
    } else {
      push?.("QR code did not contain a valid pairing key", "error");
    }
  };

  // Load ticket for Quick QR Login (WhatsApp Web style)
  const loadTicket = useCallback(async () => {
    setTicketLoading(true);
    try {
      const res = await createLoginTicket();
      const data = res.data || res;
      setTicketData(data);
      setTicketTimeLeft(data.expiresIn || 120);
    } catch (err) {
      push?.(err.message || "Failed to initialize QR login", "error");
    } finally {
      setTicketLoading(false);
    }
  }, [push]);

  // Manage ticket polling and countdown
  useEffect(() => {
    if (authMode !== "pairing" || pairingTab !== "ticket_qr") {
      if (ticketPollRef.current) clearInterval(ticketPollRef.current);
      if (ticketTimerRef.current) clearInterval(ticketTimerRef.current);
      return;
    }

    loadTicket();
  }, [authMode, pairingTab, loadTicket]);

  useEffect(() => {
    if (!ticketData?.ticketId || authMode !== "pairing" || pairingTab !== "ticket_qr") return;

    // Countdown
    ticketTimerRef.current = setInterval(() => {
      setTicketTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(ticketTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Polling
    ticketPollRef.current = setInterval(async () => {
      try {
        const res = await pollLoginTicket(ticketData.ticketId);
        const data = res.data || res;
        if (data.status === "approved" && data.token) {
          clearInterval(ticketPollRef.current);
          clearInterval(ticketTimerRef.current);
          setAuth(data.token, data.user);
          push?.("Device authorized! Welcome back!", "success");
          nav("/");
        } else if (data.status === "rejected") {
          clearInterval(ticketPollRef.current);
          push?.("Login request was declined on your device", "error");
        }
      } catch {}
    }, 2000);

    return () => {
      if (ticketPollRef.current) clearInterval(ticketPollRef.current);
      if (ticketTimerRef.current) clearInterval(ticketTimerRef.current);
    };
  }, [ticketData, authMode, pairingTab, nav, push, setAuth]);

  const copyPin = () => {
    if (!ticketData?.pin) return;
    navigator.clipboard.writeText(ticketData.pin).then(() => {
      setPinCopied(true);
      push?.("PIN copied to clipboard", "success");
      setTimeout(() => setPinCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_0.9fr] bg-[#fcfcf9] dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100 selection:bg-violet-600 selection:text-white relative">
      {/* Absolute Top Right Actions: Download App & Theme Toggle */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <a
          href="/stockly.apk"
          download="stockly-v1.0.0.apk"
          className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-bold hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition shadow-xs flex items-center gap-1.5"
          title="Download Stockly Android App"
        >
          <Smartphone size={14} className="text-violet-600 dark:text-violet-400" />
          <span className="hidden sm:inline">Download APK</span>
        </a>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 grid place-items-center hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition shadow-xs"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* LEFT SIDE: Brand Showcase & Architecture Highlights (Desktop Only) */}
      <div className="hidden lg:flex flex-col relative overflow-hidden bg-gradient-to-br from-zinc-950 via-slate-900 to-indigo-950 text-white p-12 xl:p-16 justify-between select-none">
        {/* Ambient Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/5 pointer-events-none" />

        {/* Brand Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size="md" className="shadow-lg ring-1 ring-white/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">Stockly OS</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">Modern Inventory Management System</p>
            </div>
          </div>
        </div>

        {/* Center Hero Marketing */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-violet-200">
            <Sparkles size={14} className="text-violet-300" /> Multi-Device Session Mesh & QR Auth
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.05] text-white">
            Precision stock control, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-indigo-200 to-white">
              without friction.
            </span>
          </h1>

          <p className="text-sm xl:text-base leading-relaxed text-zinc-300/90 font-normal">
            Real-time stock ledger, instant device pairing, QR-based warehouse check-in, automated low-stock warnings, and full production traceability in one cohesive workspace.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            {[
              {
                icon: Zap,
                title: "Instant Device Sync",
                desc: "Pair mobile scanners & warehouse tablets in 2 seconds without typing passwords.",
              },
              {
                icon: ShieldCheck,
                title: "Zero-Trust Sessions",
                desc: "Ephemeral one-time tokens and granular device revocation per session.",
              },
              {
                icon: Layers,
                title: "Live Inventory Ledger",
                desc: "Full audit trail for stock IN, OUT, adjustments, and supplier purchase batches.",
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-600/30 border border-violet-400/20 text-violet-200 grid place-items-center shrink-0 mt-0.5">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white leading-snug">{feat.title}</h3>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400 border-t border-white/10 pt-4">
          <span>© 2026 Stockly Technologies</span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <Activity size={13} className="text-emerald-400" /> 99.99% Uptime SLA
          </span>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form Panel */}
      <div className="flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 overflow-y-auto min-h-screen">
        <div className="w-full max-w-[440px] space-y-5 my-auto">
          {/* Card Container */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-5 relative animate-scale-in">
            {/* Header / Brand on Mobile */}
            <div className="flex flex-col items-center text-center space-y-2">
              <AppLogo size="lg" className="shadow-md" />
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  {urlClaiming
                    ? "Connecting Device…"
                    : authMode === "pairing"
                    ? "Device Pairing"
                    : isRegister
                    ? "Create Account"
                    : "Welcome Back"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs mx-auto">
                  {urlClaiming
                    ? "Validating QR pairing ticket from your scanner"
                    : authMode === "pairing"
                    ? "Sign in instantly via one-time device code or QR code"
                    : isRegister
                    ? "Register a new operator account for your workspace"
                    : "Enter your credentials to access the Stockly workspace"}
                </p>
              </div>
            </div>

            {/* Primary Mode Switcher: Password vs Device Pairing */}
            {!urlClaiming && (
              <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl gap-1 border border-zinc-200/50 dark:border-zinc-700/40">
                <button
                  type="button"
                  onClick={() => setAuthMode("password")}
                  className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 truncate ${
                    authMode === "password"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <KeyRound size={14} className="shrink-0 text-violet-600 dark:text-violet-400" />
                  <span className="truncate">Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("pairing")}
                  className={`py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 truncate ${
                    authMode === "pairing"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  <QrCode size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate">Device Sync / QR</span>
                </button>
              </div>
            )}

            {/* AUTO URL CLAIMING STATE */}
            {urlClaiming ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-3 border-zinc-200 dark:border-zinc-800 border-t-violet-600 dark:border-t-violet-400 animate-spin" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Connecting your device…</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
                    Completing cryptographic handshake with your primary session.
                  </p>
                </div>
              </div>
            ) : authMode === "password" ? (
              /* TAB 1: PASSWORD & REGISTRATION FORM */
              <form onSubmit={submitPassword} className="space-y-4">
                {/* One-click Demo Account helper */}
                {!isRegister && (
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="w-full py-2 px-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-between hover:bg-violet-100 dark:hover:bg-violet-500/20 active:scale-[0.99] transition-all"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
                      Try Demo Account
                    </span>
                    <span className="text-[10.5px] font-mono opacity-80 underline">admin@stockly.com</span>
                  </button>
                )}

                {isRegister && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="input-field pl-10 text-xs sm:text-sm"
                        placeholder="Alex Morgan"
                        required={isRegister}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="input-field pl-10 text-xs sm:text-sm"
                      placeholder="admin@stockly.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="input-field pl-10 pr-10 text-xs sm:text-sm"
                      placeholder="••••••••"
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                      title={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  className="w-full py-3 sm:py-3.5 text-xs sm:text-sm font-bold shadow-md justify-center !bg-zinc-900 dark:!bg-white dark:!text-zinc-900 mt-2"
                >
                  <span>{isRegister ? "Create Stockly Account" : "Sign In to Workspace"}</span>
                  {!loading && <ArrowRight size={15} />}
                </Button>

                {/* Toggle Register / Login */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setForm({ name: "", email: "", password: "" });
                    }}
                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                  >
                    {isRegister ? "Already registered? " : "Need an operator account? "}
                    <span className="text-violet-600 dark:text-violet-400 underline underline-offset-4">
                      {isRegister ? "Sign In" : "Create Account"}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: DEVICE PAIRING / MULTI-DEVICE LOGIN */
              <div className="space-y-4">
                {/* Sub-Tabs: 8-digit Code vs Quick QR Web Style */}
                <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setPairingTab("code")}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      pairingTab === "code"
                        ? "bg-white dark:bg-zinc-700 text-violet-700 dark:text-violet-300 shadow-xs"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <KeyRound size={12} className="shrink-0" />
                    <span className="truncate">Enter Code / Scan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPairingTab("ticket_qr")}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      pairingTab === "ticket_qr"
                        ? "bg-white dark:bg-zinc-700 text-violet-700 dark:text-violet-300 shadow-xs"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    <QrCode size={12} className="shrink-0" />
                    <span className="truncate">Quick QR Ticket</span>
                  </button>
                </div>

                {pairingTab === "code" ? (
                  /* SUB-TAB 1: ENTER 8-CHAR OTP CODE OR SCAN WITH CAMERA */
                  <div className="space-y-3.5 py-1">
                    <div className="text-center">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Enter 8-character pairing code from logged-in device:
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        (Open <strong>Settings → Link New Device</strong> on phone/desktop)
                      </p>
                    </div>

                    <div className="w-full flex justify-center py-2 overflow-x-hidden">
                      <OTPInput
                        value={pairingCode}
                        onChange={(val) => {
                          setPairingCode(val);
                          if (val.length === 8) {
                            submitPairingCode(val);
                          }
                        }}
                        length={8}
                        separator="-"
                        separatorAt={4}
                        autoFocus={true}
                        placeholder="••••••••"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={() => submitPairingCode(pairingCode)}
                      loading={pairingLoading}
                      disabled={pairingCode.length < 8}
                      className="w-full py-2.5 sm:py-3 justify-center text-xs sm:text-sm !bg-zinc-900 dark:!bg-white dark:!text-zinc-900"
                    >
                      Pair and Sign In
                    </Button>

                    <div className="flex items-center gap-2.5 py-0.5">
                      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                      <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">or</span>
                      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowScanner(true)}
                      className="w-full py-2.5 sm:py-3 justify-center gap-2 text-xs sm:text-sm font-semibold"
                    >
                      <Camera size={15} /> Scan Pairing QR with Camera
                    </Button>
                  </div>
                ) : (
                  /* SUB-TAB 2: QUICK QR LOGIN TICKET (WhatsApp Web Style) */
                  <div className="flex flex-col items-center space-y-3.5 py-1">
                    {ticketLoading ? (
                      <div className="p-8 flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-violet-600 rounded-full animate-spin" />
                        <span className="text-xs text-zinc-500">Generating secure QR ticket…</span>
                      </div>
                    ) : ticketData ? (
                      <>
                        {/* Dynamic QR Display */}
                        <div className="relative flex justify-center w-full">
                          <QRCodeDisplay
                            value={ticketData.qrPayload}
                            size={168}
                            showControls={false}
                          />

                          {ticketTimeLeft <= 0 && (
                            <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 animate-fade-in">
                              <AlertCircle size={22} className="text-amber-500 mb-1" />
                              <span className="text-xs font-bold text-zinc-900 dark:text-white">QR Code Expired</span>
                              <Button size="sm" onClick={loadTicket} className="mt-2 text-xs py-1.5 px-3">
                                <RefreshCw size={12} /> Reload Ticket
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* PIN Code Box */}
                        <div className="w-full bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-2.5 flex items-center justify-between px-3.5">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">PIN Code</span>
                            <span className="font-mono text-lg font-black tracking-widest text-zinc-900 dark:text-white">
                              {ticketData.pin}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={copyPin}
                            className="p-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 active:scale-95 transition"
                            title="Copy PIN"
                          >
                            {pinCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>

                        {/* Status Countdown */}
                        <div className="w-full flex items-center justify-between text-[11px] text-zinc-500 px-1">
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Waiting for phone authorization…
                          </span>
                          <span className="font-mono font-bold">
                            {Math.floor(ticketTimeLeft / 60)}:{String(ticketTimeLeft % 60).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Instructions */}
                        <div className="w-full text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/50 rounded-xl p-3 text-left space-y-1">
                          <div className="font-bold text-zinc-800 dark:text-zinc-200">
                            To approve from your phone:
                          </div>
                          <p>1. Open Stockly on your logged-in device.</p>
                          <p>2. Tap <strong>Settings → Authorize Device</strong>.</p>
                          <p>3. Scan this QR code or enter the PIN.</p>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Security / Compliance & Mobile Download Link */}
          <div className="text-center space-y-2 text-xs text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center justify-center gap-3 text-[11px]">
              <a
                href="/stockly.apk"
                download="stockly-v1.0.0.apk"
                className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1"
              >
                <Smartphone size={13} /> Stockly Android APK (4.9 MB)
              </a>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-500" /> End-to-End Encrypted
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Camera Scanner Modal */}
      <QRScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScanResult}
        title="Scan Pairing QR Code"
        description="Scan the pairing QR code displayed in Settings → Link New Device"
      />
    </div>
  );
}
