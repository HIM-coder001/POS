import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

// ── Colour palette for charts ─────────────────────────────────────────────────
const PIE_COLORS = ['#00236f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const PAYMENT_META = {
  mpesa: { label: 'M-Pesa',  icon: 'phone_android', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cash:  { label: 'Cash',    icon: 'payments',       bg: 'bg-blue-50',    text: 'text-blue-700'   },
  card:  { label: 'Card',    icon: 'credit_card',    bg: 'bg-violet-50',  text: 'text-violet-700' },
  split: { label: 'Split',   icon: 'call_split',     bg: 'bg-amber-50',   text: 'text-amber-700'  },
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtKES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString('en-KE');
};
const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' });

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Sk = ({ h = 'h-4', w = 'w-full', rounded = 'rounded-lg' }) => (
  <div className={`${h} ${w} ${rounded} bg-black/[0.06] animate-pulse`} />
);

// ── Trend badge ───────────────────────────────────────────────────────────────
// pct: number | null.  null = no prior data (shows neutral)
function TrendBadge({ pct, suffix = 'vs yesterday' }) {
  if (pct === null || pct === undefined) {
    return <span className="text-[11px] text-on-surface-variant/40 mt-[6px] block">No prior data</span>;
  }
  const up   = pct >= 0;
  const zero = pct === 0;
  return (
    <div className="flex items-center gap-[5px] mt-[6px]">
      <span className={`inline-flex items-center gap-[2px] text-[11px] font-bold px-[7px] py-[2px] rounded-full leading-none
        ${zero ? 'bg-gray-100 text-gray-500' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
        {!zero && (
          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>
            {up ? 'trending_up' : 'trending_down'}
          </span>
        )}
        {zero ? '—' : `${up ? '+' : ''}${pct}%`}
      </span>
      <span className="text-[11px] text-on-surface-variant/50 leading-none">{suffix}</span>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, pct, suffix, icon, iconColor, iconBg, accent, loading, children }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px] flex gap-[14px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)] transition-shadow duration-200 animate-fade-in overflow-hidden relative">
      {/* top accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: accent }} />

      {/* icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-[2px] ${iconBg}`}>
        <span className={`material-symbols-outlined icon-fill ${iconColor}`} style={{ fontSize: '22px' }}>{icon}</span>
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-on-surface-variant/55 uppercase tracking-[0.09em] leading-none truncate">{label}</p>
        {loading ? (
          <div className="mt-[8px] space-y-[6px]">
            <Sk h="h-7" w="w-[120px]" />
            <Sk h="h-3" w="w-[80px]" />
          </div>
        ) : (
          <>
            <p className="text-[24px] font-extrabold text-on-surface leading-tight mt-[4px] truncate">{value}</p>
            {children ?? <TrendBadge pct={pct} suffix={suffix} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-[14px] py-[10px]">
      <p className="text-[11px] font-semibold text-on-surface-variant/60 mb-[4px]">{dayLabel(label)}</p>
      <p className="text-[14px] font-bold text-on-surface font-mono">
        KES {Number(payload[0].value || 0).toLocaleString('en-KE')}
      </p>
      {payload[1] && (
        <p className="text-[12px] text-on-surface-variant/60 mt-[2px]">
          {payload[1].value} orders
        </p>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;

  // Payment method breakdown for mini bar
  const pmTotal = (data?.paymentMethodData || []).reduce((s, x) => s + x.total, 0);

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          title="Dashboard"
          subtitle={new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        />

        <main className="flex-1 overflow-y-auto px-[24px] pt-[20px] pb-[32px] space-y-[20px]">

          {/* ── KPI row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[14px]">

            <KpiCard
              label="Today's Revenue"
              value={fmtKES(kpis?.todaySales)}
              pct={kpis?.todayVsYesterday}
              suffix="vs yesterday"
              icon="payments"
              iconColor="text-primary"
              iconBg="bg-primary/[0.08]"
              accent="var(--color-primary)"
              loading={loading}
            />

            <KpiCard
              label="Month Revenue"
              value={fmtKES(kpis?.mtdRevenue)}
              pct={kpis?.mtdVsLastMonth}
              suffix="vs last month"
              icon="account_balance_wallet"
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              accent="#10b981"
              loading={loading}
            />

            <KpiCard
              label="Today's Orders"
              value={String(kpis?.todayOrders ?? '—')}
              pct={kpis?.ordersVsYesterday}
              suffix="vs yesterday"
              icon="shopping_basket"
              iconColor="text-violet-600"
              iconBg="bg-violet-50"
              accent="#8b5cf6"
              loading={loading}
            />

            <KpiCard
              label="Low Stock Items"
              value={String(kpis?.lowStockCount ?? '—')}
              icon="inventory_2"
              iconColor={kpis?.lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}
              iconBg={kpis?.lowStockCount > 0 ? 'bg-rose-50' : 'bg-emerald-50'}
              accent={kpis?.lowStockCount > 0 ? '#f43f5e' : '#10b981'}
              loading={loading}>
              {!loading && (
                <div className="flex items-center gap-[5px] mt-[6px]">
                  <span className={`inline-flex items-center gap-[2px] text-[11px] font-bold px-[7px] py-[2px] rounded-full leading-none
                    ${kpis?.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    <span className="material-symbols-outlined icon-fill" style={{ fontSize: '11px' }}>
                      {kpis?.lowStockCount > 0 ? 'warning' : 'check_circle'}
                    </span>
                    {kpis?.lowStockCount > 0 ? 'Needs attention' : 'All stocked'}
                  </span>
                </div>
              )}
            </KpiCard>
          </div>

          {/* ── Revenue trend + Category split ──────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-[14px]">

            {/* Area chart — 7-day trend */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
              <div className="flex items-start justify-between mb-[18px]">
                <div>
                  <h3 className="text-[15px] font-bold text-on-surface">Revenue Trend</h3>
                  <p className="text-[12px] text-on-surface-variant/55 mt-[2px]">Daily revenue — last 7 days</p>
                </div>
                {!loading && data?.salesTrend?.length > 0 && (
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-on-surface font-mono">
                      {fmtKES(data.salesTrend.reduce((s, d) => s + d.total, 0))}
                    </p>
                    <p className="text-[11px] text-on-surface-variant/50">7-day total</p>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="h-[220px] flex items-end gap-[6px]">
                  {Array(7).fill(0).map((_, i) => (
                    <div key={i} className="flex-1 bg-black/[0.05] rounded-t-lg animate-pulse"
                      style={{ height: `${20 + ((i * 37 + 13) % 65)}%` }} />
                  ))}
                </div>
              ) : data?.salesTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.salesTrend} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="_id" tickLine={false} axisLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={v => new Date(v).toLocaleDateString('en-KE', { weekday: 'short' })} />
                    <YAxis tickLine={false} axisLine={false} width={46}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={v => fmtShort(v)} />
                    <Tooltip content={<AreaTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.06)', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="total" name="Revenue"
                      stroke="var(--color-primary)" strokeWidth={2}
                      fill="url(#revGrad)" dot={false}
                      activeDot={{ r: 5, fill: 'var(--color-primary)', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center gap-[8px] text-on-surface-variant/30">
                  <span className="material-symbols-outlined text-5xl">show_chart</span>
                  <p className="text-[13px]">No sales this week</p>
                </div>
              )}
            </div>

            {/* Category donut */}
            <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px] flex flex-col">
              <div className="mb-[14px]">
                <h3 className="text-[15px] font-bold text-on-surface">Category Split</h3>
                <p className="text-[12px] text-on-surface-variant/55 mt-[2px]">Revenue share this month</p>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-black/[0.05] animate-pulse" />
                </div>
              ) : data?.categoryData?.length > 0 ? (() => {
                const grandTotal = data.categoryData.reduce((s, c) => s + c.total, 0);
                return (
                  <>
                    <div className="h-[155px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data.categoryData} dataKey="total" nameKey="_id"
                            cx="50%" cy="50%" innerRadius={42} outerRadius={66}
                            paddingAngle={2} strokeWidth={0}>
                            {data.categoryData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [`KES ${v.toLocaleString()}`, '']}
                            contentStyle={{ borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-[7px] mt-[10px]">
                      {data.categoryData.map((c, i) => {
                        const pct = grandTotal > 0 ? Math.round((c.total / grandTotal) * 100) : 0;
                        return (
                          <div key={c._id}>
                            <div className="flex items-center gap-[7px] mb-[3px]">
                              <div className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-[12px] text-on-surface flex-1 truncate min-w-0">{c._id}</span>
                              <span className="text-[12px] font-bold text-on-surface font-mono flex-shrink-0">{pct}%</span>
                            </div>
                            {/* progress bar */}
                            <div className="h-[3px] rounded-full bg-black/[0.05] ml-[15px]">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })() : (
                <div className="flex-1 flex flex-col items-center justify-center gap-[8px] text-on-surface-variant/30">
                  <span className="material-symbols-outlined text-4xl">donut_large</span>
                  <p className="text-[13px]">No category data</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-[14px]">

            {/* Recent transactions */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
              <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-black/[0.05]">
                <div>
                  <h3 className="text-[15px] font-bold text-on-surface">Recent Transactions</h3>
                  <p className="text-[12px] text-on-surface-variant/55 mt-[1px]">Latest completed sales</p>
                </div>
                <button onClick={() => navigate('/transactions')}
                  className="flex items-center gap-[4px] text-[12px] font-semibold text-primary hover:underline flex-shrink-0">
                  View all
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </button>
              </div>

              <div className="divide-y divide-black/[0.04]">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-[12px] px-[20px] py-[14px]">
                    <Sk h="h-10" w="w-10" rounded="rounded-xl" />
                    <div className="flex-1 space-y-[6px]"><Sk h="h-3" w="w-36" /><Sk h="h-3" w="w-24" /></div>
                    <Sk h="h-4" w="w-20" />
                    <Sk h="h-6" w="w-16" rounded="rounded-full" />
                  </div>
                )) : (data?.recentSales || []).map(s => {
                  const pm = PAYMENT_META[s.paymentMethod] || PAYMENT_META.cash;
                  return (
                    <div key={s._id} className="flex items-center gap-[12px] px-[20px] py-[14px] hover:bg-[#fafbff] transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pm.bg}`}>
                        <span className={`material-symbols-outlined icon-fill ${pm.text}`} style={{ fontSize: '18px' }}>{pm.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface leading-none truncate">
                          {s.customerName || 'Walk-in'}
                        </p>
                        <p className="text-[11px] text-on-surface-variant/50 mt-[3px] font-mono truncate">{s.receiptNumber}</p>
                      </div>
                      <p className="text-[14px] font-bold text-on-surface font-mono flex-shrink-0">
                        KES {Number(s.grandTotal || 0).toLocaleString('en-KE')}
                      </p>
                      <div className="flex flex-col items-end gap-[4px] flex-shrink-0">
                        <span className={`inline-flex items-center gap-[3px] px-[8px] py-[3px] rounded-full text-[11px] font-semibold ${pm.bg} ${pm.text}`}>
                          <span className="material-symbols-outlined icon-fill" style={{ fontSize: '11px' }}>{pm.icon}</span>
                          {pm.label}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/40 font-mono">
                          {new Date(s.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!loading && !data?.recentSales?.length && (
                  <div className="py-[48px] flex flex-col items-center gap-[8px] text-on-surface-variant/30">
                    <span className="material-symbols-outlined text-5xl">receipt_long</span>
                    <p className="text-[13px]">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-[14px]">

              {/* Payment method breakdown */}
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[18px]">
                <h3 className="text-[14px] font-bold text-on-surface mb-[1px]">Payment Methods</h3>
                <p className="text-[12px] text-on-surface-variant/55 mb-[14px]">This month's breakdown</p>
                {loading ? (
                  <div className="space-y-[10px]">
                    {Array(3).fill(0).map((_, i) => <Sk key={i} h="h-8" rounded="rounded-lg" />)}
                  </div>
                ) : (data?.paymentMethodData || []).length > 0 ? (
                  <div className="space-y-[10px]">
                    {data.paymentMethodData.map(pm => {
                      const meta = PAYMENT_META[pm._id] || PAYMENT_META.cash;
                      const pct  = pmTotal > 0 ? Math.round((pm.total / pmTotal) * 100) : 0;
                      return (
                        <div key={pm._id}>
                          <div className="flex items-center gap-[8px] mb-[4px]">
                            <span className={`material-symbols-outlined icon-fill ${meta.text}`} style={{ fontSize: '14px' }}>{meta.icon}</span>
                            <span className="text-[12px] font-semibold text-on-surface flex-1">{meta.label}</span>
                            <span className="text-[12px] font-bold font-mono text-on-surface">{pct}%</span>
                          </div>
                          <div className="h-[5px] rounded-full bg-black/[0.05]">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: pm._id === 'mpesa' ? '#10b981' : pm._id === 'card' ? '#8b5cf6' : '#3b82f6' }} />
                          </div>
                          <p className="text-[10px] text-on-surface-variant/40 font-mono mt-[2px] text-right">
                            KES {Number(pm.total).toLocaleString('en-KE')} · {pm.count} sale{pm.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-on-surface-variant/40 text-center py-[16px]">No payment data</p>
                )}
              </div>

              {/* Stock alerts */}
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[18px] flex flex-col">
                <div className="flex items-center justify-between mb-[12px]">
                  <div>
                    <h3 className="text-[14px] font-bold text-on-surface">Stock Alerts</h3>
                    <p className="text-[12px] text-on-surface-variant/55 mt-[1px]">
                      {loading ? '…' : `${kpis?.lowStockCount || 0} item${kpis?.lowStockCount !== 1 ? 's' : ''} need attention`}
                    </p>
                  </div>
                  <button onClick={() => navigate('/inventory')} className="btn-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                  </button>
                </div>

                <div className="space-y-[6px] overflow-y-auto max-h-[220px] no-scrollbar">
                  {loading ? Array(3).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center gap-[10px] p-[10px] rounded-xl bg-black/[0.03] animate-pulse">
                      <Sk h="h-8" w="w-8" rounded="rounded-xl" />
                      <div className="flex-1 space-y-[5px]"><Sk h="h-3" w="w-3/4" /><Sk h="h-3" w="w-1/2" /></div>
                    </div>
                  )) : (data?.stockAlerts || []).map(p => (
                    <div key={p._id}
                      className={`flex items-center gap-[10px] px-[10px] py-[9px] rounded-xl border
                        ${p.stock === 0 ? 'bg-rose-50/60 border-rose-100' : 'bg-amber-50/60 border-amber-100'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${p.stock === 0 ? 'bg-rose-100' : 'bg-amber-100'}`}>
                        <span className={`material-symbols-outlined icon-fill text-[15px]
                          ${p.stock === 0 ? 'text-rose-500' : 'text-amber-600'}`}>inventory_2</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-on-surface truncate leading-none">{p.name}</p>
                        <p className={`text-[11px] mt-[2px] font-medium ${p.stock === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                          {p.stock === 0 ? 'Out of stock' : `${p.stock} / ${p.reorderLevel} reorder level`}
                        </p>
                      </div>
                      <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 animate-pulse ${p.stock === 0 ? 'bg-rose-500' : 'bg-amber-400'}`} />
                    </div>
                  ))}
                  {!loading && !data?.stockAlerts?.length && (
                    <div className="py-[20px] flex flex-col items-center gap-[6px] text-on-surface-variant/30">
                      <span className="material-symbols-outlined icon-fill text-3xl text-emerald-400">check_circle</span>
                      <p className="text-[12px]">All items well stocked</p>
                    </div>
                  )}
                </div>

                {!loading && !!data?.stockAlerts?.length && (
                  <button onClick={() => navigate('/inventory')}
                    className="btn-secondary w-full justify-center mt-[12px] text-[12px] py-[7px]">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_cart</span>
                    Reorder Low Stock
                  </button>
                )}
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[16px]">
                <p className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-[0.09em] mb-[10px]">Quick Actions</p>
                <div className="grid grid-cols-2 gap-[8px]">
                  {[
                    { label: 'New Sale',  icon: 'point_of_sale', path: '/checkout',  color: 'text-primary',    bg: 'bg-primary/[0.07]' },
                    { label: 'Products', icon: 'inventory_2',   path: '/products',  color: 'text-violet-600', bg: 'bg-violet-50'      },
                    { label: 'Customers',icon: 'group',          path: '/customers', color: 'text-emerald-600',bg: 'bg-emerald-50'     },
                    { label: 'Reports',  icon: 'analytics',      path: '/reports',   color: 'text-amber-600',  bg: 'bg-amber-50'       },
                  ].map(a => (
                    <button key={a.path} onClick={() => navigate(a.path)}
                      className="flex flex-col items-center gap-[6px] p-[12px] rounded-xl border border-black/[0.05] hover:border-primary/20 hover:bg-surface-container-low transition-all duration-150 group">
                      <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center group-hover:scale-[1.08] transition-transform duration-150`}>
                        <span className={`material-symbols-outlined icon-fill ${a.color}`} style={{ fontSize: '18px' }}>{a.icon}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-on-surface-variant">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>{/* end right col */}
          </div>{/* end bottom row */}

        </main>
      </div>
    </div>
  );
}
