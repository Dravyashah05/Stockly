import React, { useState, useEffect, useRef, useCallback } from "react";
import { login, register, claimPairingCode, createLoginTicket, pollLoginTicket } from "../api/auth";
import { useAuth } from "../context/AuthContext";
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
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import OTPInput from "../components/ui/OTPInput";
import QRScannerModal from "../components/auth/QRScannerModal";
import QRCodeDisplay from "../components/auth/QRCodeDisplay";
import Button from "../components/ui/Button";

export default function Login() {
  const { setAuth } = useAuth();
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
  const ticketPollRef = useRef(null);
  const ticketTimerRef = useRef(null);

  // Auto-claim from URL query params (?code=...&key=...)
  const [urlClaiming, setUrlClaiming] = useState(false);

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
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const payload = isRegister ? form : { email: form.email, password: form.password };
      const res = await fn(payload);
      setAuth(res.data.token, res.data.user);
      push(isRegister ? "Registered successfully" : "Welcome back!", "success");
      nav("/");
    } catch (err) {
      push(err.message, "error");
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
      push?.("Logged in successfully!", "success");
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

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr] bg-[#fcfcf9] dark:bg-zinc-950">
      {/* Left: brand / marketing */}
      <div className="hidden lg:flex flex-col relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 text-white">
        <div className="absolute inset-0">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/10 blur-[80px]" />
          <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-300/20 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/10" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col p-10 xl:p-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-violet-700 grid place-items-center font-bold shadow-lg">
              S
            </div>
            <span className="font-semibold tracking-tight">Stockly</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur text-xs font-semibold tracking-widest uppercase border border-white/10">
              Modern OS
            </span>
          </div>

          <div className="flex-1 grid place-items-center">
            <div className="max-w-[520px]">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-medium">
                <Sparkles size={14} /> Multi-Device Sync & QR Login
              </div>
              <h1 className="mt-6 text-[42px] xl:text-[48px] font-bold tracking-tight leading-[0.95]">
                Inventory <br />
                <span className="text-white/80">that moves</span> <br />
                with you.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70 max-w-[420px]">
                Manage products, categories, stock IN/OUT and active sessions seamlessly across all your desktop, mobile, and warehouse devices.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 max-w-[420px]">
                {[
                  { icon: Zap, title: "Lightning-fast", desc: "Instant QR & code device pairing" },
                  { icon: ShieldCheck, title: "Secure by default", desc: "One-time tokens • Granular sessions" },
                  { icon: Sparkles, title: "Crafted UI", desc: "Glass, motion, multi-device sync" },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur border border-white/10"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white text-violet-700 grid place-items-center shrink-0">
                      <item.icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-none">{item.title}</div>
                      <div className="text-xs text-white/70 mt-1">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-white/50 flex items-center justify-between">
            <span>© 2026 Stockly</span>
            <span>Trusted by ops teams</span>
          </div>
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="grid place-items-center p-4 sm:p-8 bg-[#fcfcf9] dark:bg-zinc-950 relative">
        {/* Mobile Background */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 opacity-100" />
        <div className="lg:hidden absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative w-full max-w-[440px] bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-5 animate-scale-in">
          {/* Header */}
          <div className="text-center sm:text-left">
            <div className="inline-flex lg:hidden items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-3">
              <Sparkles size={12} /> Stockly OS
            </div>
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center font-bold shadow-md">
                S
              </div>
              <div className="text-left">
                <h1 className="text-[18px] font-bold tracking-tight leading-none text-zinc-900 dark:text-white">
                  Stockly
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Inventory Management OS</p>
              </div>
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-5 text-zinc-900 dark:text-white">
              {authMode === "pairing"
                ? "Pair Device"
                : isRegister
                ? "Create your account"
                : "Welcome back"}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {authMode === "pairing"
                ? "Log in instantly using a code or QR code from another device"
                : isRegister
                ? "Get started in 30 seconds"
                : "Sign in to continue to your workspace"}
            </p>
          </div>

          {/* Primary Mode Toggle: Password vs Device Pairing */}
          {!urlClaiming && (
            <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/70 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthMode("password")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === "password"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <KeyRound size={14} /> Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("pairing")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === "pairing"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <QrCode size={14} /> Device Code / QR
              </button>
            </div>
          )}

          {/* Auto URL Claiming Loader */}
          {urlClaiming ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-zinc-200 border-t-violet-600 rounded-full animate-spin" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Connecting your device…</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                Verifying pairing credentials from QR code.
              </p>
            </div>
          ) : authMode === "password" ? (
            /* PASSWORD / REGISTER FORM */
            <form onSubmit={submitPassword} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Full name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field"
                    placeholder="Alex Morgan"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                  placeholder="admin@stockly.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm shadow-lg shadow-zinc-900/10 dark:shadow-none hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-zinc-900/20 dark:border-t-zinc-900 rounded-full animate-spin" />
                ) : null}
                {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
                {!loading && <ArrowRight size={16} />}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
                >
                  {isRegister ? "Already have an account? " : "Need an account? "}
                  <span className="underline decoration-zinc-300 underline-offset-4 font-semibold">
                    {isRegister ? "Sign in" : "Register"}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* DEVICE PAIRING / MULTI-DEVICE LOGIN */
            <div className="space-y-4">
              {/* Pairing Sub-Tabs */}
              <div className="flex border-b border-zinc-100 dark:border-zinc-800 gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPairingTab("code")}
                  className={`pb-2.5 border-b-2 transition ${
                    pairingTab === "code"
                      ? "border-violet-600 text-violet-600 dark:text-violet-400"
                      : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  Enter 8-Digit Code / Scan
                </button>
                <button
                  type="button"
                  onClick={() => setPairingTab("ticket_qr")}
                  className={`pb-2.5 border-b-2 transition ${
                    pairingTab === "ticket_qr"
                      ? "border-violet-600 text-violet-600 dark:text-violet-400"
                      : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  Quick QR Login
                </button>
              </div>

              {pairingTab === "code" ? (
                /* SUB-TAB 1: ENTER 8-CHAR CODE OR SCAN QR */
                <div className="space-y-4 py-1">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Enter the 8-character pairing code from your logged-in device (<strong>Settings → Link New Device</strong>):
                    </p>
                  </div>

                  <div className="py-2 flex justify-center">
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
                    className="w-full py-3 justify-center !bg-zinc-900 dark:!bg-white dark:!text-zinc-900"
                  >
                    Pair and Sign In
                  </Button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400">or</span>
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowScanner(true)}
                    className="w-full py-3 justify-center gap-2"
                  >
                    <Camera size={16} /> Scan QR with Camera
                  </Button>
                </div>
              ) : (
                /* SUB-TAB 2: QUICK QR TICKET LOGIN (WhatsApp Web style) */
                <div className="flex flex-col items-center space-y-4 py-1">
                  {ticketLoading ? (
                    <div className="p-8 flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-2 border-zinc-300 border-t-violet-600 rounded-full animate-spin" />
                      <span className="text-xs text-zinc-500">Generating login QR…</span>
                    </div>
                  ) : ticketData ? (
                    <>
                      <div className="relative">
                        <QRCodeDisplay
                          value={ticketData.qrPayload}
                          size={180}
                          showControls={false}
                        />

                        {ticketTimeLeft <= 0 && (
                          <div className="absolute inset-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center z-10">
                            <AlertCircle size={22} className="text-amber-500 mb-1" />
                            <span className="text-xs font-semibold text-zinc-900 dark:text-white">QR Code Expired</span>
                            <Button size="sm" onClick={loadTicket} className="mt-2 text-xs">
                              <RefreshCw size={12} /> Reload QR
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 6-char PIN display */}
                      <div className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-2.5 text-center">
                        <span className="text-[11px] text-zinc-500 block">PIN Code:</span>
                        <span className="font-mono text-xl font-bold tracking-widest text-zinc-900 dark:text-white">
                          {ticketData.pin}
                        </span>
                      </div>

                      <div className="w-full flex items-center justify-between text-xs text-zinc-500 px-1">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Waiting for approval…
                        </span>
                        <span className="font-mono">
                          {Math.floor(ticketTimeLeft / 60)}:{String(ticketTimeLeft % 60).padStart(2, "0")}
                        </span>
                      </div>

                      <div className="w-full text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-3 text-left space-y-1">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          How to approve on your phone:
                        </div>
                        <p>1. Open Stockly on your logged-in phone.</p>
                        <p>2. Tap <strong>Settings → Sessions → Authorize Device</strong>.</p>
                        <p>3. Scan this QR code or type the 6-digit PIN.</p>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Footer Demo Info */}
          <p className="text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            Demo: <span className="font-mono font-medium text-zinc-600 dark:text-zinc-300">admin@stockly.com / admin123</span><br />
            Encrypted Sessions • Multi-Device Ready
          </p>
        </div>

        <p className="relative mt-6 text-xs text-zinc-500 dark:text-zinc-500 lg:text-zinc-400 text-center">
          By continuing you agree to Terms & Privacy.
        </p>
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
