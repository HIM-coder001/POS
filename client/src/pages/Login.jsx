import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ── Step 1: Full-screen role split ────────────────────────────────────────────
function RoleScreen({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  const roles = [
    {
      id: 'admin',
      label: 'Admin',
      sub: 'Manager Portal',
      desc: 'Dashboard, reports, inventory, settings and team management.',
      icon: 'manage_accounts',
      perms: ['Full Dashboard', 'Reports', 'Settings', 'User Management'],
      dark: true,
    },
    {
      id: 'cashier',
      label: 'Staff',
      sub: 'Cashier Portal',
      desc: 'POS checkout, M-Pesa payments, customers and transactions.',
      icon: 'point_of_sale',
      perms: ['POS Checkout', 'M-Pesa Payments', 'Customers', 'Transactions'],
      dark: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-[24px]"
      style={{background:'#f0f2f5'}}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-[40px]">
        <div className="w-[52px] h-[52px] rounded-2xl bg-primary flex items-center justify-center shadow-sm mb-[12px]">
          <span className="material-symbols-outlined icon-fill text-white" style={{fontSize:'26px'}}>storefront</span>
        </div>
        <h1 className="text-[20px] font-black text-on-surface">RetailEdge POS</h1>
        <p className="text-[13px] text-on-surface-variant/60 mt-[4px]">Select your role to sign in</p>
      </div>

      {/* Two cards */}
      <div className="flex flex-col sm:flex-row gap-[16px] w-full max-w-[680px]">
        {roles.map(r => (
          <button
            key={r.id}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(r.id)}
            className="flex-1 flex flex-col items-center text-center p-[32px] rounded-3xl border-2 transition-all duration-200 active:scale-[0.97] focus:outline-none"
            style={{
              background: r.dark
                ? hovered === r.id ? '#001a5e' : '#00236f'
                : hovered === r.id ? '#ffffff' : '#ffffff',
              borderColor: r.dark
                ? hovered === r.id ? '#3b82f6' : 'transparent'
                : hovered === r.id ? 'var(--color-primary)' : 'rgba(0,0,0,0.07)',
              boxShadow: hovered === r.id
                ? r.dark
                  ? '0 20px 48px rgba(0,35,111,0.35)'
                  : '0 20px 48px rgba(0,35,111,0.12)'
                : '0 2px 8px rgba(0,0,0,0.06)',
              transform: hovered === r.id ? 'translateY(-4px)' : 'none',
            }}>

            {/* Icon */}
            <div className="w-[64px] h-[64px] rounded-2xl flex items-center justify-center mb-[20px]"
              style={{background: r.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,35,111,0.07)'}}>
              <span className="material-symbols-outlined icon-fill"
                style={{fontSize:'30px', color: r.dark ? 'white' : 'var(--color-primary)'}}>
                {r.icon}
              </span>
            </div>

            {/* Labels */}
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-[6px]"
              style={{color: r.dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}}>
              {r.sub}
            </p>
            <h3 className="text-[26px] font-black mb-[12px]"
              style={{color: r.dark ? 'white' : '#191c1e'}}>
              {r.label}
            </h3>
            <p className="text-[13px] leading-relaxed mb-[24px] max-w-[220px]"
              style={{color: r.dark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.45)'}}>
              {r.desc}
            </p>

            {/* Permission tags */}
            <div className="flex flex-wrap gap-[6px] justify-center mb-[28px]">
              {r.perms.map(p => (
                <span key={p}
                  className="text-[11px] font-semibold rounded-full px-[10px] py-[4px]"
                  style={{
                    background: r.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,35,111,0.06)',
                    color: r.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,35,111,0.65)',
                  }}>
                  {p}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-[6px] text-[14px] font-bold"
              style={{color: r.dark ? 'white' : 'var(--color-primary)'}}>
              Sign in
              <span className="material-symbols-outlined" style={{fontSize:'18px',
                transform: hovered===r.id ? 'translateX(3px)' : 'none',
                transition:'transform 0.2s'}}>
                arrow_forward
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-on-surface-variant/35 mt-[32px]">© 2025 RetailEdge · v2.5.0</p>
    </div>
  );
}

// ── Shared login shell (steps 2 & 3) ─────────────────────────────────────────
function LoginShell({ children, step, role }) {
  const isAdmin = role === 'admin';
  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{background:'#f0f2f5'}}>

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col relative overflow-hidden"
        style={{background: isAdmin
          ? 'linear-gradient(160deg,#00236f 0%,#0c2d8a 100%)'
          : 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)'}}>

        <div className="absolute inset-0 opacity-[0.07]"
          style={{backgroundImage:'radial-gradient(circle,white 1px,transparent 1px)',backgroundSize:'28px 28px'}} />
        <div className="absolute bottom-0 left-0 right-0 h-[180px]"
          style={{background:'linear-gradient(to top,rgba(0,0,0,0.25),transparent)'}} />

        <div className="relative z-10 flex flex-col h-full p-[48px]">
          {/* Logo */}
          <div className="flex items-center gap-[12px]">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined icon-fill text-primary" style={{fontSize:'22px'}}>storefront</span>
            </div>
            <span className="text-[17px] font-bold text-white">RetailEdge POS</span>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-[8px] bg-white/10 border border-white/10 rounded-full px-[14px] py-[6px] mb-[20px] w-fit">
              <span className="material-symbols-outlined icon-fill text-white/70" style={{fontSize:'14px'}}>
                {isAdmin ? 'manage_accounts' : 'point_of_sale'}
              </span>
              <span className="text-[12px] font-semibold text-white/70">
                {isAdmin ? 'Admin / Manager Portal' : 'Cashier / Staff Portal'}
              </span>
            </div>
            <h1 className="text-[40px] font-black text-white leading-[1.1] mb-[16px]">
              {isAdmin ? <>Full control<br/>at your fingertips.</> : <>Fast checkout.<br/>Happy customers.</>}
            </h1>
            <p className="text-[15px] text-white/50 leading-relaxed max-w-[300px]">
              {isAdmin
                ? 'Manage your team, track inventory and monitor every sale in real time.'
                : 'Process sales, accept M-Pesa and card payments, and serve customers faster.'}
            </p>

            <div className="mt-[40px] space-y-[12px]">
              {(isAdmin
                ? [{icon:'dashboard',    text:'Sales dashboard & analytics'},
                   {icon:'inventory_2',  text:'Inventory management'},
                   {icon:'group',        text:'Team & user management'},
                   {icon:'settings',     text:'Business settings'}]
                : [{icon:'point_of_sale',text:'Quick POS checkout'},
                   {icon:'phone_android',text:'M-Pesa STK push payments'},
                   {icon:'receipt_long', text:'Transaction history'},
                   {icon:'person',       text:'Customer lookup'}]
              ).map(f => (
                <div key={f.text} className="flex items-center gap-[12px]">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.10] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined icon-fill text-white" style={{fontSize:'16px'}}>{f.icon}</span>
                  </div>
                  <span className="text-[13px] text-white/60 font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/25">© 2025 RetailEdge · v2.5.0</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-[24px] lg:p-[48px]">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-[10px] mb-[28px] lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined icon-fill text-white" style={{fontSize:'20px'}}>storefront</span>
            </div>
            <span className="text-[17px] font-bold text-primary">RetailEdge POS</span>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-[6px] mb-[32px]">
            {[0,1].map(i => {
              const cur = step==='credentials'?0:1;
              return (
                <div key={i} className={`h-[4px] rounded-full transition-all duration-300 ${
                  i===cur ? 'flex-1 bg-primary' : i<cur ? 'w-[20px] bg-primary/30' : 'w-[20px] bg-black/[0.08]'
                }`} />
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Credentials ───────────────────────────────────────────────────────
function CredentialsStep({ role, onBack, onSuccess, onForgotPassword }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = role === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await login(form.email, form.password);
      const userIsAdmin = data.role === 'admin' || data.role === 'manager';
      if (isAdmin && !userIsAdmin) { setError('This account does not have Admin/Manager access.'); setLoading(false); return; }
      if (!isAdmin && userIsAdmin) { setError('Please use the Admin/Manager login for this account.'); setLoading(false); return; }
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-[6px] text-[12px] font-semibold text-on-surface-variant/60 hover:text-on-surface mb-[24px] transition-colors group">
        <span className="material-symbols-outlined group-hover:-translate-x-[2px] transition-transform" style={{fontSize:'16px'}}>arrow_back</span>
        Change role
      </button>

      <h2 className="text-[26px] font-black text-on-surface mb-[4px]">Sign In</h2>
      <p className="text-[13px] text-on-surface-variant/55 mb-[28px]">
        {isAdmin ? 'Admin / Manager Portal' : 'Cashier / Staff Portal'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-[14px]">
        <div>
          <label className="label">Email Address</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/35" style={{fontSize:'17px'}}>mail</span>
            <input type="email" required autoFocus autoComplete="email"
              value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}
              placeholder={isAdmin ? 'admin@business.co.ke' : 'cashier@branch.co.ke'}
              className="input pl-[42px]" />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-[4px]">
            <label className="label mb-0">Password</label>
            <button type="button" onClick={onForgotPassword} className="text-[12px] font-semibold text-primary hover:underline">
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/35" style={{fontSize:'17px'}}>lock</span>
            <input type={showPwd?'text':'password'} required autoComplete="current-password"
              value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))}
              placeholder="••••••••" className="input pl-[42px] pr-[44px]" />
            <button type="button" onClick={()=>setShowPwd(v=>!v)}
              className="absolute right-[12px] top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>{showPwd?'visibility_off':'visibility'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-[10px] p-[12px] bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 animate-scale-in">
            <span className="material-symbols-outlined icon-fill text-red-500 flex-shrink-0 mt-[1px]" style={{fontSize:'16px'}}>error</span>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="btn-primary w-full justify-center py-[13px] text-[14px] font-bold shadow-sm hover:shadow-md disabled:opacity-50 mt-[4px]">
          {loading
            ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:'18px'}}>progress_activity</span>Verifying…</>
            : <>Continue <span className="material-symbols-outlined" style={{fontSize:'18px'}}>arrow_forward</span></>}
        </button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-[20px] p-[14px] rounded-xl bg-primary/[0.04] border border-primary/[0.08]">
          <div className="flex items-start gap-[8px]">
            <span className="material-symbols-outlined icon-fill text-primary/50 flex-shrink-0 mt-[1px]" style={{fontSize:'14px'}}>info</span>
            <div className="text-[11px] w-full">
              <p className="font-bold text-on-surface mb-[6px]">Demo credentials</p>
              {isAdmin ? (
                <div className="space-y-[1px]">
                  <p className="font-mono text-on-surface-variant/70">admin@retailedge.co.ke</p>
                  <p className="font-mono text-on-surface-variant/70">admin1234</p>
                </div>
              ) : (
                <div className="space-y-[1px]">
                  <p className="font-mono text-on-surface-variant/70">cashier@retailedge.co.ke</p>
                  <p className="font-mono text-on-surface-variant/70">cashier1234</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: OTP ───────────────────────────────────────────────────────────────
function OtpStep({ otpData, onBack, onVerified }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [otp, setOtp]             = useState(['','','','','','']);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
    let t=60;
    const id=setInterval(()=>{t--;setCountdown(t);if(t<=0){setCanResend(true);clearInterval(id);}},1000);
    return ()=>clearInterval(id);
  }, []);

  useEffect(() => { if(otpData?.devOtp) setOtp(String(otpData.devOtp).split('')); },[otpData?.devOtp]);

  const handleChange=(i,val)=>{
    if(!/^\d*$/.test(val))return;
    const next=[...otp];next[i]=val.slice(-1);setOtp(next);
    if(val&&i<5)inputRefs.current[i+1]?.focus();
  };
  const handleKeyDown=(i,e)=>{ if(e.key==='Backspace'&&!otp[i]&&i>0)inputRefs.current[i-1]?.focus(); };
  const handlePaste=(e)=>{ const t=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); if(t.length===6){setOtp(t.split(''));inputRefs.current[5]?.focus();} };

  const handleVerify=async()=>{
    const code=otp.join('');
    if(code.length<6)return setError('Enter all 6 digits');
    setError('');setLoading(true);
    try{ const u=await verifyOtp(otpData.email,code);onVerified(u); }
    catch(err){ setError(err.response?.data?.message||'Incorrect code');setOtp(['','','','','','']);inputRefs.current[0]?.focus(); }
    finally{setLoading(false);}
  };

  const handleResend=async()=>{
    try{await resendOtp(otpData.email);setCountdown(60);setCanResend(false);setOtp(['','','','','','']);setError('');inputRefs.current[0]?.focus();
      let t=60;const id=setInterval(()=>{t--;setCountdown(t);if(t<=0){setCanResend(true);clearInterval(id);}},1000);}
    catch{setError('Failed to resend.');}
  };

  useEffect(()=>{ if(otp.every(d=>d!=='')&&!loading)handleVerify(); },[otp]);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-[6px] text-[12px] font-semibold text-on-surface-variant/60 hover:text-on-surface mb-[24px] transition-colors group">
        <span className="material-symbols-outlined group-hover:-translate-x-[2px] transition-transform" style={{fontSize:'16px'}}>arrow_back</span>
        Back
      </button>

      <div className="flex flex-col items-center text-center mb-[28px]">
        <div className="w-[60px] h-[60px] rounded-2xl bg-primary/[0.08] flex items-center justify-center mb-[14px] relative">
          <span className="material-symbols-outlined icon-fill text-primary" style={{fontSize:'28px'}}>mark_email_read</span>
          <div className="absolute -top-[4px] -right-[4px] w-[18px] h-[18px] rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
            <span className="material-symbols-outlined icon-fill text-white" style={{fontSize:'10px'}}>check</span>
          </div>
        </div>
        <h2 className="text-[22px] font-black text-on-surface mb-[4px]">Check your email</h2>
        <p className="text-[13px] text-on-surface-variant/55">
          Code sent to <span className="font-semibold text-on-surface">{otpData?.email}</span>
        </p>
        {otpData?.devOtp && (
          <span className="mt-[8px] text-[11px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-[12px] py-[4px]">
            Dev: {otpData.devOtp}
          </span>
        )}
      </div>

      <div className="flex gap-[8px] justify-center mb-[20px]" onPaste={handlePaste}>
        {otp.map((digit,i)=>(
          <input key={i} ref={el=>inputRefs.current[i]=el}
            type="text" inputMode="numeric" maxLength={1} value={digit}
            onChange={e=>handleChange(i,e.target.value)}
            onKeyDown={e=>handleKeyDown(i,e)}
            className="w-[50px] h-[58px] text-center text-[22px] font-black rounded-2xl border-2 outline-none transition-all"
            style={{
              borderColor:error?'#ef4444':digit?'var(--color-primary)':'rgba(0,0,0,0.10)',
              background:digit?'rgba(var(--color-primary-rgb),0.05)':'white',
              color:digit?'var(--color-primary)':'#191c1e',
              boxShadow:digit?'0 0 0 3px rgba(var(--color-primary-rgb),0.10)':'none',
            }} />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-[8px] p-[11px] bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 mb-[14px] animate-scale-in">
          <span className="material-symbols-outlined icon-fill text-red-500 flex-shrink-0" style={{fontSize:'16px'}}>error</span>{error}
        </div>
      )}

      <button onClick={handleVerify} disabled={loading||otp.join('').length<6}
        className="btn-primary w-full justify-center py-[13px] text-[14px] font-bold disabled:opacity-40">
        {loading
          ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:'18px'}}>progress_activity</span>Verifying…</>
          : <>Verify & Sign In <span className="material-symbols-outlined" style={{fontSize:'18px'}}>verified</span></>}
      </button>

      <div className="flex items-center justify-between mt-[14px]">
        <p className="text-[12px] text-on-surface-variant/40">{canResend?'':'Expires in '+countdown+'s'}</p>
        <button onClick={canResend?handleResend:undefined} disabled={!canResend}
          className={`text-[12px] font-semibold flex items-center gap-[4px] ${canResend?'text-primary hover:underline':'text-on-surface-variant/30 cursor-not-allowed'}`}>
          <span className="material-symbols-outlined" style={{fontSize:'14px'}}>refresh</span>
          {canResend?'Resend code':'Resend in '+countdown+'s'}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Forgot Password ──────────────────────────────────────────────────
function ForgotPasswordStep({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setSuccess(data.message || 'If that email exists, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send recovery email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-[6px] text-[12px] font-semibold text-on-surface-variant/60 hover:text-on-surface mb-[24px] transition-colors group">
        <span className="material-symbols-outlined group-hover:-translate-x-[2px] transition-transform" style={{fontSize:'16px'}}>arrow_back</span>
        Back to login
      </button>

      <h2 className="text-[26px] font-black text-on-surface mb-[4px]">Reset Password</h2>
      <p className="text-[13px] text-on-surface-variant/55 mb-[28px]">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {success ? (
        <div className="p-[16px] bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] text-emerald-800 space-y-[8px] animate-scale-in">
          <div className="flex items-center gap-[8px]">
            <span className="material-symbols-outlined icon-fill text-emerald-500" style={{fontSize:'18px'}}>check_circle</span>
            <span className="font-bold">Email Sent</span>
          </div>
          <p>{success}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-[14px]">
          <div>
            <label className="label">Email Address</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/35" style={{fontSize:'17px'}}>mail</span>
              <input type="email" required autoFocus autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@retailedge.co.ke"
                className="input pl-[42px]" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-[10px] p-[12px] bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 animate-scale-in">
              <span className="material-symbols-outlined icon-fill text-red-500 flex-shrink-0 mt-[1px]" style={{fontSize:'16px'}}>error</span>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-[13px] text-[14px] font-bold shadow-sm hover:shadow-md disabled:opacity-50 mt-[4px]">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [step, setStep]       = useState('role');
  const [role, setRole]       = useState(null);
  const [otpData, setOtpData] = useState(null);

  if (step === 'role') {
    return (
      <RoleScreen onSelect={r => { setRole(r); setStep('credentials'); }} />
    );
  }

  return (
    <LoginShell step={step} role={role}>
      {step === 'credentials' && (
        <CredentialsStep role={role} onBack={() => setStep('role')}
          onSuccess={data => { setOtpData(data); setStep('otp'); }}
          onForgotPassword={() => setStep('forgot')} />
      )}
      {step === 'forgot' && (
        <ForgotPasswordStep onBack={() => setStep('credentials')} />
      )}
      {step === 'otp' && (
        <OtpStep otpData={otpData} onBack={() => setStep('credentials')}
          onVerified={u => navigate(u.role === 'cashier' ? '/checkout' : '/dashboard')} />
      )}
    </LoginShell>
  );
}
