import { useState, useCallback, useMemo, memo } from 'react';
import { List } from 'react-window';
import '../assets/css/ProductDashboard.css';

const PRODUCT_COUNT = 5000;
const ROW_HEIGHT = 56;
const LIST_HEIGHT = 600;

// ── Generate initial product dataset ────────────────────────────
const generateProducts = () =>
  Array.from({ length: PRODUCT_COUNT }, (_, i) => ({
    id: i + 1,
    name: `Product #${i + 1}`,
    stock: 10,
  }));

// ── Memoized row component (react-window v2) ────────────────────
const ProductRow = memo(({ index, style, ariaAttributes, products, onUpdate }) => {
  const product = products[index];
  const isOutOfStock = product.stock <= 0;

  return (
    <div className="pd-row" style={style} {...ariaAttributes}>
      <span className="pd-row-name">{product.name}</span>
      <span className="pd-row-stock">
        <span
          className={`pd-row-stock-dot${isOutOfStock ? ' pd-row-stock-dot--empty' : ''}`}
        />
        Stock: <strong>{product.stock}</strong>
      </span>
      <button
        className={`pd-btn ${isOutOfStock ? 'pd-btn--disabled' : 'pd-btn--primary'}`}
        onClick={() => onUpdate(product.id)}
        disabled={isOutOfStock}
        aria-label={`Update stock for ${product.name}`}
      >
        {isOutOfStock ? 'Out' : '− Update'}
      </button>
    </div>
  );
});

ProductRow.displayName = 'ProductRow';

// ── Dashboard component ─────────────────────────────────────────
export default function ProductDashboard() {
  const [products, setProducts] = useState(generateProducts);

  // Stable callback — never breaks child memoization
  const onUpdate = useCallback((id) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
      )
    );
  }, []);

  // Memoized rowProps — spread into each row component
  const rowProps = useMemo(
    () => ({ products, onUpdate }),
    [products, onUpdate]
  );

  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + p.stock, 0),
    [products]
  );

  return (
    <div className="pd-page">
      <div className="pd-container">
        {/* ── Header ──────────────────────────────────────── */}
        <header className="pd-header">
          <div>
            <h1 className="pd-title">Product Dashboard</h1>
            <p className="pd-subtitle">
              Manage inventory for{' '}
              <strong>{PRODUCT_COUNT.toLocaleString()}</strong> products
            </p>
          </div>
          <div className="pd-stats">
            <div className="pd-stat">
              <span className="pd-stat-value">
                {PRODUCT_COUNT.toLocaleString()}
              </span>
              <span className="pd-stat-label">Products</span>
            </div>
            <div className="pd-stat">
              <span className="pd-stat-value">
                {totalStock.toLocaleString()}
              </span>
              <span className="pd-stat-label">Total Stock</span>
            </div>
          </div>
        </header>

        {/* ── Table card ──────────────────────────────────── */}
        <div className="pd-card">
          <div className="pd-table-head">
            <span>Product Name</span>
            <span>Stock</span>
            <span>Action</span>
          </div>

          <List
            className="pd-list"
            defaultHeight={LIST_HEIGHT}
            rowCount={products.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={ProductRow}
            rowProps={rowProps}
            overscanCount={10}
            style={{
              height: LIST_HEIGHT,
              overflow: 'auto',
              position: 'relative',
            }}
          />
        </div>
      </div>
    </div>
  );
}
