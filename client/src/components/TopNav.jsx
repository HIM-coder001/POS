import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const BRANCHES = ['Main Branch', 'Westlands Branch', 'CBD Branch'];

export default function TopNav({ title, subtitle }) {
  const { user } = useAuth();
  const [activeBranch, setActiveBranch] = useState('Main Branch');

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between w-full px-lg py-md h-16 bg-surface border-b border-outline-variant shadow-sm">
      {/* Left: Title or Search */}
      <div className="flex items-center gap-lg">
        <div>
          <h2 className="text-title-md font-bold text-on-surface">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>

      {/* Center: Branch Switcher */}
      <div className="hidden md:flex gap-lg">
        {BRANCHES.map((b) => (
          <button key={b} onClick={() => setActiveBranch(b)}
            className={`text-body-sm font-medium transition-all pb-1 ${
              activeBranch === b
                ? 'text-primary border-b-2 border-primary font-bold'
                : 'text-on-surface-variant hover:text-primary'
            }`}>
            {b}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-sm">
        {/* Online status */}
        <span className="hidden sm:flex items-center gap-xs px-sm py-unit rounded-full bg-tertiary-fixed/20 text-on-tertiary-fixed-variant text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
          Online
        </span>

        {/* Notifications */}
        <button className="relative p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-all">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full border-2 border-surface" />
        </button>

        {/* Wifi */}
        <button className="p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-all">
          <span className="material-symbols-outlined">wifi</span>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm cursor-pointer hover:scale-105 transition-transform">
          {user?.name?.[0] || 'U'}
        </div>
      </div>
    </header>
  );
}
