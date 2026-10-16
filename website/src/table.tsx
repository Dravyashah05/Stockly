import { memo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney } from "./shared/config";
import { stockStatus } from "./shared/store";
import type { Product } from "./shared/types";

function ProductTable({
  products,
  onStock,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onStock: (x: { product: Product; type: "IN" | "OUT" }) => void;
  onEdit: (p: Product) => void;
  onDelete?: (p: Product) => void;
}) {
  return (
    <>
      <div className="table-scroll products-table-wrap">
        <table aria-label="Inventory products">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                p={p}
                onStock={onStock}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
        {!products.length && <p className="empty">No products to show.</p>}
      </div>
      {/* Card layout for narrow screens: same data + actions, no sideways scroll. */}
      <div className="product-cards">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            onStock={onStock}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {!products.length && <p className="empty">No products to show.</p>}
      </div>
    </>
  );
}

type RowProps = {
  p: Product;
  onStock: (x: { product: Product; type: "IN" | "OUT" }) => void;
  onEdit: (p: Product) => void;
  onDelete?: (p: Product) => void;
};

function StockTag({ p }: { p: Product }) {
  const st = stockStatus(p);
  return (
    <span className={st === "ok" ? "tag green" : "tag orange"}>
      {p.currentStock} {st === "low" ? "· Low" : ""}
      {st === "out" ? "· Out" : ""}
    </span>
  );
}

function RowActions({ p, onStock, onEdit, onDelete }: RowProps) {
  return (
    <div className="row-actions">
      <button
        title={`Stock in ${p.name}`}
        aria-label={`Stock in ${p.name}`}
        onClick={() => onStock({ product: p, type: "IN" })}
      >
        <TrendingUp size={16} />
      </button>
      <button
        title={`Stock out ${p.name}`}
        aria-label={`Stock out ${p.name}`}
        disabled={p.currentStock <= 0}
        onClick={() => onStock({ product: p, type: "OUT" })}
      >
        <TrendingDown size={16} />
      </button>
      <button onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}>Edit</button>
      {onDelete && (
        <button
          className="delete-action"
          aria-label={`Delete ${p.name}`}
          onClick={() => onDelete(p)}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function ProductRow({ p, onStock, onEdit, onDelete }: RowProps) {
  return (
    <tr>
      <td>
        <strong>{p.name}</strong>
        <small>{p.description}</small>
      </td>
      <td>{p.sku || "—"}</td>
      <td>{p.categoryName || "Uncategorized"}</td>
      <td>
        <StockTag p={p} />
      </td>
      <td>{formatMoney(p.sellingPrice)}</td>
      <td>
        <RowActions p={p} onStock={onStock} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function ProductCard({ p, onStock, onEdit, onDelete }: RowProps) {
  return (
    <article className="product-card" aria-label={p.name}>
      <div className="product-card-head">
        <div className="min-w-0">
          <strong>{p.name}</strong>
          <small>
            {[p.sku, p.categoryName || "Uncategorized"].filter(Boolean).join(" · ")}
          </small>
        </div>
        <StockTag p={p} />
      </div>
      <div className="product-card-meta">
        <span>
          Stock <strong>{p.currentStock}</strong>
        </span>
        <span>
          Price <strong>{formatMoney(p.sellingPrice)}</strong>
        </span>
      </div>
      <div className="product-card-foot">
        <RowActions p={p} onStock={onStock} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </article>
  );
}

/* Memoized: the catalog re-renders only when its rows or callbacks change,
 * not on unrelated store ticks (toasts, sync banners, polling). Callers
 * must pass stable callbacks (setState setters or useCallback). */
export default memo(ProductTable);
