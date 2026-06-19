import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navCategories = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard',  icon: 'dashboard',      label: 'Dashboard',    roles: ['admin', 'manager'] },
      { to: '/checkout',   icon: 'point_of_sale',  label: 'POS Checkout', roles: ['admin', 'manager', 'cashier'] },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products',   icon: 'inventory_2',    label: 'Products',     roles: ['admin', 'manager'] },
      { to: '/inventory',  icon: 'warehouse',      label: 'Inventory',    roles: ['admin', 'manager'] },
    ]
  },
  {
    title: 'Transactions',
    items: [
      { to: '/transactions', icon: 'receipt_long',  label: 'Sales History', roles: ['admin', 'manager', 'cashier'] },
      { to: '/customers',  icon: 'group',          label: 'Customers',    roles: ['admin', 'manager', 'cashier'] },
    ]
  },
  {
    title: 'Finance',
    items: [
      { to: '/finance',    icon: 'account_balance_wallet', label: 'Reconciliation', roles: ['admin', 'manager'] },
      { to: '/reports',    icon: 'analytics',      label: 'Reports',      roles: ['admin', 'manager'] },
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/settings',   icon: 'settings',       label: 'Settings',     roles: ['admin', 'manager'] },
      { to: '/profile',    icon: 'account_circle', label: 'Profile',      roles: ['admin', 'manager', 'cashier'] },
    ]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="h-screen w-[260px] sticky top-0 left-0 bg-surface-container-lowest shadow-sm flex flex-col z-50 border-r border-outline-variant/30">
      {/* Brand */}
      <div className="p-lg border-b border-outline-variant/20">
        <div className="flex items-center gap-sm mb-unit">
          <span className="material-symbols-outlined text-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
          <h1 className="text-headline-md text-primary font-bold">RetailEdge</h1>
        </div>
        <p className="text-body-sm text-on-surface-variant">{user?.branch || 'Nairobi Branch'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-sm space-y-sm">
        {navCategories.map(cat => {
          const visibleItems = cat.items.filter(({ roles }) => !roles || roles.includes(user?.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={cat.title} className="space-y-unit">
              <p className="px-lg text-[9px] uppercase tracking-widest font-black text-on-surface-variant/50">{cat.title}</p>
              <div className="space-y-[2px]">
                {visibleItems.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}>
                    <span className="material-symbols-outlined">{icon}</span>
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-outline-variant/30 p-md">
        <div className="flex items-center gap-sm px-sm py-sm mb-sm rounded-lg bg-surface-container">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm flex-shrink-0">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-on-surface truncate">{user?.name}</p>
            <p className="text-xs text-on-surface-variant capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-md px-md py-sm w-full text-error hover:bg-error-container/10 rounded-lg transition-colors duration-200 text-body-sm">
          <span className="material-symbols-outlined text-sm">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
