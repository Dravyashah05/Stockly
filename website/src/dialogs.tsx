import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ProductFormInput } from "./shared/store";
import type { Product } from "./shared/types";

/* Product + stock + confirm dialogs. Imported lazily by the workspace shell
 * (React.lazy + Suspense at the usage site): most visits never open them,
 * so they ride in their own chunk instead of the initial bundle. */

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function ProductDialog({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: Product | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (input: ProductFormInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  useEscapeToClose(onClose);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await onSave({
        name: String(f.get("name")),
        sku: String(f.get("sku")),
        categoryId: String(f.get("categoryId")),
        description: String(f.get("description")),
        image: "",
        costPrice: Number(f.get("costPrice")),
        sellingPrice: Number(f.get("sellingPrice")),
        currentStock: Number(f.get("currentStock")),
        minimumStock: Number(f.get("minimumStock")),
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div className="dialog-head">
          <h2 id="product-dialog-title">{item ? "Edit product" : "Add product"}</h2>
          <button type="button" onClick={onClose} aria-label="Close product form">
            <X size={18} />
          </button>
        </div>
        <label>
          Product name
          <input name="name" required defaultValue={item?.name} />
        </label>
        <div className="two-col">
          <label>
            SKU
            <input name="sku" defaultValue={item?.sku} />
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={item?.categoryId || ""}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <input name="description" defaultValue={item?.description} />
        </label>
        <div className="two-col">
          <label>
            Cost price
            <input
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item?.costPrice ?? 0}
            />
          </label>
          <label>
            Selling price
            <input
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item?.sellingPrice ?? 0}
            />
          </label>
        </div>
        <div className="two-col">
          <label>
            Current stock
            <input
              name="currentStock"
              type="number"
              min="0"
              defaultValue={item?.currentStock ?? 0}
            />
          </label>
          <label>
            Low stock threshold
            <input
              name="minimumStock"
              type="number"
              min="0"
              defaultValue={item?.minimumStock ?? 0}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="outline-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StockDialog({
  data,
  onClose,
  onSubmit,
}: {
  data: { product: Product; type: "IN" | "OUT" };
  onClose: () => void;
  onSubmit: (q: number, r: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  useEscapeToClose(onClose);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await onSubmit(Number(f.get("quantity")), String(f.get("reason") || ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="stock-dialog-title">
        <div className="dialog-head">
          <h2 id="stock-dialog-title">Stock {data.type === "IN" ? "in" : "out"}</h2>
          <button type="button" onClick={onClose} aria-label="Close stock adjustment">
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          {data.product.name} · Available: {data.product.currentStock}
        </p>
        <label>
          Quantity
          <input
            name="quantity"
            type="number"
            min="1"
            max={data.type === "OUT" ? data.product.currentStock : undefined}
            required
          />
        </label>
        {data.type === "OUT" && (
          <label>
            Reason
            <select name="reason">
              <option>Sale</option>
              <option>Damaged</option>
              <option>Lost</option>
              <option>Return</option>
              <option>Other</option>
            </select>
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" className="outline-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" disabled={busy}>
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Accessible replacement for blocking window.confirm(): same destructive
 * intent, with focus semantics, Escape, scrim-dismiss and a visible label. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeToClose(onCancel);
  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-body">
        <div className="dialog-head">
          <h2 id="confirm-dialog-title">{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>
        <p className="muted" id="confirm-dialog-body">{body}</p>
        <div className="dialog-actions">
          <button type="button" className="outline-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
