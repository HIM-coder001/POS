import { useState, useEffect } from 'react';
import { PageLayout, EmptyState, SkeletonRows, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

/**
 * Pure validation function for the purchase form.
 * Returns an errors object; keys are only present when the field is invalid.
 * An empty returned object means the form is valid.
 *
 * @param {{ supplierId: string, items: Array<{productName: string, quantity: number, unitCost: number}>, purchaseDate: string }} form
 * @returns {{ supplier?: string, items?: string, purchaseDate?: string }}
 */
export function validatePurchaseForm(form) {
  const errors = {};

  if (!form.supplierId || String(form.supplierId).trim() === '') {
    errors.supplier = 'Supplier is required';
  }

  if (!Array.isArray(form.items) || form.items.length === 0) {
    errors.items = 'At least one item is required';
  } else {
    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i];
      if (!item.productName || String(item.productName).trim() === '') {
        errors.items = `Item ${i + 1}: product name is required`;
        break;
      }
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
        errors.items = `Item ${i + 1}: quantity must be an integer ≥ 1`;
        break;
      }
      if (Number(item.unitCost) <= 0 || isNaN(Number(item.unitCost))) {
        errors.items = `Item ${i + 1}: unit cost must be > 0`;
        break;
      }
    }
  }

  if (!form.purchaseDate || String(form.purchaseDate).trim() === '') {
    errors.purchaseDate = 'Purchase date is required';
  }

  return errors;
}

