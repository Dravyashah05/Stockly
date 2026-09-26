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
  Search,
  Package,
  Layers,
  Coins,
  X,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import FAB from "../components/ui/FAB";

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
    <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Suppliers & Vendors
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage procurement contacts, purchase linkages, and supplier catalog
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs sm:text-sm shadow-sm hover:bg-zinc-800 active:scale-95 transition min-h-[42px]"
        >
          <Plus size={16} /> New Supplier
        </button>
      </div>

      {/* 2. SEARCH BAR */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers by name, phone, email or address..."
          className="input-field pl-10 h-11 text-xs sm:text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 3. SUPPLIER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {list.map((s) => {
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
              className="card p-0 overflow-hidden border border-zinc-200/80 dark:border-zinc-800 hover:shadow-md transition flex flex-col justify-between"
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
          <div className="col-span-full card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
              <Building2 size={22} />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-3">
              No suppliers found
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Add your vendors to link purchases and supplier analytics.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold"
            >
              + Add First Supplier
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {!showModal && !delTarget && <FAB onClick={openCreate} label="Add supplier" />}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Supplier" : "Add New Supplier"}
        size="md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Supplier Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field h-11 text-xs font-semibold"
              placeholder="e.g. Apex Global Distributors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Contact Phone
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="input-field h-11 text-xs"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field h-11 text-xs"
                placeholder="contact@supplier.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Office / Warehouse Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="input-field text-xs resize-none"
              placeholder="City, State, Country..."
            />
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="w-full sm:w-1/3 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              loading={submitting}
              className="w-full sm:w-2/3 min-h-[44px]"
            >
              {editing ? "Save Changes" : "Create Supplier"}
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
