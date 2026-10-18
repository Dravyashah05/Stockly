import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { validateProductInput, useStore } from '@stockly/shared-client/store';
import type { Product } from '@stockly/shared-types';
import { Field, PrimaryBtn, Sheet, inputCls } from '../components/ui';

/** Decode a picked file to something drawable, honouring EXIF orientation
 *  (phone photos otherwise come out rotated). Throws on unreadable files
 *  such as HEIC on WebViews without a decoder. */
function decodeFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() =>
        loadViaElement(file),
      );
    }
  } catch {
    /* createImageBitmap threw synchronously (old WebViews) — fall through */
  }
  return loadViaElement(file);
}

function loadViaElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/** Some Android pickers / camera captures return an empty MIME type for
 *  perfectly valid photos — fall back to the file extension instead of
 *  rejecting the pick outright. */
function looksLikeImage(file: File): boolean {
  if (file.type && file.type.trim() !== '') return file.type.startsWith('image/');
  return /\.(jpe?g|png|gif|webp|bmp|avif|hei[cf]|svg)$/i.test(file.name || '');
}

/** ImageBitmap uses .width/.height, HTMLImageElement uses naturalWidth/
 *  naturalHeight (.width can be 0 when the img isn't in the DOM). */
function intrinsicSize(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  const s = src as HTMLImageElement & ImageBitmap;
  const w = Number(s.naturalWidth ?? s.width ?? 0);
  const h = Number(s.naturalHeight ?? s.height ?? 0);
  return { w: Math.floor(w || 0), h: Math.floor(h || 0) };
}

/** Compress a picked photo to a small JPEG data URL safe for a Sheet cell. */
async function compressImage(file: File): Promise<string> {
  if (!looksLikeImage(file)) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image is too large (max 15 MB).');
  }
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decodeFile(file);
  } catch {
    throw new Error(
      /hei[cf]/i.test(`${file.type} ${file.name || ''}`)
        ? 'This photo format (HEIC) can\'t be read here — take a screenshot or pick a JPEG instead.'
        : 'Could not read this image — try a different photo or paste a link.',
    );
  }
  try {
    const { w: srcW, h: srcH } = intrinsicSize(src);
    if (!srcW || !srcH) throw new Error('Could not read this image.');
    // Google Sheets cells hold max 50k chars — stay well under it.
    for (const [side, q] of [[640, 0.72], [480, 0.65], [320, 0.6], [240, 0.55]] as const) {
      const scale = Math.min(1, side / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      // JPEG has no alpha: fill white so transparent PNGs don't turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      try {
        ctx.drawImage(src, 0, 0, w, h);
      } catch {
        continue;
      }
      let out = '';
      try {
        out = canvas.toDataURL('image/jpeg', q);
      } catch {
        continue;
      }
      if (out && out.startsWith('data:image/jpeg') && out.length < 45000) {
        return out;
      }
    }
    throw new Error('Could not shrink this image enough — try a smaller photo or paste a link.');
  } finally {
    if (typeof (src as ImageBitmap).close === 'function') (src as ImageBitmap).close();
  }
}

function slugSku(name: string): string {
  const slug =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 12) || 'ITEM';
  return slug;
}

