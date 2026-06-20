import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import api from '../services/api';

const navCategories = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard',    icon: 'dashboard',              label: 'Dashboard',      roles: ['admin', 'manager'] },
      { to: '/checkout',     icon: 'point_of_sale',          label: 'POS',            roles: ['admin', 'manager', 'cashier'] },
      { to: '/transactions', icon: 'receipt_long',           label: 'My Transactions',roles: ['admin', 'manager', 'cashier'] },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products',  icon: 'inventory_2',  label: 'Products',  roles: ['admin', 'manager'] },
      { to: '/inventory', icon: 'warehouse',    label: 'Inventory', roles: ['admin', 'manager'] },
    ]
  },
  {
    title: 'Transactions',
    items: [
      { to: '/customers', icon: 'group',        label: 'Customers', roles: ['admin', 'manager', 'cashier'] },
      { to: '/finance',   icon: 'account_balance_wallet', label: 'Purchases',  roles: ['admin', 'manager'] },
    ]
  },
  {
    title: 'Finance',
    items: [
      { to: '/reports',  icon: 'analytics',    label: 'Reports',   roles: ['admin', 'manager'] },
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/profile',  icon: 'account_circle', label: 'Profile',  roles: ['admin', 'manager', 'cashier'] },
      { to: '/settings', icon: 'settings',       label: 'Settings', roles: ['admin', 'manager'] },
    ]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { brandColor } = useTheme();
  const navigate = useNavigate();
  const [bizName, setBizName] = useState('RetailEdge POS');

  useEffect(() => {
    if (!user) return; // not authenticated — skip
    api.get('/settings')
      .then(({ data }) => { if (data?.name) setBizName(data.name); })
      .catch(() => {});
  }, []);

  return (
    <aside className="h-screen w-[240px] sticky top-0 left-0 flex flex-col z-50 bg-white border-r border-black/[0.07]"
      style={{ boxShadow: '1px 0 0 rgba(0,0,0,0.04)' }}>

      {/* Brand */}
      <div className="flex items-center gap-[10px] px-[20px] py-[18px] border-b border-black/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-white icon-fill" style={{ fontSize: '18px' }}>storefront</span>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-on-surface leading-none">{bizName}</h1>
          <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">{user?.branch || 'Nairobi Branch'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-[10px]">
        {navCategories.map(cat => {
          const visible = cat.items.filter(({ roles }) => !roles || roles.includes(user?.role));
          if (!visible.length) return null;
          return (
            <div key={cat.title} className="mb-[2px]">
              <p className="px-[22px] pt-[14px] pb-[4px] text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/40 select-none">
                {cat.title}
              </p>
              {visible.map(({ to, icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) =>
                  isActive ? 'nav-item-active flex items-center gap-[10px] px-[14px] py-[9px] mx-[8px] text-[13.5px] font-semibold text-primary bg-primary/[0.08] rounded-xl cursor-pointer'
                           : 'nav-item flex items-center gap-[10px] px-[14px] py-[9px] mx-[8px] text-[13.5px] font-medium text-on-surface-variant/80 rounded-xl cursor-pointer hover:bg-black/[0.04] hover:text-on-surface transition-all duration-150'
                }>
                  {({ isActive }) => (
                    <>
                      <span className={`material-symbols-outlined transition-all duration-150 ${isActive ? 'icon-fill' : ''}`}
                        style={{ fontSize: '18px', color: isActive ? undefined : undefined }}>
                        {icon}
                      </span>
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-[12px] border-t border-black/[0.06]">
        <div className="flex items-center gap-[10px] p-[10px] rounded-xl hover:bg-black/[0.03] transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-on-surface truncate leading-none">{user?.name}</p>
            <p className="text-[11px] text-on-surface-variant/60 capitalize mt-[2px]">{user?.role}</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="opacity-0 group-hover:opacity-100 p-[5px] rounded-lg hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all duration-150"
            title="Logout">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
