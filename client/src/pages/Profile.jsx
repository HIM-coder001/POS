import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;

      const { data } = await api.put('/api/auth/profile', payload);
      
      // Update local storage user profile
      const localData = JSON.parse(localStorage.getItem('retailedge_user') || '{}');
      const updatedUser = { ...localData, ...data };
      localStorage.setItem('retailedge_user', JSON.stringify(updatedUser));
      
      // We manually update context user (or just refresh the page)
      toast.success('Profile updated successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-gutter">
        <header className="mb-lg">
          <h2 className="text-headline-md font-bold text-primary">User Profile</h2>
          <p className="text-body-sm text-on-surface-variant">Manage your account details and password settings.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* LEFT: Info card */}
          <div className="card p-xl bg-surface-container-lowest flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center text-primary font-black text-3xl mb-md">
              {user?.name?.[0] || 'U'}
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">{user?.name}</h3>
            <p className="text-body-sm text-on-surface-variant capitalize mt-unit">{user?.role}</p>
            <div className="border-t border-outline-variant/30 w-full my-md" />
            <div className="w-full text-left space-y-md">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Email Address</p>
                <p className="text-body-sm font-medium font-mono truncate">{user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Current Branch</p>
                <p className="text-body-sm font-medium">{user?.branch}</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Account Status</p>
                <p className="text-xs font-semibold text-success flex items-center gap-unit mt-unit">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  Active
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Edit Form */}
          <div className="card lg:col-span-2 p-xl bg-surface-container-lowest">
            <h3 className="text-title-md font-bold text-on-surface mb-lg">Update Profile Credentials</h3>
            <form onSubmit={handleSubmit} className="space-y-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <label className="label">Full Name</label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" required value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="input font-mono" />
                </div>
              </div>

              <div className="border-t border-outline-variant/30 pt-md" />
              <h4 className="text-body-md font-semibold text-primary mb-sm">Change Password</h4>
              <p className="text-xs text-on-surface-variant mb-md">Leave blank if you do not want to update password.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <label className="label">New Password</label>
                  <input type="password" minLength="6" value={form.password}
                    placeholder="••••••••"
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="input" />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input type="password" value={form.confirmPassword}
                    placeholder="••••••••"
                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className="input" />
                </div>
              </div>

              <div className="pt-md flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary py-md px-lg">
                  {loading ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
