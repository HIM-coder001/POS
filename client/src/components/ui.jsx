/**
 * Shared micro-components used across all pages.
 * Import only what you need: import { Modal, Pagination, EmptyState } from '../components/ui';
 */

// ── Page layout shell ─────────────────────────────────────────────────────────
import Sidebar from './Sidebar';
import TopNav  from './TopNav';

export function PageLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f0f2f5' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title={title} subtitle={subtitle} />
        <div className="flex-1 overflow-y-auto p-gutter space-y-md">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, width = 'max-w-lg', children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/50 backdrop-blur-[2px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-overlay w-full ${width} animate-scale-in max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-xl py-lg border-b border-black/[0.06]">
          <h3 className="text-title-md font-bold text-on-surface">{title}</h3>
          <button onClick={onClose} className="btn-icon">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        <div className="p-xl">{children}</div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = 'search_off', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-2xl text-center gap-sm">
      <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">{icon}</span>
      {title && <p className="text-title-sm font-semibold text-on-surface">{title}</p>}
      {message && <p className="text-body-sm text-on-surface-variant/70 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
export function SkeletonRows({ count = 5, cols = 5 }) {
  return Array(count).fill(0).map((_, i) => (
    <tr key={i}>
      {Array(cols).fill(0).map((_, j) => (
        <td key={j} className="px-md py-md">
          <div className={`h-4 bg-black/[0.06] rounded-lg animate-pulse ${j === 0 ? 'w-32' : j === cols - 1 ? 'w-16' : 'w-24'}`} />
        </td>
      ))}
    </tr>
  ));
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, showing, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between px-md py-sm bg-[#fafafa] border-t border-black/[0.05] text-[12px] text-on-surface-variant">
      <span>
        {showing != null ? `Showing ${showing} of ${total}` : `Page ${page} of ${pages}`}
      </span>
      <div className="flex gap-xs">
        <button disabled={page <= 1} onClick={onPrev}
          className="px-md py-xs bg-white border border-outline-variant/60 rounded-lg hover:bg-surface-container-low disabled:opacity-40 transition-colors">
          ‹ Prev
        </button>
        <span className="px-md py-xs bg-primary text-on-primary rounded-lg font-bold min-w-[36px] text-center">{page}</span>
        <button disabled={page >= pages} onClick={onNext}
          className="px-md py-xs bg-white border border-outline-variant/60 rounded-lg hover:bg-surface-container-low disabled:opacity-40 transition-colors">
          Next ›
        </button>
      </div>
    </div>
  );
}

// ── Stock badge ───────────────────────────────────────────────────────────────
export function StockBadge({ stock, reorderLevel }) {
  if (stock === 0) return <span className="badge badge-red">Out of Stock</span>;
  if (stock <= reorderLevel) return <span className="badge badge-amber">Low Stock</span>;
  return <span className="badge badge-green">Active</span>;
}

// ── Loyalty tier badge ────────────────────────────────────────────────────────
const TIER_STYLES = {
  Platinum: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200/60',
  Gold:     'bg-amber-50  text-amber-700  ring-1 ring-amber-200/60',
  Silver:   'bg-gray-100  text-gray-600   ring-1 ring-gray-200/60',
  Bronze:   'bg-orange-50 text-orange-700 ring-1 ring-orange-200/60',
};
export function TierBadge({ tier }) {
  return (
    <span className={`badge ${TIER_STYLES[tier] ?? TIER_STYLES.Bronze}`}>{tier}</span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ name = 'U', size = 8, gradient = true }) {
  const sizeClass = `w-${size} h-${size}`;
  return (
    <div className={`${sizeClass} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm select-none
      ${gradient ? 'bg-gradient-to-br from-primary to-blue-600' : 'bg-primary'}`}
      style={{ fontSize: `${size * 1.6}px` }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/40"
        style={{ fontSize: '18px' }}>search</span>
      <input value={value} onChange={onChange} placeholder={placeholder}
        className="input pl-[40px]" />
    </div>
  );
}
