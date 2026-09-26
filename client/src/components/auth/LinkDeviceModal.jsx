import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, Copy, Check, RefreshCw, Smartphone, Laptop, AlertCircle, CheckCircle2 } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import QRCodeDisplay from "./QRCodeDisplay";
import { createPairingCode, cancelPairingCode, getPairingStatus } from "../../api/auth";
import { useToast } from "../../context/ToastContext";

export default function LinkDeviceModal({ open, onClose, onDeviceLinked }) {
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [copied, setCopied] = useState(false);
  const [claimedDevice, setClaimedDevice] = useState(null);
  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const { push } = useToast();

  const loadCode = useCallback(async () => {
    setLoading(true);
    setClaimedDevice(null);
    try {
      const res = await createPairingCode();
      const data = res.data || res;
      setPairingData(data);
      setTimeLeft(data.expiresIn || 120);
    } catch (err) {
      push?.(err.message || "Failed to generate pairing code", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    if (open) {
      loadCode();
    } else {
      setPairingData(null);
      setClaimedDevice(null);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
  }, [open, loadCode]);

  // Countdown timer
  useEffect(() => {
    if (!open || !pairingData || claimedDevice) return;
    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownTimerRef.current);
  }, [open, pairingData, claimedDevice]);

  // Polling for claim status
  useEffect(() => {
    if (!open || !pairingData || claimedDevice || timeLeft <= 0) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await getPairingStatus();
        const status = res.data || res;
        if (status?.claimed) {
          clearInterval(pollTimerRef.current);
          clearInterval(countdownTimerRef.current);
          setClaimedDevice(status.claimedDevice || "New device");
          push?.("New device linked successfully!", "success");
          setTimeout(() => {
            onDeviceLinked?.();
            onClose?.();
          }, 1800);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(pollTimerRef.current);
  }, [open, pairingData, claimedDevice, timeLeft, onDeviceLinked, onClose, push]);

  const handleCopyCode = () => {
    if (!pairingData?.code) return;
    navigator.clipboard.writeText(pairingData.code).then(() => {
      setCopied(true);
      push?.("Pairing code copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = async () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (!claimedDevice && pairingData) {
      cancelPairingCode().catch(() => {});
    }
    onClose?.();
  };

  const formattedCode = pairingData?.code
    ? `${pairingData.code.slice(0, 4)} - ${pairingData.code.slice(4)}`
    : "•••• - ••••";

  const isExpired = timeLeft <= 0;
  const progressPercent = Math.max(0, (timeLeft / 120) * 100);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Link a New Device"
      description="Scan this QR code or enter the code on your second device to log in instantly"
      size="md"
    >
      <div className="flex flex-col items-center space-y-4 sm:space-y-5">
        {loading ? (
          <div className="p-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-violet-600 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500">Generating secure pairing code…</span>
          </div>
        ) : claimedDevice ? (
          <div className="p-6 flex flex-col items-center text-center animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 grid place-items-center text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Device Connected!</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Successfully linked <span className="font-semibold text-zinc-800 dark:text-zinc-200">{claimedDevice}</span> to your account.
            </p>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div className="relative flex justify-center w-full">
              <QRCodeDisplay
                value={pairingData?.url || ""}
                size={170}
                copyValue={pairingData?.url || ""}
                showControls={false}
              />

              {isExpired && (
                <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 animate-fade-in">
                  <AlertCircle size={22} className="text-amber-500 mb-1" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">Code Expired</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5 mb-2.5">Pairing codes expire in 2 minutes for security.</p>
                  <Button size="sm" onClick={loadCode} className="text-xs py-1 px-2.5">
                    <RefreshCw size={12} /> Generate new code
                  </Button>
                </div>
              )}
            </div>

            {/* 8-character Code Box */}
            <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-3 sm:p-4 flex flex-col items-center">
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
                Or enter this code on your device
              </span>
              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-1.5 w-full">
                <span className="font-mono text-xl sm:text-2xl md:text-3xl font-bold tracking-wider text-zinc-900 dark:text-white select-all text-center">
                  {formattedCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={isExpired}
                  className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-200 transition disabled:opacity-40 shrink-0"
                  title="Copy Code"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Countdown and Progress */}
            <div className="w-full max-w-sm flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Waiting for device connection…
                </span>
                <span className="font-mono font-medium">
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 rounded-full ${
                    timeLeft < 30 ? "bg-amber-500" : "bg-violet-600"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Steps & Guidance */}
            <div className="w-full text-[11px] text-zinc-500 dark:text-zinc-400 bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/10 rounded-xl p-3 space-y-1">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Sparkles size={12} className="text-violet-600 dark:text-violet-400" /> How it works
              </div>
              <p>1. Open Stockly on your second device.</p>
              <p>2. Choose <strong>Device Code / QR</strong> on the login screen.</p>
              <p>3. Enter the 8-character code or scan the QR code to log in.</p>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadCode}
                disabled={loading}
                className="text-xs"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
