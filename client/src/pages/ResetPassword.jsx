import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (password.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(data.message || 'Password reset successfully.');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Token is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-[24px]" style={{background:'#f0f2f5'}}>
      <div className="w-full max-w-[420px] bg-white p-[32px] rounded-3xl border border-black/[0.06] shadow-sm">
        <div className="flex flex-col items-center mb-[28px]">
          <div className="w-[52px] h-[52px] rounded-2xl bg-primary flex items-center justify-center shadow-sm mb-[12px]">
            <span className="material-symbols-outlined icon-fill text-white" style={{fontSize:'26px'}}>lock_reset</span>
          </div>
          <h1 className="text-[20px] font-black text-on-surface">Set New Password</h1>
          <p className="text-[13px] text-on-surface-variant/60 mt-[4px]">Enter a secure password for your account</p>
        </div>

        {success ? (
          <div className="p-[16px] bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] text-emerald-800 space-y-[8px]">
            <div className="flex items-center gap-[8px]">
              <span className="material-symbols-outlined icon-fill text-emerald-500" style={{fontSize:'18px'}}>check_circle</span>
              <span className="font-bold">Success</span>
            </div>
            <p>{success}</p>
            <p className="text-[11px] text-emerald-600/70">Redirecting you to the login screen...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-[14px]">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/35" style={{fontSize:'17px'}}>lock</span>
                <input type="password" required autoFocus
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-[42px]" />
              </div>
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-[14px] top-1/2 -translate-y-1/2 text-on-surface-variant/35" style={{fontSize:'17px'}}>lock</span>
                <input type="password" required
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-[42px]" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-[10px] p-[12px] bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
                <span className="material-symbols-outlined icon-fill text-red-500 flex-shrink-0 mt-[1px]" style={{fontSize:'16px'}}>error</span>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-[13px] text-[14px] font-bold shadow-sm hover:shadow-md disabled:opacity-50 mt-[4px]">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
