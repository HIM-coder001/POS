import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt     = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const fmtS    = (n) => { const v = Number(n||0); if(v>=1e6) return `${(v/1e6).toFixed(1)}M`; if(v>=1e3) return `${(v/1e3).toFixed(1)}K`; return v.toLocaleString('en-KE'); };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' });
const fmtDT   = (d) => new Date(d).toLocaleString('en-KE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

const COLORS = ['#00236f','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899'];

const TABS = [
  { key:'overview',   label:'Sales Overview', icon:'bar_chart'          },
  { key:'purchases',  label:'Purchases',      icon:'shopping_bag'       },
  { key:'expenses',   label:'Expenses',       icon:'receipt_long'       },
  { key:'pnl',        label:'P & L',          icon:'account_balance'    },
  { key:'inventory',  label:'Inventory',      icon:'inventory_2'        },
  { key:'daily',      label:'Daily Sales',    icon:'today'              },
  { key:'eod',        label:'End of Day',     icon:'nightlight'         },
  { key:'audit',      label:'Audit Trail',    icon:'manage_search'      },
];

const defaultFrom = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };
const defaultTo   = () => new Date().toISOString().slice(0,10);

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Sk = ({ h='h-4', w='w-full', r='rounded-lg' }) => (
  <div className={`${h} ${w} ${r} bg-black/[0.06] animate-pulse`} />
);

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, iconBg, iconColor, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[18px] flex gap-[12px] items-start">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${iconBg}`}>
        <span className={`material-symbols-outlined icon-fill ${iconColor} text-[20px] leading-none`}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.08em] leading-none mb-[5px] truncate">{label}</p>
        {loading ? <><Sk h="h-6" w="w-28" /><Sk h="h-3" w="w-16" r="rounded mt-[6px]" /></> : (
          <>
            <p className="text-[20px] font-extrabold text-on-surface leading-tight truncate">{value ?? '—'}</p>
            {sub && <p className="text-[11px] text-on-surface-variant/50 mt-[4px] truncate">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Custom chart tooltip ───────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/[0.08] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-[14px] py-[10px] text-[12px]">
      <p className="font-semibold text-on-surface-variant/70 mb-[4px]">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}} className="font-bold">
          {p.name}: {p.name?.toLowerCase().includes('count')||p.name?.toLowerCase().includes('tx') ? p.value : `KES ${Number(p.value||0).toLocaleString('en-KE')}`}
        </p>
      ))}
    </div>
  );
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');
  const [from, setFrom]           = useState(defaultFrom());
  const [to,   setTo]             = useState(defaultTo());

  // per-tab data
  const [overview,  setOverview]  = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [expenses,  setExpenses]  = useState(null);
  const [pnl,       setPnl]       = useState(null);
  const [daily,     setDaily]     = useState([]);
  const [eodDate,   setEodDate]   = useState(defaultTo());
  const [eod,       setEod]       = useState(null);
  const [inv,       setInv]       = useState({ products:[], total:0, pages:1 });
  const [audit,     setAudit]     = useState({ entries:[], total:0, pages:1 });

  // loading flags
  const [loading, setLoading]     = useState({});
  const setL = (tab, v) => setLoading(p => ({...p, [tab]:v}));

  // filters
  const [invSearch,   setInvSearch]   = useState('');
  const [invPage,     setInvPage]     = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage,   setAuditPage]   = useState(1);

  const dp = { from, to };

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setL('overview', true);
    try { const {data:d} = await api.get('/reports', {params:dp}); setOverview(d); }
    catch { toast.error('Failed to load sales overview'); }
    finally { setL('overview', false); }
  }, [from, to]);

  const fetchPurchases = useCallback(async () => {
    setL('purchases', true);
    try { const {data:d} = await api.get('/reports/purchases', {params:dp}); setPurchases(d); }
    catch { toast.error('Failed to load purchases'); }
    finally { setL('purchases', false); }
  }, [from, to]);

  const fetchExpenses = useCallback(async () => {
    setL('expenses', true);
    try { const {data:d} = await api.get('/reports/expenses', {params:dp}); setExpenses(d); }
    catch { toast.error('Failed to load expenses'); }
    finally { setL('expenses', false); }
  }, [from, to]);

  const fetchPnl = useCallback(async () => {
    setL('pnl', true);
    try { const {data:d} = await api.get('/reports/pnl', {params:dp}); setPnl(d); }
    catch { toast.error('Failed to load P&L'); }
    finally { setL('pnl', false); }
  }, [from, to]);

  const fetchDaily = useCallback(async () => {
    setL('daily', true);
    try { const {data:d} = await api.get('/reports/daily-sales', {params:dp}); setDaily(d); }
    catch { toast.error('Failed to load daily sales'); }
    finally { setL('daily', false); }
  }, [from, to]);

  const fetchEod = useCallback(async () => {
    setL('eod', true);
    try { const {data:d} = await api.get('/reports/end-of-day', {params:{date:eodDate}}); setEod(d); }
    catch { toast.error('Failed to load end of day'); }
    finally { setL('eod', false); }
  }, [eodDate]);

  const fetchInv = useCallback(async () => {
    setL('inventory', true);
    try { const {data:d} = await api.get('/reports/inventory', {params:{search:invSearch,page:invPage}}); setInv(d); }
    catch { toast.error('Failed to load inventory'); }
    finally { setL('inventory', false); }
  }, [invSearch, invPage]);

  const fetchAudit = useCallback(async () => {
    setL('audit', true);
    try { const {data:d} = await api.get('/reports/audit-trail', {params:{...dp,search:auditSearch,page:auditPage}}); setAudit(d); }
    catch { toast.error('Failed to load audit trail'); }
    finally { setL('audit', false); }
  }, [from, to, auditSearch, auditPage]);

  // Trigger on tab change + date change
  useEffect(() => {
    if (activeTab==='overview')  fetchOverview();
    if (activeTab==='purchases') fetchPurchases();
    if (activeTab==='expenses')  fetchExpenses();
    if (activeTab==='pnl')       fetchPnl();
    if (activeTab==='daily')     fetchDaily();
    if (activeTab==='eod')       fetchEod();
    if (activeTab==='inventory') fetchInv();
    if (activeTab==='audit')     fetchAudit();
  }, [activeTab, from, to]);

  useEffect(() => { if (activeTab==='eod') fetchEod(); }, [eodDate]);
  useEffect(() => { if (activeTab==='inventory') fetchInv(); }, [invSearch, invPage]);
  useEffect(() => { if (activeTab==='audit') fetchAudit(); }, [auditSearch, auditPage]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = (rows, headers, filename) => {
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Exported!');
  };

  const isLoading = loading[activeTab];

  return (
    <div className="flex h-screen bg-[#f0f2f5]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <TopNav title="Reports" />

        {/* Two-column layout identical to Settings */}
        <div className="flex flex-1 overflow-hidden px-[24px] pt-[20px] pb-[32px] gap-[20px] min-h-0">

          {/* ── Left sidebar — never scrolls ── */}
          <div className="w-[200px] flex-shrink-0 flex flex-col gap-[12px]">
            {/* Tab nav */}
            <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
              <nav className="py-[6px]">
                {TABS.map(tab=>(
                  <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
                    className={`w-full flex items-center gap-[8px] text-left pl-[16px] pr-[12px] py-[9px] text-[13px] transition-all duration-150
                      ${activeTab===tab.key
                        ? 'text-primary font-semibold bg-primary/[0.07]'
                        : 'text-on-surface-variant/80 hover:bg-black/[0.03] hover:text-on-surface font-medium'}`}>
                    <span className="material-symbols-outlined flex-shrink-0"
                      style={{fontSize:'15px', fontVariationSettings: activeTab===tab.key ? "'FILL' 1" : "'FILL' 0"}}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* ── Right content — only this scrolls ── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {/* Date range — sticky at the top of the scroll area */}
            <div className="sticky top-0 z-10 bg-[#f0f2f5] pb-[12px]">
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] px-[16px] py-[10px] flex items-center gap-[12px] flex-wrap">
                <span className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-[0.09em] flex-shrink-0">Period</span>
                <div className="flex items-center gap-[8px] bg-surface-container-low border border-black/[0.07] rounded-xl px-[12px] py-[6px]">
                  <span className="material-symbols-outlined text-on-surface-variant/40" style={{fontSize:'14px'}}>calendar_today</span>
                  <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
                    className="text-[12px] text-on-surface bg-transparent outline-none cursor-pointer" />
                  <span className="text-on-surface-variant/30 text-[12px]">→</span>
                  <input type="date" value={to} onChange={e=>setTo(e.target.value)}
                    className="text-[12px] text-on-surface bg-transparent outline-none cursor-pointer" />
                </div>
                <div className="flex items-center gap-[4px]">
                  {[{label:'Today',days:0},{label:'7 days',days:7},{label:'30 days',days:30},{label:'90 days',days:90}].map(p=>(
                    <button key={p.label} onClick={()=>{
                      const d=new Date(); const f=new Date(); f.setDate(f.getDate()-p.days);
                      setFrom(f.toISOString().slice(0,10)); setTo(d.toISOString().slice(0,10));
                    }} className="text-[11px] font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/[0.06] px-[10px] py-[5px] rounded-lg transition-colors whitespace-nowrap">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-[16px] pb-[32px]">

          {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
          {activeTab==='overview' && (() => {
            const rs = overview?.revenueStats || {};
            const grossProfit = (rs.totalRevenue||0) - (rs.totalCost||0);
            const margin = rs.totalRevenue ? ((grossProfit/rs.totalRevenue)*100).toFixed(1) : '0.0';
            return (
              <div className="space-y-[16px] animate-fade-in">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
                  <StatCard label="Total Revenue"   value={fmt(rs.totalRevenue)}   sub={`${rs.txCount||0} transactions`}    icon="payments"           iconBg="bg-primary/[0.08]" iconColor="text-primary"    loading={isLoading} />
                  <StatCard label="Gross Profit"    value={fmt(grossProfit)}        sub={`${margin}% margin`}                icon="trending_up"        iconBg="bg-emerald-50"     iconColor="text-emerald-600" loading={isLoading} />
                  <StatCard label="Total Discounts" value={fmt(rs.totalDiscount)}   sub="given to customers"                 icon="price_cut"          iconBg="bg-amber-50"       iconColor="text-amber-600"  loading={isLoading} />
                  <StatCard label="Avg Transaction" value={fmt(rs.avgTransaction)}  sub="per sale"                           icon="shopping_cart"      iconBg="bg-violet-50"      iconColor="text-violet-600" loading={isLoading} />
                </div>

                {/* Revenue & Profit trend */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                  <h3 className="text-[14px] font-bold text-on-surface mb-[4px]">Revenue vs Profit Trend</h3>
                  <p className="text-[12px] text-on-surface-variant/55 mb-[16px]">Daily breakdown for selected period</p>
                  {isLoading ? <Sk h="h-[200px]" /> : overview?.dailyTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={overview.dailyTrend} margin={{top:4,right:4,left:0,bottom:0}}>
                        <defs>
                          <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="profG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="_id" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false}
                          tickFormatter={v=>new Date(v).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} />
                        <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={44} tickFormatter={fmtS} />
                        <Tooltip content={<ChartTip />} />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#revG)" dot={false} />
                        <Area type="monotone" dataKey="profit"  name="Profit"  stroke="#10b981"              strokeWidth={2} fill="url(#profG)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[200px] flex items-center justify-center text-on-surface-variant/30 text-[13px]">No data for this period</div>}
                </div>

                {/* Category + Payment breakdown */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
                  <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                    <h3 className="text-[14px] font-bold text-on-surface mb-[14px]">Revenue by Category</h3>
                    {isLoading ? <Sk h="h-[160px]" /> : overview?.categoryBreakdown?.length > 0 ? (
                      <div className="space-y-[8px]">
                        {(() => { const tot=overview.categoryBreakdown.reduce((s,c)=>s+c.total,0); return overview.categoryBreakdown.map((c,i)=>{
                          const pct=tot>0?Math.round((c.total/tot)*100):0;
                          return (
                            <div key={c._id}>
                              <div className="flex items-center gap-[8px] mb-[3px]">
                                <span className="text-[12px] text-on-surface font-medium flex-1 min-w-0 truncate">{c._id||'Uncategorised'}</span>
                                <span className="text-[11px] font-bold text-on-surface-variant/60 flex-shrink-0 w-[32px] text-right">{pct}%</span>
                                <span className="text-[12px] font-bold font-mono text-on-surface flex-shrink-0 w-[110px] text-right">{fmt(c.total)}</span>
                              </div>
                              <div className="h-[4px] rounded-full bg-black/[0.05]">
                                <div className="h-full rounded-full" style={{width:`${pct}%`,background:COLORS[i%COLORS.length]}} />
                              </div>
                            </div>
                          );
                        })})()}
                      </div>
                    ) : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No category data</p>}
                  </div>

                  <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                    <h3 className="text-[14px] font-bold text-on-surface mb-[14px]">Payment Methods</h3>
                    {isLoading ? <Sk h="h-[160px]" /> : overview?.paymentBreakdown?.length > 0 ? (
                      <div className="space-y-[10px]">
                        {(() => { const tot=overview.paymentBreakdown.reduce((s,p)=>s+p.total,0); return overview.paymentBreakdown.map((p,i)=>{
                          const pct=tot>0?Math.round((p.total/tot)*100):0;
                          const meta={mpesa:{icon:'phone_android',color:'#10b981'},cash:{icon:'payments',color:'#3b82f6'},card:{icon:'credit_card',color:'#8b5cf6'}};
                          const m=meta[p._id]||{icon:'payments',color:'#9ca3af'};
                          return (
                            <div key={p._id}>
                              <div className="flex items-center gap-[8px] mb-[4px]">
                                <span className="material-symbols-outlined icon-fill flex-shrink-0" style={{fontSize:'14px',color:m.color}}>{m.icon}</span>
                                <span className="text-[12px] font-semibold text-on-surface capitalize flex-1 min-w-0">{p._id}</span>
                                <span className="text-[11px] font-bold text-on-surface-variant/60 flex-shrink-0 w-[32px] text-right">{pct}%</span>
                                <span className="text-[12px] font-bold font-mono text-on-surface flex-shrink-0 w-[110px] text-right">{fmt(p.total)}</span>
                              </div>
                              <div className="h-[4px] rounded-full bg-black/[0.05]">
                                <div className="h-full rounded-full" style={{width:`${pct}%`,background:m.color}} />
                              </div>
                            </div>
                          );
                        })})()}
                      </div>
                    ) : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No data</p>}
                  </div>
                </div>

                {/* Best sellers */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-[20px] py-[14px] border-b border-black/[0.05]">
                    <h3 className="text-[14px] font-bold text-on-surface">Best Selling Products</h3>
                  </div>
                  <table className="w-full text-left">
                    <thead className="table-head"><tr>
                      <th className="px-[20px] py-[10px]">Product</th>
                      <th className="px-[20px] py-[10px] text-right">Units Sold</th>
                      <th className="px-[20px] py-[10px] text-right">Revenue</th>
                    </tr></thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {isLoading ? Array(5).fill(0).map((_,i)=>(
                        <tr key={i}><td colSpan={3} className="px-[20px] py-[12px]"><Sk /></td></tr>
                      )) : (overview?.bestSellers||[]).map((p,i)=>(
                        <tr key={i} className="table-row">
                          <td className="px-[20px] py-[12px] text-[13px] font-medium text-on-surface">{p.name}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{p.unitsSold}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono font-bold text-primary text-[13px]">{fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ══ PURCHASES ═════════════════════════════════════════════ */}
          {activeTab==='purchases' && (() => {
            const s = purchases?.summary || {};
            const cogs = purchases?.cogsSold || {};
            const margin = s.totalRetailValue > 0
              ? (((s.totalRetailValue - s.totalStockValue) / s.totalRetailValue)*100).toFixed(1) : '0.0';
            return (
              <div className="space-y-[16px] animate-fade-in">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
                  <StatCard label="Total Stock Cost Value" value={fmt(s.totalStockValue)}  sub={`${s.totalProducts||0} products`}   icon="inventory_2"      iconBg="bg-primary/[0.08]" iconColor="text-primary"    loading={isLoading} />
                  <StatCard label="Total Retail Value"     value={fmt(s.totalRetailValue)} sub="at selling price"                   icon="store"            iconBg="bg-emerald-50"     iconColor="text-emerald-600" loading={isLoading} />
                  <StatCard label="COGS Sold (Period)"     value={fmt(cogs.totalCOGS)}     sub={`${cogs.totalUnits||0} units sold`} icon="shopping_bag"     iconBg="bg-amber-50"       iconColor="text-amber-600"  loading={isLoading} />
                  <StatCard label="Avg Margin"             value={`${s.avgMargin?.toFixed(1)||'0.0'}%`} sub="across all products"  icon="percent"          iconBg="bg-violet-50"      iconColor="text-violet-600" loading={isLoading} />
                </div>

                {/* Category cost breakdown */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                  <h3 className="text-[14px] font-bold text-on-surface mb-[14px]">Stock Cost by Category</h3>
                  {isLoading ? <Sk h="h-[180px]" /> : purchases?.byCategory?.length > 0 ? (
                    <div className="space-y-[10px]">
                      {(() => { const tot=purchases.byCategory.reduce((s,c)=>s+c.totalCostValue,0); return purchases.byCategory.map((c,i)=>{
                        const pct=tot>0?Math.round((c.totalCostValue/tot)*100):0;
                        return (
                          <div key={c._id}>
                            <div className="flex items-center gap-[8px] mb-[3px]">
                              <span className="text-[12px] text-on-surface font-medium flex-1 min-w-0 truncate">{c._id||'Uncategorised'}</span>
                              <span className="text-[11px] text-on-surface-variant/60 flex-shrink-0">{c.totalUnits} units</span>
                              <span className="text-[11px] font-bold text-on-surface-variant/60 flex-shrink-0 w-[32px] text-right">{pct}%</span>
                              <span className="text-[12px] font-bold font-mono text-on-surface flex-shrink-0 w-[110px] text-right">{fmt(c.totalCostValue)}</span>
                            </div>
                            <div className="h-[4px] rounded-full bg-black/[0.05]">
                              <div className="h-full rounded-full" style={{width:`${pct}%`,background:COLORS[i%COLORS.length]}} />
                            </div>
                          </div>
                        );
                      })})()}
                    </div>
                  ) : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No purchase data</p>}
                </div>

                {/* Top products by cost */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-[20px] py-[14px] border-b border-black/[0.05]">
                    <h3 className="text-[14px] font-bold text-on-surface">Products by Cost Price</h3>
                  </div>
                  <table className="w-full text-left">
                    <thead className="table-head"><tr>
                      <th className="px-[20px] py-[10px]">Product</th>
                      <th className="px-[20px] py-[10px]">Category</th>
                      <th className="px-[20px] py-[10px] text-right">Stock</th>
                      <th className="px-[20px] py-[10px] text-right">Cost Price</th>
                      <th className="px-[20px] py-[10px] text-right">Sell Price</th>
                      <th className="px-[20px] py-[10px] text-right">Margin</th>
                      <th className="px-[20px] py-[10px] text-right">Stock Value</th>
                    </tr></thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {isLoading ? Array(6).fill(0).map((_,i)=>(
                        <tr key={i}><td colSpan={7} className="px-[20px] py-[12px]"><Sk /></td></tr>
                      )) : (purchases?.topProducts||[]).map(p=>{
                        const mg=p.price>0?(((p.price-p.costPrice)/p.price)*100).toFixed(1):0;
                        return (
                          <tr key={p._id} className="table-row">
                            <td className="px-[20px] py-[12px] text-[13px] font-medium text-on-surface">{p.name}</td>
                            <td className="px-[20px] py-[12px]"><span className="badge badge-blue">{p.category}</span></td>
                            <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{p.stock}</td>
                            <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{fmt(p.costPrice)}</td>
                            <td className="px-[20px] py-[12px] text-right font-mono font-bold text-primary text-[13px]">{fmt(p.price)}</td>
                            <td className="px-[20px] py-[12px] text-right">
                              <span className={`text-[11px] font-bold px-[6px] py-[2px] rounded-full ${Number(mg)>=30?'bg-emerald-50 text-emerald-700':Number(mg)>=10?'bg-amber-50 text-amber-700':'bg-red-50 text-red-600'}`}>{mg}%</span>
                            </td>
                            <td className="px-[20px] py-[12px] text-right font-mono font-bold text-[13px]">{fmt(p.costPrice*p.stock)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ══ EXPENSES ══════════════════════════════════════════════ */}
          {activeTab==='expenses' && (() => {
            const t = expenses?.totals || {};
            return (
              <div className="space-y-[16px] animate-fade-in">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
                  <StatCard label="Cost of Goods Sold" value={fmt(t.totalCOGS)}     sub="direct product cost"       icon="shopping_bag"  iconBg="bg-rose-50"        iconColor="text-rose-600"    loading={isLoading} />
                  <StatCard label="Discounts Given"    value={fmt(t.totalDiscount)} sub="to customers"              icon="price_cut"     iconBg="bg-amber-50"       iconColor="text-amber-600"   loading={isLoading} />
                  <StatCard label="VAT Collected"      value={fmt(t.totalVAT)}      sub="payable to KRA"            icon="percent"       iconBg="bg-violet-50"      iconColor="text-violet-600"  loading={isLoading} />
                  <StatCard label="Total Revenue"      value={fmt(t.totalRevenue)}  sub={`${t.txCount||0} sales`}   icon="payments"      iconBg="bg-emerald-50"     iconColor="text-emerald-600" loading={isLoading} />
                </div>

                {/* Expense composition */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                  <h3 className="text-[14px] font-bold text-on-surface mb-[4px]">Expense Composition</h3>
                  <p className="text-[12px] text-on-surface-variant/55 mb-[16px]">How revenue is split between costs, discounts and VAT</p>
                  {isLoading ? <Sk h="h-[160px]" /> : t.totalRevenue > 0 ? (() => {
                    const items = [
                      {label:'COGS',       value:t.totalCOGS||0,     color:'#f43f5e'},
                      {label:'Discounts',  value:t.totalDiscount||0,  color:'#f59e0b'},
                      {label:'VAT',        value:t.totalVAT||0,       color:'#8b5cf6'},
                      {label:'Net Profit', value:Math.max(0,(t.totalRevenue||0)-(t.totalCOGS||0)-(t.totalDiscount||0)-(t.totalVAT||0)), color:'#10b981'},
                    ];
                    return (
                      <div className="space-y-[12px]">
                        {items.map(item=>{
                          const pct=t.totalRevenue>0?((item.value/t.totalRevenue)*100).toFixed(1):0;
                          return (
                            <div key={item.label}>
                              <div className="flex items-center gap-[8px] mb-[5px]">
                                <div className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{background:item.color}} />
                                <span className="text-[13px] font-semibold text-on-surface flex-1 min-w-0">{item.label}</span>
                                <span className="text-[11px] font-bold text-on-surface-variant/60 flex-shrink-0 w-[36px] text-right">{pct}%</span>
                                <span className="text-[13px] font-bold font-mono text-on-surface flex-shrink-0 w-[130px] text-right truncate">{fmt(item.value)}</span>
                              </div>
                              <div className="h-[5px] rounded-full bg-black/[0.05] ml-[16px]">
                                <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:item.color}} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No expense data for this period</p>}
                </div>

                {/* Daily expense trend */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                  <h3 className="text-[14px] font-bold text-on-surface mb-[16px]">Daily Expense Trend</h3>
                  {isLoading ? <Sk h="h-[180px]" /> : expenses?.daily?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={expenses.daily} barSize={14} barGap={2}>
                        <XAxis dataKey="_id" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false}
                          tickFormatter={v=>new Date(v).toLocaleDateString('en-KE',{day:'numeric',month:'short'})} />
                        <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={44} tickFormatter={fmtS} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="totalCOGS"     name="COGS"      fill="#f43f5e" radius={[3,3,0,0]} />
                        <Bar dataKey="totalDiscount" name="Discounts" fill="#f59e0b" radius={[3,3,0,0]} />
                        <Bar dataKey="totalVAT"      name="VAT"       fill="#8b5cf6" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No data</p>}
                </div>

                {/* By payment method */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-[20px] py-[14px] border-b border-black/[0.05]">
                    <h3 className="text-[14px] font-bold text-on-surface">Breakdown by Payment Method</h3>
                  </div>
                  <table className="w-full text-left">
                    <thead className="table-head"><tr>
                      <th className="px-[20px] py-[10px]">Method</th>
                      <th className="px-[20px] py-[10px] text-right">Sales</th>
                      <th className="px-[20px] py-[10px] text-right">Revenue</th>
                      <th className="px-[20px] py-[10px] text-right">Discounts</th>
                      <th className="px-[20px] py-[10px] text-right">VAT</th>
                    </tr></thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {isLoading ? Array(3).fill(0).map((_,i)=>(
                        <tr key={i}><td colSpan={5} className="px-[20px] py-[12px]"><Sk /></td></tr>
                      )) : (expenses?.byMethod||[]).map(p=>(
                        <tr key={p._id} className="table-row">
                          <td className="px-[20px] py-[12px] text-[13px] font-semibold text-on-surface capitalize">{p._id}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{p.count}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono font-bold text-primary text-[13px]">{fmt(p.revenue)}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono text-amber-600 text-[13px]">{fmt(p.discount)}</td>
                          <td className="px-[20px] py-[12px] text-right font-mono text-violet-600 text-[13px]">{fmt(p.vat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ══ P&L ═══════════════════════════════════════════════════ */}
          {activeTab==='pnl' && (() => {
            const s = pnl?.summary || {};
            const isProfit = (s.netProfit||0) >= 0;
            return (
              <div className="space-y-[16px] animate-fade-in">
                {/* P&L Statement card */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-[24px] py-[16px] border-b border-black/[0.05] bg-[#fafafa]">
                    <h3 className="text-[15px] font-bold text-on-surface">Profit & Loss Statement</h3>
                    <p className="text-[12px] text-on-surface-variant/55 mt-[2px]">{fmtDate(from)} — {fmtDate(to)}</p>
                  </div>
                  <div className="p-[24px] space-y-[0px]">
                    {isLoading ? <div className="space-y-[10px]">{Array(8).fill(0).map((_,i)=><Sk key={i} h="h-8" />)}</div> : [
                      { label:'Gross Revenue',   value:s.grossRevenue,   indent:0, bold:false, color:'text-on-surface'     },
                      { label:'Cost of Goods Sold', value:-(s.totalCOGS||0), indent:1, bold:false, color:'text-rose-600'   },
                      { label:'Gross Profit',    value:s.grossProfit,    indent:0, bold:true,  color:'text-emerald-700', border:true },
                      { label:'Discounts Given', value:-(s.totalDiscounts||0), indent:1, bold:false, color:'text-amber-600' },
                      { label:'VAT Collected',   value:-(s.totalVAT||0), indent:1, bold:false, color:'text-violet-600'   },
                      { label:'Net Profit',      value:s.netProfit,      indent:0, bold:true,  color:isProfit?'text-emerald-700':'text-rose-600', border:true, large:true },
                      { label:'Net Margin',      value:null,             indent:0, bold:false, color:'text-on-surface-variant/60', sub:`${s.margin}%` },
                      { label:'Transactions',    value:null,             indent:0, bold:false, color:'text-on-surface-variant/60', sub:`${s.txCount||0} sales` },
                    ].map((row,i)=>(
                      <div key={i} className={`flex items-center gap-[12px] py-[10px] ${row.border?'border-t-2 border-black/[0.08] mt-[4px]':''}`}
                        style={{paddingLeft: row.indent ? `${row.indent*20}px` : '0'}}>
                        <span className={`text-[13px] flex-1 min-w-0 truncate ${row.bold?'font-bold text-on-surface':'text-on-surface-variant'}`}>{row.label}</span>
                        <span className={`font-mono flex-shrink-0 ${row.large?'text-[20px]':'text-[14px]'} font-bold ${row.color}`}>
                          {row.sub ?? fmt(row.value||0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly P&L chart */}
                <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                  <h3 className="text-[14px] font-bold text-on-surface mb-[16px]">Monthly Revenue vs Net Profit</h3>
                  {isLoading ? <Sk h="h-[200px]" /> : pnl?.monthly?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={pnl.monthly} barSize={20} barGap={4}>
                        <XAxis dataKey="_id" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} />
                        <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={50} tickFormatter={fmtS} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="revenue"   name="Revenue"    fill="var(--color-primary)" radius={[4,4,0,0]} />
                        <Bar dataKey="netProfit" name="Net Profit" fill="#10b981"              radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-[13px] text-on-surface-variant/40 text-center py-[32px]">No monthly data for this period</p>}
                </div>
              </div>
            );
          })()}

          {/* ══ INVENTORY ═════════════════════════════════════════════ */}
          {activeTab==='inventory' && (
            <div className="space-y-[16px] animate-fade-in">
              <div className="flex gap-[10px] items-center">
                <div className="relative flex-1 max-w-sm">
                  <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{fontSize:'18px'}}>search</span>
                  <input value={invSearch} onChange={e=>{setInvSearch(e.target.value);setInvPage(1);}}
                    placeholder="Search products…" className="input pl-[38px]" />
                </div>
                <span className="text-[12px] text-on-surface-variant/60">{inv.total} items</span>
              </div>
              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="table-head"><tr>
                    <th className="px-[20px] py-[10px]">Product</th>
                    <th className="px-[20px] py-[10px]">SKU</th>
                    <th className="px-[20px] py-[10px]">Category</th>
                    <th className="px-[20px] py-[10px] text-right">Stock</th>
                    <th className="px-[20px] py-[10px] text-right">Reorder</th>
                    <th className="px-[20px] py-[10px] text-right">Stock Value</th>
                    <th className="px-[20px] py-[10px]">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {isLoading ? Array(8).fill(0).map((_,i)=>(
                      <tr key={i}><td colSpan={7} className="px-[20px] py-[12px]"><Sk /></td></tr>
                    )) : inv.products.map(p=>(
                      <tr key={p._id} className="table-row">
                        <td className="px-[20px] py-[12px] text-[13px] font-medium text-on-surface">{p.name}</td>
                        <td className="px-[20px] py-[12px] font-mono text-[11px] text-on-surface-variant/60">{p.sku}</td>
                        <td className="px-[20px] py-[12px]"><span className="badge badge-blue">{p.category}</span></td>
                        <td className="px-[20px] py-[12px] text-right font-mono font-bold text-[13px]">{p.stock}</td>
                        <td className="px-[20px] py-[12px] text-right font-mono text-[13px] text-on-surface-variant/60">{p.reorderLevel}</td>
                        <td className="px-[20px] py-[12px] text-right font-mono font-bold text-primary text-[13px]">{fmt(p.price*p.stock)}</td>
                        <td className="px-[20px] py-[12px]">
                          <span className={`badge ${p.stock===0?'badge-red':p.stock<=p.reorderLevel?'badge-amber':'badge-green'}`}>
                            {p.stock===0?'Out of Stock':p.stock<=p.reorderLevel?'Low Stock':'In Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inv.pages > 1 && (
                  <div className="flex items-center justify-between px-[20px] py-[10px] border-t border-black/[0.05] bg-[#fafafa] text-[12px]">
                    <span className="text-on-surface-variant/60">Page {invPage} of {inv.pages}</span>
                    <div className="flex gap-[6px]">
                      <button disabled={invPage<=1} onClick={()=>setInvPage(p=>p-1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Prev</button>
                      <span className="px-[12px] py-[5px] rounded-lg bg-primary text-white font-bold">{invPage}</span>
                      <button disabled={invPage>=inv.pages} onClick={()=>setInvPage(p=>p+1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DAILY SALES ═══════════════════════════════════════════ */}
          {activeTab==='daily' && (
            <div className="animate-fade-in bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
              <table className="w-full text-left">
                <thead className="table-head"><tr>
                  <th className="px-[20px] py-[10px]">Date</th>
                  <th className="px-[20px] py-[10px] text-right">Transactions</th>
                  <th className="px-[20px] py-[10px] text-right">Revenue</th>
                  <th className="px-[20px] py-[10px] text-right">Discount</th>
                  <th className="px-[20px] py-[10px] text-right">VAT</th>
                  <th className="px-[20px] py-[10px] text-right">Avg Ticket</th>
                </tr></thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {isLoading ? Array(7).fill(0).map((_,i)=>(
                    <tr key={i}><td colSpan={6} className="px-[20px] py-[12px]"><Sk /></td></tr>
                  )) : daily.length===0 ? (
                    <tr><td colSpan={6} className="px-[20px] py-[40px] text-center text-on-surface-variant/40 text-[13px]">No sales in this period</td></tr>
                  ) : daily.map(r=>(
                    <tr key={r._id} className="table-row">
                      <td className="px-[20px] py-[12px] text-[13px] font-medium text-on-surface">{fmtDate(r._id)}</td>
                      <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{r.count}</td>
                      <td className="px-[20px] py-[12px] text-right font-mono font-bold text-primary text-[13px]">{fmt(r.totalRevenue)}</td>
                      <td className="px-[20px] py-[12px] text-right font-mono text-rose-600 text-[13px]">{fmt(r.totalDiscount)}</td>
                      <td className="px-[20px] py-[12px] text-right font-mono text-on-surface-variant/60 text-[13px]">{fmt(r.totalVat)}</td>
                      <td className="px-[20px] py-[12px] text-right font-mono text-[13px]">{fmt(r.avgTransaction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ END OF DAY ════════════════════════════════════════════ */}
          {activeTab==='eod' && (
            <div className="space-y-[16px] animate-fade-in">
              <div className="flex items-center gap-[12px]">
                <label className="text-[13px] font-semibold text-on-surface-variant">Select Date:</label>
                <input type="date" value={eodDate} onChange={e=>setEodDate(e.target.value)}
                  className="input w-auto" />
              </div>
              {isLoading ? <Sk h="h-[200px]" /> : eod ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
                  <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px] space-y-[8px]">
                    <h3 className="text-[14px] font-bold text-on-surface mb-[4px]">Summary — {fmtDate(eod.date)}</h3>
                    {[
                      ['Total Revenue',    fmt(eod.summary.totalRevenue),  'payments'],
                      ['Transactions',     eod.summary.count||0,            'receipt'],
                      ['Total Discounts',  fmt(eod.summary.totalDiscount), 'price_cut'],
                      ['VAT Collected',    fmt(eod.summary.totalVat),      'percent'],
                      ['Avg Transaction',  fmt(eod.summary.avgTransaction),'shopping_cart'],
                    ].map(([label,val,icon])=>(
                      <div key={label} className="flex items-center gap-[8px] py-[8px] border-b border-black/[0.04] last:border-0">
                        <span className="material-symbols-outlined text-on-surface-variant/40 flex-shrink-0" style={{fontSize:'16px'}}>{icon}</span>
                        <span className="text-[13px] text-on-surface-variant flex-1 min-w-0 truncate">{label}</span>
                        <span className="font-mono font-bold text-on-surface text-[13px] flex-shrink-0">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[20px]">
                    <h3 className="text-[14px] font-bold text-on-surface mb-[12px]">Payment Methods</h3>
                    {eod.byPayment.map(p=>(
                      <div key={p._id} className="flex items-center gap-[8px] py-[8px] border-b border-black/[0.04] last:border-0">
                        <span className="text-[13px] font-medium text-on-surface capitalize flex-1 min-w-0 truncate">{p._id}</span>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono font-bold text-primary text-[13px]">{fmt(p.total)}</p>
                          <p className="text-[11px] text-on-surface-variant/50">{p.count} transactions</p>
                        </div>
                      </div>
                    ))}
                    {eod.topProducts?.length > 0 && (
                      <div className="mt-[14px] pt-[14px] border-t border-black/[0.05]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/50 mb-[8px]">Top Products</p>
                        {eod.topProducts.map((p,i)=>(
                          <div key={i} className="flex justify-between text-[12px] py-[4px]">
                            <span className="text-on-surface">{p.name}</span>
                            <span className="font-mono text-on-surface-variant/60">{p.qty} sold</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : <div className="bg-white rounded-2xl border border-black/[0.05] p-[40px] text-center text-on-surface-variant/40 text-[13px]">No data for selected date</div>}
            </div>
          )}

          {/* ══ AUDIT TRAIL ═══════════════════════════════════════════ */}
          {activeTab==='audit' && (
            <div className="space-y-[16px] animate-fade-in">
              <div className="flex gap-[10px] flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{fontSize:'18px'}}>search</span>
                  <input value={auditSearch} onChange={e=>{setAuditSearch(e.target.value);setAuditPage(1);}}
                    placeholder="Search user, receipt…" className="input pl-[38px]" />
                </div>
                <span className="text-[12px] text-on-surface-variant/60 ml-auto">{audit.total} entries</span>
                <button onClick={()=>exportCSV(
                  audit.entries.map(e=>`"${fmtDT(e.date)}","${e.user}","${e.action}","${e.description.replace(/"/g,'""')}","${e.ref}"`),
                  ['Date','User','Action','Description','Receipt'],
                  `audit_${from}_${to}.csv`
                )} className="btn-secondary text-[12px] py-[7px]">
                  <span className="material-symbols-outlined" style={{fontSize:'15px'}}>download</span>CSV
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="table-head"><tr>
                    <th className="px-[20px] py-[10px]">Date</th>
                    <th className="px-[20px] py-[10px]">User</th>
                    <th className="px-[20px] py-[10px]">Action</th>
                    <th className="px-[20px] py-[10px]">Description</th>
                    <th className="px-[20px] py-[10px] text-right">Receipt</th>
                  </tr></thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {isLoading ? Array(5).fill(0).map((_,i)=>(
                      <tr key={i}><td colSpan={5} className="px-[20px] py-[12px]"><Sk /></td></tr>
                    )) : audit.entries.length===0 ? (
                      <tr><td colSpan={5} className="px-[20px] py-[40px] text-center text-on-surface-variant/40 text-[13px]">No entries found</td></tr>
                    ) : audit.entries.map((e,i)=>(
                      <tr key={i} className="table-row">
                        <td className="px-[20px] py-[12px] text-[11px] font-mono text-on-surface-variant/60 whitespace-nowrap">{fmtDT(e.date)}</td>
                        <td className="px-[20px] py-[12px] text-[13px] font-medium text-on-surface">{e.user}</td>
                        <td className="px-[20px] py-[12px]">
                          <span className={`badge ${e.action==='Sale'?'badge-green':e.action==='Refund'?'badge-red':'badge-amber'}`}>{e.action}</span>
                        </td>
                        <td className="px-[20px] py-[12px] text-[12px] text-on-surface-variant max-w-[280px] truncate">{e.description}</td>
                        <td className="px-[20px] py-[12px] text-right font-mono text-[11px] text-on-surface-variant/60">{e.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {audit.pages > 1 && (
                  <div className="flex items-center justify-between px-[20px] py-[10px] border-t border-black/[0.05] bg-[#fafafa] text-[12px]">
                    <span className="text-on-surface-variant/60">Page {auditPage} of {audit.pages}</span>
                    <div className="flex gap-[6px]">
                      <button disabled={auditPage<=1} onClick={()=>setAuditPage(p=>p-1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Prev</button>
                      <span className="px-[12px] py-[5px] rounded-lg bg-primary text-white font-bold">{auditPage}</span>
                      <button disabled={auditPage>=audit.pages} onClick={()=>setAuditPage(p=>p+1)} className="px-[12px] py-[5px] rounded-lg border border-black/[0.08] bg-white hover:bg-surface-container-low disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

            </div>{/* end space-y-[16px] */}
          </div>{/* end right overflow-y-auto */}
        </div>{/* end two-col flex */}
      </div>{/* end flex-col */}
    </div>
  );
}
