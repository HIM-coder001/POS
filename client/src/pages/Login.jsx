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
      navigate(userData.role === 'cashier' ? '/checkout' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #f0f2f5 0%, #e8ecf4 100%)' }}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-[48px] overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #00236f 0%, #1e3a8a 50%, #0f2460 100%)' }}>

        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Floating blobs */}
        <div className="absolute top-[10%] right-[10%] w-64 h-64 rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
        <div className="absolute bottom-[15%] left-[5%] w-48 h-48 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo */}
          <div className="w-[72px] h-[72px] rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-[28px] shadow-lg">
            <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: '36px' }}>storefront</span>
          </div>

          <h1 className="text-[32px] font-bold text-white mb-[12px] leading-tight">
            The pulse of<br />your business.
          </h1>
          <p className="text-[15px] text-white/60 leading-relaxed mb-[40px]">
            Track inventory, manage sales, and grow with real-time insights.
          </p>

          {/* Stats row */}
          <div className="flex gap-[12px] justify-center">
            {[['KES 4.2M', 'MTD Revenue'], ['2,450', 'Products'], ['3', 'Branches']].map(([v, l]) => (
              <div key={l} className="flex-1 bg-white/[0.08] backdrop-blur-sm rounded-xl p-[14px] border border-white/10">
                <p className="text-[18px] font-bold text-white leading-none">{v}</p>
                <p className="text-[11px] text-white/50 mt-[4px] leading-none">{l}</p>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-[8px] justify-center mt-[28px]">
            {['M-Pesa Integration', 'Real-time Analytics', 'Multi-branch', 'Receipt Printing'].map(f => (
              <span key={f} className="text-[11px] font-medium text-white/70 bg-white/10 border border-white/10 rounded-full px-[10px] py-[4px]">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-[24px] lg:p-[48px]">
        <div className="w-full max-w-[400px] animate-fade-in">

          {/* Mobile logo */}
          <div className="flex items-center gap-[10px] mb-[32px] lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: '20px' }}>storefront</span>
            </div>
            <h1 className="text-[18px] font-bold text-primary">Beauty Park</h1>
          </div>

          <h2 className="text-[26px] font-bold text-on-surface mb-[6px]">Welcome back</h2>
          <p className="text-[14px] text-on-surface-variant/70 mb-[32px]">Sign in to your branch portal</p>

          <form onSubmit={handleSubmit} className="space-y-[16px]">

            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{ fontSize: '18px' }}>mail</span>
                <input type="email" required autoComplete="email"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="manager@branch.co.ke"
                  className="input pl-[42px] input-inset" />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-[6px]">
                <label className="label mb-0">Password</label>
                <button type="button" className="text-[12px] text-primary font-semibold hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{ fontSize: '18px' }}>lock</span>
                <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input pl-[42px] pr-[42px] input-inset" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {showPwd ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-[8px] cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded border-outline-variant accent-primary" />
              <span className="text-[13px] text-on-surface-variant">Remember me</span>
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-[10px] p-[12px] bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 animate-scale-in">
                <span className="material-symbols-outlined icon-fill text-red-500 flex-shrink-0" style={{ fontSize: '18px' }}>error</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-[12px] text-[14px] font-semibold shadow-sm hover:shadow-md mt-[4px]">
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>
                  Signing in...
                </>
              ) : (
                <>Sign In <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span></>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-[20px] p-[14px] bg-blue-50 border border-blue-200/60 rounded-xl">
            <div className="flex items-start gap-[8px]">
              <span className="material-symbols-outlined icon-fill text-blue-500 flex-shrink-0 mt-[1px]" style={{ fontSize: '16px' }}>info</span>
              <div>
                <p className="text-[12px] font-semibold text-blue-800 mb-[3px]">Demo credentials</p>
                <p className="text-[12px] text-blue-700 font-mono">admin@retailedge.co.ke</p>
                <p className="text-[12px] text-blue-700 font-mono">admin1234</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[12px] text-on-surface-variant/50 mt-[24px]">
            © 2025 RetailEdge · v2.5.0
          </p>
        </div>
      </div>
    </div>
  );
}
