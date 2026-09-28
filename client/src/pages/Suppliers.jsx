import { useEffect, useState } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../api/suppliers";
import { getProducts } from "../api/products";
import { useToast } from "../context/ToastContext";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Button from "../components/ui/Button";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  Package,
} from "lucide-react";
import { Link } from "react-router-dom";
import FAB from "../components/ui/FAB";
import { Input, Textarea, SearchInput } from "../components/ui/Input";
import { EmptyState } from "../components/ui/Loader";

export default function Suppliers() {
  const { push } = useToast();
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", email: "", address: "" });
  const [delTarget, setDelTarget] = useState(null);
  const [loadingDel, setLoadingDel] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        getSuppliers(search),
        getProducts({ limit: 100 }).catch(() => ({ data: [] })),
      ]);
      setList(sRes.data || sRes || []);
      setProducts(pRes.data || pRes || []);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", contact: "", email: "", address: "" });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      contact: s.contact || "",
      email: s.email || "",
      address: s.address || "",
    });
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return push("Supplier name is required", "error");
    setSubmitting(true);
    try {
      if (editing) await updateSupplier(editing._id, form);
      else await createSupplier(form);
      push(editing ? "Supplier updated" : "Supplier created", "success");
      setShowModal(false);
      load();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!delTarget) return;
    setLoadingDel(true);
    try {
      await deleteSupplier(delTarget._id);
      push("Supplier deleted", "success");
      setDelTarget(null);
      load();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setLoadingDel(false);
    }
  };

  const fmtCurrency = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{list.length} vendors • purchase contacts</p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus size={15} /> <span className="hidden sm:inline">New supplier</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email…" />

      {/* 3. SUPPLIER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {list.map((s, idx) => {
          const sProducts = products.filter(
            (p) => String(p.supplier?._id || p.supplier || "") === String(s._id)
          );
          const productCount = sProducts.length;
          const totalStock = sProducts.reduce((a, b) => a + Number(b.quantity || 0), 0);
          const totalValue = sProducts.reduce(
            (a, b) => a + Number(b.quantity || 0) * Number(b.price || 0),
            0
          );

          return (
            <div
              key={s._id}
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
              className="stagger-item card overflow-hidden hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-sm shrink-0 shadow-xs">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                        <Package size={12} className="text-zinc-400" />
                        <span>{productCount} products supplied</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 grid place-items-center active:scale-95 transition"
                      title="Edit Supplier"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDelTarget(s)}
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 active:scale-95 transition grid place-items-center"
                      title="Delete Supplier"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Contact information pills */}
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  {s.contact && (
                    <a
                      href={`tel:${s.contact}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold hover:bg-emerald-100 transition"
                    >
                      <Phone size={11} /> {s.contact}
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-semibold hover:bg-blue-100 transition truncate max-w-[200px]"
                    >
                      <Mail size={11} /> {s.email}
                    </a>
                  )}
                  {s.address && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      <MapPin size={11} className="text-zinc-400" /> {s.address}
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics bar */}
              <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30">
                <Link
                  to="/products"
                  className="p-3 text-center hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Products
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {productCount}
                  </div>
                </Link>

                <div className="p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Total Units
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {totalStock.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Stock Value
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {fmtCurrency(totalValue)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!list.length && !loading && (
          <EmptyState
            icon={Building2}
            title="No suppliers found"
            hint="Add vendors to link purchases and track supply."
            action={
              <Button onClick={openCreate}>
                <Plus size={15} /> Add supplier
              </Button>
            }
          />
        )}
      </div>

      {/* Floating Action Button */}
      {!showModal && !delTarget && <FAB onClick={openCreate} label="Add supplier" />}

      {/* Create / edit */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit supplier" : "New supplier"}
        description={editing ? "Update contact details" : "Just a name — the rest is optional"}
        size="sm"
      >
        <div className="space-y-3.5">
          <Input
            label="Supplier name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Apex Distributors"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              type="tel"
              inputMode="tel"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="+91…"
            />
            <Input
              label="Email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@…"
            />
          </div>
          <Textarea
            label="Address (optional)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="City, State…"
          />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} className="flex-1">
              {editing ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!delTarget}
        onClose={() => !loadingDel && setDelTarget(null)}
        onConfirm={doDelete}
        loading={loadingDel}
        title="Delete supplier?"
        description={
          delTarget ? `Delete "${delTarget.name}"? Products will retain their records.` : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
