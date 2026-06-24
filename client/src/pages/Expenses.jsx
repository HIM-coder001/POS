import { useState, useEffect } from 'react';
import { PageLayout, EmptyState, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export function validateExpenseForm(form) {
  const errors = {};
  if (!form.category?.trim()) errors.category = 'Category is required';
  else if (form.category.trim().length > 100) errors.category = 'Category must be at most 100 characters';
  const amt = Number(form.amount);
  if (!form.amount) errors.amount = 'Amount is required';
  else if (isNaN(amt) || amt <= 0) errors.amount = 'Amount must be greater than 0';
  else if (amt > 999999999.99) errors.amount = 'Amount too large';
  if (!form.date) errors.date = 'Date is required';
  return errors;
}

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/expenses');
      setExpenses(data.expenses ?? data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load expenses';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const closeModal = () => {
    setShowForm(false);
    setForm({ category: '', description: '', amount: '', date: '' });
    setFieldErrors({});
  };

  const handleBlur = (field) => {
    const errs = validateExpenseForm(form);
    setFieldErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateExpenseForm(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await api.post('/expenses', {
        category: form.category.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
        date: form.date,
      });
      setExpenses((prev) => [data.expense ?? data, ...prev]);
      toast.success('Expense added');
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      setDeletingId(id);
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      setExpenses((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageLayout title="Expenses" subtitle="Track and manage business expenses">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body-sm text-on-surface-variant">
            {!loading && !error ? `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Add Expense
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-2xl">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center justify-between gap-md p-lg bg-error-container/20 border border-error-container rounded-xl text-on-surface">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-error">error</span>
            <p className="text-body-sm font-medium">{error}</p>
          </div>
          <button
            onClick={fetchExpenses}
            className="btn-secondary text-sm py-xs px-md"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && expenses.length === 0 && (
        <EmptyState
          icon="receipt_long"
          title="No expenses yet"
          message="Add your first expense to get started."
        />
      )}

      {/* Expenses table */}
      {!loading && !error && expenses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="table-head">
                <tr>
                  <th className="px-lg py-md">Date</th>
                  <th className="px-lg py-md">Category</th>
                  <th className="px-lg py-md">Description</th>
                  <th className="px-lg py-md text-right">Amount</th>
                  {canWrite && <th className="px-lg py-md text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-body-sm">
                {expenses.map((expense) => (
                  <tr key={expense._id} className="table-row">
                    <td className="px-lg py-md text-on-surface-variant">
                      {expense.date
                        ? new Date(expense.date).toLocaleDateString('en-KE')
                        : new Date(expense.createdAt).toLocaleDateString('en-KE')}
                    </td>
                    <td className="px-lg py-md font-medium text-on-surface">
                      {expense.category}
                    </td>
                    <td className="px-lg py-md text-on-surface-variant">
                      {expense.description || '—'}
                    </td>
                    <td className="px-lg py-md text-right font-mono font-semibold text-on-surface">
                      {fmt(expense.amount)}
                    </td>
                    {canWrite && (
                      <td className="px-lg py-md text-right">
                        <button
                          onClick={() => handleDelete(expense._id)}
                          disabled={deletingId === expense._id}
                          className="btn-icon text-error/70 hover:text-error hover:bg-error/10 disabled:opacity-40"
                          title="Delete expense"
                        >
                          {deletingId === expense._id ? (
                            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                              delete
                            </span>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NewExpenseModal */}
      <Modal
        open={showForm}
        onClose={closeModal}
        title="Add Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-md">
          {/* Category */}
          <div>
            <label className="label">
              Category <span className="text-error">*</span>
            </label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              onBlur={() => handleBlur('category')}
              maxLength={100}
              placeholder="e.g. Utilities"
            />
            {fieldErrors.category && (
              <p className="text-xs text-error mt-unit">{fieldErrors.category}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              maxLength={500}
              rows={3}
              placeholder="Optional notes"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="label">
              Amount (KES) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="999999999.99"
              className="input"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              onBlur={() => handleBlur('amount')}
              placeholder="0.00"
            />
            {fieldErrors.amount && (
              <p className="text-xs text-error mt-unit">{fieldErrors.amount}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">
              Date <span className="text-error">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              onBlur={() => handleBlur('date')}
            />
            {fieldErrors.date && (
              <p className="text-xs text-error mt-unit">{fieldErrors.date}</p>
            )}
          </div>

          <div className="flex gap-sm pt-sm">
            <button
              type="button"
              onClick={closeModal}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 justify-center"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              ) : (
                'Add Expense'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
