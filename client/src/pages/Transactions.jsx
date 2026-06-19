import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Transactions() {
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (date) params.date = date;
      const { data } = await api.get('/api/sales', { params });
      setSales(data.sales || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [page, date]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSales();
  };

  const handlePrint = () => {
    window.print();
  };

  const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

  // Filter sales locally if searching
  const filteredSales = sales.filter(s => 
    s.receiptNumber?.toLowerCase().includes(search.toLowerCase()) ||
    s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.cashierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-gutter">
        <header className="mb-md flex-shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-headline-md font-bold text-primary">Sales Transactions</h2>
            <p className="text-body-sm text-on-surface-variant">Review historical sales records and reprint customer receipts.</p>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-md bg-surface-container-lowest flex-shrink-0 flex flex-wrap gap-md items-center justify-between mb-md">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search receipt, cashier, customer..." className="input pl-10" />
          </form>
          <div className="flex gap-sm">
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} className="input" />
            {date && <button onClick={() => setDate('')} className="btn-secondary">Clear Date</button>}
          </div>
        </div>

        {/* Table List */}
        <div className="flex-1 card bg-surface-container-lowest overflow-hidden flex flex-col">
          <div className="flex-grow overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-lg py-md">Receipt No</th>
                  <th className="px-lg py-md">Customer</th>
                  <th className="px-lg py-md">Cashier</th>
                  <th className="px-lg py-md">Payment Method</th>
                  <th className="px-lg py-md">Grand Total</th>
                  <th className="px-lg py-md">Date</th>
                  <th className="px-lg py-md text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-body-sm">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="7" className="px-lg py-lg bg-surface-container/10"></td>
                    </tr>
                  ))
                ) : filteredSales.map(sale => (
                  <tr key={sale._id} className="hover:bg-surface-container-low/50">
                    <td className="px-lg py-md font-mono font-bold text-primary">{sale.receiptNumber}</td>
                    <td className="px-lg py-md">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-lg py-md">{sale.cashierName || sale.cashier?.name}</td>
                    <td className="px-lg py-md uppercase font-semibold text-xs">{sale.paymentMethod}</td>
                    <td className="px-lg py-md font-mono font-bold">{fmt(sale.grandTotal)}</td>
                    <td className="px-lg py-md text-xs text-on-surface-variant">{new Date(sale.createdAt).toLocaleString('en-KE')}</td>
                    <td className="px-lg py-md text-right">
                      <button onClick={() => setSelectedSale(sale)}
                        className="px-md py-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all">
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !filteredSales.length && (
                  <tr>
                    <td colSpan="7" className="text-center py-xl text-on-surface-variant">No transactions found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 border-t border-outline-variant/30 px-lg py-md flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Total: <strong>{total}</strong> records</span>
            <div className="flex items-center gap-sm">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-sm px-md text-xs">Previous</button>
              <span className="text-xs">Page <strong>{page}</strong> of <strong>{pages}</strong></span>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-sm px-md text-xs">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reprint Receipt Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-md overflow-y-auto print:p-0">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-md p-lg animate-fade-in flex flex-col my-8 print:my-0 print:shadow-none print:border-0 print:w-full">
            <div className="flex justify-between items-center mb-md border-b pb-sm print:hidden">
              <h3 className="text-title-md font-bold text-on-surface">Reprint Receipt</h3>
              <div className="flex gap-sm">
                <button onClick={handlePrint} className="p-2 text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 text-sm font-semibold">
                  <span className="material-symbols-outlined text-lg">print</span> Print
                </button>
                <button onClick={() => setSelectedSale(null)} className="text-outline hover:text-primary p-2">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div id="print-receipt-container" className="bg-white p-lg text-black rounded-lg border border-dashed border-outline font-mono text-xs flex flex-col gap-sm print:border-0 print:p-0">
              <div className="text-center space-y-unit">
                <h2 className="text-lg font-black tracking-tight uppercase">RetailEdge POS</h2>
                <p className="text-[10px] text-gray-500 uppercase">{selectedSale.branch}</p>
              </div>
              
              <div className="border-t border-dashed border-black/30 my-xs" />
              
              <div className="space-y-unit text-[11px]">
                <div className="flex justify-between">
                  <span>Receipt:</span>
                  <span className="font-bold">{selectedSale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(selectedSale.createdAt).toLocaleString('en-KE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{selectedSale.cashierName || selectedSale.cashier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{selectedSale.customerName || 'Walk-in'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-dashed border-black/30">
                    <th className="pb-unit font-bold">Item</th>
                    <th className="pb-unit text-center font-bold">Qty</th>
                    <th className="pb-unit text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map(item => (
                    <tr key={item._id} className="align-top">
                      <td className="py-unit max-w-[150px] truncate">{item.name}</td>
                      <td className="py-unit text-center">{item.quantity}</td>
                      <td className="py-unit text-right font-mono">{fmt(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <div className="space-y-unit text-[11px] font-mono">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{fmt(selectedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT ({selectedSale.vatRate || 16}%):</span>
                  <span>{fmt(selectedSale.vatAmount)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Discount:</span>
                    <span>- {fmt(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-dashed border-black/30 pt-unit mt-unit">
                  <span>GRAND TOTAL:</span>
                  <span>{fmt(selectedSale.grandTotal)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <div className="space-y-unit text-[11px]">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-bold uppercase">{selectedSale.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
