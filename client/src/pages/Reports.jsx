import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const COLORS = ['#00236f', '#1e3a8a', '#4de082', '#505f76', '#b6c4ff'];
const PERIODS = [['month', 'This Month'], ['quarter', 'Last Quarter'], ['week', 'This Week']];

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/reports', { params: { period } });
      setData(data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [period]);

  const kpis = data?.revenueStats
    ? [
        { label: 'Total Revenue', value: fmt(data.revenueStats.totalRevenue), icon: 'payments', badge: '+12.4%', up: true },
        { label: 'Gross Profit', value: fmt((data.revenueStats.totalRevenue || 0) - (data.revenueStats.totalVat || 0)), icon: 'account_balance_wallet', badge: '+8.2%', up: true },
        { label: 'Net Margin %', value: data.revenueStats.totalRevenue ? `${(((data.revenueStats.totalRevenue - data.revenueStats.totalVat) / data.revenueStats.totalRevenue) * 100).toFixed(1)}%` : '—', icon: 'percent', badge: '-1.5%', up: false },
        { label: 'Avg Transaction', value: fmt(data.revenueStats.avgTransaction), icon: 'shopping_cart', badge: '+5.1%', up: true },
      ]
    : [];

  // peak hours: fill 8am–8pm
  const peakData = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8;
    const found = data?.peakHours?.find(h => h._id === hour);
    return { hour: `${hour}:00`, count: found?.count || 0, revenue: found?.revenue || 0 };
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Reports & Analytics" />
        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h1 className="text-headline-lg font-bold text-primary">Reports & Analytics</h1>
              <p className="text-body-sm text-on-surface-variant">Real-time performance tracking for Nairobi Branch</p>
            </div>
            <div className="flex items-center gap-sm">
              <div className="flex bg-surface-container-lowest border border-outline-variant rounded-lg p-unit">
                {PERIODS.map(([v, l]) => (
                  <button key={v} onClick={() => setPeriod(v)}
                    className={`px-md py-sm rounded-lg text-body-sm font-medium transition-all ${
                      period === v ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'
                    }`}>{l}</button>
                ))}
              </div>
              <button className="btn-primary">
                <span className="material-symbols-outlined text-xl">download</span>Export Data
              </button>
            </div>
          </div>

          {/* KPIs */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {[1,2,3,4].map(i => <div key={i} className="kpi-card h-28 animate-pulse bg-surface-container-high" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {kpis.map(k => (
                <div key={k.label} className="kpi-card animate-fade-in">
                  <div className="flex justify-between items-start">
                    <div className="p-xs bg-primary/10 rounded-lg"><span className="material-symbols-outlined text-primary">{k.icon}</span></div>
                    <span className={`text-xs font-bold flex items-center gap-unit ${k.up ? 'text-on-tertiary-container' : 'text-error'}`}>
                      <span className="material-symbols-outlined text-sm">{k.up ? 'trending_up' : 'trending_down'}</span>{k.badge}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">{k.label}</p>
                  <p className="font-mono text-currency font-bold text-primary">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* Revenue Trend */}
            <div className="lg:col-span-2 card p-lg">
              <div className="flex justify-between items-center mb-lg">
                <div>
                  <h3 className="text-title-md font-bold">Revenue vs. Profit Trend</h3>
                  <p className="text-xs text-outline">Comparison over selected period</p>
                </div>
                <div className="flex gap-md text-xs font-bold text-on-surface-variant">
                  <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-primary" />Revenue</span>
                  <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim" />Profit</span>
                </div>
              </div>
              {data?.dailyTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.dailyTrend}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00236f" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#00236f" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4de082" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#4de082" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#757682' }} tickLine={false} axisLine={false}
                      tickFormatter={v => new Date(v).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#757682' }} tickLine={false} axisLine={false}
                      tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => `KES ${v.toLocaleString()}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #c5c5d3', fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" stroke="#00236f" strokeWidth={2.5} fill="url(#revenueGrad)" />
                    <Area type="monotone" dataKey="profit" stroke="#4de082" strokeWidth={2.5} fill="url(#profitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-on-surface-variant text-body-sm">No data for this period</div>
              )}
            </div>

            {/* Category Donut */}
            <div className="card p-lg flex flex-col">
              <h3 className="text-title-md font-bold mb-xs">Sales by Category</h3>
              <p className="text-xs text-outline mb-md">Revenue distribution</p>
              {data?.categoryBreakdown?.length > 0 ? (
                <>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.categoryBreakdown} dataKey="total" nameKey="_id"
                          cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                          {data.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => `KES ${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-sm mt-sm">
                    {data.categoryBreakdown.slice(0, 4).map((c, i) => (
                      <div key={c._id} className="flex items-center justify-between text-body-sm">
                        <div className="flex items-center gap-sm">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span>{c._id}</span>
                        </div>
                        <span className="font-mono font-bold">{fmt(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-sm">No data</div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter">
            {/* Best Sellers Table */}
            <div className="card overflow-hidden">
              <div className="p-lg bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
                <h3 className="text-title-md font-bold">Best Selling Products</h3>
                <button className="text-primary font-bold text-body-sm hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="table-head">
                    <tr>
                      {['Rank','Product Name','Units Sold','Revenue'].map(h => <th key={h} className="px-lg py-md">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {(data?.bestSellers || []).slice(0, 5).map((p, i) => (
                      <tr key={p._id} className="table-row">
                        <td className="px-lg py-md font-mono text-primary font-bold">#{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-lg py-md text-body-sm">{p.name}</td>
                        <td className="px-lg py-md text-body-sm font-mono">{p.unitsSold?.toLocaleString()}</td>
                        <td className="px-lg py-md font-mono font-bold text-primary">{fmt(p.revenue)}</td>
                      </tr>
                    ))}
                    {!data?.bestSellers?.length && (
                      <tr><td colSpan={4} className="px-lg py-xl text-center text-on-surface-variant text-body-sm">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory & Heatmap */}
            <div className="space-y-gutter">
              {/* Inventory Valuation Card */}
              <div className="card bg-primary text-on-primary p-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-lg opacity-20 translate-x-4 -translate-y-4">
                  <span className="material-symbols-outlined text-[80px]">warehouse</span>
                </div>
                <h3 className="text-title-md font-bold mb-md relative z-10">Inventory Valuation</h3>
                <div className="relative z-10 space-y-md">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-70">Total Stock Value</p>
                    <p className="text-headline-md font-bold">{fmt(data?.inventoryVal?.stockValue)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-md pt-md border-t border-on-primary/10">
                    <div>
                      <p className="text-xs uppercase opacity-70">Potential Profit</p>
                      <p className="font-bold">{fmt(data?.inventoryVal?.potentialProfit)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase opacity-70">Low Stock Alerts</p>
                      <p className="font-bold flex items-center gap-xs">
                        <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                        {data?.inventoryVal?.lowStockItems || 0} Items
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Peak Hours Heatmap */}
              <div className="card p-lg">
                <div className="flex justify-between items-center mb-md">
                  <h3 className="text-title-md font-bold">Peak Sales Hours</h3>
                  <span className="text-xs text-outline font-bold uppercase">Activity Level</span>
                </div>
                <div className="grid grid-cols-12 gap-1 mb-sm">
                  {peakData.map((h, i) => {
                    const maxCount = Math.max(...peakData.map(d => d.count), 1);
                    const intensity = h.count / maxCount;
                    return (
                      <div key={i}
                        className="aspect-square rounded transition-all hover:scale-125 cursor-help relative group"
                        style={{ backgroundColor: `rgba(0,35,111,${Math.max(0.05, intensity)})` }}>
                        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-inverse-surface text-inverse-on-surface px-sm py-xs rounded text-[10px] whitespace-nowrap z-10">
                          {h.hour}: {h.count} sales
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-outline font-mono uppercase">
                  <span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
                </div>
                <p className="text-body-sm text-on-surface-variant mt-md">
                  <span className="font-bold text-primary">Tip:</span> Monitor peak hours to optimize cashier scheduling.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center py-md border-t border-outline-variant/30">
            <p className="text-xs text-outline">Powered by <span className="font-bold text-primary">RetailEdge Analytics Engine v4.2</span> • © 2024 Kenya Retail Solutions LTD</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
