import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const SettingsContext = createContext(null);

const DEFAULTS = {
  gatewayMpesa: true,
  gatewayCash:  true,
  gatewayCard:  true,
  gatewaySplit: true,
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded,   setLoaded]   = useState(false);

  const loadSettings = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('retailedge_user') || 'null');
    if (!user?.token) return;
    api.get('/settings')
      .then(({ data }) => {
        setSettings(prev => ({ ...prev, ...data }));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Called by Settings page after a successful save so Checkout sees changes immediately
  const refreshSettings = loadSettings;

  // Derive the enabled payment methods list for Checkout
  const enabledMethods = [
    settings.gatewayCash  && { id: 'cash',  label: 'Cash',   icon: 'payments'    },
    settings.gatewayCard  && { id: 'card',  label: 'Card',   icon: 'credit_card' },
    settings.gatewayMpesa && { id: 'mpesa', label: 'M-Pesa', icon: 'smartphone'  },
    settings.gatewaySplit && { id: 'split', label: 'Split',  icon: 'call_split'  },
  ].filter(Boolean);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, refreshSettings, enabledMethods, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
};
