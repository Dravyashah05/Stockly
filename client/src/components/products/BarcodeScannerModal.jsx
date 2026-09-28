import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  SwitchCamera,
  AlertCircle,
  X,
  Check,
  Sparkles,
  Barcode,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { playScanSound, playSuccessSound, playStockInSound, playStockOutSound } from "../../utils/sound";
import { hapticSuccess, hapticMedium, hapticLight } from "../../utils/haptics";

export default function BarcodeScannerModal({
  open,
  onClose,
  products = [],
  onSelectProduct,
  onQuickStockIn,
  onQuickStockOut,
  onAddProductWithSku,
}) {
  const containerId = "stockly-barcode-scanner";
  const scannerRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [hasPermission, setHasPermission] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isStarting, setIsStarting] = useState(true);
  const [detectedCode, setDetectedCode] = useState("");
  const [matchedProduct, setMatchedProduct] = useState(null);

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

  const handleScanSuccess = useCallback(
    (decodedText) => {
      if (!decodedText) return;
      const clean = decodedText.trim();
      setDetectedCode(clean);
      playScanSound();
      hapticSuccess();

      // Find product matching barcode or SKU or _id
      const match = products.find(
        (p) =>
          p.sku?.toLowerCase() === clean.toLowerCase() ||
          p.barcode?.toLowerCase() === clean.toLowerCase() ||
          p._id === clean ||
          p.name?.toLowerCase() === clean.toLowerCase()
      );

      setMatchedProduct(match || null);
    },
    [products]
  );

  const startScannerWithCamera = useCallback(
    async (cameraId) => {
      setIsStarting(true);
      setErrorMsg("");
      try {
        await stopScanner();

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ];

        const html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
        };

        const cameraParam = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: "environment" };

        await html5QrCode.start(
          cameraParam,
          config,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
        setHasPermission(true);
        setIsStarting(false);
      } catch (err) {
        console.error("Camera start error:", err);
        setErrorMsg(err?.message || "Could not access camera. Please allow camera access.");
        setHasPermission(false);
        setIsStarting(false);
      }
    },
    [handleScanSuccess, stopScanner]
  );

  useEffect(() => {
    if (!open) {
      stopScanner();
      setDetectedCode("");
      setMatchedProduct(null);
      return;
    }

    setDetectedCode("");
    setMatchedProduct(null);
    setIsStarting(true);

    // Guard against the async camera lookup resolving after close —
    // without this the camera can start (and stay held) behind the modal.
    let cancelled = false;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find((d) =>
            /back|rear|environment/i.test(d.label || "")
          );
          const chosenId = backCam ? backCam.id : devices[0].id;
          setCurrentCameraId(chosenId);
          startScannerWithCamera(chosenId);
        } else {
          startScannerWithCamera(null);
        }
      })
      .catch(() => {
        if (!cancelled) startScannerWithCamera(null);
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

  const handleQuickIn = () => {
    if (!matchedProduct) return;
    hapticMedium();
    playStockInSound();
    onQuickStockIn?.(matchedProduct);
    onClose();
  };

  const handleQuickOut = () => {
    if (!matchedProduct) return;
    hapticMedium();
    playStockOutSound();
    onQuickStockOut?.(matchedProduct);
    onClose();
  };

  const handleSelect = () => {
    if (!matchedProduct) return;
    hapticLight();
    onSelectProduct?.(matchedProduct);
    onClose();
  };

  const handleCreateNewSku = () => {
    hapticMedium();
    onAddProductWithSku?.(detectedCode);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        stopScanner();
        onClose?.();
      }}
      title="Barcode Scanner"
      description="Scan 1D/2D product barcodes or QR labels"
      size="sm"
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Scanner Viewport */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-inner">
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Viewfinder Overlay */}
          {!errorMsg && !detectedCode && (
            <div className="absolute inset-0 pointer-events-none grid place-items-center">
              <div className="w-64 h-36 border-2 border-white/70 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner Accents */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />

                {/* Laser scan line */}
                <div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse"
                  style={{ top: "50%" }}
                />
              </div>
            </div>
          )}

          {/* Error State */}
          {errorMsg && (
            <div className="absolute inset-0 bg-zinc-900/95 p-6 flex flex-col items-center justify-center text-center z-10">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 grid place-items-center text-red-400 mb-2">
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
                className="mt-3 text-xs !bg-zinc-800 !text-white !border-zinc-700"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Loading Indicator */}
          {isStarting && !errorMsg && (
            <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-400 z-10">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-xs">Connecting camera…</span>
            </div>
          )}
        </div>

        {/* Scan Result Card */}
        {detectedCode && (
          <div className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Scanned Code
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                {detectedCode}
              </span>
            </div>

            {matchedProduct ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                      {matchedProduct.name}
                    </h4>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      SKU: {matchedProduct.sku} • Stock: <strong className="text-zinc-900 dark:text-white">{matchedProduct.quantity ?? 0}</strong> units
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                      ₹{Number(matchedProduct.price || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleQuickIn}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowDownRight size={15} />
                    <span>Stock In (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickOut}
                    className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpRight size={15} />
                    <span>Stock Out (−)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>Unregistered barcode: {detectedCode}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewSku}
                  className="w-full p-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs shadow-md shadow-violet-600/25 active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <Plus size={15} />
                  <span>Create Product</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Controls */}
        <div className="w-full flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          {cameras.length > 1 ? (
            <button
              type="button"
              onClick={switchCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <SwitchCamera size={14} />
              Switch Camera
            </button>
          ) : (
            <span className="text-[11px] text-zinc-400">1D & 2D Barcodes</span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              stopScanner();
              onClose?.();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