function genSku(name: string, taken: Set<string>): string {
  const base = slugSku(name);
  for (let i = 0; i < 20; i++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const sku = `${base}-${suffix}`;
    if (!taken.has(sku)) return sku;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

export default function ProductForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Product | null;
}) {
  const { products, saveProduct, categories, notify } = useStore();
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [upload, setUpload] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [minStock, setMinStock] = useState('5');
  const [stockQty, setStockQty] = useState('0');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setErr(null);
      setUpload('');
      setUploading(false);
      if (editing) {
        setName(editing.name);
        if (editing.image.startsWith('data:image/')) {
          setUpload(editing.image);
          setImage('');
        } else {
          setImage(editing.image || '');
        }
        setMinStock(String(editing.minimumStock));
        setStockQty(String(editing.currentStock));
        const p = editing.sellingPrice > 0 ? editing.sellingPrice : editing.costPrice;
        setPrice(p > 0 ? String(p) : '');
        setDescription(editing.description || '');
        setCategoryId(editing.categoryId || '');
      } else {
        setName('');
        setImage('');
        setMinStock('5');
        setStockQty('0');
        setPrice('');
        setDescription('');
        setCategoryId('');
      }
    }
  }, [open, editing]);

  const takenSkus = useMemo(
    () => new Set(products.map((p) => String(p.sku).toUpperCase())),
    [products],
  );

  // Live preview of the auto-generated SKU (add mode only).
  const autoSku = editing ? editing.sku : name.trim() ? `${slugSku(name)}-····` : 'on save';

  /** Effective image: uploaded photo wins over pasted URL. */
  const imageValue = upload || image.trim();
  const imageOk = imageValue !== '' && (/^https?:\/\//i.test(imageValue) || imageValue.startsWith('data:image/'));

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setUploading(true);
    try {
      const dataUrl = await compressImage(f);
      setUpload(dataUrl);
      setImage('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read this image.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return setErr('Product name is required.');
    const min = Math.floor(Number(minStock));
    if (!Number.isInteger(min) || min < 0 || minStock.trim() === '')
      return setErr('Minimum stock must be a whole number ≥ 0.');
    const qty = Math.floor(Number(stockQty));
    if (!Number.isInteger(qty) || qty < 0 || stockQty.trim() === '')
      return setErr('Stock qty must be a whole number ≥ 0.');
    let unitPrice = 0;
    if (price.trim() !== '') {
      unitPrice = Number(price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0)
        return setErr('Price must be 0 or more, or left blank.');
    }
    if (imageValue && !/^https?:\/\//i.test(imageValue) && !imageValue.startsWith('data:image/'))
      return setErr('Image must be an uploaded photo or a valid http(s) URL, or left blank.');

    const sku = editing ? editing.sku : genSku(trimmedName, takenSkus);

    const problem = validateProductInput(
      {
        name: trimmedName,
        sku,
        categoryId,
        description: description.trim(),
        image: imageValue,
        costPrice: unitPrice,
        sellingPrice: unitPrice,
        currentStock: qty,
        minimumStock: min,
      },
      { isNew: !editing },
    );
    if (problem) {
      setErr(problem);
      return;
    }

    setErr(null);
    setBusy(true);
    const ok = await saveProduct(
      {
        name: trimmedName,
        sku,
        categoryId,
        description: description.trim(),
        image: imageValue,
        costPrice: unitPrice,
        sellingPrice: unitPrice,
        currentStock: qty,
        minimumStock: min,
      },
      editing?.id,
    );
    setBusy(false);
    if (ok) onClose();
    else notify('Could not save — check the error message.', 'error');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit product' : 'Add product'}
      footer={
        <PrimaryBtn onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
        </PrimaryBtn>
      }
    >
      <div className="product-form-grid space-y-5">
        {/* 1 — Product name */}
        <div className="product-form-name">
          <Field
            label="Product name *"
            hint={editing ? `SKU: ${editing.sku}` : `SKU auto-generated: ${autoSku}`}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Basmati Rice 5kg"
              className={inputCls}
            />
          </Field>
        </div>

        {/* 2 — Image */}
        <div className="product-form-image">
          <Field label="Product image">
            <div className="flex items-center gap-3">
              {imageOk ? (
                <img
                  src={imageValue}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-2xl border border-(--stroke-dim) object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="glass-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-(--ink-3)">
                  <ImagePlus size={22} />
                </span>
              )}
              <div className="flex min-w-0 flex-1 gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="press glass-soft flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-[14px] font-bold text-(--ink) disabled:opacity-50"
                >
                  <Upload size={16} />
                  {uploading ? 'Shrinking…' : upload ? 'Replace photo' : 'Upload photo'}
                </button>
                {upload ? (
                  <button
                    type="button"
                    onClick={() => setUpload('')}
                    aria-label="Remove uploaded photo"
                    className="press glass-soft flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl text-rose-500 dark:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp"
              className="hidden"
              aria-label="Upload product photo"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            {!upload ? (
              <div className="relative mt-2.5">
                <Link2 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-3)" />
                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="…or paste image link"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={`${inputCls} pl-10`}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-(--ink-2)">
                Photo stored with the product · ~{(upload.length / 1024).toFixed(0)} KB · syncs to all devices
              </p>
            )}
          </Field>
        </div>

        {/* Min / qty / price — one related group with equal-width fields */}
        <div className="product-form-stock">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Minimum stock *" hint="Low-stock alert level">
              <input
                value={minStock}
                onChange={(e) => setMinStock(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="5"
                className={inputCls}
              />
            </Field>
            <Field label={editing ? 'Stock qty *' : 'Opening stock *'}>
              <input
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <Field label="Price (optional)" hint="Saved as both cost & selling price.">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="e.g. 120"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* 4 — Description */}
        <div className="product-form-description">
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details…"
              className={`${inputCls} resize-none`}
            />
          </Field>
        </div>

        {/* 5 — Category */}
        <div className="product-form-category">
          <Field
            label="Category"
            hint={categories.length === 0 ? 'No categories yet — add them in Settings.' : undefined}
          >
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {err ? (
          <div className="animate-pop-in rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13.5px] font-medium text-rose-600 dark:text-rose-300">
            {err}
          </div>
        ) : null}

      </div>
    </Sheet>
  );
}
