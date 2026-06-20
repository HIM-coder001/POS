import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopNav({ title, subtitle, actions }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-black/[0.06]"
      style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between px-[24px] h-[58px]">

        {/* Left: page title */}
        <div className="flex items-center gap-[10px] min-w-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-on-surface leading-none truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-on-surface-variant/60 mt-[2px] truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-[6px] flex-shrink-0">

          {/* Online pill */}
          <div className="hidden sm:flex items-center gap-[5px] px-[10px] py-[5px] rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-200/60 mr-[6px]">
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            Online
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(v => !v)}
              className="btn-icon relative">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
              <span className="absolute top-[6px] right-[6px] w-[7px] h-[7px] bg-error rounded-full border-[1.5px] border-white" />
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-full mt-[6px] w-[280px] card animate-scale-in z-50 overflow-hidden">
                <div className="px-[16px] py-[12px] border-b border-black/[0.06] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-on-surface">Notifications</span>
                  <button className="text-[11px] text-primary font-semibold hover:underline" onClick={() => setShowNotifs(false)}>Mark all read</button>
                </div>
                <div className="py-[6px]">
                  {[
                    { icon: 'warning', color: 'text-amber-500', bg: 'bg-amber-50', text: 'Low stock on 3 items', time: '2m ago' },
                    { icon: 'payments', color: 'text-emerald-600', bg: 'bg-emerald-50', text: 'Sale #POS-00421 completed', time: '8m ago' },
                    { icon: 'person_add', color: 'text-blue-600', bg: 'bg-blue-50', text: 'New customer registered', time: '1h ago' },
                  ].map((n, i) => (
                    <div key={i} className="flex items-start gap-[10px] px-[16px] py-[10px] hover:bg-black/[0.02] cursor-pointer transition-colors">
                      <div className={`w-8 h-8 rounded-xl ${n.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`material-symbols-outlined icon-fill ${n.color}`} style={{ fontSize: '16px' }}>{n.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-on-surface leading-snug">{n.text}</p>
                        <p className="text-[11px] text-on-surface-variant/50 mt-[2px]">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-[16px] py-[10px] border-t border-black/[0.06]">
                  <button className="text-[12px] text-primary font-semibold w-full text-center hover:underline">View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* Settings shortcut */}
          <button onClick={() => navigate('/settings')} className="btn-icon">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</span>
          </button>

          {/* Avatar */}
          <button onClick={() => navigate('/profile')}
            className="w-[34px] h-[34px] rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-[13px] ml-[4px] shadow-sm hover:shadow-md hover:scale-[1.05] transition-all duration-150">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </button>
        </div>
      </div>
    </header>
  );
}
