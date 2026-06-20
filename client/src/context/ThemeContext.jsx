import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// ── Colour math helpers ───────────────────────────────────────────────────────

/** Parse a #rrggbb or #rgb hex string to [r, g, b] 0-255 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Convert [r,g,b] to #rrggbb */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Lighten / darken a hex colour by a ratio (positive = lighter, negative = darker) */
function adjustLightness(hex, ratio) {
  const [r, g, b] = hexToRgb(hex);
  if (ratio > 0) {
    // blend toward white
    return rgbToHex(r + (255 - r) * ratio, g + (255 - g) * ratio, b + (255 - b) * ratio);
  } else {
    // blend toward black
    const f = 1 + ratio;
    return rgbToHex(r * f, g * f, b * f);
  }
}

/**
 * Given a primary brand colour, derive the full token palette and inject it
 * as CSS custom properties on :root so every `var(--color-primary)` ref updates.
 */
function applyTheme(brandColor) {
  const root = document.documentElement;
  const set = (name, value) => root.style.setProperty(name, value);

  const [r, g, b] = hexToRgb(brandColor);

  // Core primary tokens
  set('--color-primary',           brandColor);
  set('--color-primary-rgb',       `${r}, ${g}, ${b}`);
  set('--color-on-primary',        '#ffffff');
  set('--color-primary-container', adjustLightness(brandColor, -0.15));
  set('--color-on-primary-container', adjustLightness(brandColor, 0.65));
  set('--color-primary-fixed',     adjustLightness(brandColor, 0.80));
  set('--color-primary-fixed-dim', adjustLightness(brandColor, 0.55));
  set('--color-inverse-primary',   adjustLightness(brandColor, 0.55));
  set('--color-surface-tint',      brandColor);

  // Glow / ring colours derived from primary
  set('--color-glow-primary', `rgba(${r}, ${g}, ${b}, 0.12)`);
  set('--color-primary-hover-bg', `rgba(${r}, ${g}, ${b}, 0.07)`);
  set('--color-primary-active-bg', `rgba(${r}, ${g}, ${b}, 0.08)`);
  set('--color-primary-20', `rgba(${r}, ${g}, ${b}, 0.20)`);
}

// ── Preset palette ────────────────────────────────────────────────────────────
export const COLOR_PRESETS = [
  { name: 'Navy Blue',     hex: '#00236f', group: 'Blues'   },
  { name: 'Royal Blue',    hex: '#1e40af', group: 'Blues'   },
  { name: 'Sky Blue',      hex: '#0284c7', group: 'Blues'   },
  { name: 'Teal',          hex: '#0f766e', group: 'Greens'  },
  { name: 'Emerald',       hex: '#047857', group: 'Greens'  },
  { name: 'Forest',        hex: '#166534', group: 'Greens'  },
  { name: 'Violet',        hex: '#6d28d9', group: 'Purples' },
  { name: 'Purple',        hex: '#7e22ce', group: 'Purples' },
  { name: 'Fuchsia',       hex: '#a21caf', group: 'Purples' },
  { name: 'Rose',          hex: '#be123c', group: 'Reds'    },
  { name: 'Orange',        hex: '#c2410c', group: 'Reds'    },
  { name: 'Amber',         hex: '#b45309', group: 'Ambers'  },
  { name: 'Slate',         hex: '#334155', group: 'Neutrals'},
  { name: 'Zinc',          hex: '#3f3f46', group: 'Neutrals'},
  { name: 'Stone',         hex: '#57534e', group: 'Neutrals'},
];

// ── Context ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

const STORAGE_KEY = 'retailedge_brand_color';

export const ThemeProvider = ({ children }) => {
  const [brandColor, setBrandColor] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || '#00236f';
  });
  const [brandColorName, setBrandColorName] = useState('Navy Blue');

  // Apply immediately on mount and whenever color changes
  useEffect(() => {
    applyTheme(brandColor);
    localStorage.setItem(STORAGE_KEY, brandColor);
  }, [brandColor]);

  // Load persisted color from settings API on startup — only if authenticated
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('retailedge_user') || 'null');
    if (!user?.token) return; // not logged in — skip, use localStorage default
    api.get('/settings')
      .then(({ data }) => {
        if (data?.brandColor) {
          setBrandColor(data.brandColor);
          setBrandColorName(data.brandColorName || '');
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  const setThemeColor = useCallback((hex, name = '') => {
    setBrandColor(hex);
    setBrandColorName(name || hex);
  }, []);

  return (
    <ThemeContext.Provider value={{ brandColor, brandColorName, setThemeColor, COLOR_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
};
