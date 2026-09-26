import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download, QrCode as QrIcon } from "lucide-react";
import { useToast } from "../../context/ToastContext";

export default function QRCodeDisplay({
  value,
  size = 200,
  copyValue = "",
  showControls = true,
  title = "",
  description = "",
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: "#18181b", // zinc-900
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        setDataUrl(url);
        setError(null);
      })
      .catch((err) => {
        console.error("QR Code generation error:", err);
        setError("Failed to generate QR code");
      });
  }, [value, size]);

  const handleCopy = () => {
    const textToCopy = copyValue || value;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      push?.("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `stockly-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    push?.("QR Code downloaded", "success");
  };

  return (
    <div className="flex flex-col items-center">
      {title && <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">{title}</h4>}
      {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 text-center">{description}</p>}

      <div className="relative p-3 bg-white rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700/60 inline-flex flex-col items-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Pairing QR Code"
            className="rounded-xl object-contain"
            style={{ width: size, height: size }}
          />
        ) : error ? (
          <div
            className="grid place-items-center bg-zinc-50 rounded-xl text-xs text-red-500 p-4 text-center"
            style={{ width: size, height: size }}
          >
            {error}
          </div>
        ) : (
          <div
            className="grid place-items-center bg-zinc-50 rounded-xl"
            style={{ width: size, height: size }}
          >
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showControls && dataUrl && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-95"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-95"
          >
            <Download size={13} />
            Save image
          </button>
        </div>
      )}
    </div>
  );
}
