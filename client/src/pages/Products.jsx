import React, { useEffect, useState } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct, bulkDeleteProducts, bulkUpdateProducts } from "../api/products";
import { getCategories } from "../api/categories";
import { getSuppliers } from "../api/suppliers";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Button from "../components/ui/Button";
import Badge, { getProductStatus } from "../components/ui/Badge";
import ProductActionMenu from "../components/products/ProductActionMenu";
import ProductFormModal from "../components/products/ProductFormModal";
import { useToast } from "../context/ToastContext";
import { useSearch } from "../context/SearchContext";
import {
  Plus, Trash2, Package, Layers,
  CheckSquare, Square, ArrowUpDown, ChevronLeft,
  ChevronRight, ArrowRight
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { TableSkeleton, EmptyState } from "../components/ui/Loader";
import { Select } from "../components/ui/Input";

const PAGE_SIZES = [10, 25, 50, 100];

export default function Products() {
  const { push } = useToast();
  const { search } = useSearch();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedCategory, setSelectedCategory] = useState("");
  const initialFilter = searchParams.get("filter") === "low" || searchParams.get("filter") === "low-stock" ? "low" : "";
  const [stockStatusFilter, setStockStatusFilter] = useState(initialFilter);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategoryModal, setBulkCategoryModal] = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState("");
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modals & Single Operations
  const [showModal, setShowModal] = useState(searchParams.get("action") === "add");
  const [editing, setEditing] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copiedSku, setCopiedSku] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category", selectedCategory);
      if (stockStatusFilter) params.set("stockStatus", stockStatusFilter);
      params.set("sort", sortBy);
      params.set("order", sortOrder);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await getProducts(`?${params.toString()}`);
      setProducts(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (e) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCategories().then((r) => setCategories(r.data || [])).catch(() => {});
    getSuppliers().then((r) => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [search, selectedCategory, stockStatusFilter, sortBy, sortOrder, page, limit]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, selectedCategory, stockStatusFilter, sortBy, sortOrder]);

  // Selection handlers
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrent = () => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p._id)));
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkDeleteProducts(ids);
      push(res.message || `Deleted ${ids.length} products`, "success");
      setSelectedIds(new Set());
      setBulkDeleteModal(false);
      fetchData();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (!selectedIds.size || !bulkCategoryTarget) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateProducts(ids, { category: bulkCategoryTarget });
      push(res.message || `Updated category for ${ids.length} products`, "success");
      setSelectedIds(new Set());
      setBulkCategoryModal(false);
      setBulkCategoryTarget("");
      fetchData();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Create / Edit modal
  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setShowModal(true);
  };

  const handleSubmitProduct = async (formData) => {
    setFormSubmitting(true);
    try {
      if (editing) {
        await updateProduct(editing._id, formData);
        push("Product updated successfully", "success");
      } else {
        await createProduct(formData);
        push("Product created successfully", "success");
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      push(e.message || "Failed to save product", "error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(deleteTarget._id);
      push("Product deleted", "success");
      setDeleteTarget(null);
      fetchData();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const copySku = (sku) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            {pagination.total || products.length} items in catalog
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus size={15} /> New product
        </Button>
      </div>

      {/* Category pills + sort */}
      <div className="card p-3 space-y-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory("")}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              !selectedCategory
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <Layers size={13} /> All
          </button>
          {categories.map((c) => {
            const isActive = selectedCategory === c._id;
            return (
              <button
                key={c._id}
                onClick={() => setSelectedCategory(isActive ? "" : c._id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  isActive
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                    isActive ? "bg-white/20 dark:bg-zinc-900/10 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300"
                  }`}
                >
                  {c.name[0].toUpperCase()}
                </span>
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
            <ArrowUpDown size={13} /> Sort
          </span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split("-");
              setSortBy(sort);
              setSortOrder(order);
            }}
            className="flex-1 min-w-0 text-xs bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg px-2.5 py-2 text-zinc-700 dark:text-zinc-200 outline-none"
          >
            <option value="createdAt-desc">Newest first</option>
            <option value="createdAt-asc">Oldest first</option>
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="quantity-desc">Stock (high–low)</option>
            <option value="quantity-asc">Stock (low–high)</option>
            <option value="price-desc">Price (high–low)</option>
            <option value="price-asc">Price (low–high)</option>
          </select>
          <button
            onClick={selectAllCurrent}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition shrink-0"
          >
            {selectedIds.size === products.length && products.length > 0 ? (
              <CheckSquare size={15} className="text-zinc-900 dark:text-white" />
            ) : (
              <Square size={15} />
            )}
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading && products.length === 0 ? (
        <TableSkeleton rows={5} />
      ) : !products.length ? (
        <EmptyState
          icon={Package}
          title="No products found"
          hint={
            search || selectedCategory || stockStatusFilter
              ? "Nothing matches the current filters. Try clearing them."
              : "Your catalog is empty. Add your first product to get started."
          }
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> Create product
            </Button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {products.map((p, idx) => {
              const isSelected = selectedIds.has(p._id);
              const status = getProductStatus(p);
              return (
                <div
                  key={p._id}
                  style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
                  className={`stagger-item px-3.5 py-3 flex items-center gap-3 transition ${
                    isSelected ? "bg-zinc-100/70 dark:bg-zinc-800/60" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(p._id)}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition shrink-0"
                    aria-label="Select product"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-zinc-900 dark:text-white" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>

                  <Link
                    to={`/products/${p._id}`}
                    className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0"
                  >
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={18} className="text-zinc-400" />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/products/${p._id}`}
                        className="text-sm font-semibold truncate text-zinc-900 dark:text-white hover:underline min-w-0"
                      >
                        {p.name}
                      </Link>
                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <div className="text-right leading-tight">
                          <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                            {p.quantity} <span className="font-normal text-zinc-500">{p.unit}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500">min {p.minimumStock ?? 5}</div>
                        </div>
                        <Badge status={status} size="sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500 min-w-0">
                      <span className="truncate">
                        {p.category?.name || "Uncategorized"}
                        {p.supplier?.name && ` • ${p.supplier.name}`}
                      </span>
                      {p.price > 0 && (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                          ₹{Number(p.price).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    <div className="sm:hidden flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white">
                        {p.quantity} {p.unit}
                      </span>
                      <Badge status={status} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <Link
                      to={`/products/${p._id}`}
                      className="w-9 h-9 hidden sm:grid place-items-center rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="View details"
                    >
                      <ArrowRight size={15} />
                    </Link>
                    <ProductActionMenu
                      product={p}
                      onEdit={openEdit}
                      onDelete={(prod) => setDeleteTarget(prod)}
                      onCopySku={copySku}
                      copiedSku={copiedSku}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="card p-3 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500 truncate">
            Page <span className="font-bold text-zinc-800 dark:text-zinc-200">{pagination.page}</span> of{" "}
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{pagination.pages}</span>
            <span className="hidden sm:inline"> • {pagination.total} items</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg px-2 py-1.5 text-zinc-600 dark:text-zinc-300 outline-none"
              aria-label="Items per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 pl-4 pr-2 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-[95vw] animate-slide-up">
          <span className="text-xs font-bold shrink-0">{selectedIds.size} selected</span>
          <span className="h-4 w-px bg-white/20 dark:bg-zinc-300" />
          <button
            onClick={() => setBulkCategoryModal(true)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl hover:bg-white/10 dark:hover:bg-zinc-900/5 transition shrink-0"
          >
            Change category
          </button>
          <button
            onClick={() => setBulkDeleteModal(true)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition shrink-0 flex items-center gap-1"
          >
            <Trash2 size={13} /> Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-semibold px-2 py-1.5 rounded-xl opacity-60 hover:opacity-100 transition shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleteLoading}
        title="Delete product?"
        description={deleteTarget ? `"${deleteTarget.name}" will be permanently removed from inventory.` : ""}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmModal
        open={bulkDeleteModal}
        onClose={() => !bulkActionLoading && setBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
        title={`Delete ${selectedIds.size} products?`}
        description="Selected products will be permanently removed. This cannot be undone."
        confirmLabel={`Delete ${selectedIds.size} items`}
        variant="danger"
      />

      <Modal
        open={bulkCategoryModal}
        onClose={() => !bulkActionLoading && setBulkCategoryModal(false)}
        title="Change category"
        description={`Reassign ${selectedIds.size} selected products`}
        size="sm"
      >
        <div className="space-y-4">
          <Select label="New category" value={bulkCategoryTarget} onChange={(e) => setBulkCategoryTarget(e.target.value)}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBulkCategoryModal(false)} disabled={bulkActionLoading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBulkCategoryUpdate} loading={bulkActionLoading} disabled={!bulkCategoryTarget} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      <ProductFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmitProduct}
        editingProduct={editing}
        categories={categories}
        suppliers={suppliers}
        loading={formSubmitting}
      />
    </div>
  );
}
