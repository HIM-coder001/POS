import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const KPI_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Today's Sales", value: fmt(data?.kpis?.todaySales), icon: 'payments', badge: '+12.5%', badgeColor: 'text-on-tertiary-container' },
    { label: 'MTD Revenue', value: fmt(data?.kpis?.mtdRevenue), icon: 'account_balance_wallet', badge: '+8.2%', badgeColor: 'text-on-tertiary-container' },
    { label: "Today's Orders", value: data?.kpis?.todayOrders ?? '—', icon: 'shopping_basket', badge: 'Total', badgeColor: 'text-secondary' },
    { label: 'Low Stock Alerts', value: data?.kpis?.lowStockCount ?? '—', icon: 'warning', badge: 'Urgent', badgeColor: 'text-error', urgent: true },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Dashboard Overview" subtitle="Real-time performance for Nairobi Main Branch" />

        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h2 className="text-headline-lg font-bold text-on-surface">Dashboard Overview</h2>
              <p className="text-body-sm text-on-surface-variant">Real-time performance tracking</p>
            </div>
            <div className="flex items-center gap-sm">
              <button className="btn-secondary gap-sm">
                <span className="material-symbols-outlined text-xl">calendar_today</span>
                <span>Last 7 Days</span>
              </button>
              <button className="btn-primary">
                <span className="material-symbols-outlined text-xl">download</span>
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {[1,2,3,4].map(i => <div key={i} className="kpi-card h-32 animate-pulse bg-surface-container-high" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {kpis.map((k) => (
                <div key={k.label} className={`kpi-card animate-fade-in ${k.urgent ? 'border-error/30' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className={`p-xs rounded-lg ${k.urgent ? 'bg-error-container/20' : 'bg-primary/10'}`}>
                      <span className={`material-symbols-outlined ${k.urgent ? 'text-error' : 'text-primary'}`}>{k.icon}</span>
                    </div>
                    <span className={`text-xs font-bold px-sm py-unit rounded ${k.urgent ? 'bg-error-container/20 text-error' : 'bg-tertiary-container/10 text-on-tertiary-container'}`}>
                      {k.badge}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant uppercase tracking-wider">{k.label}</p>
                  <p className={`font-mono text-currency font-bold ${k.urgent ? 'text-error' : 'text-primary'}`}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Bar chart */}
            <div className="lg:col-span-8 card p-lg h-[380px]">
              <div className="flex justify-between items-center mb-lg">
                <h3 className="text-title-md font-bold text-on-surface">Sales Revenue Trend</h3>
                <div className="flex items-center gap-md text-body-sm text-on-surface-variant">
                  <span className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-primary inline-block" />This Week</span>
                </div>
              </div>
              {data?.salesTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={data.salesTrend} barSize={32}>
                    <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#757682' }} tickLine={false} axisLine={false}
                      tickFormatter={v => new Date(v).toLocaleDateString('en-KE', { weekday: 'short' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#757682' }} tickLine={false} axisLine={false}
                      tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => [`KES ${v.toLocaleString()}`, 'Sales']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #c5c5d3', fontSize: 12 }} />
                    <Bar dataKey="total" fill="#00236f" radius={[6, 6, 0, 0]}
                      activeBar={{ fill: '#1e3a8a' }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center h-64 text-on-surface-variant text-body-sm">
                  No sales data yet. Run the seed script to see sample data.
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className="lg:col-span-4 card p-lg h-[380px] flex flex-col">
              <h3 className="text-title-md font-bold text-on-surface mb-md">Category Distribution</h3>
              {data?.categoryData?.length > 0 ? (
                <>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.categoryData} dataKey="total" nameKey="_id"
                          cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={3}
                          label={({ _id, percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {data.categoryData.map((_, i) => (
                            <Cell key={i} fill={KPI_COLORS[i % KPI_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`KES ${v.toLocaleString()}`, name]} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-sm mt-sm">
                    {data.categoryData.slice(0, 3).map((c, i) => (
                      <div key={c._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-sm">
                          <div className="w-2 h-2 rounded-full" style={{ background: KPI_COLORS[i % KPI_COLORS.length] }} />
                          <span className="text-body-sm">{c._id}</span>
                        </div>
                        <span className="font-mono text-label-sm">{fmt(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-sm">
                  No category data
                </div>
              )}
            </div>
          </div>

          {/* Transactions + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Recent Transactions */}
            <div className="lg:col-span-8 card overflow-hidden">
              <div className="p-lg border-b border-outline-variant/30 flex justify-between items-center">
                <h3 className="text-title-md font-bold text-on-surface">Recent Transactions</h3>
                <button className="text-primary font-bold text-body-sm hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="table-head">
                    <tr>
                      {['Receipt', 'Customer', 'Amount (KES)', 'Method', 'Time', ''].map(h => (
                        <th key={h} className="px-lg py-md">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {(data?.recentSales || []).map(s => (
                      <tr key={s._id} className="table-row">
                        <td className="px-lg py-md font-mono text-label-sm text-primary">{s.receiptNumber}</td>
                        <td className="px-lg py-md text-body-sm font-medium">{s.customerName || 'Walk-in'}</td>
                        <td className="px-lg py-md text-body-sm font-bold">{s.grandTotal?.toLocaleString()}</td>
                        <td className="px-lg py-md">
                          <span className={`px-sm py-unit rounded-full text-xs font-bold ${
                            s.paymentMethod === 'mpesa' ? 'bg-green-100 text-green-700' :
                            s.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                            'bg-surface-container-high text-on-surface-variant'}`}>
                            {s.paymentMethod?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-lg py-md text-xs text-on-surface-variant">
                          {new Date(s.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-lg py-md text-right">
                          <button className="p-unit text-secondary hover:bg-secondary-container/20 rounded">
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!data?.recentSales?.length && (
                      <tr><td colSpan={6} className="px-lg py-xl text-center text-on-surface-variant text-body-sm">No transactions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Alerts */}
            <div className="lg:col-span-4 card p-lg">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-error">inventory_2</span>
                <h3 className="text-title-md font-bold text-on-surface">Critical Stock Alerts</h3>
              </div>
              <div className="space-y-md">
                {(data?.stockAlerts || []).map(p => (
                  <div key={p._id} className={`flex items-center gap-md p-md rounded-r-lg border-l-4 ${
                    p.stock === 0 ? 'border-error bg-error-container/5' : 'border-secondary bg-secondary-container/10'}`}>
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-outline text-sm">inventory_2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-body-sm font-bold truncate">{p.name}</h5>
                      <p className="text-xs text-on-surface-variant">{p.stock === 0 ? 'Out of stock' : `${p.stock} units left`}</p>
                    </div>
                    <button className={`p-unit rounded text-on-primary ${p.stock === 0 ? 'bg-error' : 'bg-secondary'} hover:opacity-90`}>
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                    </button>
                  </div>
                ))}
                {!data?.stockAlerts?.length && (
                  <div className="text-center py-lg text-on-surface-variant text-body-sm">
                    <span className="material-symbols-outlined text-4xl block mb-sm text-tertiary-fixed-dim">check_circle</span>
                    All items well stocked!
                  </div>
                )}
              </div>
              {data?.stockAlerts?.length > 0 && (
                <button className="w-full mt-lg py-sm border border-outline-variant rounded-lg text-body-sm font-bold hover:bg-surface-container-low transition-all">
                  Order All Low Stock
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
