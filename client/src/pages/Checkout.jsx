import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Groceries', 'Electronics', 'Dairy', 'Beverages', 'Bakery', 'FMCG', 'Grains'];
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const FAV_KEY = 'retailedge_fav_products';
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } };
const saveFavs = (ids) => localStorage.setItem(FAV_KEY, JSON.stringify(ids));
export default function Checkout() {
  const { user } = useAuth();
  const { enabledMethods } = useSettings();
  const {
    items,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    subtotal,
    vatAmount,
    discount,
    setDiscount,
    heldSales,
    holdCurrentSale,
    resumeSale,
    deleteHeldSale
  } = useCart();
  
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [completingLoading, setCompletingLoading] = useState(false);
  // M-Pesa polling state
  const [mpesaStatus, setMpesaStatus] = useState(null); // null | 'waiting' | 'success' | 'failed' | 'cancelled' | 'timeout'
  const [mpesaCountdown, setMpesaCountdown] = useState(60);
  const [mpesaRef, setMpesaRef] = useState('');
  const mpesaPollRef = useRef(null);
  const mpesaTimerRef = useRef(null);
  const searchRef = useRef(null);
 
  // Loyalty & Customer states
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [pointsRedemptionApplied, setPointsRedemptionApplied] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);
  
  // Quick Add Customer Modal state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Hold/Resume and Split payment states
  const [showHeldSalesDrawer, setShowHeldSalesDrawer] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const [splitMpesa, setSplitMpesa] = useState(0);
  const [splitMpesaPhone, setSplitMpesaPhone] = useState('');
  const [splitMpesaPaid, setSplitMpesaPaid] = useState(false);
  const [splitMpesaRef, setSplitMpesaRef] = useState('');
  const [splitMpesaLoading, setSplitMpesaLoading] = useState(false);
  const [splitMpesaStatus, setSplitMpesaStatus] = useState(null); // null|'waiting'|'success'|'failed'|'cancelled'
  const [splitMpesaCountdown, setSplitMpesaCountdown] = useState(60);
  const splitPollRef  = useRef(null);
  const splitTimerRef = useRef(null);

  // Checkout workflow states
  const [activePaymentMethod, setActivePaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');

  // Favourites
  const [favIds, setFavIds] = useState(loadFavs);
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const toggleFav = useCallback((id) => {
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveFavs(next);
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Only fire when no input/textarea is focused
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); if (items.length > 0) { const name = prompt('Hold sale — customer name:'); if (name !== null) { holdCurrentSale(name || 'Walk-in'); toast.success('Sale held'); } } }
      if (e.key === 'F3') { e.preventDefault(); setShowFavsOnly(v => !v); }
      if (e.key === 'Escape') { setPaymentModal(false); }
      if (e.key === 'F10') { e.preventDefault(); if (items.length > 0) { if (enabledMethods.length > 0) setActivePaymentMethod(enabledMethods[0].id); setPaymentModal(true); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, enabledMethods, holdCurrentSale]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    searchRef.current?.focus();
  }, []);

  useEffect(() => { fetchProducts(); }, [category, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { limit: 40 };
      if (search) params.search = search;
      if (category !== 'All') params.category = category;
      const { data } = await api.get('/products', { params });
      setProducts(data.products);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/customers?limit=100');
      setCustomers(data.customers || []);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    }
  };

  const playScanSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.07);
    } catch (e) {
      console.warn('Scan beep audio blocked by browser settings.');
    }
  };

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = search.trim();
      if (!term) return;

      // Try local lookup first
      let match = products.find(p => p.sku?.toUpperCase() === term.toUpperCase() || p.barcode === term);

      // Try remote API search if not found locally
      if (!match) {
        try {
          const { data } = await api.get('/products', { params: { search: term, limit: 1 } });
          if (data.products?.length > 0) {
            const p = data.products[0];
            if (p.sku?.toUpperCase() === term.toUpperCase() || p.barcode === term) {
              match = p;
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      if (match) {
        if (match.stock > 0) {
          addItem(match);
          playScanSound();
          setSearch('');
        } else {
          toast.error('Out of stock');
        }
      } else {
        toast.error(`No product matches barcode/SKU: ${term}`);
      }
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName || !newCustomerPhone) return toast.error('Please enter name and phone');
    try {
      const { data } = await api.post('/customers', { name: newCustomerName, phone: newCustomerPhone });
      toast.success('Customer registered!');
      setSelectedCustomer(data);
      setCustomers(prev => [data, ...prev]);
      setShowAddCustomerModal(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCustomerSearch('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register customer');
    }
  };

  const maxPointsToRedeem = selectedCustomer && pointsRedemptionApplied 
    ? Math.min(selectedCustomer.loyaltyPoints, Math.floor(subtotal + vatAmount - discount))
    : 0;

  const finalGrandTotal = Math.max(0, subtotal + vatAmount - discount - maxPointsToRedeem);

  const completeSale = async (method, mpesaRef = '') => {
    if (!items.length) return toast.error('Cart is empty');
    setCompletingLoading(true);
    try {
      const { data } = await api.post('/sales', {
        items: items.map(i => ({ productId: i._id, quantity: i.quantity })),
        paymentMethod: method,
        discount,
        pointsRedeemed: maxPointsToRedeem,
        customerId: selectedCustomer?._id,
        mpesaRef,
      });
      toast.success('🎉 Sale completed successfully!');
      clearCart();
      
      // Reset split payment states
      setIsSplitPayment(false);
      setSplitCash(0);
      setSplitCard(0);
      setSplitMpesa(0);
      setSplitMpesaPhone('');
      setSplitMpesaPaid(false);
      setSplitMpesaRef('');
      setSplitMpesaStatus(null);
      setSplitMpesaCountdown(60);
      setCashReceived('');
      setActivePaymentMethod('cash');
      
      setPaymentModal(false);
      setSelectedCustomer(null);
      setPointsRedemptionApplied(false);
      setCompletedSaleData(data);
      fetchProducts();
      fetchCustomers();
      // Auto-print if enabled
      if (localStorage.getItem('retailedge_auto_print') === 'true') {
        setTimeout(() => window.print(), 600);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally { setCompletingLoading(false); }
  };

  const stopMpesaPolling = () => {
    if (mpesaPollRef.current)  { clearInterval(mpesaPollRef.current);  mpesaPollRef.current  = null; }
    if (mpesaTimerRef.current) { clearInterval(mpesaTimerRef.current); mpesaTimerRef.current = null; }
  };

  const resetMpesaState = () => {
    stopMpesaPolling();
    setMpesaStatus(null);
    setMpesaCountdown(60);
    setMpesaRef('');
    setMpesaLoading(false);
  };

  const handleMpesa = async () => {
    if (!mpesaPhone) return toast.error('Enter M-Pesa phone number');
    setMpesaLoading(true);
    try {
      const { data } = await api.post('/mpesa/stk-push', {
        phone: mpesaPhone,
        amount: finalGrandTotal,
        orderId: `POS-${Date.now()}`,
      });

      const checkoutId = data.checkoutRequestId;
      setMpesaStatus('waiting');
      setMpesaCountdown(60);
      setMpesaLoading(false);

      // ── Countdown timer ──────────────────────────────────────────
      let remaining = 60;
      mpesaTimerRef.current = setInterval(() => {
        remaining -= 1;
        setMpesaCountdown(remaining);
        if (remaining <= 0) {
          stopMpesaPolling();
          setMpesaStatus('timeout');
        }
      }, 1000);

      // ── Poll /status every 3 seconds ─────────────────────────────
      mpesaPollRef.current = setInterval(async () => {
        try {
          const { data: statusData } = await api.get(`/mpesa/status/${checkoutId}`);

          if (statusData.status === 'success') {
            stopMpesaPolling();
            setMpesaRef(statusData.mpesaRef || '');
            setMpesaStatus('success');
            // Auto-complete the sale with the M-Pesa receipt ref
            await completeSale('mpesa', statusData.mpesaRef || checkoutId);
            resetMpesaState();

          } else if (statusData.status === 'cancelled') {
            stopMpesaPolling();
            setMpesaStatus('cancelled');
            toast.error('Payment cancelled by customer.');

          } else if (statusData.status === 'failed') {
            stopMpesaPolling();
            setMpesaStatus('failed');
            toast.error(statusData.resultDesc || 'M-Pesa payment failed.');
          }
          // 'pending' → keep polling
        } catch {
          // network blip — keep polling
        }
      }, 3000);

    } catch (err) {
      setMpesaLoading(false);
      toast.error(err.response?.data?.message || 'Failed to send STK push');
    }
  };

  const handlePrint = () => { window.print(); };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar with search */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-lg py-md h-16 bg-surface border-b border-outline-variant shadow-sm">
          <div className="flex-1 max-w-xl relative group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
            <input ref={searchRef} type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan Barcode or Search Products..."
              className="input pl-10 w-full" />
          </div>
          <div className="flex items-center gap-sm ml-lg">
            <span className="hidden lg:block text-body-sm text-on-surface-variant">{user?.name} · {user?.branch}</span>
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">{user?.name?.[0]}</div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden p-gutter gap-gutter">
          {/* LEFT: Products */}
          <section className="flex-[2.5] flex flex-col gap-md overflow-hidden">
            {/* Category filters + favourites toggle */}
            <div className="flex gap-sm overflow-x-auto pb-1 no-scrollbar items-center">
              <button onClick={() => setShowFavsOnly(v => !v)}
                title="F3 — Toggle favourites"
                className={`px-lg py-sm rounded-full text-body-sm whitespace-nowrap font-medium transition-all flex items-center gap-[4px] flex-shrink-0
                  ${showFavsOnly ? 'bg-amber-500 text-white shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container'}`}>
                <span className="material-symbols-outlined icon-fill" style={{fontSize:'14px'}}>star</span>
                Favourites {favIds.length > 0 && `(${favIds.length})`}
              </button>
              <div className="w-px h-5 bg-black/[0.10] flex-shrink-0" />
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCategory(c); setShowFavsOnly(false); }}
                  className={`px-lg py-sm rounded-full text-body-sm whitespace-nowrap font-medium transition-all ${
                    category === c && !showFavsOnly ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container'
                  }`}>
                  {c}
                </button>
              ))}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="flex items-center gap-[12px] text-[10px] text-on-surface-variant/40 flex-wrap">
              {[['F1','Search'],['F2','Hold Sale'],['F3','Favourites'],['F10','Checkout'],['Esc','Close']].map(([k,l])=>(
                <span key={k} className="flex items-center gap-[4px]">
                  <kbd className="px-[5px] py-[1px] rounded border border-black/[0.10] bg-surface-container-low font-mono text-[10px]">{k}</kbd>
                  {l}
                </span>
              ))}
            </div>

            {/* Product grid — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md pb-4">
                {loading ? Array(8).fill(0).map((_, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-high h-52 animate-pulse" />
                )) : (showFavsOnly ? products.filter(p => favIds.includes(p._id)) : products).map(p => (
                  <div key={p._id}
                    onClick={() => { if (p.stock > 0) addItem(p); else toast.error('Out of stock'); }}
                    className={`card flex flex-col overflow-hidden cursor-pointer active:scale-95 group relative ${p.stock === 0 ? 'opacity-60' : ''}`}>
                    {/* Star button */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleFav(p._id); }}
                      title={favIds.includes(p._id) ? 'Remove from favourites' : 'Add to favourites'}
                      className="absolute top-[6px] right-[6px] z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                      <span className={`material-symbols-outlined text-sm ${favIds.includes(p._id) ? 'icon-fill text-amber-500' : 'text-on-surface-variant/50'}`}
                        style={{fontSize:'16px'}}>star</span>
                    </button>
                    <div className="relative h-36 overflow-hidden bg-surface-container">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-5xl text-outline/30">inventory_2</span>
                        </div>
                      )}
                      {p.stock === 0 && (
                        <div className="absolute inset-0 bg-surface-dim/80 flex items-center justify-center">
                          <span className="badge-red">Out of Stock</span>
                        </div>
                      )}
                      {p.stock > 0 && p.stock <= p.reorderLevel && (
                        <div className="absolute top-sm right-sm"><span className="badge-amber">Low Stock</span></div>
                      )}
                    </div>
                    <div className="p-md flex flex-col flex-1">
                      <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-unit">{p.category}</p>
                      <h3 className="text-body-sm font-semibold text-on-surface line-clamp-1 mb-auto">{p.name}</h3>
                      <div className="mt-sm flex items-center justify-between">
                        <p className="font-mono text-primary font-bold">{fmt(p.price)}</p>
                        <span className="material-symbols-outlined text-primary-fixed-dim group-hover:text-primary transition-colors">add_circle</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!loading && (showFavsOnly ? products.filter(p => favIds.includes(p._id)) : products).length === 0 && (
                  <div className="col-span-4 py-xl text-center text-on-surface-variant text-body-sm">
                    <span className="material-symbols-outlined text-5xl block mb-sm">{showFavsOnly ? 'star' : 'search_off'}</span>
                    {showFavsOnly ? 'No favourite products yet. Hover a product and click ★ to add.' : 'No products found'}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT: Cart */}
          <aside className="w-80 xl:w-96 flex-shrink-0 bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant flex flex-col overflow-hidden">
            {/* Cart header */}
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low flex-shrink-0">
              <div>
                <h2 className="text-title-md font-bold text-primary">Current Cart</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-xs">
                {/* Hold current sale button */}
                <button 
                  onClick={() => {
                    if (items.length === 0) return toast.error('Cart is empty');
                    const name = prompt('Enter customer name / reference for this held cart:');
                    if (name === null) return; // cancelled
                    holdCurrentSale(name || 'Walk-in');
                    toast.success('Sale held successfully');
                  }} 
                  disabled={items.length === 0}
                  title="Hold current sale"
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all rounded-lg disabled:opacity-50">
                  <span className="material-symbols-outlined text-xl">pause_circle</span>
                </button>
                {/* Held sales list toggle */}
                <button 
                  onClick={() => setShowHeldSalesDrawer(true)} 
                  title="Held sales"
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all rounded-lg relative">
                  <span className="material-symbols-outlined text-xl">bookmark_manager</span>
                  {heldSales.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-error text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {heldSales.length}
                    </span>
                  )}
                </button>
                {/* Clear cart */}
                <button onClick={clearCart} title="Clear cart"
                  className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-all rounded-lg">
                  <span className="material-symbols-outlined text-xl">delete_sweep</span>
                </button>
              </div>
            </div>

            {/* Customer Search & Loyalty Section */}
            <div className="px-5 py-3 border-b border-outline-variant bg-surface-container-low flex-shrink-0 flex flex-col gap-sm">
              {!selectedCustomer ? (
                <div className="relative">
                  <div className="flex gap-xs">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-sm">person_search</span>
                      <input
                        type="text"
                        placeholder="Link customer..."
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        className="input pl-8 text-xs h-8"
                      />
                      {customerSearch && (
                        <button
                          onClick={() => setCustomerSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowAddCustomerModal(true)}
                      title="Add new customer"
                      className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                    </button>
                  </div>

                  {/* Customer search results dropdown */}
                  {customerSearch && (
                    <div className="absolute left-0 right-0 mt-1 bg-surface border border-outline-variant rounded-lg shadow-overlay max-h-40 overflow-y-auto z-50">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                          <div
                            key={c._id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                            }}
                            className="px-3 py-2 hover:bg-surface-container-high cursor-pointer flex justify-between items-center border-b border-outline-variant/30 last:border-0"
                          >
                            <div>
                              <p className="text-xs font-semibold text-on-surface">{c.name}</p>
                              <p className="text-[10px] text-on-surface-variant font-mono">{c.phone}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              c.tier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                              c.tier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                              c.tier === 'Silver' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>{c.tier} ({c.loyaltyPoints} pts)</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-on-surface-variant">
                          No customer found. <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => { setShowAddCustomerModal(true); setCustomerSearch(''); }}>Register New</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-xs p-md bg-surface border border-outline-variant rounded-xl animate-fade-in relative">
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setPointsRedemptionApplied(false);
                    }}
                    className="absolute top-2 right-2 text-outline hover:text-error p-unit"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                  
                  <div className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-base">account_circle</span>
                    <span className="text-xs font-bold text-on-surface truncate pr-6">{selectedCustomer.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-mono mt-unit">
                    <span>{selectedCustomer.phone}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      selectedCustomer.tier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                      selectedCustomer.tier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                      selectedCustomer.tier === 'Silver' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{selectedCustomer.tier}</span>
                  </div>

                  {selectedCustomer.loyaltyPoints > 0 ? (
                    <label className="flex items-center gap-sm mt-xs pt-xs border-t border-outline-variant/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pointsRedemptionApplied}
                        onChange={e => setPointsRedemptionApplied(e.target.checked)}
                        className="rounded border-outline text-primary focus:ring-primary/20"
                      />
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Redeem {Math.min(selectedCustomer.loyaltyPoints, Math.floor(subtotal + vatAmount - discount))} points (Save {fmt(Math.min(selectedCustomer.loyaltyPoints, Math.floor(subtotal + vatAmount - discount)))})
                      </span>
                    </label>
                  ) : (
                    <div className="text-[10px] text-primary font-medium mt-xs pt-xs border-t border-outline-variant/30">
                      Will earn {Math.floor(finalGrandTotal / 10)} loyalty points
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items — scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-on-surface-variant gap-3 py-12">
                  <span className="material-symbols-outlined text-5xl opacity-25">shopping_cart</span>
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs text-center opacity-60 max-w-[160px]">Click a product to add it here</p>
                </div>
              ) : items.map(item => (
                <div key={item._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors group animate-fade-in">
                  {/* Thumbnail */}
                  <div className="h-11 w-11 rounded-lg bg-surface-container overflow-hidden border border-outline-variant flex-shrink-0">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-outline text-base">inventory_2</span>
                        </div>
                    }
                  </div>
                  {/* Name + price */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-on-surface truncate leading-tight">{item.name}</h4>
                    <div className="flex items-center gap-[6px] mt-0.5">
                      <p className="text-xs text-on-surface-variant font-mono">{fmt(item.price)}</p>
                      {item.quantity >= item.stock && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-[5px] py-[1px] rounded-full">Max</span>
                      )}
                    </div>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 bg-surface-container rounded-lg p-1 flex-shrink-0">
                    <button
                      onClick={() => item.quantity > 1 ? updateQty(item._id, item.quantity - 1) : removeItem(item._id)}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-surface text-primary hover:bg-primary hover:text-on-primary transition-all text-sm font-bold leading-none">
                      −
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-on-surface">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item._id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      title={item.quantity >= item.stock ? `Max stock: ${item.stock}` : ''}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-surface text-primary hover:bg-primary hover:text-on-primary transition-all text-sm font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-primary">
                      +
                    </button>
                  </div>
                  {/* Line total */}
                  <p className="text-xs font-mono font-bold text-primary w-20 text-right flex-shrink-0">
                    {fmt(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer: totals + payment — fixed, never scrolls */}
            <div className="flex-shrink-0 border-t border-outline-variant bg-surface-container-low">
              {/* Discount input */}
              <div className="px-4 pt-3 pb-2">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{fontSize:'16px'}}>percent</span>
                  <input
                    type="number" min="0" value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                    placeholder="Discount (KES)"
                    className="input pl-9 text-sm h-9" />
                </div>
              </div>

              {/* Totals — compact, fixed rows */}
              <div className="px-4 pb-2 space-y-[5px]">
                <div className="flex justify-between text-[12px] text-on-surface-variant">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-on-surface-variant">
                  <span>VAT (16%)</span>
                  <span className="font-mono font-medium">{fmt(vatAmount)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[12px] text-tertiary">
                    <span>Discount</span>
                    <span className="font-mono font-medium">− {fmt(discount)}</span>
                  </div>
                )}
                {maxPointsToRedeem > 0 && (
                  <div className="flex justify-between text-[12px] text-purple-600 font-bold">
                    <span>Points Redeemed</span>
                    <span className="font-mono font-medium">− {fmt(maxPointsToRedeem)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-[6px] border-t border-outline-variant">
                  <span className="font-bold text-on-surface text-[13px]">Grand Total</span>
                  <span className="font-mono text-primary text-[17px] font-bold">{fmt(finalGrandTotal)}</span>
                </div>
              </div>

              {/* Checkout / Proceed button */}
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={() => {
                    if (items.length === 0) return toast.error('Cart is empty');
                    // auto-select first enabled payment method
                    if (enabledMethods.length > 0) setActivePaymentMethod(enabledMethods[0].id);
                    setPaymentModal(true);
                  }}
                  disabled={items.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary rounded-xl shadow-md hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <span className="material-symbols-outlined text-lg">shopping_cart_checkout</span>
                  <span className="font-bold uppercase tracking-wider text-sm">Proceed to Payment</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Checkout & Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-md overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-2xl animate-fade-in flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-2xl">shopping_cart_checkout</span>
                <div>
                  <h3 className="text-title-md font-bold text-on-surface">Checkout & Payment</h3>
                  <p className="text-xs text-on-surface-variant">
                    {selectedCustomer ? `Customer: ${selectedCustomer.name} · ` : ''}Total Due: <strong className="text-primary font-mono">{fmt(finalGrandTotal)}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => {
                setPaymentModal(false);
                setIsSplitPayment(false);
              }} className="text-outline hover:text-primary p-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content - Two Column Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Left Column: Navigation Tabs — dynamic based on enabled gateways */}
              <div className="w-full md:w-[160px] flex-shrink-0 bg-surface-container-low border-b md:border-b-0 md:border-r border-outline-variant flex flex-row md:flex-col gap-[4px] overflow-x-auto md:overflow-x-visible no-scrollbar p-[8px]">
                {enabledMethods.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setActivePaymentMethod(method.id);
                      setIsSplitPayment(method.id === 'split');
                    }}
                    className={`flex items-center gap-[8px] px-[12px] py-[10px] rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all w-full flex-shrink-0
                      ${activePaymentMethod === method.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                  >
                    <span className="material-symbols-outlined flex-shrink-0" style={{
                      fontSize: '18px',
                      fontVariationSettings: activePaymentMethod === method.id ? "'FILL' 1" : "'FILL' 0",
                    }}>{method.icon}</span>
                    <span>{method.label}</span>
                  </button>
                ))}
                {enabledMethods.length === 0 && (
                  <p className="text-[12px] text-on-surface-variant/60 p-[12px] text-center">
                    No payment methods enabled. Check Settings → Payment Gateways.
                  </p>
                )}
              </div>

              {/* Right Column: Active Form Content */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto p-lg">
                  <div className="space-y-md">
                  {activePaymentMethod === 'cash' && (
                    <div className="space-y-md animate-fade-in">
                      <div className="flex items-center gap-sm text-primary mb-sm">
                        <span className="material-symbols-outlined">payments</span>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Cash Sale</h4>
                      </div>
                      
                      <div className="bg-surface-container p-md rounded-xl text-center">
                        <p className="text-xs text-on-surface-variant uppercase tracking-wider">Amount to Pay</p>
                        <p className="text-headline-md font-bold text-primary font-mono">{fmt(finalGrandTotal)}</p>
                      </div>

                      <div>
                        <label className="label">Cash Tendered / Received</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={cashReceived}
                          onChange={e => setCashReceived(e.target.value)}
                          className="input font-mono text-lg h-12 text-center"
                        />
                      </div>

                      {Number(cashReceived) > 0 && (
                        <div className="bg-surface-container-low p-md rounded-xl flex justify-between items-center border border-outline-variant/30 animate-fade-in">
                          <span className="text-xs font-semibold text-on-surface-variant">Change Due:</span>
                          <span className="text-title-md font-bold text-success font-mono">
                            {Number(cashReceived) >= finalGrandTotal
                              ? fmt(Number(cashReceived) - finalGrandTotal)
                              : 'Insufficient Cash'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {activePaymentMethod === 'card' && (
                    <div className="space-y-md animate-fade-in">
                      <div className="flex items-center gap-sm text-primary mb-sm">
                        <span className="material-symbols-outlined">credit_card</span>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Card Transaction</h4>
                      </div>

                      <div className="bg-surface-container p-md rounded-xl text-center">
                        <p className="text-xs text-on-surface-variant uppercase tracking-wider">Amount to Charge Card</p>
                        <p className="text-headline-md font-bold text-primary font-mono">{fmt(finalGrandTotal)}</p>
                      </div>

                      <p className="text-xs text-on-surface-variant bg-surface-container-low p-md rounded-lg border border-outline-variant/30">
                        Please insert or tap the customer's card on the PDQ POS terminal, and confirm that the payment has cleared before clicking complete.
                      </p>
                    </div>
                  )}

                  {activePaymentMethod === 'mpesa' && (
                    <div className="space-y-md animate-fade-in">
                      <div className="flex items-center gap-sm text-mpesa-green mb-sm">
                        <span className="material-symbols-outlined">smartphone</span>
                        <h4 className="font-bold text-sm uppercase tracking-wide">M-Pesa STK Push</h4>
                      </div>

                      {/* ── Waiting state ── */}
                      {mpesaStatus === 'waiting' && (
                        <div className="flex flex-col items-center gap-md py-md animate-fade-in">
                          {/* Animated phone icon */}
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-mpesa-green/10 animate-ping" />
                            <div className="absolute inset-2 rounded-full bg-mpesa-green/20 animate-pulse" />
                            <div className="w-14 h-14 rounded-full bg-mpesa-green flex items-center justify-center z-10">
                              <span className="material-symbols-outlined text-white icon-fill text-3xl">smartphone</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-on-surface text-[15px]">Waiting for payment…</p>
                            <p className="text-xs text-on-surface-variant mt-1">Check <span className="font-bold font-mono">{mpesaPhone}</span> and enter PIN</p>
                          </div>
                          {/* Countdown ring */}
                          <div className="flex items-center gap-sm">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                              ${mpesaCountdown > 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {mpesaCountdown}s
                            </div>
                            <p className="text-xs text-on-surface-variant">Expires in {mpesaCountdown} seconds</p>
                          </div>
                          <button onClick={resetMpesaState}
                            className="text-xs text-on-surface-variant hover:text-error underline mt-sm">
                            Cancel and retry
                          </button>
                        </div>
                      )}

                      {/* ── Success state ── */}
                      {mpesaStatus === 'success' && (
                        <div className="flex flex-col items-center gap-sm py-md animate-fade-in">
                          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="material-symbols-outlined icon-fill text-emerald-600 text-4xl">check_circle</span>
                          </div>
                          <p className="font-bold text-emerald-700 text-[15px]">Payment Confirmed!</p>
                          {mpesaRef && <p className="text-xs font-mono text-on-surface-variant">Ref: {mpesaRef}</p>}
                        </div>
                      )}

                      {/* ── Cancelled state ── */}
                      {mpesaStatus === 'cancelled' && (
                        <div className="flex flex-col items-center gap-sm py-md animate-fade-in">
                          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="material-symbols-outlined icon-fill text-amber-600 text-4xl">cancel</span>
                          </div>
                          <p className="font-bold text-amber-700 text-[15px]">Cancelled by Customer</p>
                          <p className="text-xs text-on-surface-variant">The customer did not complete the payment.</p>
                          <button onClick={resetMpesaState} className="btn-secondary text-xs py-sm mt-sm">Try Again</button>
                        </div>
                      )}

                      {/* ── Failed / Timeout state ── */}
                      {(mpesaStatus === 'failed' || mpesaStatus === 'timeout') && (
                        <div className="flex flex-col items-center gap-sm py-md animate-fade-in">
                          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="material-symbols-outlined icon-fill text-red-600 text-4xl">
                              {mpesaStatus === 'timeout' ? 'timer_off' : 'error'}
                            </span>
                          </div>
                          <p className="font-bold text-red-700 text-[15px]">
                            {mpesaStatus === 'timeout' ? 'Request Timed Out' : 'Payment Failed'}
                          </p>
                          <p className="text-xs text-on-surface-variant text-center max-w-[220px]">
                            {mpesaStatus === 'timeout'
                              ? 'No response received in 60 seconds. Please retry.'
                              : 'Payment was not completed. Please retry.'}
                          </p>
                          <button onClick={resetMpesaState} className="btn-secondary text-xs py-sm mt-sm">Try Again</button>
                        </div>
                      )}

                      {/* ── Idle state (enter phone) ── */}
                      {!mpesaStatus && (
                        <>
                          <div className="bg-surface-container p-md rounded-xl text-center">
                            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Amount to Push</p>
                            <p className="text-headline-md font-bold text-mpesa-green font-mono">{fmt(finalGrandTotal)}</p>
                          </div>

                          <div>
                            <label className="label">Customer M-Pesa Phone Number</label>
                            <input
                              type="tel"
                              value={mpesaPhone}
                              onChange={e => setMpesaPhone(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleMpesa()}
                              placeholder="0712345678"
                              className="input font-mono h-11 text-center text-lg tracking-widest"
                            />
                          </div>

                          <p className="text-xs text-on-surface-variant bg-surface-container-low p-md rounded-lg">
                            A prompt will be sent to the customer's phone. The sale completes automatically once they enter their PIN.
                          </p>

                          <button
                            type="button"
                            onClick={handleMpesa}
                            disabled={mpesaLoading || !mpesaPhone}
                            className="w-full flex items-center justify-center gap-sm py-3 bg-mpesa-green text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {mpesaLoading
                              ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>Sending…</>
                              : <><span className="material-symbols-outlined">send</span>Send M-Pesa Request</>}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {activePaymentMethod === 'split' && (
                    <div className="space-y-md animate-fade-in">
                      <div className="flex items-center gap-sm text-primary mb-sm">
                        <span className="material-symbols-outlined">call_split</span>
                        <h4 className="font-bold text-sm uppercase tracking-wide">Split Payment Breakdown</h4>
                      </div>

                      <div className="grid grid-cols-3 gap-md">
                        <div>
                          <label className="text-xs text-on-surface-variant font-medium block mb-unit">Cash Amount</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={splitCash || ''}
                            onChange={e => setSplitCash(Number(e.target.value))}
                            className="input font-mono h-10 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-variant font-medium block mb-unit">Card Amount</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={splitCard || ''}
                            onChange={e => setSplitCard(Number(e.target.value))}
                            className="input font-mono h-10 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-variant font-medium block mb-unit">M-Pesa Amount</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={splitMpesa || ''}
                            disabled={splitMpesaPaid}
                            onChange={e => setSplitMpesa(Number(e.target.value))}
                            className="input font-mono h-10 text-center disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {splitMpesa > 0 && (
                        <div className="bg-surface-container p-md rounded-xl space-y-sm border border-outline-variant/30 animate-fade-in">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-mpesa-green uppercase">M-Pesa STK Push ({fmt(splitMpesa)})</span>
                            {splitMpesaPaid ? (
                              <span className="text-xs font-bold text-success flex items-center gap-unit">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Paid
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-error flex items-center gap-unit">
                                <span className="material-symbols-outlined text-[14px]">pending</span> Pending Push
                              </span>
                            )}
                          </div>

                          {!splitMpesaPaid ? (
                            <div className="space-y-[10px]">
                              {/* Waiting state */}
                              {splitMpesaStatus === 'waiting' && (
                                <div className="flex flex-col items-center gap-[10px] py-[8px] animate-fade-in">
                                  <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                                    <div className="absolute inset-0 rounded-full bg-mpesa-green/10 animate-ping" />
                                    <div className="w-10 h-10 rounded-full bg-mpesa-green flex items-center justify-center z-10">
                                      <span className="material-symbols-outlined text-white icon-fill" style={{fontSize:'18px'}}>smartphone</span>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[13px] font-bold text-on-surface">Waiting for PIN…</p>
                                    <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">Check {splitMpesaPhone}</p>
                                  </div>
                                  <div className={`text-[12px] font-bold px-[10px] py-[4px] rounded-full ${splitMpesaCountdown > 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                    {splitMpesaCountdown}s
                                  </div>
                                  <button onClick={() => {
                                    if (splitPollRef.current)  clearInterval(splitPollRef.current);
                                    if (splitTimerRef.current) clearInterval(splitTimerRef.current);
                                    setSplitMpesaStatus(null);
                                    setSplitMpesaLoading(false);
                                  }} className="text-[11px] text-on-surface-variant/60 hover:text-error underline">
                                    Cancel
                                  </button>
                                </div>
                              )}

                              {/* Cancelled / Failed / Timeout */}
                              {(splitMpesaStatus === 'cancelled' || splitMpesaStatus === 'failed' || splitMpesaStatus === 'timeout') && (
                                <div className="flex items-center justify-between p-[10px] bg-red-50 border border-red-100 rounded-xl animate-fade-in">
                                  <div className="flex items-center gap-[8px]">
                                    <span className="material-symbols-outlined icon-fill text-red-500" style={{fontSize:'18px'}}>
                                      {splitMpesaStatus === 'cancelled' ? 'cancel' : 'error'}
                                    </span>
                                    <span className="text-[12px] font-semibold text-red-700">
                                      {splitMpesaStatus === 'cancelled' ? 'Cancelled by customer' : splitMpesaStatus === 'timeout' ? 'Timed out' : 'Payment failed'}
                                    </span>
                                  </div>
                                  <button onClick={() => setSplitMpesaStatus(null)}
                                    className="text-[11px] font-bold text-primary hover:underline">Retry</button>
                                </div>
                              )}

                              {/* Idle — show phone input + send button */}
                              {!splitMpesaStatus && (
                                <div className="flex gap-sm items-center">
                                  <input
                                    type="tel"
                                    placeholder="0712345678"
                                    value={splitMpesaPhone}
                                    onChange={e => setSplitMpesaPhone(e.target.value)}
                                    className="input flex-1 h-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!splitMpesaPhone) return toast.error('Enter phone number');
                                      setSplitMpesaLoading(true);
                                      try {
                                        const { data } = await api.post('/mpesa/stk-push', {
                                          phone: splitMpesaPhone,
                                          amount: splitMpesa,
                                          orderId: `POS-SPLIT-${Date.now()}`,
                                        });
                                        const checkoutId = data.checkoutRequestId;
                                        setSplitMpesaRef(checkoutId);
                                        setSplitMpesaStatus('waiting');
                                        setSplitMpesaCountdown(60);
                                        setSplitMpesaLoading(false);

                                        // Countdown
                                        let remaining = 60;
                                        splitTimerRef.current = setInterval(() => {
                                          remaining -= 1;
                                          setSplitMpesaCountdown(remaining);
                                          if (remaining <= 0) {
                                            clearInterval(splitTimerRef.current);
                                            clearInterval(splitPollRef.current);
                                            setSplitMpesaStatus('timeout');
                                          }
                                        }, 1000);

                                        // Poll status
                                        splitPollRef.current = setInterval(async () => {
                                          try {
                                            const { data: s } = await api.get(`/mpesa/status/${checkoutId}`);
                                            if (s.status === 'success') {
                                              clearInterval(splitPollRef.current);
                                              clearInterval(splitTimerRef.current);
                                              setSplitMpesaRef(s.mpesaRef || checkoutId);
                                              setSplitMpesaStatus('success');
                                              setSplitMpesaPaid(true);
                                              toast.success('M-Pesa split payment confirmed!');
                                            } else if (s.status === 'cancelled') {
                                              clearInterval(splitPollRef.current);
                                              clearInterval(splitTimerRef.current);
                                              setSplitMpesaStatus('cancelled');
                                            } else if (s.status === 'failed') {
                                              clearInterval(splitPollRef.current);
                                              clearInterval(splitTimerRef.current);
                                              setSplitMpesaStatus('failed');
                                            }
                                          } catch { /* keep polling */ }
                                        }, 3000);

                                      } catch (err) {
                                        setSplitMpesaLoading(false);
                                        toast.error(err.response?.data?.message || 'M-Pesa STK push failed');
                                      }
                                    }}
                                    disabled={splitMpesaLoading || !splitMpesaPhone}
                                    className="px-lg h-10 bg-mpesa-green hover:brightness-110 text-white rounded-xl font-bold flex items-center justify-center disabled:opacity-50 text-xs flex-shrink-0"
                                  >
                                    {splitMpesaLoading
                                      ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                      : 'Send Push'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-[8px] p-[10px] bg-emerald-50 border border-emerald-200/60 rounded-xl animate-fade-in">
                              <span className="material-symbols-outlined icon-fill text-emerald-600" style={{fontSize:'18px'}}>check_circle</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-emerald-700">Payment Confirmed</p>
                                <p className="text-[10px] font-mono text-emerald-600/70 truncate">Ref: {splitMpesaRef}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-md border-t border-outline-variant/30 text-xs font-semibold">
                        <span className="text-on-surface-variant">
                          Paid: <span className="font-mono font-bold text-on-surface">{fmt(Number(splitCash) + Number(splitCard) + Number(splitMpesa))}</span>
                        </span>
                        {Math.abs(finalGrandTotal - (Number(splitCash) + Number(splitCard) + Number(splitMpesa))) > 0.05 ? (
                          <span className="text-error font-bold flex items-center gap-unit">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            Remaining: <span className="font-mono">{fmt(finalGrandTotal - (Number(splitCash) + Number(splitCard) + Number(splitMpesa)))}</span>
                          </span>
                        ) : (
                          <span className="text-success font-bold flex items-center gap-unit">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span> Balanced & Ready
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>{/* end space-y-md */}
                </div>{/* end scrollable content */}

                {/* Footer — fixed at bottom, never overlaps content */}
                {activePaymentMethod !== 'mpesa' && (
                  <div className="flex-shrink-0 px-lg pb-lg pt-md border-t border-outline-variant/30 flex gap-sm bg-surface-container-lowest">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentModal(false);
                        setIsSplitPayment(false);
                      }}
                      className="btn-secondary flex-1 justify-center"
                    >
                      Cancel
                    </button>
                    {activePaymentMethod === 'split' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const totalPaid = Number(splitCash) + Number(splitCard) + Number(splitMpesa);
                          if (Math.abs(totalPaid - finalGrandTotal) > 0.05) {
                            return toast.error('Split amounts do not balance with total.');
                          }
                          if (splitMpesa > 0 && !splitMpesaPaid) {
                            return toast.error('M-Pesa payment is pending.');
                          }
                          
                          setCompletingLoading(true);
                          try {
                            const splitPayments = [
                              { method: 'cash', amount: Number(splitCash) },
                              { method: 'card', amount: Number(splitCard) },
                              { method: 'mpesa', amount: Number(splitMpesa), ref: splitMpesaRef }
                            ].filter(p => p.amount > 0);

                            const { data } = await api.post('/sales', {
                              items: items.map(i => ({ productId: i._id, quantity: i.quantity })),
                              paymentMethod: 'split',
                              discount,
                              pointsRedeemed: maxPointsToRedeem,
                              customerId: selectedCustomer?._id,
                              splitPayments,
                            });
                            toast.success('🎉 Split sale completed successfully!');
                            clearCart();
                            
                            // Reset split states
                            setIsSplitPayment(false);
                            setSplitCash(0);
                            setSplitCard(0);
                            setSplitMpesa(0);
                            setSplitMpesaPhone('');
                            setSplitMpesaPaid(false);
                            setSplitMpesaRef('');
                            setCashReceived('');
                            setActivePaymentMethod('cash');
                            
                            setPaymentModal(false);
                            setSelectedCustomer(null);
                            setPointsRedemptionApplied(false);
                            setCompletedSaleData(data);
                            fetchProducts();
                            fetchCustomers();
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Sale failed');
                          } finally {
                            setCompletingLoading(false);
                          }
                        }}
                        disabled={
                          completingLoading ||
                          Math.abs(Number(splitCash) + Number(splitCard) + Number(splitMpesa) - finalGrandTotal) > 0.05 ||
                          (splitMpesa > 0 && !splitMpesaPaid)
                        }
                        className="btn-primary flex-1 justify-center"
                      >
                        {completingLoading ? (
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        ) : (
                          'Complete Split Sale'
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (activePaymentMethod === 'cash' && Number(cashReceived) > 0 && Number(cashReceived) < finalGrandTotal) {
                            return toast.error('Received cash is less than total amount due');
                          }
                          completeSale(activePaymentMethod);
                        }}
                        disabled={completingLoading || (activePaymentMethod === 'cash' && Number(cashReceived) > 0 && Number(cashReceived) < finalGrandTotal)}
                        className="btn-primary flex-1 justify-center"
                      >
                        {completingLoading ? (
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        ) : (
                          'Complete Sale'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>{/* end right column */}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <form onSubmit={handleAddCustomer} className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-fade-in space-y-md">
            <div className="flex items-center justify-between">
              <h3 className="text-title-md font-bold text-on-surface">Register Customer</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="text-outline hover:text-primary p-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="label">Customer Name</label>
              <input type="text" required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                placeholder="John Doe" className="input" />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input type="tel" required value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                placeholder="0712345678" className="input" />
            </div>
            <div className="flex gap-sm pt-sm">
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center">Register</button>
            </div>
          </form>
        </div>
      )}

      {/* Held Sales Drawer / Modal */}
      {showHeldSalesDrawer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-md p-xl animate-fade-in flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-lg border-b pb-md flex-shrink-0">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-2xl">bookmark_manager</span>
                <div>
                  <h3 className="text-title-md font-bold text-on-surface">Held Sales ({heldSales.length})</h3>
                  <p className="text-xs text-on-surface-variant">Parked sales queue</p>
                </div>
              </div>
              <button onClick={() => setShowHeldSalesDrawer(false)} className="text-outline hover:text-primary p-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-md pr-1 min-h-0">
              {heldSales.length === 0 ? (
                <div className="py-xl text-center text-on-surface-variant text-body-sm">
                  <span className="material-symbols-outlined text-5xl block mb-sm opacity-35">bookmark_border</span>
                  No held sales in the queue
                </div>
              ) : (
                heldSales.map(sale => (
                  <div key={sale.id} className="p-md bg-surface-container-low border border-outline-variant rounded-xl flex flex-col gap-sm hover:border-primary/50 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">{sale.customerName}</h4>
                        <p className="text-[10px] text-on-surface-variant">{new Date(sale.createdAt).toLocaleString('en-KE')}</p>
                      </div>
                      <div className="flex gap-xs">
                        <button 
                          onClick={() => {
                            if (items.length > 0) {
                              if (!window.confirm('Current items in cart will be overwritten. Resume anyway?')) return;
                            }
                            resumeSale(sale.id);
                            setShowHeldSalesDrawer(false);
                            toast.success('Sale resumed');
                          }}
                          className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold flex items-center gap-xs hover:bg-primary-hover active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-xs">play_arrow</span> Resume
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this held sale?')) {
                              deleteHeldSale(sale.id);
                              toast.success('Held sale deleted');
                            }
                          }}
                          className="p-1.5 bg-error-container/10 text-error hover:bg-error-container/20 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                          title="Delete held sale">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-t border-outline-variant/30 pt-xs">
                      <p className="text-[11px] font-medium text-on-surface-variant">Items:</p>
                      <div className="max-h-24 overflow-y-auto space-y-1 mt-1 pr-1">
                        {sale.items.map(item => (
                          <div key={item._id} className="flex justify-between text-[11px] font-mono text-on-surface-variant">
                            <span className="truncate max-w-[200px]">{item.name} x{item.quantity}</span>
                            <span>{fmt(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="pt-md border-t border-outline-variant mt-md flex-shrink-0">
              <button onClick={() => setShowHeldSalesDrawer(false)} className="btn-secondary w-full justify-center">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Printable Receipt Modal */}
      {completedSaleData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-md overflow-y-auto print:p-0">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-md p-lg animate-fade-in flex flex-col my-8 print:my-0 print:shadow-none print:border-0 print:w-full">
            <div className="flex justify-between items-center mb-md border-b pb-sm print:hidden">
              <div>
                <h3 className="text-title-md font-bold text-on-surface">Sale Completed 🎉</h3>
                <p className="text-[11px] text-on-surface-variant/60 mt-[2px]">{completedSaleData.receiptNumber}</p>
              </div>
              <div className="flex items-center gap-sm">
                {/* Auto-print toggle */}
                <label className="flex items-center gap-[5px] text-[11px] text-on-surface-variant/70 cursor-pointer">
                  <input type="checkbox"
                    defaultChecked={localStorage.getItem('retailedge_auto_print') === 'true'}
                    onChange={e => localStorage.setItem('retailedge_auto_print', String(e.target.checked))}
                    className="rounded accent-primary w-[13px] h-[13px]" />
                  Auto-print
                </label>
                <button onClick={handlePrint} className="p-2 text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 text-sm font-semibold">
                  <span className="material-symbols-outlined text-lg">print</span> Print
                </button>
                <button onClick={() => setCompletedSaleData(null)} className="text-outline hover:text-primary p-2">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Receipt container mapped to print styling */}
            <div id="print-receipt-container" className="bg-white p-lg text-black rounded-lg border border-dashed border-outline font-mono text-xs flex flex-col gap-sm print:border-0 print:p-0">
              <div className="text-center space-y-unit">
                <h2 className="text-lg font-black tracking-tight uppercase">RetailEdge POS</h2>
                <p className="text-[10px] text-gray-500 uppercase">{completedSaleData.branch}</p>
                <p className="text-[10px] text-gray-500">Tel: +254 700 000 000</p>
              </div>
              
              <div className="border-t border-dashed border-black/30 my-xs" />
              
              <div className="space-y-unit text-[11px]">
                <div className="flex justify-between">
                  <span>Receipt:</span>
                  <span className="font-bold">{completedSaleData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(completedSaleData.createdAt).toLocaleString('en-KE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{completedSaleData.cashier?.name || completedSaleData.cashierName}</span>
                </div>
                {completedSaleData.customer && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>{completedSaleData.customer.name}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-dashed border-black/30">
                    <th className="pb-unit font-bold">Item</th>
                    <th className="pb-unit text-center font-bold">Qty</th>
                    <th className="pb-unit text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSaleData.items.map(item => (
                    <tr key={item._id} className="align-top">
                      <td className="py-unit max-w-[150px] truncate">{item.name}</td>
                      <td className="py-unit text-center">{item.quantity}</td>
                      <td className="py-unit text-right font-mono">{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <div className="space-y-unit text-[11px] font-mono">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{fmt(completedSaleData.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span>{fmt(completedSaleData.vatAmount)}</span>
                </div>
                {completedSaleData.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Discount:</span>
                    <span>- {fmt(completedSaleData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-dashed border-black/30 pt-unit mt-unit">
                  <span>GRAND TOTAL:</span>
                  <span>{fmt(completedSaleData.grandTotal)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/30 my-xs" />

              <div className="space-y-unit text-[11px]">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-bold uppercase">{completedSaleData.paymentMethod}</span>
                </div>
                {completedSaleData.paymentMethod === 'split' && completedSaleData.splitPayments?.length > 0 && (
                  <div className="pl-md py-xs space-y-unit border-l border-dashed border-black/30">
                    {completedSaleData.splitPayments.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="capitalize">{p.method}:</span>
                        <span>{fmt(p.amount)} {p.ref ? `(Ref: ${p.ref})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {completedSaleData.mpesaRef && (
                  <div className="flex justify-between">
                    <span>M-Pesa Ref:</span>
                    <span className="font-mono text-[10px]">{completedSaleData.mpesaRef}</span>
                  </div>
                )}
              </div>

              {completedSaleData.customer && (
                <>
                  <div className="border-t border-dashed border-black/30 my-xs" />
                  <div className="text-[10px] space-y-unit bg-gray-50 p-sm rounded border border-gray-200 print:bg-transparent print:border-black">
                    <p className="font-bold text-center uppercase tracking-wider text-[9px] text-gray-600 print:text-black">Loyalty Club Summary</p>
                    <div className="flex justify-between">
                      <span>Tier:</span>
                      <span className="font-bold">{completedSaleData.customer.tier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Balance:</span>
                      <span className="font-bold">{completedSaleData.customer.loyaltyPoints} pts</span>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-dashed border-black/30 my-xs" />
              <div className="text-center py-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider">Thank you for shopping with us!</p>
                <div className="font-mono text-[9px] mt-xs text-gray-400 print:text-black">
                  ||||| | |||| || ||| |||||
                </div>
              </div>
            </div>
            
            <button onClick={() => setCompletedSaleData(null)} className="btn-primary mt-md justify-center print:hidden">
              Start New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
