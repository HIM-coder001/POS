import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(form.email, form.password);
      if (userData.role === 'admin' || userData.role === 'manager') {
        navigate('/dashboard');
      } else {
        navigate('/checkout');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{
      backgroundImage: 'radial-gradient(#d1d5db 0.5px, transparent 0.5px)',
      backgroundSize: '24px 24px'
    }}>
      <main className="flex-grow flex items-center justify-center px-gutter py-xl">
        <div className="max-w-5xl w-full flex flex-col md:flex-row shadow-2xl rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm border border-white/20">

          {/* LEFT: Form */}
          <div className="w-full md:w-1/2 p-lg md:p-xl flex flex-col justify-center animate-fade-in">
            <div className="mb-xl">
              <div className="flex items-center gap-sm mb-sm">
                <span className="material-symbols-outlined text-primary text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
                <h1 className="text-headline-lg text-primary font-bold">RetailEdge</h1>
              </div>
              <p className="text-body-lg text-secondary">Welcome back — sign in to your branch</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Email */}
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">mail</span>
                  <input type="email" required value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="manager@branch.co.ke"
                    className="input pl-10" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">lock</span>
                  <input type={showPwd ? 'text' : 'password'} required value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="input pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      {showPwd ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-sm cursor-pointer">
                  <input type="checkbox" className="rounded border-outline-variant text-primary w-4 h-4" />
                  <span className="text-body-sm text-on-surface-variant">Remember Me</span>
                </label>
                <button type="button" className="text-body-sm text-primary font-semibold hover:underline">
                  Forgot Password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-sm p-md bg-error-container/20 border border-error/20 rounded-lg text-on-error-container text-body-sm">
                  <span className="material-symbols-outlined text-error text-xl">error</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-md text-title-md">
                {loading ? (
                  <><span className="material-symbols-outlined animate-spin">progress_activity</span> Authenticating...</>
                ) : (
                  <><span>Sign In</span><span className="material-symbols-outlined">login</span></>
                )}
              </button>
            </form>

            {/* Demo hint */}
            <div className="mt-xl flex items-start gap-sm p-md bg-secondary-container/10 rounded-lg border border-secondary-container/20">
              <span className="material-symbols-outlined text-primary mt-xs"
                style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              <div>
                <p className="text-body-sm text-secondary">
                  <strong>Demo:</strong> admin@retailedge.co.ke / admin1234
                </p>
                <p className="text-xs text-on-surface-variant mt-unit">Accessing Nairobi Main Branch portal.</p>
              </div>
            </div>
          </div>

          {/* RIGHT: Visual */}
          <div className="hidden md:flex w-1/2 bg-primary-container flex-col items-center justify-center p-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_#00236f,_transparent)]" />

            {/* Icon ring */}
            <div className="relative z-10 w-64 h-64 rounded-full border-2 border-on-primary-container/20 flex items-center justify-center mb-xl">
              <div className="w-52 h-52 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-2xl">
                <span className="material-symbols-outlined text-[100px] text-on-primary-container/70"
                  style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
              </div>
              {/* Floating badges */}
              <div className="absolute -top-3 -right-3 w-14 h-14 bg-tertiary-fixed rounded-xl flex items-center justify-center shadow-lg animate-bounce"
                style={{ animationDuration: '3s' }}>
                <span className="material-symbols-outlined text-tertiary text-2xl">insights</span>
              </div>
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-secondary-fixed rounded-full flex items-center justify-center shadow-lg animate-pulse">
                <span className="material-symbols-outlined text-on-secondary-fixed text-2xl">payments</span>
              </div>
            </div>

            <div className="text-center z-10 text-on-primary-container">
              <h2 className="text-headline-md font-bold mb-sm">The pulse of your business.</h2>
              <p className="text-body-lg opacity-80 max-w-xs">Track inventory, manage employees, and scale with precision.</p>
            </div>

            {/* Mini KPIs */}
            <div className="mt-lg flex gap-sm z-10">
              {[['KES 4.2M', 'MTD Revenue'], ['2,450', 'Products'], ['3', 'Branches']].map(([v, l]) => (
                <div key={l} className="bg-white/15 backdrop-blur-sm rounded-xl p-md text-center text-on-primary-container">
                  <p className="text-xl font-bold">{v}</p>
                  <p className="text-xs opacity-70 mt-unit">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-md px-gutter flex flex-col md:flex-row items-center justify-between gap-md border-t border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-sm">support_agent</span>
          <span className="text-body-sm text-on-surface-variant">Support: <strong>+254 700 000 000</strong></span>
        </div>
        <div className="flex gap-lg">
          <a href="#" className="text-body-sm text-on-surface-variant hover:text-primary">Terms of Service</a>
          <a href="#" className="text-body-sm text-on-surface-variant hover:text-primary">Privacy Policy</a>
          <span className="font-mono text-xs text-outline">v2.4.0</span>
        </div>
      </footer>
    </div>
  );
}
