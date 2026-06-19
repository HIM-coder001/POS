import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [form, setForm] = useState({
    name: 'RetailEdge Main Store',
    address: 'Nairobi Central District, Tom Mboya St',
    phone: '+254 700 000 000',
    kraPin: 'A001234567Z',
    receiptHeader: 'Thank you for choosing RetailEdge!',
    receiptFooter: 'Goods once sold cannot be returned. Thank you!',
    currency: 'KES',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/api/settings');
      if (data) {
        setForm({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          kraPin: data.kraPin || '',
          receiptHeader: data.receiptHeader || '',
          receiptFooter: data.receiptFooter || '',
          currency: data.currency || 'KES',
        });
      }
    } catch {
      toast.error('Failed to load store settings');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/api/settings', form);
      toast.success('Business settings updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-gutter">
        <header className="mb-md flex-shrink-0">
          <h2 className="text-headline-md font-bold text-primary">Business Settings</h2>
          <p className="text-body-sm text-on-surface-variant">Customize your business details, contact information, and printed receipts.</p>
        </header>

        <div className="flex-1 flex overflow-hidden gap-gutter min-h-0">
          {/* LEFT: Settings Form */}
          <div className="flex-1 card p-xl bg-surface-container-lowest overflow-y-auto">
            <h3 className="text-title-md font-bold text-on-surface mb-lg">Customization Details</h3>
            {fetching ? (
              <div className="py-xl text-center text-on-surface-variant animate-pulse">Loading settings...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-md">
                <div>
                  <label className="label">Store / Business Name</label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="input" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="label">Store Phone Number</label>
                    <input type="text" required value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="input" />
                  </div>
                  <div>
                    <label className="label">KRA Tax PIN</label>
                    <input type="text" required value={form.kraPin}
                      onChange={e => setForm(p => ({ ...p, kraPin: e.target.value }))}
                      className="input font-mono" />
                  </div>
                </div>
                <div>
                  <label className="label">Physical Address</label>
                  <input type="text" required value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    className="input" />
                </div>

                <div className="border-t border-outline-variant/30 pt-md" />
                <h4 className="text-body-md font-semibold text-primary mb-sm">Receipt Customizer</h4>
                
                <div>
                  <label className="label">Receipt Header / Greeting Message</label>
                  <input type="text" value={form.receiptHeader}
                    onChange={e => setForm(p => ({ ...p, receiptHeader: e.target.value }))}
                    placeholder="Welcome to our store!" className="input" />
                </div>
                <div>
                  <label className="label">Receipt Footer / Thank You Message</label>
                  <textarea rows="3" value={form.receiptFooter}
                    onChange={e => setForm(p => ({ ...p, receiptFooter: e.target.value }))}
                    placeholder="Goods once sold cannot be returned." className="input resize-none" />
                </div>

                <div className="pt-md flex justify-end">
                  <button type="submit" disabled={loading} className="btn-primary py-md px-lg">
                    {loading ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT: Live Receipt Preview */}
          <div className="w-80 xl:w-96 flex-shrink-0 card p-md bg-surface-container overflow-y-auto flex flex-col items-center">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-md">Live Receipt Preview</h4>
            
            <div className="w-full bg-white text-black p-lg rounded-lg shadow-sm border border-outline-variant font-mono text-[10px] space-y-sm">
              <div className="text-center space-y-unit">
                <h3 className="text-sm font-black uppercase tracking-tight">{form.name || 'STORE NAME'}</h3>
                <p className="text-[8px] text-gray-500 uppercase">{form.address || 'STORE ADDRESS'}</p>
                <p className="text-[8px] text-gray-500">Tel: {form.phone || 'PHONE NUMBER'}</p>
                <p className="text-[8px] text-gray-500">PIN: {form.kraPin || 'KRA PIN'}</p>
              </div>

              <div className="border-t border-dashed border-gray-400 my-unit" />

              <div className="space-y-unit text-[9px]">
                <div className="flex justify-between">
                  <span>Receipt No:</span>
                  <span className="font-bold">POS-00042</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>Grace Wangari</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-400 my-unit" />

              <table className="w-full text-left text-[9px]">
                <thead>
                  <tr className="border-b border-dashed border-gray-400">
                    <th className="pb-unit">Item</th>
                    <th className="pb-unit text-center">Qty</th>
                    <th className="pb-unit text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-unit truncate">Unga Wa Dola (2kg)</td>
                    <td className="py-unit text-center">2</td>
                    <td className="py-unit text-right">{fmt(360)}</td>
                  </tr>
                  <tr>
                    <td className="py-unit truncate">Greek Yogurt (500g)</td>
                    <td className="py-unit text-center">1</td>
                    <td className="py-unit text-right">{fmt(320)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-dashed border-gray-400 my-unit" />

              <div className="space-y-unit text-[9px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{fmt(680)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span>{fmt(108.80)}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-dashed border-gray-400 pt-unit mt-unit">
                  <span>GRAND TOTAL:</span>
                  <span>{fmt(788.80)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-400 my-unit" />

              <div className="text-center space-y-unit pt-unit">
                <p className="font-bold uppercase tracking-wider text-[8px]">{form.receiptHeader || 'GREETING MESSAGE'}</p>
                <p className="text-gray-600 text-[8px]">{form.receiptFooter || 'THANK YOU MESSAGE'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