function PurchasesTab() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState(null);
  const [form, setForm] = useState({
    supplierId: '',
    items: [{ productName: '', quantity: 1, unitCost: '' }],
    purchaseDate: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    api.get('/purchases')
      .then(({ data }) => setPurchases(data))
      .catch(() => toast.error('Failed to load purchases'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch suppliers when the form is opened
  const fetchSuppliers = async () => {
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      const { data } = await api.get('/suppliers');
      // API returns sorted by name, but ensure alphabetical order
      const sorted = [...data].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setSuppliers(sorted);
    } catch (err) {
      setSuppliersError(err.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setSuppliersLoading(false);
    }
  };

  const openForm = () => {
    setShowForm(true);
    fetchSuppliers();
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({ supplierId: '', items: [{ productName: '', quantity: 1, unitCost: '' }], purchaseDate: '' });
    setFieldErrors({});
  };

  const handleBlur = (field) => {
    const errs = validatePurchaseForm(form);
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const updateItem = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productName: '', quantity: 1, unitCost: '' }],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validatePurchaseForm(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        supplier: form.supplierId,
        items: form.items.map((it) => ({
          productName: it.productName.trim(),
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
        })),
        purchaseDate: form.purchaseDate,
      };
      const { data } = await api.post('/purchases', payload);
      setPurchases((prev) => [data, ...prev]);
      toast.success('Purchase recorded');
      closeForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record purchase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-gutter">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-title-md font-bold text-on-surface">Purchase Orders</h2>
        {canWrite && (
          <button
            onClick={openForm}
            className="btn-primary flex items-center gap-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Purchase
          </button>
        )}
      </div>

      {/* Purchases table card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="table-head">
              <tr>
                <th className="px-lg py-md">Date</th>
                <th className="px-lg py-md">Supplier</th>
                <th className="px-lg py-md text-center">Items</th>
                <th className="px-lg py-md text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] text-body-sm">
              {loading ? (
                <SkeletonRows count={5} cols={4} />
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon="receipt_long"
                      title="No purchases yet"
                      message={canWrite ? 'Click "New Purchase" to record your first purchase order.' : 'No purchase orders have been recorded yet.'}
                    />
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p._id} className="table-row">
                    <td className="px-lg py-md font-sans text-[12px] text-on-surface-variant">
                      {p.purchaseDate
                        ? new Date(p.purchaseDate).toLocaleDateString('en-KE', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-lg py-md font-semibold">
                      {p.supplier?.name ?? p.supplierName ?? '—'}
                    </td>
                    <td className="px-lg py-md text-center text-on-surface-variant">
                      {Array.isArray(p.items) ? p.items.length : '—'}
                    </td>
                    <td className="px-lg py-md text-right font-mono font-bold">
                      {fmt(p.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase form modal */}
      <Modal open={showForm} onClose={closeForm} title="New Purchase Order" width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Supplier dropdown */}
          <div>
            <label className="label">
              Supplier <span className="text-error">*</span>
            </label>
            {suppliersLoading ? (
              <div className="flex items-center gap-sm py-sm text-on-surface-variant text-body-sm">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Loading suppliers…
              </div>
            ) : suppliersError ? (
              <div className="flex items-center gap-sm p-sm bg-error-container/20 border border-error-container rounded-lg text-body-sm">
                <span className="material-symbols-outlined text-error text-base">error</span>
                <span className="flex-1 text-on-surface">{suppliersError}</span>
                <button
                  type="button"
                  onClick={fetchSuppliers}
                  className="btn-secondary text-xs py-unit px-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <select
                className="input"
                value={form.supplierId}
                onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                onBlur={() => handleBlur('supplier')}
                disabled={suppliers.length === 0}
              >
                <option value="">
                  {suppliers.length === 0 ? 'No suppliers available' : 'Select a supplier…'}
                </option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {fieldErrors.supplier && (
              <p className="text-xs text-error mt-unit">{fieldErrors.supplier}</p>
            )}
          </div>

          {/* Dynamic line items */}
          <div>
            <label className="label">Line Items <span className="text-error">*</span></label>
            <div className="space-y-sm">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-sm p-sm bg-surface-container/40 rounded-lg">
                  <div className="flex-1 space-y-xs">
                    <input
                      className="input"
                      placeholder="Product name"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      onBlur={() => handleBlur('items')}
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      className="input text-center"
                      placeholder="Qty"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      onBlur={() => handleBlur('items')}
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      className="input"
                      placeholder="Unit cost"
                      min="0.01"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                      onBlur={() => handleBlur('items')}
                    />
                  </div>
                  <div className="w-24 text-right font-mono text-body-sm font-semibold pt-sm text-on-surface-variant">
                    {item.quantity && item.unitCost
                      ? fmt(Number(item.quantity) * Number(item.unitCost))
                      : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length <= 1}
                    className="btn-icon text-error/60 hover:text-error hover:bg-error/10 disabled:opacity-30 mt-unit"
                    title="Remove item"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
            {fieldErrors.items && (
              <p className="text-xs text-error mt-unit">{fieldErrors.items}</p>
            )}
            <button
              type="button"
              onClick={addItem}
              className="mt-sm text-body-sm text-primary font-semibold hover:underline flex items-center gap-unit"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Add line item
            </button>
          </div>

          {/* Purchase date */}
          <div>
            <label className="label">
              Purchase Date <span className="text-error">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={form.purchaseDate}
              onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
              onBlur={() => handleBlur('purchaseDate')}
            />
            {fieldErrors.purchaseDate && (
              <p className="text-xs text-error mt-unit">{fieldErrors.purchaseDate}</p>
            )}
          </div>

          {/* Computed total */}
          {form.items.some((it) => it.unitCost && it.quantity) && (
            <div className="flex justify-between items-center p-md bg-surface-container rounded-lg">
              <span className="text-body-sm font-semibold text-on-surface">Estimated Total</span>
              <span className="font-mono font-bold text-primary">
                {fmt(
                  form.items.reduce(
                    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
                    0
                  )
                )}
              </span>
            </div>
          )}

          {/* Submit / Cancel */}
          <div className="flex gap-sm pt-sm">
            <button
              type="button"
              onClick={closeForm}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || suppliersLoading || suppliers.length === 0}
              className="btn-primary flex-1 justify-center"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                'Save Purchase'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function Finance() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reconciliation');
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
    <PageLayout title="Finance" subtitle="Daily cash reconciliation and register audit">
      {/* Tab Bar */}
      <div className="flex gap-xs border-b border-black/[0.06] mb-lg">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-lg py-md text-body-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'reconciliation'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Reconciliation
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-lg py-md text-body-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === 'purchases'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Purchases
        </button>
      </div>

      {activeTab === 'reconciliation' && (
      <>
      {loading ? (
        <div className="flex items-center justify-center py-2xl">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
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
                        <span className={`font-bold ${Number(actualCash) - stats.cashSales === 0 ? 'text-emerald-600' : Number(actualCash) - stats.cashSales > 0 ? 'text-emerald-600' : 'text-error'}`}>
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
        <div className="card overflow-hidden">
          <div className="px-xl py-lg border-b border-black/[0.05]">
            <h3 className="text-title-md font-bold text-on-surface">Register Closing Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="table-head">
                <tr>
                  <th className="px-lg py-md">Closing Time</th>
                  <th className="px-lg py-md">Expected Cash</th>
                  <th className="px-lg py-md">Actual Counted</th>
                  <th className="px-lg py-md">Variance</th>
                  <th className="px-lg py-md">Audited By</th>
                  <th className="px-lg py-md text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] font-mono text-body-sm">
                {reconciliationLog.map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="px-lg py-md font-sans text-[12px]">{log.date}</td>
                    <td className="px-lg py-md">{fmt(log.expected)}</td>
                    <td className="px-lg py-md">{fmt(log.actual)}</td>
                    <td className={`px-lg py-md font-bold ${log.variance === 0 ? 'text-emerald-600' : log.variance > 0 ? 'text-emerald-600' : 'text-error'}`}>
                      {fmt(log.variance)}
                    </td>
                    <td className="px-lg py-md font-sans text-[12px] text-on-surface-variant">{log.auditedBy || 'System/Self'}</td>
                    <td className="px-lg py-md text-right">
                      <span className={`badge ${log.status === 'Balanced' || log.status === 'Surplus' ? 'badge-green' : 'badge-red'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!reconciliationLog.length && (
                  <tr><td colSpan={6} className="px-lg py-2xl text-center text-on-surface-variant font-sans">No closing records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
      )}

      {activeTab === 'purchases' && <PurchasesTab />}
    </PageLayout>
  );
}