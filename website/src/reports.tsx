import { memo, useMemo } from "react";
import { formatMoney } from "./shared/config";
import type { Product, StockTransaction } from "./shared/types";

function Reports({
  transactions,
  products,
  onLoadOlder,
  loadingMore,
  exhausted,
}: {
  transactions: StockTransaction[];
  products: Product[];
  onLoadOlder: () => void;
  loadingMore: boolean;
  exhausted: boolean;
}) {
  // Aggregates recomputed only when the underlying arrays change — never on
  // unrelated store ticks (sync banners, toasts, polling).
  const { added, removed, catalogValue } = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const t of transactions) {
      if (t.type === "IN") added += t.quantity;
      else removed += t.quantity;
    }
    let catalogValue = 0;
    for (const p of products) catalogValue += p.currentStock * p.costPrice;
    return { added, removed, catalogValue };
  }, [transactions, products]);
  if (transactions.length === 0 && products.length === 0) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>No activity to report yet</h2>
            <p className="muted">Reports build themselves from your real data.</p>
          </div>
        </div>
        <p className="empty">
          Add products to your catalog, then record stock movements — received
          units, removals, and net movement will appear here with a
          downloadable CSV.
        </p>
      </section>
    );
  }
  function exportCsv() {
    const rows = [
      ["Date", "Product", "Type", "Quantity", "Price", "Reason"],
      ...transactions.map((t) => [
        new Date(t.createdAt).toISOString(),
        t.productName,
        t.type,
        String(t.quantity),
        String(t.price),
        t.reason,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockly-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <span>Units received</span>
          <strong>{added}</strong>
        </article>
        <article className="stat-card">
          <span>Units removed</span>
          <strong>{removed}</strong>
        </article>
        <article className="stat-card">
          <span>Net movement</span>
          <strong>{added - removed}</strong>
        </article>
        <article className="stat-card">
          <span>Catalog value</span>
          <strong>{formatMoney(catalogValue)}</strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventory activity report</h2>
            <p className="muted">Based on the synced transaction history</p>
          </div>
          <button className="outline-btn" onClick={exportCsv}>
            Download CSV
          </button>
        </div>
        <p className="muted">
          {transactions.length} loaded transactions · {products.length} products
        </p>
        {!exhausted && (
          <button
            className="outline-btn"
            disabled={loadingMore}
            onClick={onLoadOlder}
          >
            {loadingMore ? "Loading…" : "Load older transactions"}
          </button>
        )}
      </section>
    </>
  );
}

export default memo(Reports);
