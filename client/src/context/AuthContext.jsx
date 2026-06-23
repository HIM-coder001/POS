import { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('retailedge_user')) || null;
    } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    // Step 1 returns otpSent:true — caller handles OTP step
    return data;
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp });
    localStorage.setItem('retailedge_user', JSON.stringify(data));
    setUser(data);
    toast.success(`Welcome back, ${data.name}!`);
    return data;
  }, []);

  const resendOtp = useCallback(async (email) => {
    await api.post('/auth/resend-otp', { email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('retailedge_user');
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, verifyOtp, resendOtp, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
