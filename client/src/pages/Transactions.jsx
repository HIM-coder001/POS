import { useState, useEffect } from 'react';
import { PageLayout, SearchInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import api from '../services/api';
import toast from 'react-hot-toast';

const PAYMENT_STYLE = {
  mpesa:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'phone_android', label: 'M-Pesa' },
  cash:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'payments',      label: 'Cash'   },
  card:   { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'credit_card',   label: 'Card'   },
  split:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'call_split',    label: 'Split'  },
};

const STATUS_STYLE = {
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  refunded:  { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Refunded'  },
  voided:    { bg: 'bg-gray-100',   text: 'text-gray-600',    label: 'Voided'    },
};

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

export default function Transactions() {
  const [sales, setSales]             = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [search, setSearch]           = useState('');
  const [date, setDate]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundModal, setRefundModal] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding]     = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (date) params.date = date;
      const { data } = await api.get('/sales', { params });
      setSales(data.sales || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSales(); }, [page, date]);

  const handleRefund = async () => {
    if (!refundModal) return;
    if (!refundReason.trim()) return toast.error('Please enter a reason for the refund');
    setRefunding(true);
    try {
      await api.post(`/sales/${refundModal._id}/refund`, { refundReason });
      toast.success(`Sale ${refundModal.receiptNumber} refunded`);
      setRefundModal(null);
      setRefundReason('');
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    } finally { setRefunding(false); }
  };

  const filteredSales = sales.filter(s =>
    s.receiptNumber?.toLowerCase().includes(search.toLowerCase()) ||
    s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.cashierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
    <PageLayout title="Transactions" subtitle={`${total} total records`}>
      {/* Filters */}
      <div className="flex flex-wrap gap-sm items-center">
        <SearchInput value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search receipt, cashier, customer…" />
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} className="input w-auto" />
        {date && (
          <button onClick={() => setDate('')} className="btn-secondary py-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                {['Receipt', 'Customer', 'Cashier', 'Method', 'Total', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="px-md py-md">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading ? <SkeletonRows count={8} cols={8} /> : filteredSales.map(sale => {
                const ps = PAYMENT_STYLE[sale.paymentMethod] || PAYMENT_STYLE.cash;
                const ss = STATUS_STYLE[sale.status] || STATUS_STYLE.completed;
                return (
                  <tr key={sale._id} className={`table-row ${sale.status === 'refunded' ? 'opacity-60' : ''}`}>
                    <td className="px-md py-md font-mono text-[12px] text-primary font-semibold">{sale.receiptNumber}</td>
                    <td className="px-md py-md text-body-sm font-medium text-on-surface">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-md py-md text-body-sm text-on-surface-variant">{sale.cashierName || sale.cashier?.name}</td>
                    <td className="px-md py-md">
                      <span className={`inline-flex items-center gap-[4px] px-sm py-unit rounded-full text-[11px] font-semibold ${ps.bg} ${ps.text}`}>
                        <span className="material-symbols-outlined icon-fill" style={{ fontSize: '12px' }}>{ps.icon}</span>
                        {ps.label}
                      </span>
                    </td>
                    <td className="px-md py-md font-mono font-bold text-on-surface">{fmt(sale.grandTotal)}</td>
                    <td className="px-md py-md">
                      <span className={`inline-flex items-center px-sm py-unit rounded-full text-[11px] font-semibold ${ss.bg} ${ss.text}`}>
                        {ss.label}
                      </span>
                    </td>
                    <td className="px-md py-md text-[12px] text-on-surface-variant/70">
                      {new Date(sale.createdAt).toLocaleString('en-KE')}
                    </td>
                    <td className="px-md py-md">
                      <div className="flex items-center gap-[6px] justify-end">
                        <button onClick={() => setSelectedSale(sale)} className="btn-ghost text-[12px] py-[5px] px-sm">
                          View <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>receipt</span>
                        </button>
                        {sale.status === 'completed' && (
                          <button onClick={() => { setRefundModal(sale); setRefundReason(''); }}
                            className="btn-ghost text-[12px] py-[5px] px-sm text-error hover:bg-red-50">
                            Refund <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>undo</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !filteredSales.length && (
                <tr><td colSpan={8} className="py-0">
                  <EmptyState icon="receipt_long" title="No transactions found" message="Try adjusting your search or date filter." />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} showing={filteredSales.length}
          onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
      </div>
    </PageLayout>

    {/* Receipt Modal */}
    {selectedSale && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-overlay w-full max-w-md p-xl animate-scale-in flex flex-col my-8">
          <div className="flex justify-between items-center mb-lg border-b border-black/[0.06] pb-md">
            <div>
              <h3 className="text-title-md font-bold text-on-surface">Receipt — {selectedSale.receiptNumber}</h3>
              {selectedSale.status === 'refunded' && (
                <span className="badge badge-red mt-[4px]">Refunded</span>
              )}
            </div>
            <div className="flex gap-sm">
              <button onClick={() => window.print()} className="btn-ghost text-[13px] py-sm px-md">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>Print
              </button>
              <button onClick={() => setSelectedSale(null)} className="btn-icon">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          <div id="print-receipt-container" className="bg-white text-black font-mono text-xs space-y-sm">
            <div className="text-center space-y-unit">
              <h2 className="text-[15px] font-black uppercase">RetailEdge POS</h2>
              <p className="text-[10px] text-gray-500">{selectedSale.branch}</p>
            </div>
            <div className="border-t border-dashed border-black/30" />
            <div className="space-y-unit text-[11px]">
              {[['Receipt', selectedSale.receiptNumber], ['Date', new Date(selectedSale.createdAt).toLocaleString('en-KE')], ['Cashier', selectedSale.cashierName || selectedSale.cashier?.name], ['Customer', selectedSale.customerName || 'Walk-in']].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span>{k}:</span><span className="font-bold">{v}</span></div>
              ))}
            </div>
            <div className="border-t border-dashed border-black/30" />
            <table className="w-full text-[11px]">
              <thead><tr className="border-b border-dashed border-black/30">
                <th className="pb-unit font-bold text-left">Item</th>
                <th className="pb-unit text-center font-bold">Qty</th>
                <th className="pb-unit text-right font-bold">Total</th>
              </tr></thead>
              <tbody>
                {selectedSale.items.map(item => (
                  <tr key={item._id}>
                    <td className="py-unit truncate max-w-[150px]">{item.name}</td>
                    <td className="py-unit text-center">{item.quantity}</td>
                    <td className="py-unit text-right font-mono">{fmt(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-dashed border-black/30" />
            <div className="space-y-unit text-[11px]">
              <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(selectedSale.subtotal)}</span></div>
              <div className="flex justify-between"><span>VAT ({selectedSale.vatRate || 16}%):</span><span>{fmt(selectedSale.vatAmount)}</span></div>
              {selectedSale.discount > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Discount:</span><span>- {fmt(selectedSale.discount)}</span></div>}
              <div className="flex justify-between font-black text-[13px] border-t border-dashed border-black/30 pt-unit mt-unit">
                <span>GRAND TOTAL:</span><span>{fmt(selectedSale.grandTotal)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-black/30" />
            <div className="flex justify-between text-[11px]">
              <span>Payment:</span><span className="font-bold uppercase">{selectedSale.paymentMethod}</span>
            </div>
            {selectedSale.status === 'refunded' && (
              <div className="border-t border-dashed border-red-300 pt-unit text-red-600 font-bold text-center">
                *** REFUNDED ***
                {selectedSale.refundReason && <p className="font-normal text-[10px]">{selectedSale.refundReason}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Refund Modal */}
    {refundModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
        <div className="bg-white rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-scale-in space-y-md">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-title-md font-bold text-on-surface">Process Refund</h3>
              <p className="text-[12px] text-on-surface-variant/60 mt-[2px]">{refundModal.receiptNumber} · {fmt(refundModal.grandTotal)}</p>
            </div>
            <button onClick={() => setRefundModal(null)} className="btn-icon">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-md flex items-start gap-sm">
            <span className="material-symbols-outlined icon-fill text-amber-500 flex-shrink-0 mt-[1px]" style={{fontSize:'16px'}}>warning</span>
            <div className="text-[12px] text-amber-800">
              <p className="font-bold mb-[2px]">This action cannot be undone.</p>
              <p>Stock will be restored for all {refundModal.items?.length} item(s). Loyalty points earned will be deducted.</p>
            </div>
          </div>

          <div>
            <label className="label">Refund Reason <span className="text-error">*</span></label>
            <textarea
              rows={3}
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              placeholder="e.g. Customer returned defective item, wrong product delivered…"
              className="input resize-none"
            />
          </div>

          <div className="flex gap-sm pt-sm">
            <button onClick={() => setRefundModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleRefund} disabled={refunding || !refundReason.trim()}
              className="flex-1 flex items-center justify-center gap-sm px-lg py-sm rounded-xl font-semibold text-body-sm bg-error text-white hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40">
              {refunding
                ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:'16px'}}>progress_activity</span>Processing…</>
                : <><span className="material-symbols-outlined" style={{fontSize:'16px'}}>undo</span>Confirm Refund</>}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
