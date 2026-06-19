import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';

const TIERS = { Platinum: 'bg-purple-100 text-purple-800', Gold: 'bg-yellow-100 text-yellow-800', Silver: 'bg-gray-100 text-gray-700', Bronze: 'bg-orange-100 text-orange-800' };
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = { limit: 30 };
      if (search) params.search = search;
      if (tier) params.tier = tier;
      const { data } = await api.get('/customers', { params });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, [search, tier]);

  const viewCustomer = async (id) => {
    try {
      setDetailLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      setSelected(data);
    } catch { toast.error('Failed to load customer'); }
    finally { setDetailLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      toast.success('Customer added');
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Customer Directory" />
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Customer List */}
          <div className="flex-1 flex flex-col overflow-hidden p-lg">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
              <div>
                <h1 className="text-headline-lg font-bold text-on-surface">Customer Directory</h1>
                <p className="text-body-sm text-on-surface-variant">{total} registered customers</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="btn-primary">
                <span className="material-symbols-outlined text-xl">person_add</span>Add Customer
              </button>
            </div>

            {/* Search + filter */}
            <div className="flex gap-md mb-lg">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or phone..." className="input pl-xl" />
              </div>
              <select value={tier} onChange={e => setTier(e.target.value)} className="input w-40">
                <option value="">All Tiers</option>
                {['Platinum','Gold','Silver','Bronze'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Customer grid */}
            <div className="flex-1 overflow-y-auto space-y-sm pr-1">
              {loading ? Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-20 bg-surface-container-high rounded-xl animate-pulse" />
              )) : customers.map(c => (
                <button key={c._id} onClick={() => viewCustomer(c._id)}
                  className={`w-full card p-md flex items-center gap-md text-left transition-all ${
                    selected?._id === c._id ? 'ring-2 ring-primary border-primary' : ''}`}>
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-lg flex-shrink-0">
                    {c.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm">
                      <h3 className="text-body-sm font-bold text-on-surface truncate">{c.name}</h3>
                      <span className={`px-sm py-unit text-xs font-bold rounded-full ${TIERS[c.tier]}`}>{c.tier}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-mono">{c.phone}</p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-body-sm font-bold font-mono text-primary">{fmt(c.totalSpend)}</p>
                    <p className="text-xs text-on-surface-variant">{c.totalVisits} visits</p>
                  </div>
                </button>
              ))}
              {!loading && !customers.length && (
                <div className="text-center py-xl text-on-surface-variant">
                  <span className="material-symbols-outlined text-5xl block mb-sm">group_off</span>
                  <p className="text-body-sm">No customers found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <aside className={`w-[380px] bg-surface-container-lowest border-l border-outline-variant flex flex-col overflow-hidden transition-all ${selected ? '' : 'hidden xl:flex'}`}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-lg">
                <span className="material-symbols-outlined text-6xl mb-md opacity-20">person</span>
                <p className="text-body-sm text-center">Select a customer to view their details</p>
              </div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span></div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="p-xl bg-primary text-on-primary relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_#1e3a8a,_transparent)]" />
                  <div className="relative z-10 flex items-center gap-md mb-lg">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                      {selected.name?.[0]}
                    </div>
                    <div>
                      <h2 className="text-title-md font-bold">{selected.name}</h2>
                      <p className="text-xs opacity-80 font-mono">{selected.phone}</p>
                    </div>
                  </div>
                  <div className="relative z-10 grid grid-cols-3 gap-md">
                    <div className="text-center bg-white/10 rounded-lg p-md">
                      <p className="text-xs opacity-70">Loyalty</p>
                      <p className="text-lg font-bold">{selected.loyaltyPoints?.toLocaleString()}</p>
                    </div>
                    <div className="text-center bg-white/10 rounded-lg p-md">
                      <p className="text-xs opacity-70">Total Spend</p>
                      <p className="text-lg font-bold">{(selected.totalSpend / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="text-center bg-white/10 rounded-lg p-md">
                      <p className="text-xs opacity-70">Visits</p>
                      <p className="text-lg font-bold">{selected.totalVisits}</p>
                    </div>
                  </div>
                </div>
                <div className="p-lg space-y-lg">
                  {/* Tier badge */}
                  <div className="flex items-center gap-sm">
                    <span className={`px-md py-xs text-sm font-bold rounded-full ${TIERS[selected.tier]}`}>
                      {selected.tier} Member
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {selected.lastPurchase ? `Last: ${new Date(selected.lastPurchase).toLocaleDateString('en-KE')}` : 'No purchases'}
                    </span>
                  </div>
                  {/* Contact */}
                  {selected.email && (
                    <div className="flex items-center gap-sm text-body-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">email</span>{selected.email}
                    </div>
                  )}
                  {/* Purchase History */}
                  <div>
                    <h4 className="text-body-sm font-bold text-on-surface mb-md">Recent Purchases</h4>
                    <div className="space-y-sm">
                      {(selected.purchaseHistory || []).slice(-5).reverse().map((h, i) => (
                        <div key={i} className="flex justify-between items-center p-md bg-surface-container rounded-lg">
                          <div>
                            <p className="text-body-sm font-medium">{h.items?.slice(0, 30) || 'Items'}{h.items?.length > 30 ? '…' : ''}</p>
                            <p className="text-xs text-on-surface-variant">{new Date(h.date).toLocaleDateString('en-KE')}</p>
                          </div>
                          <span className="font-mono text-sm font-bold text-primary">{fmt(h.amount)}</span>
                        </div>
                      ))}
                      {!selected.purchaseHistory?.length && (
                        <p className="text-xs text-on-surface-variant py-md text-center">No purchase history</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="text-title-md font-bold">New Customer</h3>
              <button onClick={() => setShowAdd(false)} className="text-outline hover:text-primary"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-md">
              <div><label className="label">Full Name</label><input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="input" /></div>
              <div><label className="label">Phone Number</label><input required value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} className="input font-mono" placeholder="+254 7XX XXX XXX" /></div>
              <div><label className="label">Email (Optional)</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} className="input" /></div>
              <div><label className="label">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="input" rows="2" /></div>
              <div className="flex gap-sm pt-sm">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
