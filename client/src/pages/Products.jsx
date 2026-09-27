import React, { useEffect, useState } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct, bulkDeleteProducts, bulkUpdateProducts, uploadProductImage } from "../api/products";
import { getCategories } from "../api/categories";
import { getSuppliers } from "../api/suppliers";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge, { getProductStatus } from "../components/ui/Badge";
import ProductActionMenu from "../components/products/ProductActionMenu";
import ProductFormModal from "../components/products/ProductFormModal";
import { useToast } from "../context/ToastContext";
import { useSearch } from "../context/SearchContext";
import {
  Plus, Trash2, Edit2, Package, AlertTriangle, CheckCircle2, Layers,
  Image as ImageIcon, CheckSquare, Square, ArrowUpDown, ChevronLeft,
  ChevronRight, ArrowRight, ExternalLink, Loader2, Copy, Check
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import FAB from "../components/ui/FAB";
import { StatsSkeleton } from "../components/ui/Loader";

export default function Products(){
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

  const fetchData = async ()=>{
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if(search) params.set("search", search);
      if(selectedCategory) params.set("category", selectedCategory);
      if(stockStatusFilter) params.set("stockStatus", stockStatusFilter);
      params.set("sort", sortBy);
      params.set("order", sortOrder);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await getProducts(`?${params.toString()}`);
      setProducts(res.data || []);
      if(res.pagination) {
        setPagination(res.pagination);
      }
    } catch(e) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    getCategories().then(r=> setCategories(r.data||[])).catch(()=>{});
    getSuppliers().then(r=> setSuppliers(r.data||[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    fetchData();
  },[search, selectedCategory, stockStatusFilter, sortBy, sortOrder, page, limit]);

  // Reset page to 1 when filters change
  useEffect(()=>{
    setPage(1);
    setSelectedIds(new Set());
  }, [search, selectedCategory, stockStatusFilter, sortBy, sortOrder]);

  const stats = {
    total: pagination.total || products.length,
    inStock: products.filter(p=> getProductStatus(p)==="In Stock").length,
    low: products.filter(p=> getProductStatus(p)==="Low Stock").length,
    out: products.filter(p=> getProductStatus(p)==="Out of Stock").length,
  };

  // Selection handlers
  const toggleSelect = (id)=>{
    setSelectedIds(prev => {
      const next = new Set(prev);
      if(next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCurrent = ()=>{
    if(selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p._id)));
    }
  };

  // Bulk Actions
  const handleBulkDelete = async ()=>{
    if(!selectedIds.size) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkDeleteProducts(ids);
      push(res.message || `Deleted ${ids.length} products`, "success");
      setSelectedIds(new Set());
      setBulkDeleteModal(false);
      fetchData();
    } catch(e) {
      push(e.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCategoryUpdate = async ()=>{
    if(!selectedIds.size || !bulkCategoryTarget) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkUpdateProducts(ids, { category: bulkCategoryTarget });
      push(res.message || `Updated category for ${ids.length} products`, "success");
      setSelectedIds(new Set());
      setBulkCategoryModal(false);
      setBulkCategoryTarget("");
      fetchData();
    } catch(e) {
      push(e.message, "error");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Create / Edit modal
  const openCreate = ()=>{
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (p)=>{
    setEditing(p);
    setShowModal(true);
  };

  const handleSubmitProduct = async (formData)=>{
    setFormSubmitting(true);
    try {
      if(editing){
        await updateProduct(editing._id, formData);
        push("Product updated successfully","success");
      } else {
        await createProduct(formData);
        push("Product created successfully","success");
      }
      setShowModal(false);
      fetchData();
    } catch(e){
      push(e.message || "Failed to save product","error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const doDelete = async ()=>{
    if(!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(deleteTarget._id);
      push("Product deleted","success");
      setDeleteTarget(null);
      fetchData();
    } catch(e) {
      push(e.message,"error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const copySku = (sku)=>{
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(()=> setCopiedSku(null), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">Products</h1>
          <p className="text-[13px] sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Enterprise inventory management • <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pagination.total || products.length} items cataloged</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} size="sm">
            <Plus size={15}/> New product
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {loading && products.length===0 ? <StatsSkeleton /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {[
            { label:"Total", value: stats.total, icon: Package, statusKey:"" },
            { label:"In Stock", value: stats.inStock, icon: CheckCircle2, statusKey:"in" },
            { label:"Low Stock", value: stats.low, icon: AlertTriangle, statusKey:"low" },
            { label:"Out of Stock", value: stats.out, icon: Layers, statusKey:"out" },
          ].map((s,i)=>(
            <button
              key={s.label}
              onClick={()=> setStockStatusFilter(prev => prev === s.statusKey ? "" : s.statusKey)}
              className={`card p-3 sm:p-4 text-left transition-all ${
                stockStatusFilter === s.statusKey && s.statusKey !== ""
                  ? "ring-2 ring-zinc-900 dark:ring-white bg-zinc-50 dark:bg-zinc-800"
                  : "hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center shrink-0">
                  <s.icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 truncate">{s.label}</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white leading-none mt-1">{s.value}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Controls: Categories, Sorting & Filters */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1 pb-1 md:pb-0" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={()=> setSelectedCategory("")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                !selectedCategory
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <Layers size={13}/> All Categories
            </button>
            {categories.map(c=>{
              const isActive = selectedCategory === c._id;
              return (
                <button
                  key={c._id}
                  onClick={()=> setSelectedCategory(isActive ? "" : c._id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    isActive
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-semibold"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${isActive ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                    {c.name[0].toUpperCase()}
                  </span>
                  {c.name}
                </button>
              )
            })}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <ArrowUpDown size={13} />
              <span>Sort:</span>
            </div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={e=> {
                const [sort, order] = e.target.value.split("-");
                setSortBy(sort);
                setSortOrder(order);
              }}
              className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 outline-none"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="quantity-desc">Stock (High-Low)</option>
              <option value="quantity-asc">Stock (Low-High)</option>
              <option value="price-desc">Price (High-Low)</option>
              <option value="price-asc">Price (Low-High)</option>
            </select>
          </div>
        </div>

        {/* Selection Bar & Quick Bulk Actions */}
        {products.length > 0 && (
          <div className="flex items-center justify-between px-2 text-xs text-zinc-500">
            <button
              onClick={selectAllCurrent}
              className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-900 dark:hover:text-white transition"
            >
              {selectedIds.size === products.length && products.length > 0 ? (
                <CheckSquare size={14} className="text-zinc-900 dark:text-white" />
              ) : (
                <Square size={14} />
              )}
              {selectedIds.size > 0 ? `Selected ${selectedIds.size} of ${products.length}` : "Select all on page"}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={()=> setSelectedIds(new Set())}
                className="hover:underline text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Products List */}
      {loading && products.length === 0 ? (
        <div className="grid gap-3">
          {[1,2,3,4].map(i=> (
            <div key={i} className="card p-5 animate-pulse flex gap-4">
              <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded"/>
                <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded"/>
              </div>
            </div>
          ))}
        </div>
      ) : !products.length ? (
        <Card className="py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
            <Package size={28}/>
          </div>
          <p className="mt-5 font-semibold text-zinc-900 dark:text-white">No products found</p>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
            {search || selectedCategory || stockStatusFilter
              ? "No products match the selected filters. Try clearing filters or search keywords."
              : "Your inventory catalog is currently empty. Get started by adding your first product."}
          </p>
          <Button onClick={openCreate} className="mt-6">
            <Plus size={16}/> Create product
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p)=>{
            const isSelected = selectedIds.has(p._id);
            return (
              <div
                key={p._id}
                className={`card transition-all duration-200 overflow-visible ${
                  isSelected
                    ? "border-zinc-900 dark:border-white ring-1 ring-zinc-900 dark:ring-white bg-zinc-50/60 dark:bg-zinc-800/40"
                    : "hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                {/* MOBILE CARD VIEW (< sm: 640px) */}
                <div className="block sm:hidden p-3.5 space-y-3">
                  {/* Top Row: Select Checkbox, Image, Name & Action Menu */}
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(p._id)}
                      className="w-7 h-7 -ml-1 mt-0.5 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition shrink-0"
                      aria-label="Select product"
                    >
                      {isSelected ? (
                        <CheckSquare size={17} className="text-zinc-900 dark:text-white" />
                      ) : (
                        <Square size={17} />
                      )}
                    </button>

                    {/* Image Thumbnail */}
                    <Link
                      to={`/products/${p._id}`}
                      className="w-11 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/90 dark:border-zinc-700/80 overflow-hidden grid place-items-center shrink-0 group shadow-xs"
                    >
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </Link>

                    {/* Name & Supplier */}
                    <div className="flex-1 min-w-0 pr-1">
                      <Link
                        to={`/products/${p._id}`}
                        className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-white line-clamp-2 hover:underline leading-snug"
                      >
                        {p.name}
                      </Link>
                      {p.supplier?.name && (
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                          {p.supplier.name}
                        </div>
                      )}
                    </div>

                    {/* Action Dropdown */}
                    <ProductActionMenu
                      product={p}
                      onEdit={openEdit}
                      onDelete={(prod) => setDeleteTarget(prod)}
                      onCopySku={copySku}
                      copiedSku={copiedSku}
                      className="shrink-0 -mr-1 -mt-0.5"
                    />
                  </div>

                  {/* Middle Row: Badges (SKU, Category, Price) */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {p.sku && (
                      <button
                        type="button"
                        onClick={() => copySku(p.sku)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/70 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                        title="Click to copy SKU"
                      >
                        {copiedSku === p.sku ? (
                          <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy size={10} className="text-zinc-400" />
                        )}
                        <span>{p.sku}</span>
                      </button>
                    )}

                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-300 text-[11px] font-medium truncate max-w-[130px]">
                      {p.category?.name || "Uncategorized"}
                    </span>

                    {p.price > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold ml-auto">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: Stock Quantity & Status Badge */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Stock:</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">
                        {p.quantity} <span className="text-xs font-normal text-zinc-500">{p.unit}</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        (min {p.minimumStock ?? 5})
                      </span>
                    </div>

                    <div className="shrink-0">
                      <Badge status={getProductStatus(p)} size="sm" />
                    </div>
                  </div>
                </div>

                {/* DESKTOP ROW VIEW (>= sm: 640px) */}
                <div className="hidden sm:flex items-center gap-3.5 lg:gap-4 p-4 lg:p-5">
                  {/* Select Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(p._id)}
                    className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition shrink-0"
                    aria-label="Select product"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-zinc-900 dark:text-white" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>

                  {/* Product Image */}
                  <Link
                    to={`/products/${p._id}`}
                    className="w-13 h-13 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0 group shadow-xs"
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <span className="text-xl">📦</span>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/products/${p._id}`}
                        className="font-semibold text-sm tracking-tight truncate text-zinc-900 dark:text-white hover:underline flex items-center gap-1.5"
                      >
                        {p.name}
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-zinc-400" />
                      </Link>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-2 mt-1 flex-wrap">
                      {p.sku && (
                        <button
                          type="button"
                          onClick={() => copySku(p.sku)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                          title="Click to copy SKU"
                        >
                          {copiedSku === p.sku ? (
                            <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy size={10} />
                          )}
                          {p.sku}
                        </button>
                      )}
                      <span className="truncate">
                        {p.category?.name || "Uncategorized"} • {p.unit} {p.supplier?.name && `• ${p.supplier.name}`}
                      </span>
                      {p.price > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                          ₹{Number(p.price).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Level column */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                      {p.quantity} <span className="text-xs font-normal text-zinc-500">{p.unit}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">min {p.minimumStock ?? 5}</div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    <Badge status={getProductStatus(p)} />
                  </div>

                  {/* Action Dropdown Menu & Details Link */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/products/${p._id}`}
                      className="w-9 h-9 grid place-items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                      title="View details & movement"
                    >
                      <ArrowRight size={14} />
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
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {pagination && pagination.pages > 1 && (
        <div className="card p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="text-xs text-zinc-500">
            Showing Page <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pagination.page}</span> of <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pagination.pages}</span> ({pagination.total} total items)
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={e=> { setLimit(Number(e.target.value)); setPage(1); }}
              className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-700 dark:text-zinc-300"
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={()=> setPage(p => Math.max(1, p-1))}
            >
              <ChevronLeft size={14}/> Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={()=> setPage(p => p+1)}
            >
              Next <ChevronRight size={14}/>
            </Button>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-zinc-700/50 animate-slide-up max-w-[95vw]">
          <span className="text-xs font-bold px-2 py-1 rounded-lg bg-white/20 dark:bg-zinc-900/10 shrink-0">
            {selectedIds.size} Selected
          </span>
          <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />
          <button
            onClick={()=> setBulkCategoryModal(true)}
            className="text-xs font-medium hover:underline flex items-center gap-1.5 shrink-0"
          >
            <Layers size={13}/> Change Category
          </button>
          <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />
          <button
            onClick={()=> setBulkDeleteModal(true)}
            className="text-xs font-medium text-red-400 dark:text-red-600 hover:underline flex items-center gap-1.5 shrink-0"
          >
            <Trash2 size={13}/> Delete
          </button>
        </div>
      )}

      {/* FAB */}
      {!showModal && !deleteTarget && <FAB onClick={openCreate} label="Add product" />}

      {/* Delete Single Product Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={()=> !deleteLoading && setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleteLoading}
        title="Delete product?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.name}" and remove it from active inventory.` : ""}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Bulk Delete Modal */}
      <ConfirmModal
        open={bulkDeleteModal}
        onClose={()=> !bulkActionLoading && setBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
        title={`Delete ${selectedIds.size} products?`}
        description={`This will permanently remove ${selectedIds.size} selected products from your inventory catalog. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} items`}
        variant="danger"
      />

      {/* Bulk Category Change Modal */}
      <Modal
        open={bulkCategoryModal}
        onClose={()=> !bulkActionLoading && setBulkCategoryModal(false)}
        title="Bulk Change Category"
        description={`Reassign ${selectedIds.size} selected products to a new category`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">New Category</label>
            <select
              value={bulkCategoryTarget}
              onChange={e=> setBulkCategoryTarget(e.target.value)}
              className="input-field"
            >
              <option value="">Select target category</option>
              {categories.map(c=> (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={()=> setBulkCategoryModal(false)} disabled={bulkActionLoading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBulkCategoryUpdate} loading={bulkActionLoading} disabled={!bulkCategoryTarget} className="flex-1">
              Apply to {selectedIds.size} items
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Modal */}
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
  )
}
