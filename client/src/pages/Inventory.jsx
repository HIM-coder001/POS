import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtDT = (d) => new Date(d).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

const MOVEMENT_TYPE = {
  sale:       { label:'Sale',       bg:'bg-red-50',    text:'text-red-700',    icon:'shopping_cart'  },
  purchase:   { label:'Purchase',   bg:'bg-emerald-50',text:'text-emerald-700',icon:'add_shopping_cart'},
  adjustment: { label:'Adjustment', bg:'bg-amber-50',  text:'text-amber-700',  icon:'tune'           },
  refund:     { label:'Refund',     bg:'bg-blue-50',   text:'text-blue-700',   icon:'undo'           },
};

export default function Inventory() {
  const [activeTab, setActiveTab]     = useState('stock');
  const [products, setProducts]       = useState([]);
  const [stats, setStats]             = useState({});
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [total, setTotal]             = useState(0);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustVal, setAdjustVal]     = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Stock movements
  const [movements, setMovements]     = useState([]);
  const [movTotal, setMovTotal]       = useState(0);
  const [movPage, setMovPage]         = useState(1);
  const [movPages, setMovPages]       = useState(1);
  const [movType, setMovType]         = useState('');
  const [movLoading, setMovLoading]   = useState(false);

  // Purchase Order states
  const [showPoModal, setShowPoModal] = useState(false);
  const [poProducts, setPoProducts]   = useState([]);
  const [poProductId, setPoProductId] = useState('');
  const [poQuantity, setPoQuantity]   = useState('');
  const [poLoading, setPoLoading]     = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = { limit: 20, page };
      if (statusFilter) params.status = statusFilter;
      if (search)       params.search = search;
      const { data } = await api.get('/inventory', { params });
      setProducts(data.products);
      setStats(data.stats);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };

  const fetchMovements = async () => {
    try {
      setMovLoading(true);
      const params = { page: movPage, limit: 20 };
      if (movType) params.type = movType;
      const { data } = await api.get('/stock-movements', { params });
      setMovements(data.movements || []);
      setMovTotal(data.total || 0);
      setMovPages(data.pages || 1);
    } catch { toast.error('Failed to load stock movements'); }
    finally { setMovLoading(false); }
  };

  useEffect(() => { fetchInventory(); }, [statusFilter, search, page]);
  useEffect(() => { setPage(1); }, [statusFilter, search]);
  useEffect(() => { if (activeTab === 'movements') fetchMovements(); }, [activeTab, movPage, movType]);

  const handleAdjust = async () => {
    if (!adjustVal || adjustVal === 0) return toast.error('Enter a non-zero adjustment');
    try {
      await api.put(`/inventory/${adjustModal._id}/adjust`, {
        adjustment: adjustVal,
        reason: adjustReason || 'Manual adjustment',
      });
      toast.success('Stock adjusted');
      setAdjustModal(null);
      setAdjustVal(0);
      setAdjustReason('');
      fetchInventory();
    } catch (err) { toast.error(err.response?.data?.message || 'Adjustment failed'); }
  };

  const openPoModal = async () => {
    try {
      const { data } = await api.get('/products', { params: { limit: 100 } });
      setPoProducts(data.products || []);
      if (data.products?.length > 0) {
        setPoProductId(data.products[0]._id);
      }
      setShowPoModal(true);
    } catch {
      toast.error('Failed to load products for purchase order');
    }
  };

  const handlePurchaseOrder = async (e) => {
    e.preventDefault();
    if (!poProductId || !poQuantity || Number(poQuantity) <= 0) {
      return toast.error('Please select a product and enter a valid quantity');
    }
    setPoLoading(true);
    try {
      await api.post('/inventory/purchase-order', {
        productId: poProductId,
        quantity: Number(poQuantity)
      });
      toast.success('Purchase order completed successfully!');
      setShowPoModal(false);
      setPoProductId('');
      setPoQuantity('');
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purchase order failed');
    } finally {
      setPoLoading(false);
    }
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
    <>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Inventory Management" />
        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h1 className="text-headline-lg font-bold text-on-surface">Inventory</h1>
              <p className="text-body-sm text-on-surface-variant">{total} products in catalogue</p>
            </div>
            <button onClick={openPoModal} className="btn-primary">
              <span className="material-symbols-outlined text-xl">add_shopping_cart</span>Purchase Order
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-xs border-b border-outline-variant/30">
            {[
              { key:'stock',     icon:'warehouse',      label:'Stock Levels' },
              { key:'movements', icon:'swap_vert',      label:'Stock Movements' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-xs px-md py-sm text-body-sm font-medium transition-all border-b-2 -mb-px
                  ${activeTab===tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'movements' && (
            <>
              {/* Movement type filter */}
              <div className="flex gap-[8px] flex-wrap">
                {[['','All Types'],['sale','Sales'],['purchase','Purchases'],['adjustment','Adjustments'],['refund','Refunds']].map(([v,l])=>(
                  <button key={v} onClick={()=>{setMovType(v);setMovPage(1);}}
                    className={`px-[14px] py-[7px] rounded-xl text-[12.5px] font-semibold transition-all
                      ${movType===v ? 'bg-primary text-white shadow-sm' : 'bg-white border border-black/[0.08] text-on-surface-variant hover:bg-surface-container-low'}`}>
                    {l}
                  </button>
                ))}
                <span className="ml-auto text-[12px] text-on-surface-variant/60 self-center">{movTotal} records</span>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="table-head"><tr>
                    <th className="px-md py-md">Date</th>
                    <th className="px-md py-md">Product</th>
                    <th className="px-md py-md">Type</th>
                    <th className="px-md py-md text-right">Qty Change</th>
                    <th className="px-md py-md text-right">Before</th>
                    <th className="px-md py-md text-right">After</th>
                    <th className="px-md py-md">Reference</th>
                    <th className="px-md py-md">By</th>
                  </tr></thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {movLoading ? Array(6).fill(0).map((_,i)=>(
                      <tr key={i}><td colSpan={8} className="px-md py-md">
                        <div className="h-5 bg-surface-container-high rounded animate-pulse" />
                      </td></tr>
                    )) : movements.length === 0 ? (
                      <tr><td colSpan={8} className="px-md py-[48px] text-center text-on-surface-variant/40 text-[13px]">
                        No stock movements recorded yet
                      </td></tr>
                    ) : movements.map((m,i)=>{
                      const mt = MOVEMENT_TYPE[m.type] || MOVEMENT_TYPE.adjustment;
                      return (
                        <tr key={i} className="table-row">
                          <td className="px-md py-md text-[12px] text-on-surface-variant/60 whitespace-nowrap">{fmtDT(m.createdAt)}</td>
                          <td className="px-md py-md">
                            <p className="text-[13px] font-medium text-on-surface">{m.productName || m.product?.name}</p>
                            <p className="text-[11px] font-mono text-on-surface-variant/50">{m.product?.sku}</p>
                          </td>
                          <td className="px-md py-md">
                            <span className={`inline-flex items-center gap-[4px] px-sm py-unit rounded-full text-[11px] font-semibold ${mt.bg} ${mt.text}`}>
                              <span className="material-symbols-outlined icon-fill" style={{fontSize:'12px'}}>{mt.icon}</span>
                              {mt.label}
                            </span>
                          </td>
                          <td className={`px-md py-md text-right font-mono font-bold text-[13px] ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                          </td>
                          <td className="px-md py-md text-right font-mono text-[13px] text-on-surface-variant/60">{m.balanceBefore ?? '—'}</td>
                          <td className="px-md py-md text-right font-mono font-bold text-[13px]">{m.balanceAfter ?? '—'}</td>
                          <td className="px-md py-md font-mono text-[11px] text-on-surface-variant/60">{m.reference || '—'}</td>
                          <td className="px-md py-md text-[12px] text-on-surface-variant">{m.performedByName || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {movPages > 1 && (
                  <div className="flex items-center justify-between px-md py-[10px] border-t border-black/[0.05] bg-[#fafafa] text-[12px]">
                    <span className="text-on-surface-variant/60">Page {movPage} of {movPages} · {movTotal} total</span>
                    <div className="flex gap-[6px]">
                      <button disabled={movPage<=1} onClick={()=>setMovPage(p=>p-1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white disabled:opacity-40">Prev</button>
                      <span className="px-[12px] py-[5px] rounded-lg bg-primary text-white font-bold">{movPage}</span>
                      <button disabled={movPage>=movPages} onClick={()=>setMovPage(p=>p+1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'stock' && (<>

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

          {/* Search + Filter Tabs */}
          <div className="flex flex-col sm:flex-row gap-sm items-stretch sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{fontSize:'18px'}}>search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, SKU or barcode…"
                className="input pl-[38px]"
              />
            </div>
            <div className="flex gap-sm flex-wrap">
              {[['', 'All'], ['ok', 'In Stock'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([v, l]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-[14px] py-[7px] rounded-xl text-[12.5px] font-semibold transition-all
                    ${statusFilter === v ? 'bg-primary text-white shadow-sm' : 'bg-white border border-black/[0.08] text-on-surface-variant hover:bg-surface-container-low'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-head">
                  <tr>
                    {['Product','Category','Stock Level','Status','Supplier','Actions'].map(h =>
                      <th key={h} className="px-md py-md">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-md py-lg"><div className="h-8 bg-surface-container-high rounded animate-pulse" /></td></tr>
                  )) : products.length === 0 ? (
                    <tr><td colSpan={6} className="px-md py-[48px] text-center text-on-surface-variant/40 text-[13px]">
                      No products found
                    </td></tr>
                  ) : products.map(p => (
                    <tr key={p._id} className="table-row group">
                      <td className="px-md py-md">
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 overflow-hidden border border-black/[0.05]">
                            {p.image
                              ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                              : <span className="material-symbols-outlined text-on-surface-variant/30 text-sm">inventory_2</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-on-surface truncate">{p.name}</p>
                            <p className="text-[11px] text-on-surface-variant/50 font-mono">{p.sku}</p>
                          </div>
                        </div>
                      </td>
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

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-[20px] py-[10px] bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] text-[12px]">
              <span className="text-on-surface-variant/60">
                Showing {products.length} of {total} products
              </span>
              <div className="flex gap-[6px]">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Prev</button>
                <span className="px-[12px] py-[5px] rounded-lg bg-primary text-white font-bold">{page}</span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>{/* end flex min-h-screen */}

      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-fade-in space-y-md">
            <div className="flex justify-between items-center">
              <h3 className="text-title-md font-bold text-on-surface">Adjust Stock</h3>
              <button onClick={() => { setAdjustModal(null); setAdjustVal(0); setAdjustReason(''); }}
                className="text-outline hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">{adjustModal.name}</span> · Current stock: <strong className="text-primary">{adjustModal.stock}</strong>
            </p>
            <div>
              <label className="label">Adjustment (+ to add, − to remove)</label>
              <input type="number" value={adjustVal}
                onChange={e => setAdjustVal(Number(e.target.value))}
                className="input font-mono text-center text-lg" placeholder="e.g. +10 or -5" />
            </div>
            <div className="bg-surface-container-low px-md py-sm rounded-xl flex justify-between text-[13px]">
              <span className="text-on-surface-variant">New stock level:</span>
              <span className="font-bold font-mono text-primary">{Math.max(0, adjustModal.stock + (adjustVal||0))}</span>
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                className="input" placeholder="e.g. Received delivery, damaged goods…" />
            </div>
            <div className="flex gap-sm">
              <button onClick={() => { setAdjustModal(null); setAdjustVal(0); setAdjustReason(''); }}
                className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleAdjust} className="btn-primary flex-1 justify-center">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <form onSubmit={handlePurchaseOrder} className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-md p-xl animate-fade-in space-y-md">
            <div className="flex items-center justify-between">
              <h3 className="text-title-md font-bold text-on-surface">Create Purchase Order</h3>
              <button type="button" onClick={() => setShowPoModal(false)} className="text-outline hover:text-primary p-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div>
              <label className="label">Select Product to Reorder</label>
              <select 
                value={poProductId} 
                onChange={e => setPoProductId(e.target.value)} 
                className="input w-full"
                required
              >
                <option value="" disabled>-- Select Product --</option>
                {poProducts.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} (SKU: {p.sku}) — Current Stock: {p.stock}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Order Quantity</label>
              <input 
                type="number" 
                min="1" 
                required 
                value={poQuantity} 
                onChange={e => setPoQuantity(e.target.value)}
                placeholder="Enter quantity" 
                className="input" 
              />
            </div>

            {poProductId && (() => {
              const prod = poProducts.find(p => p._id === poProductId);
              if (!prod) return null;
              return (
                <div className="bg-surface-container-low p-md rounded-xl space-y-xs text-xs border border-outline-variant/30">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">SKU:</span>
                    <span className="font-mono text-on-surface font-semibold">{prod.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Category:</span>
                    <span className="text-on-surface font-semibold">{prod.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-medium">Supplier:</span>
                    <span className="text-on-surface font-semibold">{prod.supplier?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between pt-unit border-t border-outline-variant/30 mt-unit">
                    <span className="text-on-surface-variant font-medium">New Projected Stock:</span>
                    <span className="text-primary font-bold">{prod.stock + (Number(poQuantity) || 0)} units</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-sm pt-sm">
              <button type="button" onClick={() => setShowPoModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={poLoading} className="btn-primary flex-1 justify-center">
                {poLoading ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
