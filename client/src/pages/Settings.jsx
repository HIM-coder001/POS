import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useTheme, COLOR_PRESETS, resolveColorName } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';

// ── Constants ────────────────────────────────────────────────────────────────
const INDUSTRIES = ['Clothing & Apparel','Grocery & Supermarket','Electronics','Pharmacy & Health','Restaurant & Food','Beauty & Cosmetics','Hardware & Construction','Bookshop & Stationery','Other'];
const CURRENCIES = [{code:'KES',label:'KES — Kenyan Shilling'},{code:'USD',label:'USD — US Dollar'},{code:'EUR',label:'EUR — Euro'},{code:'GBP',label:'GBP — British Pound'},{code:'UGX',label:'UGX — Ugandan Shilling'},{code:'TZS',label:'TZS — Tanzanian Shilling'}];
const TIMEZONES  = ['Africa/Nairobi','Africa/Kampala','Africa/Dar_es_Salaam','Africa/Lagos','Africa/Johannesburg','Europe/London','UTC'];
const ROLES      = ['admin','manager','cashier'];
const BRANCHES   = ['Nairobi Main Branch','Westlands Branch','CBD Branch','Mombasa Branch'];
const PAYMENT_GATEWAYS = [
  { key:'mpesa',  label:'M-Pesa (Safaricom)',   icon:'phone_android',  color:'text-emerald-600', bg:'bg-emerald-50' },
  { key:'card',   label:'Card (Visa/Mastercard)',icon:'credit_card',    color:'text-blue-600',    bg:'bg-blue-50'   },
  { key:'cash',   label:'Cash',                  icon:'payments',       color:'text-gray-600',    bg:'bg-gray-50'   },
  { key:'split',  label:'Split Payment',         icon:'call_split',     color:'text-violet-600',  bg:'bg-violet-50' },
];

const SECTION_GROUPS = [
  { title: null, items: [{ key:'business', label:'Business', icon:'storefront' }] },
  { title: null, items: [
    { key:'branding',  label:'Branding',         icon:'palette'              },
    { key:'locations', label:'Locations',         icon:'location_on'          },
    { key:'users',     label:'Users',             icon:'group'                },
    { key:'roles',     label:'Roles',             icon:'admin_panel_settings' },
    { key:'payments',  label:'Payment Accounts',  icon:'account_balance'      },
    { key:'gateways',  label:'Payment Gateways',  icon:'credit_card'          },
    { key:'receipt',   label:'Receipt',           icon:'receipt_long'         },
    { key:'numbering', label:'Numbering',         icon:'tag'                  },
    { key:'suppliers', label:'Suppliers',         icon:'local_shipping'       },
  ]},
];

