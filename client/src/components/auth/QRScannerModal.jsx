import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, SwitchCamera, AlertCircle, X, Check, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export function parseQRResult(decodedText) {
  if (!decodedText || typeof decodedText !== "string") return null;
  const raw = decodedText.trim();

  // 1. JSON Payload check
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.ticketId || parsed.pin) {
        return {
          type: "ticket",
          ticketId: parsed.ticketId || "",
          pin: parsed.pin || "",
          raw,
        };
      }
    }
  } catch {}

  // 2. URL check (e.g. /login?code=ABCDEFGH&key=XYZ or full http://...)
  try {
    let urlObj = null;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      urlObj = new URL(raw);
    } else if (raw.includes("?code=") || raw.startsWith("/login?")) {
      urlObj = new URL(raw, "http://localhost");
    }

    if (urlObj) {
      const code = urlObj.searchParams.get("code");
      const key = urlObj.searchParams.get("key");
      const ticket = urlObj.searchParams.get("ticket") || urlObj.searchParams.get("ticketId");
      if (code) {
        return {
          type: "pairing_code",
          code: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
          key: key || "",
          raw,
        };
      }
      if (ticket) {
        return {
          type: "ticket",
          ticketId: ticket,
          raw,
        };
      }
    }
  } catch {}

  // 3. Raw alphanumeric code (6 or 8 chars)
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 8) {
    return {
      type: "pairing_code",
      code: clean,
      key: "",
      raw,
    };
  }
  if (clean.length === 6) {
    return {
      type: "ticket_pin",
      pin: clean,
      raw,
    };
  }

  // Fallback raw string
  return {
    type: "unknown",
    raw,
  };
}

export default function QRScannerModal({ open, onClose, onScan, title = "Scan QR Code", description = "Point your camera at the QR code on the other screen" }) {
  const containerId = "stockly-qr-reader";
  const scannerRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [hasPermission, setHasPermission] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isStarting, setIsStarting] = useState(true);
  const [scannedSuccess, setScannedSuccess] = useState(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Failed to stop scanner cleanly:", err);
      }
      scannerRef.current = null;
    }
  }, []);

  const handleScanSuccess = useCallback(async (decodedText) => {
    if (scannedSuccess) return;
    setScannedSuccess(true);
    const parsed = parseQRResult(decodedText);
    await stopScanner();
    onScan?.(parsed, decodedText);
  }, [onScan, stopScanner, scannedSuccess]);

  const startScannerWithCamera = useCallback(async (cameraId) => {
    setIsStarting(true);
    setErrorMsg("");
    try {
      await stopScanner();

      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame error (ignore frequent frame misses)
        }
      );
      setHasPermission(true);
      setIsStarting(false);
    } catch (err) {
      console.error("Camera start error:", err);
      setErrorMsg(err?.message || "Could not access camera. Please grant camera permission.");
      setHasPermission(false);
      setIsStarting(false);
    }
  }, [handleScanSuccess, stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setScannedSuccess(false);
      return;
    }

    setScannedSuccess(false);
    setIsStarting(true);

    // Guard against the async camera lookup resolving after close —
    // without this the camera can start (and stay held) behind the modal.
    let cancelled = false;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if found
          const backCam = devices.find((d) =>
            /back|rear|environment/i.test(d.label || "")
          );
          const chosenId = backCam ? backCam.id : devices[0].id;
          setCurrentCameraId(chosenId);
          startScannerWithCamera(chosenId);
        } else {
          // Try with facingMode default
          startScannerWithCamera(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("getCameras error, falling back to facingMode:", err);
          startScannerWithCamera(null);
        }
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, startScannerWithCamera, stopScanner]);

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setCurrentCameraId(nextCamId);
    startScannerWithCamera(nextCamId);
  };

  return (
    <Modal open={open} onClose={() => { stopScanner(); onClose?.(); }} title={title} description={description} size="sm">
      <div className="flex flex-col items-center">
        <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
          {/* html5-qrcode mount target */}
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Viewfinder overlay */}
          {!errorMsg && !scannedSuccess && (
            <div className="absolute inset-0 pointer-events-none grid place-items-center">
              <div className="w-56 h-56 border-2 border-white/60 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                {/* Corner highlights */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-violet-500 rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-violet-500 rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-violet-500 rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-violet-500 rounded-br-xl" />

                {/* Animated scan beam */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-bounce" style={{ animationDuration: "2s" }} />
              </div>
            </div>
          )}

          {/* Success overlay */}
          {scannedSuccess && (
            <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-sm grid place-items-center animate-fade-in z-20">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 grid place-items-center text-emerald-400 animate-scale-in">
                  <Check size={24} />
                </div>
                <span className="text-sm font-semibold">QR Code Scanned!</span>
              </div>
            </div>
          )}

          {/* Error / Permission Blocked state */}
          {errorMsg && (
            <div className="absolute inset-0 bg-zinc-900/95 p-6 flex flex-col items-center justify-center text-center z-10">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 grid place-items-center text-red-400 mb-3">
                <AlertCircle size={22} />
              </div>
              <h4 className="text-sm font-semibold text-white">Camera Access Required</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-[240px] leading-relaxed">
                {errorMsg}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => startScannerWithCamera(currentCameraId)}
                className="mt-4 text-xs !bg-zinc-800 !text-white !border-zinc-700 hover:!bg-zinc-700"
              >
                Try again
              </Button>
            </div>
          )}

          {/* Loading / Starting indicator */}
          {isStarting && !errorMsg && (
            <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-400 z-10">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
              <span className="text-xs">Starting camera…</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full flex items-center justify-between gap-3 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {cameras.length > 1 ? (
            <button
              type="button"
              onClick={switchCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <SwitchCamera size={14} />
              Switch camera
            </button>
          ) : (
            <span className="text-xs text-zinc-400">Position QR code inside frame</span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              stopScanner();
              onClose?.();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
