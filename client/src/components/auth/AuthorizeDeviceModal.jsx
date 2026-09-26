import { useState } from "react";
import { ShieldCheck, Laptop, Smartphone, Monitor, AlertTriangle, Camera, Check, X, QrCode } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import QRScannerModal from "./QRScannerModal";
import OTPInput from "../ui/OTPInput";
import { getTicketInfo, authorizeLoginTicket, rejectLoginTicket } from "../../api/auth";
import { useToast } from "../../context/ToastContext";

export default function AuthorizeDeviceModal({ open, onClose, onAuthorized }) {
  const [pin, setPin] = useState("");
  const [ticketInfo, setTicketInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { push } = useToast();

  const handleLookup = async (lookupIdentifier) => {
    const id = (lookupIdentifier || pin).trim();
    if (!id) return push?.("Please enter a PIN or scan a QR code", "error");
    setLoading(true);
    try {
      const res = await getTicketInfo(id);
      const data = res.data || res;
      setTicketInfo(data);
    } catch (err) {
      push?.(err.message || "Login request not found or expired", "error");
      setTicketInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (parsed) => {
    setShowScanner(false);
    if (!parsed) return;
    const identifier = parsed.ticketId || parsed.pin || parsed.raw;
    if (parsed.pin) setPin(parsed.pin);
    handleLookup(identifier);
  };

  const handleAuthorize = async () => {
    if (!ticketInfo) return;
    setActionLoading(true);
    try {
      await authorizeLoginTicket({
        ticketId: ticketInfo.ticketId,
        pin: ticketInfo.pin,
      });
      push?.("Device authorized successfully!", "success");
      onAuthorized?.();
      handleClose();
    } catch (err) {
      push?.(err.message || "Failed to authorize device", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!ticketInfo) return;
    setActionLoading(true);
    try {
      await rejectLoginTicket({
        ticketId: ticketInfo.ticketId,
        pin: ticketInfo.pin,
      });
      push?.("Device request declined", "info");
      handleClose();
    } catch (err) {
      push?.(err.message || "Failed to decline request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setPin("");
    setTicketInfo(null);
    onClose?.();
  };

  const device = ticketInfo?.deviceInfo;
  const DeviceIcon = device?.isMobile
    ? Smartphone
    : device?.os === "Windows" || device?.os === "macOS"
    ? Laptop
    : Monitor;

  return (
    <>
      <Modal
        open={open && !showScanner}
        onClose={handleClose}
        title="Authorize New Device"
        description="Approve a sign-in request from another computer, tablet, or browser"
        size="md"
      >
        <div className="space-y-5">
          {!ticketInfo ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="text-center">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Enter the 6-character PIN shown on the requesting screen:
                </span>
              </div>

              <div className="w-full flex justify-center py-2">
                <OTPInput
                  value={pin}
                  onChange={(val) => {
                    setPin(val);
                    if (val.length === 6) {
                      handleLookup(val);
                    }
                  }}
                  length={6}
                  separator=""
                  autoFocus={true}
                  placeholder="••••••"
                />
              </div>

              <div className="flex items-center gap-3 w-full my-2">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowScanner(true)}
                className="w-full justify-center gap-2 py-3"
              >
                <Camera size={16} /> Scan QR Code with Camera
              </Button>

              <div className="flex gap-2 w-full pt-2">
                <Button variant="secondary" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleLookup(pin)}
                  loading={loading}
                  disabled={pin.length < 6}
                  className="flex-1"
                >
                  Verify PIN
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-scale-in">
              {/* Device Card Preview */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 grid place-items-center text-violet-600 dark:text-violet-300 shrink-0">
                  <DeviceIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {device?.device || "New Device"}
                  </h4>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{device?.browser || "Browser"}</span> • <span>{device?.os || "OS"}</span>
                    {device?.ip && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                        {device.ip}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1.5">
                    PIN: <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">{ticketInfo.pin}</span>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Only approve this request if you recognize this device. Approving will grant full access to your Stockly workspace.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <Button
                  variant="secondary"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 !text-red-600 dark:!text-red-400 !border-red-200 dark:!border-red-500/20 hover:!bg-red-50"
                >
                  <X size={14} /> Decline
                </Button>
                <Button
                  onClick={handleAuthorize}
                  loading={actionLoading}
                  className="flex-1 !bg-violet-600 hover:!bg-violet-700 !text-white"
                >
                  <Check size={14} /> Approve Device
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <QRScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title="Scan Login QR"
        description="Point camera at the QR code displayed on your other device"
      />
    </>
  );
}
