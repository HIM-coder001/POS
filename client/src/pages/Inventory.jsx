import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustVal, setAdjustVal] = useState(0);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/inventory', { params });
      setProducts(data.products);
      setStats(data.stats);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInventory(); }, [statusFilter]);

  const handleAdjust = async () => {
    try {
      await api.put(`/inventory/${adjustModal._id}/adjust`, { adjustment: adjustVal, reason: 'Manual adjustment' });
      toast.success('Stock adjusted');
      setAdjustModal(null);
      setAdjustVal(0);
      fetchInventory();
    } catch (err) { toast.error(err.response?.data?.message || 'Adjustment failed'); }
  };

  const statCards = [
    { label: 'Total Stock Value', value: fmt(stats.totalValue), icon: 'warehouse', color: 'bg-primary/10 text-primary' },
    { label: 'Total Items', value: stats.totalItems ?? '—', icon: 'inventory_2', color: 'bg-secondary-container/20 text-secondary' },
    { label: 'Low Stock', value: stats.lowStockCount ?? '—', icon: 'trending_down', color: 'bg-yellow-100 text-yellow-800' },
    { label: 'Out of Stock', value: stats.outOfStockCount ?? '—', icon: 'remove_shopping_cart', color: 'bg-error-container/20 text-error' },
  ];

  const statusBadge = (p) => {
    if (p.stock === 0) return <span className="badge-red">Out of Stock</span>;
    if (p.stock <= p.reorderLevel) return <span className="badge-amber">Low Stock ({p.stock})</span>;
    return <span className="badge-green">In Stock ({p.stock})</span>;
  };

  const stockPercent = (p) => Math.min(100, p.reorderLevel > 0 ? (p.stock / (p.reorderLevel * 3)) * 100 : 100);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Inventory Management" />
        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h1 className="text-headline-lg font-bold text-on-surface">Inventory Management</h1>
              <p className="text-body-sm text-on-surface-variant">Monitor stock levels and manage warehouse operations</p>
            </div>
            <button className="btn-primary"><span className="material-symbols-outlined text-xl">add_shopping_cart</span>Purchase Order</button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {statCards.map(s => (
              <div key={s.label} className="kpi-card animate-fade-in">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider">{s.label}</p>
                <p className="text-currency font-bold font-mono text-primary">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-sm">
            {[['', 'All Items'], ['ok', 'In Stock'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={`px-lg py-sm rounded-full text-body-sm font-medium transition-all ${
                  statusFilter === v ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Inventory Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-head">
                  <tr>
                    {['Product','SKU','Category','Stock Level','Status','Supplier','Actions'].map(h =>
                      <th key={h} className="px-md py-md">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-md py-lg"><div className="h-8 bg-surface-container-high rounded animate-pulse" /></td></tr>
                  )) : products.map(p => (
                    <tr key={p._id} className="table-row group">
                      <td className="px-md py-md">
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-outline text-sm">inventory_2</span>
                          </div>
                          <span className="text-body-sm font-semibold text-on-surface">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-md py-md font-mono text-label-sm text-outline">{p.sku}</td>
                      <td className="px-md py-md"><span className="badge-blue">{p.category}</span></td>
                      <td className="px-md py-md">
                        <div className="w-32">
                          <div className="flex justify-between mb-unit text-xs">
                            <span className="font-mono font-bold">{p.stock}</span>
                            <span className="text-outline">/ {p.reorderLevel * 3}</span>
                          </div>
                          <div className="w-full bg-surface-container-high rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${
                              p.stock === 0 ? 'bg-error' : p.stock <= p.reorderLevel ? 'bg-yellow-500' : 'bg-tertiary-fixed-dim'
                            }`} style={{ width: `${stockPercent(p)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-md py-md">{statusBadge(p)}</td>
                      <td className="px-md py-md text-body-sm text-on-surface-variant">
                        {p.supplier?.name || '—'}
                        {p.supplier?.reliabilityScore && (
                          <span className={`ml-sm text-xs font-bold ${p.supplier.reliabilityScore >= 80 ? 'text-on-tertiary-container' : p.supplier.reliabilityScore >= 60 ? 'text-yellow-600' : 'text-error'}`}>
                            {p.supplier.reliabilityScore}%
                          </span>
                        )}
                      </td>
                      <td className="px-md py-md">
                        <button onClick={() => { setAdjustModal(p); setAdjustVal(0); }}
                          className="btn-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined text-sm">tune</span>Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-fade-in">
            <h3 className="text-title-md font-bold text-on-surface mb-sm">Adjust Stock</h3>
            <p className="text-body-sm text-on-surface-variant mb-lg">{adjustModal.name} · Current: <strong>{adjustModal.stock}</strong></p>
            <label className="label">Adjustment (+ add / − remove)</label>
            <input type="number" value={adjustVal} onChange={e => setAdjustVal(Number(e.target.value))} className="input font-mono mb-lg" />
            <p className="text-xs text-on-surface-variant mb-lg">
              New stock level: <strong className="text-primary">{Math.max(0, adjustModal.stock + adjustVal)}</strong>
            </p>
            <div className="flex gap-sm">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleAdjust} className="btn-primary flex-1 justify-center">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
