import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Finance() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    mpesaSales: 0,
  });

  // Reconciliation states
  const [actualCash, setActualCash] = useState('');
  const [reconciliationLog, setReconciliationLog] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [pendingLog, setPendingLog] = useState(null);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [verifyingManager, setVerifyingManager] = useState(false);

  useEffect(() => {
    fetchFinancials();
    loadLocalReconciliationLogs();
  }, []);

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      // Get today's sales to compute expected drawer cash
      const { data } = await api.get('/sales?limit=100');
      const todaySalesList = data.sales || [];

      // Filter by today only
      const today = new Date();
      today.setHours(0,0,0,0);
      const todaySales = todaySalesList.filter(s => new Date(s.createdAt) >= today);

      let total = 0;
      let cash = 0;
      let card = 0;
      let mpesa = 0;

      todaySales.forEach(s => {
        total += s.grandTotal;
        if (s.paymentMethod === 'cash') {
          cash += s.grandTotal;
        } else if (s.paymentMethod === 'card') {
          card += s.grandTotal;
        } else if (s.paymentMethod === 'mpesa') {
          mpesa += s.grandTotal;
        } else if (s.paymentMethod === 'split' && s.splitPayments?.length > 0) {
          s.splitPayments.forEach(p => {
            if (p.method === 'cash') cash += p.amount;
            else if (p.method === 'card') card += p.amount;
            else if (p.method === 'mpesa') mpesa += p.amount;
          });
        }
      });

      setStats({
        totalSales: total,
        cashSales: cash,
        cardSales: card,
        mpesaSales: mpesa,
      });
    } catch (err) {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const loadLocalReconciliationLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('retailedge_reconciliations') || '[]');
      setReconciliationLog(logs);
    } catch (e) {
      setReconciliationLog([]);
    }
  };

  const saveReconciliationLog = (log) => {
    const updated = [log, ...reconciliationLog];
    localStorage.setItem('retailedge_reconciliations', JSON.stringify(updated));
    setReconciliationLog(updated);
    setActualCash('');
    
    if (log.variance === 0) {
      toast.success('🎉 Register session closed. Perfectly balanced!');
    } else if (log.variance > 0) {
      toast.success(`Register closed with Surplus of ${fmt(log.variance)}`);
    } else {
      toast.error(`Warning: Register closed with Deficit of ${fmt(Math.abs(log.variance))}`);
    }
  };

  const handleReconcile = (e) => {
    e.preventDefault();
    const counted = Number(actualCash);
    if (isNaN(counted) || counted < 0) return toast.error('Enter a valid cash amount');

    const expected = stats.cashSales;
    const variance = counted - expected;

    const newLog = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      expected,
      actual: counted,
      variance,
      status: variance === 0 ? 'Balanced' : variance > 0 ? 'Surplus' : 'Deficit',
      auditedBy: 'System/Self'
    };

    if (variance !== 0) {
      setPendingLog(newLog);
      setIsLocked(true);
      toast.error('Discrepancy detected: Manager override required');
      return;
    }

    saveReconciliationLog(newLog);
  };

  const handleManagerUnlock = async (e) => {
    e.preventDefault();
    if (!managerEmail || !managerPassword) {
      return toast.error('Enter manager credentials');
    }
    setVerifyingManager(true);
    try {
      const { data } = await api.post('/auth/verify-manager', {
        email: managerEmail,
        password: managerPassword
      });
      if (data.success) {
        toast.success(`Manager Override approved by ${data.managerName || 'Manager'}`);
        const finalizedLog = {
          ...pendingLog,
          auditedBy: data.managerName || 'Manager'
        };
        saveReconciliationLog(finalizedLog);
        setIsLocked(false);
        setPendingLog(null);
        setManagerEmail('');
        setManagerPassword('');
      } else {
        toast.error('Verification failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Override rejected: insufficient credentials');
    } finally {
      setVerifyingManager(false);
    }
  };

  const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-gutter gap-gutter">
        <header className="flex-shrink-0">
          <h2 className="text-headline-md font-bold text-primary">Finance & Register Reconciliation</h2>
          <p className="text-body-sm text-on-surface-variant">Perform daily cash drawer count, audit payment methods, and close register session.</p>
        </header>

        {loading ? (
          <div className="py-xl text-center text-on-surface-variant animate-pulse">Loading financials...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* LEFT: Expected Cash & Payment Audit */}
            <div className="lg:col-span-2 space-y-gutter">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="card p-lg bg-surface-container-lowest">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Today's Expected Cash Sales</p>
                  <h3 className="text-headline-sm font-black text-success mt-sm">{fmt(stats.cashSales)}</h3>
                  <p className="text-[10px] text-on-surface-variant mt-unit">Based on cash transactions processed today.</p>
                </div>
                <div className="card p-lg bg-surface-container-lowest">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Today's Total Sales</p>
                  <h3 className="text-headline-sm font-black text-primary mt-sm">{fmt(stats.totalSales)}</h3>
                  <p className="text-[10px] text-on-surface-variant mt-unit">Combined sum of Cash + M-Pesa + Card sales.</p>
                </div>
              </div>

              {/* Payment Audit Breakdown */}
              <div className="card p-xl bg-surface-container-lowest">
                <h3 className="text-title-md font-bold text-on-surface mb-lg">Payment Methods Breakdown</h3>
                <div className="space-y-md">
                  <div className="flex justify-between items-center">
                    <span className="text-body-sm font-semibold flex items-center gap-sm">
                      <span className="material-symbols-outlined text-green-600 text-lg">payments</span> Cash Drawer
                    </span>
                    <span className="font-mono text-body-sm font-bold">{fmt(stats.cashSales)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-body-sm font-semibold flex items-center gap-sm">
                      <span className="material-symbols-outlined text-mpesa-green text-lg">smartphone</span> M-Pesa Total
                    </span>
                    <span className="font-mono text-body-sm font-bold">{fmt(stats.mpesaSales)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-body-sm font-semibold flex items-center gap-sm">
                      <span className="material-symbols-outlined text-blue-600 text-lg">credit_card</span> Card Total
                    </span>
                    <span className="font-mono text-body-sm font-bold">{fmt(stats.cardSales)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Perform Reconciliation */}
            <div className="card p-xl bg-surface-container-lowest flex flex-col justify-between relative overflow-hidden">
              {isLocked && (
                <div className="absolute inset-0 bg-surface-container-lowest/95 z-40 p-xl flex flex-col justify-between animate-fade-in">
                  <div className="space-y-md">
                    <div className="flex items-center gap-sm text-error">
                      <span className="material-symbols-outlined text-3xl font-bold">lock</span>
                      <h3 className="text-title-md font-bold text-on-surface">Manager Override Required</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      A variance of <strong>{fmt(pendingLog?.variance)}</strong> was detected. A manager must authorize this discrepancy to proceed.
                    </p>
                    <div className="p-sm bg-error-container/10 border border-error-container text-on-surface text-xs space-y-unit rounded-lg">
                      <div className="flex justify-between">
                        <span>Expected Cash:</span>
                        <span className="font-bold">{fmt(pendingLog?.expected)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Actual Counted:</span>
                        <span className="font-bold">{fmt(pendingLog?.actual)}</span>
                      </div>
                      <div className="flex justify-between text-error font-bold border-t border-outline-variant/30 pt-unit mt-unit">
                        <span>Variance:</span>
                        <span>{fmt(pendingLog?.variance)}</span>
                      </div>
                    </div>
                    
                    <form onSubmit={handleManagerUnlock} className="space-y-sm pt-sm">
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block mb-unit">Manager Email</label>
                        <input 
                          type="email" 
                          required 
                          placeholder="manager@retailedge.com" 
                          value={managerEmail}
                          onChange={e => setManagerEmail(e.target.value)}
                          className="input h-9 text-xs" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block mb-unit">Manager Password</label>
                        <input 
                          type="password" 
                          required 
                          placeholder="••••••••" 
                          value={managerPassword}
                          onChange={e => setManagerPassword(e.target.value)}
                          className="input h-9 text-xs" 
                        />
                      </div>
                      <div className="flex gap-xs pt-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsLocked(false);
                            setPendingLog(null);
                            setManagerEmail('');
                            setManagerPassword('');
                            toast.error('Reconciliation canceled');
                          }}
                          className="btn-secondary text-[11px] py-xs justify-center flex-1">
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={verifyingManager}
                          className="btn-primary text-[11px] py-xs bg-error text-on-error hover:bg-error/90 justify-center flex-1">
                          {verifyingManager ? (
                            <span className="material-symbols-outlined animate-spin text-xs">progress_activity</span>
                          ) : (
                            'Authorize'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-title-md font-bold text-on-surface mb-md">Close Register Drawer</h3>
                <p className="text-xs text-on-surface-variant mb-lg">Verify the physical cash currency present in the cash drawer to audit for variance discrepancies.</p>
                
                <form onSubmit={handleReconcile} className="space-y-md">
                  <div>
                    <label className="label">Actual Counted Cash (KES)</label>
                    <input type="number" required min="0" value={actualCash}
                      onChange={e => setActualCash(e.target.value)}
                      placeholder="e.g. 15400" className="input" />
                  </div>
                  <div className="p-md bg-surface-container rounded-lg space-y-unit text-xs">
                    <div className="flex justify-between">
                      <span>Expected Cash:</span>
                      <span className="font-bold">{fmt(stats.cashSales)}</span>
                    </div>
                    {actualCash && (
                      <div className="flex justify-between">
                        <span>Variance:</span>
                        <span className={`font-bold ${Number(actualCash) - stats.cashSales === 0 ? 'text-success' : Number(actualCash) - stats.cashSales > 0 ? 'text-success' : 'text-error'}`}>
                          {fmt(Number(actualCash) - stats.cashSales)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="w-full btn-primary py-md justify-center">
                    Audit & Close Register
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Closing Audit Logs */}
        <div className="card p-xl bg-surface-container-lowest flex-1 overflow-hidden flex flex-col min-h-[300px]">
          <h3 className="text-title-md font-bold text-on-surface mb-lg flex-shrink-0">Register Closing Logs</h3>
          <div className="flex-grow overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/30 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-lg py-md">Closing Time</th>
                  <th className="px-lg py-md">Expected Cash</th>
                  <th className="px-lg py-md">Actual Counted</th>
                  <th className="px-lg py-md">Variance</th>
                  <th className="px-lg py-md">Audited By</th>
                  <th className="px-lg py-md text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-body-sm font-mono">
                {reconciliationLog.map(log => (
                  <tr key={log.id}>
                    <td className="px-lg py-md font-sans text-xs">{log.date}</td>
                    <td className="px-lg py-md">{fmt(log.expected)}</td>
                    <td className="px-lg py-md">{fmt(log.actual)}</td>
                    <td className={`px-lg py-md font-bold ${log.variance === 0 ? 'text-success' : log.variance > 0 ? 'text-success' : 'text-error'}`}>
                      {fmt(log.variance)}
                    </td>
                    <td className="px-lg py-md font-sans text-xs text-on-surface-variant">{log.auditedBy || 'System/Self'}</td>
                    <td className="px-lg py-md text-right">
                      <span className={`px-md py-0.5 rounded font-sans text-xs font-bold ${log.status === 'Balanced' ? 'bg-success/15 text-success' : log.status === 'Surplus' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!reconciliationLog.length && (
                  <tr>
                    <td colSpan="6" className="text-center py-xl text-on-surface-variant font-sans">No closing records logged</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
