import { useState } from 'react';
import { PageLayout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const ROLE_STYLE = {
  admin:   'badge-red',
  manager: 'badge-blue',
  cashier: 'badge-green',
};

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name:            user?.name || '',
    email:           user?.email || '',
    password:        '',
    confirmPassword: '',
  });
  const [avatar, setAvatar]   = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    const reader = new FileReader();
    reader.onload = async ev => {
      setAvatarUploading(true);
      try {
        const { data } = await api.post('/upload/image', {
          data: ev.target.result,
          folder: 'retailedge/avatars',
        });
        setAvatar(data.url);
        toast.success('Photo updated!');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Upload failed');
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword)
      return toast.error('Passwords do not match');
    if (form.password && form.password.length < 6)
      return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      if (avatar !== user?.avatar) payload.avatar = avatar;
      const { data } = await api.put('/auth/profile', payload);
      const local = JSON.parse(localStorage.getItem('retailedge_user') || '{}');
      localStorage.setItem('retailedge_user', JSON.stringify({ ...local, ...data }));
      toast.success('Profile updated successfully!');
      // clear password fields
      setForm(p => ({ ...p, password: '', confirmPassword: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const initials = (form.name || user?.name || 'U')[0]?.toUpperCase();

  return (
    <PageLayout title="Profile" subtitle="Manage your account and credentials">
      <div className="max-w-5xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-[24px] items-start">

        {/* ── Top identity card ── */}
        <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[24px]">
          <div className="flex flex-col items-center gap-[20px] text-center">
            {/* Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center gap-[8px]">
              <div className="w-[80px] h-[80px] rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-sm ring-2 ring-primary/20">
                {avatar
                  ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-white font-black text-[32px]">{initials}</span>}
              </div>
              <label className={`inline-flex items-center gap-[4px] text-[11px] font-semibold text-primary bg-primary/[0.07] hover:bg-primary/[0.12] px-[10px] py-[5px] rounded-lg cursor-pointer transition-colors ${avatarUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="material-symbols-outlined" style={{fontSize:'13px'}}>
                  {avatarUploading ? 'progress_activity' : 'photo_camera'}
                </span>
                {avatarUploading ? 'Uploading…' : 'Change Photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={avatarUploading} />
              </label>
              {avatar && (
                <button type="button" onClick={() => setAvatar('')}
                  className="text-[11px] text-error hover:underline">
                  Remove
                </button>
              )}
            </div>

            {/* Info */}
            <div className="w-full min-w-0 pt-[8px] border-t border-black/[0.05]">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight truncate">{user?.name}</h2>
              <p className="text-[13px] text-on-surface-variant/60 font-mono mt-[2px] truncate">{user?.email}</p>
              <div className="flex items-center justify-center gap-[8px] mt-[16px] flex-wrap">
                <span className={`badge ${ROLE_STYLE[user?.role] || 'badge-gray'}`}>{user?.role}</span>
                <span className="badge badge-green">Active</span>
                {user?.branch && (
                  <span className="inline-flex items-center justify-center w-full mt-[8px] gap-[4px] text-[11px] text-on-surface-variant/60">
                    <span className="material-symbols-outlined" style={{fontSize:'13px'}}>location_on</span>
                    {user.branch}
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Edit form ── */}
        <div className="bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.07)] p-[24px]">
          <h3 className="text-[15px] font-bold text-on-surface mb-[20px]">Update Details</h3>
          <form onSubmit={handleSubmit} className="space-y-[16px]">

            {/* Name + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
              <div>
                <label className="label">Full Name</label>
                <input required value={form.name} onChange={e => sf('name', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input type="email" required value={form.email}
                  onChange={e => sf('email', e.target.value)} className="input font-mono" />
              </div>
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
              <div>
                <label className="label">Role</label>
                <div className="input bg-surface-container-low text-on-surface-variant/60 cursor-not-allowed capitalize">
                  {user?.role}
                </div>
              </div>
              <div>
                <label className="label">Branch</label>
                <div className="input bg-surface-container-low text-on-surface-variant/60 cursor-not-allowed">
                  {user?.branch || '—'}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-black/[0.06] pt-[16px]">
              <p className="text-[14px] font-bold text-on-surface mb-[4px]">Change Password</p>
              <p className="text-[12px] text-on-surface-variant/55 mb-[14px]">Leave blank to keep your current password.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
                <div>
                  <label className="label">New Password</label>
                  <input type="password" minLength={6} value={form.password}
                    onChange={e => sf('password', e.target.value)}
                    placeholder="Min. 6 characters" className="input" />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input type="password" value={form.confirmPassword}
                    onChange={e => sf('confirmPassword', e.target.value)}
                    placeholder="Repeat password" className="input" />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-[4px]">
              <button type="submit" disabled={loading} className="btn-primary px-[28px]">
                {loading
                  ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:'16px'}}>progress_activity</span>Saving…</>
                  : <><span className="material-symbols-outlined" style={{fontSize:'16px'}}>save</span>Save Changes</>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </PageLayout>
  );
}