// ── Reusable UI ──────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled = false }) => (
  <button type="button" role="switch" aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex w-[44px] h-[24px] rounded-full transition-colors duration-200 flex-shrink-0
      ${checked ? 'bg-primary' : 'bg-black/20'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
    <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm
      transition-transform duration-200 ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`} />
  </button>
);

const RuleRow = ({ icon, label, description, checked, onChange }) => (
  <div className="flex items-start justify-between gap-[16px] py-[16px] border-b border-black/[0.05] last:border-0">
    <div className="flex items-start gap-[12px]">
      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center flex-shrink-0 mt-[1px]">
        <span className="material-symbols-outlined text-on-surface-variant/60" style={{ fontSize: '16px' }}>{icon}</span>
      </div>
      <div>
        <p className="text-[13.5px] font-semibold text-on-surface leading-none">{label}</p>
        <p className="text-[12px] text-on-surface-variant/60 mt-[4px] leading-snug max-w-lg">{description}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const SectionCard = ({ icon, title, subtitle, children }) => (
  <div className="card overflow-hidden">
    <div className="px-[24px] py-[16px] border-b border-black/[0.05] flex items-center gap-[10px]">
      <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: '18px' }}>{icon}</span>
      <div>
        <h2 className="text-[15px] font-bold text-on-surface">{title}</h2>
        {subtitle && <p className="text-[12px] text-on-surface-variant/60 mt-[1px]">{subtitle}</p>}
      </div>
    </div>
    <div className="p-[24px]">{children}</div>
  </div>
);

const SaveBar = ({ saving, onSave }) => (
  <div className="flex justify-end pt-[4px]">
    <button onClick={onSave} disabled={saving} className="btn-primary py-[10px] px-[24px]">
      {saving
        ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>Saving…</>
        : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>Save Changes</>}
    </button>
  </div>
);

// ── Suppliers Section ─────────────────────────────────────────────────────────
function SuppliersSection() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm]           = useState({ name:'', contact:'', email:'', phone:'', address:'', reliabilityScore:80 });
  const sf = (k,v) => setForm(p => ({...p, [k]:v}));

  const fetchSuppliers = async () => {
    setLoading(true);
    try { const {data} = await api.get('/suppliers'); setSuppliers(data); }
    catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openAdd  = () => { setEditItem(null); setForm({name:'',contact:'',email:'',phone:'',address:'',reliabilityScore:80}); setShowModal(true); };
  const openEdit = (s) => { setEditItem(s); setForm({name:s.name,contact:s.contact||'',email:s.email||'',phone:s.phone||'',address:s.address||'',reliabilityScore:s.reliabilityScore||80}); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editItem) { await api.put(`/suppliers/${editItem._id}`, form); toast.success('Supplier updated'); }
      else          { await api.post('/suppliers', form); toast.success('Supplier added'); }
      setShowModal(false); fetchSuppliers();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Remove supplier "${s.name}"?`)) return;
    try { await api.delete(`/suppliers/${s._id}`); toast.success('Supplier removed'); fetchSuppliers(); }
    catch { toast.error('Delete failed'); }
  };

  const scoreColor = (n) => n >= 80 ? 'text-emerald-600 bg-emerald-50' : n >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  return (
    <>
      <SectionCard icon="local_shipping" title="Suppliers" subtitle="Manage your product suppliers and vendors.">
        <div className="space-y-[10px]">
          {loading ? Array(3).fill(0).map((_,i)=>(
            <div key={i} className="h-[52px] bg-surface-container-low rounded-xl animate-pulse" />
          )) : suppliers.map(s => (
            <div key={s._id} className="flex items-center gap-[14px] p-[14px] rounded-xl border border-black/[0.06] hover:bg-black/[0.02] group">
              <div className="w-9 h-9 rounded-xl bg-primary/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined icon-fill text-primary" style={{fontSize:'18px'}}>local_shipping</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-on-surface truncate">{s.name}</p>
                <div className="flex items-center gap-[10px] mt-[2px] flex-wrap">
                  {s.phone && <span className="text-[11px] text-on-surface-variant/60">{s.phone}</span>}
                  {s.email && <span className="text-[11px] text-on-surface-variant/60">{s.email}</span>}
                </div>
              </div>
              <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-full flex-shrink-0 ${scoreColor(s.reliabilityScore)}`}>
                {s.reliabilityScore}% reliable
              </span>
              <div className="flex gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(s)} className="btn-icon"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>edit</span></button>
                <button onClick={() => handleDelete(s)} className="btn-icon text-error hover:bg-red-50"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete</span></button>
              </div>
            </div>
          ))}
          {!loading && !suppliers.length && (
            <p className="text-[13px] text-on-surface-variant/50 text-center py-[24px]">No suppliers yet. Add your first supplier.</p>
          )}
          <button onClick={openAdd} className="btn-secondary w-full justify-center py-[10px] border-dashed">
            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>add</span>Add Supplier
          </button>
        </div>
      </SectionCard>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal-panel max-w-md w-full p-[24px]">
            <div className="flex justify-between items-center mb-[20px]">
              <h3 className="text-[16px] font-bold text-on-surface">{editItem ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSave} className="space-y-[14px]">
              <div><label className="label">Supplier Name <span className="text-error">*</span></label>
                <input required value={form.name} onChange={e=>sf('name',e.target.value)} className="input" /></div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div><label className="label">Phone</label>
                  <input value={form.phone} onChange={e=>sf('phone',e.target.value)} className="input" placeholder="+254 7XX XXX XXX" /></div>
                <div><label className="label">Email</label>
                  <input type="email" value={form.email} onChange={e=>sf('email',e.target.value)} className="input" placeholder="supplier@example.com" /></div>
              </div>
              <div><label className="label">Contact Person</label>
                <input value={form.contact} onChange={e=>sf('contact',e.target.value)} className="input" placeholder="Name of contact" /></div>
              <div><label className="label">Address</label>
                <input value={form.address} onChange={e=>sf('address',e.target.value)} className="input" /></div>
              <div>
                <label className="label">Reliability Score: <span className="text-primary font-bold">{form.reliabilityScore}%</span></label>
                <input type="range" min="0" max="100" value={form.reliabilityScore}
                  onChange={e=>sf('reliabilityScore',Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-on-surface-variant/50 mt-[2px]">
                  <span>Poor</span><span>Average</span><span>Excellent</span>
                </div>
              </div>
              <div className="flex gap-[10px] pt-[6px]">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editItem ? 'Update' : 'Add'} Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Roles & Permissions Section ───────────────────────────────────────────────
const ALL_PERMISSIONS = [
  { key:'pos',           label:'POS Checkout',           group:'Sales'     },
  { key:'sales_view',    label:'View All Transactions',  group:'Sales'     },
  { key:'sales_refund',  label:'Process Refunds',        group:'Sales'     },
  { key:'sales_discount',label:'Apply Discounts',        group:'Sales'     },
  { key:'products_view', label:'View Products',          group:'Products'  },
  { key:'products_edit', label:'Add / Edit Products',    group:'Products'  },
  { key:'products_delete',label:'Delete Products',       group:'Products'  },
  { key:'inventory',     label:'Manage Inventory',       group:'Products'  },
  { key:'customers',     label:'View & Edit Customers',  group:'CRM'       },
  { key:'reports',       label:'View Reports',           group:'Reports'   },
  { key:'reports_export',label:'Export Reports',         group:'Reports'   },
  { key:'settings',      label:'Access Settings',        group:'System'    },
  { key:'users',         label:'Manage Users',           group:'System'    },
];

const ROLE_DEFAULTS = {
  admin:   ALL_PERMISSIONS.map(p => p.key),
  manager: ['pos','sales_view','sales_refund','sales_discount','products_view','products_edit','inventory','customers','reports','reports_export'],
  cashier: ['pos','sales_view','customers'],
};

const ROLE_META = {
  admin:   { label:'Admin',   desc:'Full access to all features and settings.',       icon:'shield',          badge:'badge-red',   iconBg:'bg-red-50',    iconColor:'text-red-600'   },
  manager: { label:'Manager', desc:'Day-to-day operations management.',               icon:'manage_accounts', badge:'badge-blue',  iconBg:'bg-blue-50',   iconColor:'text-blue-600'  },
  cashier: { label:'Cashier', desc:'POS-only access for processing sales.',           icon:'point_of_sale',   badge:'badge-green', iconBg:'bg-green-50',  iconColor:'text-green-600' },
};

function RolesSection({ users, fetchUsers, usersLoading }) {
  const [editingRole, setEditingRole] = useState(null); // 'admin'|'manager'|'cashier'|null
  const [perms, setPerms] = useState({ ...ROLE_DEFAULTS });

  useEffect(() => { fetchUsers(); }, []);

  const userCountByRole = (role) => users.filter(u => u.role === role && u.isActive !== false).length;
  const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

  const togglePerm = (role, key) => {
    if (role === 'admin') return; // admin always has all
    setPerms(prev => {
      const cur = prev[role];
      return { ...prev, [role]: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] };
    });
  };

  return (
    <div className="space-y-[16px]">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-on-surface">Roles & Permissions</h2>
          <p className="text-[12px] text-on-surface-variant/60 mt-[2px]">Manage team members, roles and granular permissions.</p>
        </div>
      </div>

      {/* Role list */}
      <div className="card overflow-hidden">
        {Object.entries(ROLE_META).map(([roleKey, meta], idx) => {
          const count = userCountByRole(roleKey);
          const permCount = perms[roleKey]?.length ?? 0;
          const isLast = idx === Object.keys(ROLE_META).length - 1;
          return (
            <div key={roleKey}
              className={`flex items-center gap-[14px] px-[20px] py-[16px] hover:bg-[#fafbff] transition-colors ${!isLast ? 'border-b border-black/[0.05]' : ''}`}>
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                <span className={`material-symbols-outlined icon-fill ${meta.iconColor}`} style={{fontSize:'20px'}}>{meta.icon}</span>
              </div>
              {/* Name + desc */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-on-surface">{meta.label}</p>
                <p className="text-[12px] text-on-surface-variant/55 mt-[1px]">{meta.desc}</p>
              </div>
              {/* Stats */}
              <div className="flex items-center gap-[16px] flex-shrink-0">
                <span className="text-[12px] text-on-surface-variant/60">
                  <span className="font-bold text-on-surface">{count}</span> user{count !== 1 ? 's' : ''}
                </span>
                <span className="text-[12px] text-on-surface-variant/60">
                  <span className="font-bold text-on-surface">{permCount}</span> perm{permCount !== 1 ? 's' : ''}
                </span>
                {roleKey !== 'admin' && (
                  <button
                    onClick={() => setEditingRole(editingRole === roleKey ? null : roleKey)}
                    className={`flex items-center gap-[5px] text-[12px] font-semibold px-[12px] py-[6px] rounded-lg border transition-all
                      ${editingRole === roleKey ? 'bg-primary text-white border-primary' : 'border-black/[0.10] text-on-surface hover:bg-surface-container-low'}`}>
                    <span className="material-symbols-outlined" style={{fontSize:'14px'}}>
                      {editingRole === roleKey ? 'expand_less' : 'edit'}
                    </span>
                    {editingRole === roleKey ? 'Done' : 'Edit'}
                  </button>
                )}
                {roleKey === 'admin' && (
                  <span className="text-[11px] text-on-surface-variant/40 italic">All access</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission editor panel — slides in below selected role */}
      {editingRole && editingRole !== 'admin' && (
        <div className="card p-[20px] animate-fade-in">
          <div className="flex items-center gap-[10px] mb-[16px]">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ROLE_META[editingRole].iconBg}`}>
              <span className={`material-symbols-outlined icon-fill ${ROLE_META[editingRole].iconColor}`} style={{fontSize:'16px'}}>{ROLE_META[editingRole].icon}</span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-on-surface">{ROLE_META[editingRole].label} Permissions</p>
              <p className="text-[11px] text-on-surface-variant/55">Check to grant, uncheck to revoke. Changes are local — Enterprise plan required to persist custom roles.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-[24px] gap-y-[0px]">
            {groups.map(group => (
              <div key={group} className="mb-[14px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-on-surface-variant/50 mb-[8px]">{group}</p>
                <div className="space-y-[4px]">
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(p => {
                    const checked = perms[editingRole]?.includes(p.key) ?? false;
                    return (
                      <label key={p.key}
                        className="flex items-center gap-[10px] px-[10px] py-[7px] rounded-lg hover:bg-surface-container-low cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(editingRole, p.key)}
                          className="w-[15px] h-[15px] rounded accent-primary cursor-pointer flex-shrink-0"
                        />
                        <span className={`text-[13px] ${checked ? 'text-on-surface font-medium' : 'text-on-surface-variant/60'}`}>
                          {p.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-[14px] border-t border-black/[0.05] mt-[4px]">
            <p className="text-[11px] text-on-surface-variant/40">
              {perms[editingRole]?.length ?? 0} of {ALL_PERMISSIONS.length} permissions enabled
            </p>
            <div className="flex gap-[8px]">
              <button onClick={() => setPerms(p => ({...p, [editingRole]: []}))}
                className="text-[12px] text-on-surface-variant/60 hover:text-error px-[10px] py-[5px] rounded-lg hover:bg-red-50">
                Clear all
              </button>
              <button onClick={() => setPerms(p => ({...p, [editingRole]: ROLE_DEFAULTS[editingRole]}))}
                className="btn-secondary text-[12px] py-[5px] px-[12px]">
                Reset to default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [active, setActive] = useState('business');
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const { brandColor, brandColorName, setThemeColor, COLOR_PRESETS } = useTheme();
  const { refreshSettings } = useSettings();

  // Business settings form
  const [biz, setBiz] = useState({
    name:'Beauty Park', address:'Nairobi', phone:'+254 7XX XXX XXX',
    email:'info@business.co.ke', kraPin:'A001234567Z', industry:'Clothing & Apparel',
    logoUrl:'', currency:'KES', timezone:'Africa/Nairobi', vatEnabled:true, vatRate:16,
    receiptHeader:'Thank you for shopping with us!',
    receiptFooter:'Goods once sold cannot be returned. Thank you!',
    receiptShowLogo:true, preventOverselling:true, requireManagerApprovalRemove:false,
    allowDiscounts:true, requireCustomerOnSale:false, allowRefunds:true,
    receiptPrefix:'POS', receiptNextNum:1,
    brandColor:'#00236f', brandColorName:'Navy Blue',
    receiptPhone:'', receiptAddress:'',
    receiptFontType:'Arial', receiptFontSize:'medium',
    receiptShowTaxBreakdown:false, receiptShowServedBy:true, receiptShowDateTime:true,
  });
  const sb = (k, v) => setBiz(p => ({ ...p, [k]: v }));

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ name:'', email:'', password:'', role:'cashier', branch:'Nairobi Main Branch' });
  const su = (k, v) => setUserForm(p => ({ ...p, [k]: v }));

  // Locations state
  const [locations, setLocations] = useState([
    { id:1, name:'Nairobi Main Branch', address:'Tom Mboya St, Nairobi', phone:'+254 700 000 001', isMain:true },
    { id:2, name:'Westlands Branch',    address:'Westlands, Nairobi',    phone:'+254 700 000 002', isMain:false },
  ]);
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [locForm, setLocForm] = useState({ name:'', address:'', phone:'' });

  // Gateway toggles — keys match DB field names: gatewayMpesa, gatewayCash, etc.
  const [gatewayEnabled, setGatewayEnabled] = useState({ mpesa:true, card:true, cash:true, split:true });
  const [mpesaForm, setMpesaForm] = useState({ tillNumber:'', shortcode:'', consumerKey:'', consumerSecret:'' });
  const [paymentAccounts, setPaymentAccounts] = useState([
    { id:1, name:'Main M-Pesa Till', type:'mpesa', number:'123456', isDefault:true },
    { id:2, name:'Cash Drawer',      type:'cash',  number:'',      isDefault:false },
  ]);
  const [showAccModal, setShowAccModal] = useState(false);
  const [accForm, setAccForm] = useState({ name:'', type:'cash', number:'' });

  // Roles state (display only — roles are enum in backend)
  const ROLE_PERMS = {
    admin:   { label:'Admin',   color:'bg-red-50 text-red-700',     perms:['All permissions — full system access'] },
    manager: { label:'Manager', color:'bg-blue-50 text-blue-700',   perms:['Sales & POS','Products & Inventory','Customers','Reports','Settings (limited)','User management (cashiers)'] },
    cashier: { label:'Cashier', color:'bg-green-50 text-green-700', perms:['POS Checkout only','View own transactions','Update profile'] },
  };

  // Plan state removed
  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        if (data) {
          setBiz(f => ({ ...f, ...data }));
          if (data.brandColor) setThemeColor(data.brandColor, data.brandColorName || '');
          // Load gateway toggles from DB
          setGatewayEnabled({
            mpesa: data.gatewayMpesa !== false,
            card:  data.gatewayCard  !== false,
            cash:  data.gatewayCash  !== false,
            split: data.gatewaySplit !== false,
          });
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setFetching(false));
  }, []);

  // Req 5.7: On load, if brandColorName is empty/absent, resolve from brandColor
  useEffect(() => {
    if (!biz.brandColorName) {
      sb('brandColorName', resolveColorName(biz.brandColor, COLOR_PRESETS));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try { const { data } = await api.get('/users'); setUsers(data); }
    catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => { if (active === 'users') fetchUsers(); }, [active]);

  const saveBiz = async () => {
    setSaving(true);
    try { await api.put('/settings', biz); toast.success('Settings saved'); refreshSettings(); }
    catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const saveGateways = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        ...biz,
        gatewayMpesa: gatewayEnabled.mpesa,
        gatewayCard:  gatewayEnabled.card,
        gatewayCash:  gatewayEnabled.cash,
        gatewaySplit: gatewayEnabled.split,
      });
      toast.success('Gateway settings saved');
      refreshSettings(); // update Checkout immediately
    }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        const payload = { ...userForm };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editUser._id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', userForm);
        toast.success('User created');
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const handleDeactivateUser = async (u) => {
    if (!confirm(`Deactivate ${u.name}?`)) return;
    try { await api.delete(`/users/${u._id}`); toast.success('User deactivated'); fetchUsers(); }
    catch { toast.error('Failed'); }
  };

  const openAddUser = () => { setEditUser(null); setUserForm({ name:'', email:'', password:'', role:'cashier', branch:'Nairobi Main Branch' }); setShowUserModal(true); };
  const openEditUser = (u) => { setEditUser(u); setUserForm({ name:u.name, email:u.email, password:'', role:u.role, branch:u.branch }); setShowUserModal(true); };

  const saveLoc = () => {
    if (!locForm.name) return toast.error('Branch name required');
    if (editLoc) {
      setLocations(ls => ls.map(l => l.id === editLoc.id ? { ...l, ...locForm } : l));
      toast.success('Location updated');
    } else {
      setLocations(ls => [...ls, { id: Date.now(), ...locForm, isMain: false }]);
      toast.success('Location added');
    }
    setShowLocModal(false);
  };

  const saveAccount = () => {
    if (!accForm.name) return toast.error('Account name required');
    setPaymentAccounts(pa => [...pa, { id: Date.now(), ...accForm, isDefault: false }]);
    toast.success('Account added');
    setShowAccModal(false);
    setAccForm({ name:'', type:'cash', number:'' });
  };

  if (fetching) return (
    <div className="flex min-h-screen" style={{ background: '#f0f2f5' }}>
      <Sidebar /><div className="flex-1 flex flex-col"><TopNav title="Settings" />
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      </div>
    </div>
  );

  const allSections = SECTION_GROUPS.flatMap(g => g.items);

  return (
    <>
    <div className="flex h-screen" style={{ background: '#f0f2f5' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        <TopNav title="Settings" />
        {/* Two-column layout: left nav fixed, right content scrolls */}
        <div className="flex flex-1 overflow-hidden px-[24px] pt-[24px] pb-[32px] gap-[20px] min-h-0">

          {/* ── Left nav — no overflow, never scrolls, always visible ── */}
          <div className="w-[200px] flex-shrink-0">
            <h1 className="text-[18px] font-bold text-on-surface mb-[12px]">Settings</h1>
            <div className="card overflow-hidden">
              <nav className="py-[6px]">
                {allSections.map(s => (
                  <button key={s.key} onClick={() => setActive(s.key)}
                    className={`w-full flex items-center gap-[8px] text-left pl-[20px] pr-[14px] py-[9px] text-[13px] transition-all duration-150
                      ${active === s.key ? 'text-primary font-semibold bg-primary/[0.07]' : 'text-on-surface-variant/80 hover:bg-black/[0.03] hover:text-on-surface font-medium'}`}>
                    <span className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: '15px', fontVariationSettings: active === s.key ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" : "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24" }}>
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* ── Right content — ONLY this scrolls ── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="space-y-[16px] pb-[32px]">

              {/* ══ BUSINESS ══════════════════════════════════════════════ */}
              {active === 'business' && (<>
                <SectionCard icon="storefront" title="Business Information" subtitle="Core business details.">
                  <div className="space-y-[16px] max-w-lg">
                    <div><label className="label">Business Name</label>
                      <input value={biz.name} onChange={e => sb('name', e.target.value)} className="input" /></div>
                    <div className="grid grid-cols-2 gap-[14px]">
                      <div><label className="label">Phone</label>
                        <div className="relative"><span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{fontSize:'15px'}}>phone</span>
                          <input value={biz.phone} onChange={e => sb('phone', e.target.value)} className="input pl-[34px]" /></div></div>
                      <div><label className="label">Email</label>
                        <div className="relative"><span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{fontSize:'15px'}}>mail</span>
                          <input type="email" value={biz.email} onChange={e => sb('email', e.target.value)} className="input pl-[34px]" /></div></div>
                    </div>
                    <div><label className="label">Business Address</label>
                      <div className="relative"><span className="material-symbols-outlined absolute left-[12px] top-[10px] text-on-surface-variant/40" style={{fontSize:'15px'}}>location_on</span>
                        <textarea rows={2} value={biz.address} onChange={e => sb('address', e.target.value)} className="input pl-[34px] resize-none" /></div></div>
                    <div><label className="label">Industry</label>
                      <select value={biz.industry} onChange={e => sb('industry', e.target.value)} className="input">
                        {INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select>
                      <p className="text-[11px] text-on-surface-variant/50 mt-[4px]">Industry helps tailor features. Pharmacy unlocks batch & expiry tracking.</p></div>
                    <div><label className="label">KRA Tax PIN</label>
                      <input value={biz.kraPin} onChange={e => sb('kraPin', e.target.value)} className="input font-mono" /></div>
                  </div>
                </SectionCard>

                <SectionCard icon="receipt_long" title="Tax & Regional Settings" subtitle="Currency, timezone and tax configuration.">
                  <div className="space-y-[16px] max-w-lg">
                    <div className="grid grid-cols-2 gap-[14px]">
                      <div><label className="label">Currency</label>
                        <select value={biz.currency} onChange={e => sb('currency', e.target.value)} className="input">
                          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                      <div><label className="label">Timezone</label>
                        <select value={biz.timezone} onChange={e => sb('timezone', e.target.value)} className="input">
                          {TIMEZONES.map(t => <option key={t}>{t}{t==='Africa/Nairobi'?' (EAT)':''}</option>)}</select></div>
                    </div>
                    <div className="flex items-start justify-between py-[14px] border-t border-black/[0.05]">
                      <div><p className="text-[13.5px] font-semibold text-on-surface">VAT Enabled</p>
                        <p className="text-[12px] text-on-surface-variant/60 mt-[3px]">Enable or disable VAT charging for this organisation.</p></div>
                      <Toggle checked={biz.vatEnabled} onChange={v => sb('vatEnabled', v)} />
                    </div>
                    {biz.vatEnabled && <div className="w-40"><label className="label">VAT Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={biz.vatRate} onChange={e => sb('vatRate', Number(e.target.value))} className="input font-mono" /></div>}
                  </div>
                </SectionCard>

                <SectionCard icon="rule" title="Business Rules" subtitle="Inventory and point of sale safeguards.">
                  <div className="max-w-2xl">
                    <RuleRow icon="block" label="Prevent Overselling" description="Block sales and adjustments that would push stock below zero." checked={biz.preventOverselling} onChange={v => sb('preventOverselling', v)} />
                    <RuleRow icon="manage_accounts" label="Require Manager Approval to Remove a Scanned Item" description="Cashiers must enter manager credentials before removing an item already added to the cart." checked={biz.requireManagerApprovalRemove} onChange={v => sb('requireManagerApprovalRemove', v)} />
                    <RuleRow icon="discount" label="Allow Discounts" description="Permit cashiers and managers to apply discounts at checkout." checked={biz.allowDiscounts} onChange={v => sb('allowDiscounts', v)} />
                    <RuleRow icon="person_search" label="Require Customer on Every Sale" description="A customer must be selected or created before completing a sale." checked={biz.requireCustomerOnSale} onChange={v => sb('requireCustomerOnSale', v)} />
                    <RuleRow icon="undo" label="Allow Refunds" description="Allow completed sales to be refunded by authorised users." checked={biz.allowRefunds} onChange={v => sb('allowRefunds', v)} />
                  </div>
                </SectionCard>
                <SaveBar saving={saving} onSave={saveBiz} />
              </>)}

              {/* ══ BRANDING ══════════════════════════════════════════════ */}
              {active === 'branding' && (<>
                <SectionCard icon="palette" title="Branding" subtitle="Logo, colours and store appearance.">
                  <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[32px] items-start">
                    
                    <div className="space-y-[24px]">
                      {/* Logo upload */}
                      <div>
                      <label className="label text-center block">Business Logo</label>
                      <div className="flex flex-col items-center gap-[16px] text-center mt-[8px]">
                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center bg-surface-container-low overflow-hidden flex-shrink-0">
                          {biz.logoUploading
                            ? <span className="material-symbols-outlined animate-spin text-primary text-2xl">progress_activity</span>
                            : biz.logoUrl
                            ? <img src={biz.logoUrl} alt="logo" className="w-full h-full object-cover" />
                            : <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">image</span>}
                        </div>
                        <div className="space-y-[8px]">
                          <label className={`btn-secondary cursor-pointer text-[12px] py-[7px] ${biz.logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>upload</span>
                            {biz.logoUploading ? 'Uploading…' : 'Upload Logo'}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={async e => {
                                const file = e.target.files[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
                                const reader = new FileReader();
                                reader.onload = async ev => {
                                  sb('logoUploading', true);
                                  try {
                                    const { data } = await api.post('/upload/image', {
                                      data: ev.target.result,
                                      folder: 'retailedge/logos',
                                    });
                                    sb('logoUrl', data.url);
                                    sb('logoUploading', false);
                                    toast.success('Logo uploaded!');
                                  } catch (err) {
                                    toast.error(err.response?.data?.message || 'Upload failed');
                                    sb('logoUploading', false);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }} />
                          </label>
                          {biz.logoUrl && !biz.logoUploading && (
                            <button onClick={() => sb('logoUrl', '')} className="text-[12px] text-error hover:underline block">Remove logo</button>
                          )}
                          <p className="text-[11px] text-on-surface-variant/50">PNG or JPG · Max 5MB · Hosted on Cloudinary</p>
                        </div>
                      </div>
                    </div>

                    {/* Store name display */}
                    <div className="pt-[16px] border-t border-black/[0.05]">
                      <label className="label">Display Name</label>
                      <input value={biz.name} onChange={e => sb('name', e.target.value)} className="input"
                        placeholder="Your Business Name" />
                      <p className="text-[11px] text-on-surface-variant/50 mt-[4px]">Shown on receipts & sidebar</p>
                    </div>
                    </div>

                    <div className="space-y-[24px]">
                      {/* ── Brand Colour ── */}
                      <div>
                        <label className="label">Brand Colour</label>
                      <p className="text-[12px] text-on-surface-variant/60 mb-[14px]">
                        Changes apply instantly across the entire interface — buttons, nav, highlights and more.
                      </p>

                      {/* Live preview strip */}
                      <div className="rounded-xl overflow-hidden border border-black/[0.06] mb-[16px]">
                        <div className="h-[48px] flex items-center justify-between px-[16px]"
                          style={{ background: biz.brandColor }}>
                          <div className="flex items-center gap-[8px]">
                            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white icon-fill" style={{fontSize:'14px'}}>storefront</span>
                            </div>
                            <span className="text-white font-bold text-[13px]">{biz.name || 'Your Business'}</span>
                          </div>
                          <div className="flex items-center gap-[6px]">
                            <div className="h-[28px] px-[10px] rounded-lg bg-white/20 flex items-center">
                              <span className="text-white text-[11px] font-semibold">Button</span>
                            </div>
                            <div className="w-[28px] h-[28px] rounded-lg bg-white/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white" style={{fontSize:'14px'}}>notifications</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-[16px] py-[12px] bg-surface-container-low flex items-center gap-[8px]">
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: biz.brandColor }} />
                          <span className="text-[12px] text-on-surface-variant/70">{resolveColorName(biz.brandColor, COLOR_PRESETS)}</span>
                        </div>
                      </div>

                      {/* Colour presets grid */}
                      <div className="mb-[16px]">
                        <p className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.07em] mb-[10px]">Preset Colours</p>
                        <div className="flex flex-wrap gap-[10px]">
                          {COLOR_PRESETS.map(preset => {
                            const isActive = biz.brandColor.toLowerCase() === preset.hex.toLowerCase();
                            return (
                              <button key={preset.hex} title={preset.name}
                                onClick={() => {
                                  sb('brandColor', preset.hex);
                                  sb('brandColorName', preset.name);
                                  setThemeColor(preset.hex, preset.name);
                                }}
                                className="flex flex-col items-center gap-[5px] group focus:outline-none">
                                <div
                                  className={`w-9 h-9 rounded-xl transition-all duration-150 flex-shrink-0 relative
                                    ${isActive ? 'scale-[1.12]' : 'hover:scale-[1.08] hover:shadow-md'}`}
                                  style={{
                                    background: preset.hex,
                                    boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${preset.hex}` : undefined,
                                  }}>
                                  {isActive && (
                                    <span className="material-symbols-outlined text-white icon-fill absolute inset-0 flex items-center justify-center"
                                      style={{fontSize:'16px', display:'flex'}}>check</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-on-surface-variant/70 group-hover:text-on-surface transition-colors leading-tight text-center max-w-[48px]">
                                  {preset.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom colour input */}
                      <div>
                        <p className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.07em] mb-[10px]">Custom Colour</p>
                        <div className="flex items-center gap-[10px]">
                          {/* Native colour picker */}
                          <label className="relative cursor-pointer">
                            <div className="w-10 h-10 rounded-xl border-2 border-outline-variant/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                              style={{ background: biz.brandColor }}>
                              <input type="color" value={biz.brandColor}
                                onChange={e => {
                                  sb('brandColor', e.target.value);
                                  sb('brandColorName', resolveColorName(e.target.value, COLOR_PRESETS));
                                  setThemeColor(e.target.value, resolveColorName(e.target.value, COLOR_PRESETS));
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                            </div>
                          </label>
                          {/* Hex text input */}
                          <div className="relative flex-1 max-w-[160px]">
                            <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[12px] text-on-surface-variant/50 font-mono font-bold">#</span>
                            <input
                              value={biz.brandColor.replace('#', '')}
                              onChange={e => {
                                const val = '#' + e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                                sb('brandColor', val);
                                sb('brandColorName', resolveColorName(val, COLOR_PRESETS));
                                if (val.length === 7) setThemeColor(val, resolveColorName(val, COLOR_PRESETS));
                              }}
                              className="input pl-[28px] font-mono text-[13px] uppercase"
                              placeholder="00236f"
                              maxLength={6}
                            />
                          </div>
                          <button
                            onClick={() => {
                              sb('brandColor', '#00236f');
                              sb('brandColorName', 'Navy Blue');
                              setThemeColor('#00236f', 'Navy Blue');
                            }}
                            className="btn-secondary text-[12px] py-[7px] px-[12px]">
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </SectionCard>
                <SaveBar saving={saving} onSave={saveBiz} />
              </>)}

              {/* ══ LOCATIONS ═════════════════════════════════════════════ */}
              {active === 'locations' && (<>
                <SectionCard icon="location_on" title="Locations / Branches" subtitle="Manage your business branches and outlets.">
                  <div className="space-y-[10px]">
                    {locations.map(loc => (
                      <div key={loc.id} className="flex items-center gap-[14px] p-[14px] rounded-xl border border-black/[0.06] hover:bg-black/[0.02] group">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined icon-fill text-primary" style={{fontSize:'18px'}}>storefront</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[8px]">
                            <p className="text-[13.5px] font-semibold text-on-surface">{loc.name}</p>
                            {loc.isMain && <span className="badge badge-blue">Main</span>}
                          </div>
                          <p className="text-[12px] text-on-surface-variant/60 mt-[2px]">{loc.address}</p>
                          <p className="text-[12px] text-on-surface-variant/50">{loc.phone}</p>
                        </div>
                        <div className="flex gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditLoc(loc); setLocForm({name:loc.name,address:loc.address,phone:loc.phone}); setShowLocModal(true); }}
                            className="btn-icon"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>edit</span></button>
                          {!loc.isMain && <button onClick={() => setLocations(ls => ls.filter(l => l.id !== loc.id))}
                            className="btn-icon text-error hover:bg-red-50"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete</span></button>}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => { setEditLoc(null); setLocForm({name:'',address:'',phone:''}); setShowLocModal(true); }}
                      className="btn-secondary w-full justify-center py-[10px] border-dashed">
                      <span className="material-symbols-outlined" style={{fontSize:'16px'}}>add</span>Add Branch
                    </button>
                  </div>
                </SectionCard>
              </>)}

              {/* ══ USERS ═════════════════════════════════════════════════ */}
              {active === 'users' && (<>
                <SectionCard icon="group" title="Users" subtitle="Manage team members and their access.">
                  <div className="space-y-[10px]">
                    {usersLoading ? Array(3).fill(0).map((_,i)=>(
                      <div key={i} className="flex items-center gap-[12px] p-[12px] rounded-xl animate-pulse bg-black/[0.03]">
                        <div className="w-9 h-9 rounded-xl bg-black/[0.08]" />
                        <div className="flex-1 space-y-[6px]"><div className="h-3 bg-black/[0.08] rounded w-32" /><div className="h-3 bg-black/[0.06] rounded w-24" /></div>
                      </div>
                    )) : users.map(u => (
                      <div key={u._id} className={`flex items-center gap-[14px] p-[14px] rounded-xl border group transition-colors
                        ${u.isActive ? 'border-black/[0.06] hover:bg-black/[0.02]' : 'border-red-100 bg-red-50/40'}`}>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[8px]">
                            <p className="text-[13.5px] font-semibold text-on-surface">{u.name}</p>
                            <span className={`badge ${u.role==='admin'?'badge-red':u.role==='manager'?'badge-blue':'badge-green'}`}>{u.role}</span>
                            {!u.isActive && <span className="badge badge-gray">Inactive</span>}
                          </div>
                          <p className="text-[12px] text-on-surface-variant/60 mt-[2px]">{u.email} · {u.branch}</p>
                        </div>
                        <div className="flex gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditUser(u)} className="btn-icon"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>edit</span></button>
                          {u.isActive && <button onClick={() => handleDeactivateUser(u)} className="btn-icon text-error hover:bg-red-50"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>person_off</span></button>}
                        </div>
                      </div>
                    ))}
                    {!usersLoading && !users.length && (
                      <div className="text-center py-[32px] text-on-surface-variant/50">
                        <span className="material-symbols-outlined text-4xl block mb-[8px]">group</span>
                        <p className="text-[13px]">No users yet. Add your first team member.</p>
                      </div>
                    )}
                    <button onClick={openAddUser} className="btn-primary justify-center w-full py-[10px]">
                      <span className="material-symbols-outlined" style={{fontSize:'16px'}}>person_add</span>Add User
                    </button>
                  </div>
                </SectionCard>
              </>)}

              {/* ══ ROLES ═════════════════════════════════════════════════ */}
              {active === 'roles' && <RolesSection users={users} fetchUsers={fetchUsers} usersLoading={usersLoading} />}

              {/* ══ PAYMENT ACCOUNTS ══════════════════════════════════════ */}
              {active === 'payments' && (<>
                <SectionCard icon="account_balance" title="Payment Accounts" subtitle="Bank accounts, M-Pesa tills and cash drawers linked to this business.">
                  <div className="space-y-[10px] max-w-lg">
                    {paymentAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center gap-[14px] p-[14px] rounded-xl border border-black/[0.06] hover:bg-black/[0.02] group">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                          ${acc.type==='mpesa'?'bg-emerald-50':acc.type==='cash'?'bg-blue-50':'bg-violet-50'}`}>
                          <span className={`material-symbols-outlined icon-fill text-[18px]
                            ${acc.type==='mpesa'?'text-emerald-600':acc.type==='cash'?'text-blue-600':'text-violet-600'}`}>
                            {acc.type==='mpesa'?'phone_android':acc.type==='cash'?'payments':'credit_card'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[8px]">
                            <p className="text-[13.5px] font-semibold text-on-surface">{acc.name}</p>
                            {acc.isDefault && <span className="badge badge-blue">Default</span>}
                          </div>
                          <p className="text-[12px] text-on-surface-variant/60 mt-[1px] capitalize">{acc.type}{acc.number ? ` · ${acc.number}` : ''}</p>
                        </div>
                        <div className="flex gap-[6px] opacity-0 group-hover:opacity-100 transition-opacity">
                          {!acc.isDefault && <button onClick={() => setPaymentAccounts(pa => pa.map(a => ({...a, isDefault: a.id===acc.id})))}
                            className="text-[11px] text-primary font-semibold hover:underline px-[8px]">Set default</button>}
                          <button onClick={() => setPaymentAccounts(pa => pa.filter(a => a.id !== acc.id))}
                            className="btn-icon text-error hover:bg-red-50"><span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete</span></button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowAccModal(true)} className="btn-secondary w-full justify-center py-[10px] border-dashed">
                      <span className="material-symbols-outlined" style={{fontSize:'16px'}}>add</span>Add Account
                    </button>
                  </div>
                </SectionCard>
              </>)}

              {/* ══ PAYMENT GATEWAYS ══════════════════════════════════════ */}
              {active === 'gateways' && (<>
                <SectionCard icon="credit_card" title="Payment Gateways" subtitle="Enable or disable payment methods at checkout.">
                  <div className="space-y-[4px] max-w-2xl">
                    {PAYMENT_GATEWAYS.map(gw => (
                      <div key={gw.key}>
                        <div className="flex items-center gap-[14px] py-[14px] border-b border-black/[0.05] last:border-0">
                          <div className={`w-9 h-9 rounded-xl ${gw.bg} flex items-center justify-center flex-shrink-0`}>
                            <span className={`material-symbols-outlined icon-fill ${gw.color}`} style={{fontSize:'18px'}}>{gw.icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[13.5px] font-semibold text-on-surface">{gw.label}</p>
                            <p className="text-[12px] text-on-surface-variant/60 mt-[1px]">
                              {gatewayEnabled[gw.key] ? 'Active at checkout' : 'Disabled'}
                            </p>
                          </div>
                          <Toggle checked={gatewayEnabled[gw.key]} onChange={v => setGatewayEnabled(g => ({...g, [gw.key]: v}))} />
                        </div>
                        {/* M-Pesa config expandable */}
                        {gw.key === 'mpesa' && gatewayEnabled.mpesa && (
                          <div className="ml-[52px] mb-[12px] p-[16px] bg-emerald-50/60 border border-emerald-200/40 rounded-xl space-y-[12px]">
                            <p className="text-[12px] font-bold text-emerald-800 uppercase tracking-wide">M-Pesa Configuration</p>
                            <div className="grid grid-cols-2 gap-[12px]">
                              <div><label className="label">Till / Paybill Number</label>
                                <input value={mpesaForm.tillNumber} onChange={e => setMpesaForm(p=>({...p,tillNumber:e.target.value}))} className="input font-mono" placeholder="123456" /></div>
                              <div><label className="label">Shortcode</label>
                                <input value={mpesaForm.shortcode} onChange={e => setMpesaForm(p=>({...p,shortcode:e.target.value}))} className="input font-mono" placeholder="600000" /></div>
                              <div><label className="label">Consumer Key</label>
                                <input value={mpesaForm.consumerKey} onChange={e => setMpesaForm(p=>({...p,consumerKey:e.target.value}))} className="input font-mono" placeholder="From Daraja portal" /></div>
                              <div><label className="label">Consumer Secret</label>
                                <input type="password" value={mpesaForm.consumerSecret} onChange={e => setMpesaForm(p=>({...p,consumerSecret:e.target.value}))} className="input font-mono" placeholder="••••••••••••" /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
                <SaveBar saving={saving} onSave={saveGateways} />
              </>)}

              {/* ══ RECEIPT ═══════════════════════════════════════════════ */}
              {active === 'receipt' && (<>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px] items-start">
                  <SectionCard icon="receipt_long" title="Receipt Settings" subtitle="Customise what appears on printed receipts.">
                    <div className="space-y-[16px]">
                      <div><label className="label">Header / Greeting</label>
                        <input value={biz.receiptHeader} onChange={e => sb('receiptHeader', e.target.value)} className="input" /></div>
                      <div><label className="label">Footer / Thank You Message</label>
                        <textarea rows={3} value={biz.receiptFooter} onChange={e => sb('receiptFooter', e.target.value)} className="input resize-none" /></div>
                      <div className="flex items-center justify-between py-[12px] border-t border-black/[0.05]">
                        <div><p className="text-[13px] font-semibold text-on-surface">Show Logo on Receipt</p>
                          <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">Requires a logo to be uploaded in Branding.</p></div>
                        <Toggle checked={biz.receiptShowLogo} onChange={v => sb('receiptShowLogo', v)} />
                      </div>

                      {/* Receipt Phone */}
                      <div>
                        <label className="label">Receipt Phone</label>
                        <input value={biz.receiptPhone || ''} onChange={e => sb('receiptPhone', e.target.value)} className="input" placeholder="e.g. +254 700 000 000" />
                      </div>

                      {/* Business Address */}
                      <div>
                        <label className="label">Business Address</label>
                        <textarea rows={2} value={biz.receiptAddress || ''} onChange={e => sb('receiptAddress', e.target.value)} className="input resize-none" placeholder="e.g. Tom Mboya Street, Nairobi" />
                      </div>

                      {/* Font Type */}
                      <div>
                        <label className="label">Font Type</label>
                        <select value={biz.receiptFontType || 'Arial'} onChange={e => sb('receiptFontType', e.target.value)} className="input">
                          {['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana'].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>

                      {/* Font Size */}
                      <div>
                        <label className="label">Font Size</label>
                        <select value={biz.receiptFontSize || 'medium'} onChange={e => sb('receiptFontSize', e.target.value)} className="input">
                          <option value="small">Small (10pt)</option>
                          <option value="medium">Medium (12pt)</option>
                          <option value="large">Large (14pt)</option>
                        </select>
                      </div>

                      {/* Show Tax Breakdown */}
                      <div className="flex items-center justify-between py-[12px] border-t border-black/[0.05]">
                        <div>
                          <p className="text-[13px] font-semibold text-on-surface">Show Tax Breakdown</p>
                          <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">Display net amount and VAT as separate line items.</p>
                        </div>
                        <Toggle checked={!!biz.receiptShowTaxBreakdown} onChange={v => sb('receiptShowTaxBreakdown', v)} />
                      </div>

                      {/* Show Served By */}
                      <div className="flex items-center justify-between py-[12px] border-t border-black/[0.05]">
                        <div>
                          <p className="text-[13px] font-semibold text-on-surface">Show Served By</p>
                          <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">Display the cashier's name on the receipt.</p>
                        </div>
                        <Toggle checked={biz.receiptShowServedBy !== false} onChange={v => sb('receiptShowServedBy', v)} />
                      </div>

                      {/* Show Date & Time */}
                      <div className="flex items-center justify-between py-[12px] border-t border-black/[0.05]">
                        <div>
                          <p className="text-[13px] font-semibold text-on-surface">Show Date &amp; Time</p>
                          <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">Display the sale timestamp on the receipt.</p>
                        </div>
                        <Toggle checked={biz.receiptShowDateTime !== false} onChange={v => sb('receiptShowDateTime', v)} />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Live receipt preview */}
                  <div className="card p-[20px] sticky top-[24px]">
                    <h4 className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-[0.08em] mb-[16px]">Live Preview</h4>
                    <div 
                      className="max-w-[240px] mx-auto bg-white text-black p-[14px] rounded-lg shadow border border-black/[0.08] space-y-[6px]"
                      style={{ 
                        fontFamily: biz.receiptFontType || 'Arial',
                        fontSize: biz.receiptFontSize === 'small' ? '8px' : biz.receiptFontSize === 'large' ? '12px' : '10px'
                      }}
                    >
                      <div className="text-center space-y-[2px]">
                        {biz.logoUrl && biz.receiptShowLogo && <img src={biz.logoUrl} alt="logo" className="w-10 h-10 object-contain mx-auto mb-[4px]" />}
                        <p className="font-black uppercase" style={{ fontSize: '1.2em' }}>{biz.name}</p>
                        <p className="text-gray-600">{biz.receiptAddress || biz.address}</p>
                        <p className="text-gray-600">Tel: {biz.receiptPhone || biz.phone}</p>
                        <p className="text-gray-600">PIN: {biz.kraPin}</p>
                      </div>
                      <div className="border-t border-dashed border-gray-300" />
                      <div className="space-y-[2px]">
                        <div className="flex justify-between"><span>Receipt:</span><b>POS-00042</b></div>
                        {biz.receiptShowDateTime !== false && (
                          <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString()}</span></div>
                        )}
                        {biz.receiptShowServedBy !== false && (
                          <div className="flex justify-between"><span>Cashier:</span><span>Grace W.</span></div>
                        )}
                      </div>
                      <div className="border-t border-dashed border-gray-300" />
                      <div className="space-y-[2px]">
                        <div className="flex justify-between"><span className="flex-1 truncate">Unga 2kg</span><span className="ml-2">KES 180</span></div>
                        <div className="flex justify-between"><span className="flex-1 truncate">Yogurt 500g</span><span className="ml-2">KES 320</span></div>
                      </div>
                      <div className="border-t border-dashed border-gray-300" />
                      <div className="space-y-[2px]">
                        {biz.receiptShowTaxBreakdown && (
                          <>
                            <div className="flex justify-between"><span>Subtotal:</span><span>KES 500</span></div>
                            <div className="flex justify-between"><span>VAT ({biz.vatRate}%):</span><span>KES {(500*biz.vatRate/100).toFixed(0)}</span></div>
                          </>
                        )}
                        <div className="flex justify-between font-bold border-t border-dashed pt-[2px] mt-[2px]">
                          <span>TOTAL:</span><span>KES {(500*(1+biz.vatRate/100)).toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="border-t border-dashed border-gray-300" />
                      <div className="text-center space-y-[2px] pt-[4px]">
                        <p className="font-bold uppercase" style={{ fontSize: '0.9em' }}>{biz.receiptHeader}</p>
                        <p className="text-gray-600" style={{ fontSize: '0.9em' }}>{biz.receiptFooter}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <SaveBar saving={saving} onSave={saveBiz} />
              </>)}

              {/* ══ NUMBERING ═════════════════════════════════════════════ */}
              {active === 'numbering' && (<>
                <SectionCard icon="tag" title="Receipt Numbering" subtitle="Configure receipt number format and sequence.">
                  <div className="space-y-[16px] max-w-sm">
                    <div><label className="label">Receipt Prefix</label>
                      <input value={biz.receiptPrefix} onChange={e => sb('receiptPrefix', e.target.value)} className="input font-mono" placeholder="POS" />
                      <p className="text-[11px] text-on-surface-variant/50 mt-[5px]">
                        Receipts will be: <span className="font-mono font-bold">{biz.receiptPrefix}-00042</span>
                      </p>
                    </div>
                    <div><label className="label">Next Receipt Number</label>
                      <input type="number" min="1" value={biz.receiptNextNum} onChange={e => sb('receiptNextNum', Number(e.target.value))} className="input font-mono w-40" />
                      <p className="text-[11px] text-on-surface-variant/50 mt-[5px]">
                        Next: <span className="font-mono font-bold">{biz.receiptPrefix}-{String(biz.receiptNextNum).padStart(5,'0')}</span>
                      </p>
                    </div>
                    <div className="p-[12px] bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-[8px]">
                      <span className="material-symbols-outlined icon-fill text-amber-500 flex-shrink-0 mt-[1px]" style={{fontSize:'15px'}}>warning</span>
                      <p className="text-[12px] text-amber-800">Changing the next receipt number may create gaps in your records. Only change this if needed.</p>
                    </div>
                  </div>
                </SectionCard>
                <SaveBar saving={saving} onSave={saveBiz} />
              </>)}

              {/* ══ SUPPLIERS ═════════════════════════════════════════════ */}
              {active === 'suppliers' && <SuppliersSection />}

            </div>{/* end content space-y */}
          </div>{/* end content scroll col */}
        </div>{/* end flex row */}
      </div>
    </div>

      {/* ── User modal ───────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowUserModal(false)}>
          <div className="modal-panel max-w-md w-full p-[24px]">
            <div className="flex justify-between items-center mb-[20px]">
              <h3 className="text-[16px] font-bold text-on-surface">{editUser ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setShowUserModal(false)} className="btn-icon"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-[14px]">
              <div><label className="label">Full Name</label><input required value={userForm.name} onChange={e => su('name',e.target.value)} className="input" /></div>
              <div><label className="label">Email</label><input required type="email" value={userForm.email} onChange={e => su('email',e.target.value)} className="input" /></div>
              <div><label className="label">{editUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input type="password" required={!editUser} minLength={6} value={userForm.password} onChange={e => su('password',e.target.value)} className="input font-mono" placeholder="••••••••" /></div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div><label className="label">Role</label>
                  <select value={userForm.role} onChange={e => su('role',e.target.value)} className="input">
                    {ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
                <div><label className="label">Branch</label>
                  <select value={userForm.branch} onChange={e => su('branch',e.target.value)} className="input">
                    {BRANCHES.map(b => <option key={b}>{b}</option>)}</select></div>
              </div>
              <div className="flex gap-[10px] pt-[6px]">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editUser ? 'Update' : 'Create'} User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Location modal ────────────────────────────────────────────── */}
      {showLocModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowLocModal(false)}>
          <div className="modal-panel max-w-md w-full p-[24px]">
            <div className="flex justify-between items-center mb-[20px]">
              <h3 className="text-[16px] font-bold text-on-surface">{editLoc ? 'Edit Branch' : 'Add Branch'}</h3>
              <button onClick={() => setShowLocModal(false)} className="btn-icon"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-[14px]">
              <div><label className="label">Branch Name</label><input required value={locForm.name} onChange={e => setLocForm(p=>({...p,name:e.target.value}))} className="input" /></div>
              <div><label className="label">Address</label><input value={locForm.address} onChange={e => setLocForm(p=>({...p,address:e.target.value}))} className="input" /></div>
              <div><label className="label">Phone</label><input value={locForm.phone} onChange={e => setLocForm(p=>({...p,phone:e.target.value}))} className="input" /></div>
              <div className="flex gap-[10px] pt-[6px]">
                <button onClick={() => setShowLocModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={saveLoc} className="btn-primary flex-1 justify-center">{editLoc ? 'Update' : 'Add'} Branch</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment account modal ─────────────────────────────────────── */}
      {showAccModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAccModal(false)}>
          <div className="modal-panel max-w-sm w-full p-[24px]">
            <div className="flex justify-between items-center mb-[20px]">
              <h3 className="text-[16px] font-bold text-on-surface">Add Payment Account</h3>
              <button onClick={() => setShowAccModal(false)} className="btn-icon"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-[14px]">
              <div><label className="label">Account Name</label><input value={accForm.name} onChange={e => setAccForm(p=>({...p,name:e.target.value}))} className="input" placeholder="e.g. Main M-Pesa Till" /></div>
              <div><label className="label">Type</label>
                <select value={accForm.type} onChange={e => setAccForm(p=>({...p,type:e.target.value}))} className="input">
                  <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="card">Card</option><option value="bank">Bank</option>
                </select></div>
              <div><label className="label">Account / Till Number</label><input value={accForm.number} onChange={e => setAccForm(p=>({...p,number:e.target.value}))} className="input font-mono" placeholder="Optional" /></div>
              <div className="flex gap-[10px] pt-[6px]">
                <button onClick={() => setShowAccModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={saveAccount} className="btn-primary flex-1 justify-center">Add Account</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
