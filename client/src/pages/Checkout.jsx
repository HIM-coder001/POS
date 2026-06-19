import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Groceries', 'Electronics', 'Dairy', 'Beverages', 'Bakery', 'FMCG', 'Grains'];
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

export default function Checkout() {
  const { user } = useAuth();
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
      setPaymentModal(false);
      setSelectedCustomer(null);
      setPointsRedemptionApplied(false);
      setCompletedSaleData(data);
      fetchProducts();
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally { setCompletingLoading(false); }
  };

  const handleMpesa = async () => {
    if (!mpesaPhone) return toast.error('Enter phone number');
    setMpesaLoading(true);
    try {
      const { data } = await api.post('/mpesa/stk-push', {
        phone: mpesaPhone, amount: finalGrandTotal, orderId: `POS-${Date.now()}`
      });
      toast.success(data.message || 'STK push sent! Check phone.');
      await completeSale('mpesa', data.checkoutRequestId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'M-Pesa failed');
    } finally { setMpesaLoading(false); }
  };

  const handlePrint = () => {
    window.print();
  };

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
            {/* Category filters */}
            <div className="flex gap-sm overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-lg py-sm rounded-full text-body-sm whitespace-nowrap font-medium transition-all ${
                    category === c ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container'
                  }`}>
                  {c}
                </button>
              ))}
            </div>

            {/* Product grid — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md pb-4">
                {loading ? Array(8).fill(0).map((_, i) => (
                  <div key={i} className="rounded-xl bg-surface-container-high h-52 animate-pulse" />
                )) : products.map(p => (
                  <div key={p._id} onClick={() => { if (p.stock > 0) addItem(p); else toast.error('Out of stock'); }}
                    className={`card flex flex-col overflow-hidden cursor-pointer active:scale-95 group ${p.stock === 0 ? 'opacity-60' : ''}`}>
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
                {!loading && !products.length && (
                  <div className="col-span-4 py-xl text-center text-on-surface-variant text-body-sm">
                    <span className="material-symbols-outlined text-5xl block mb-sm">search_off</span>
                    No products found
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
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5">{fmt(item.price)}</p>
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
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-surface text-primary hover:bg-primary hover:text-on-primary transition-all text-sm font-bold leading-none">
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

            {/* Footer: totals + payment — fixed height, never scrolls */}
            <div className="flex-shrink-0 border-t border-outline-variant bg-surface-container-low">
              {/* Discount input */}
              <div className="px-5 pt-4 pb-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">percent</span>
                  <input
                    type="number" min="0" value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                    placeholder="General Discount (KES)"
                    className="input pl-9 text-sm h-9" />
                </div>
              </div>

              {/* Totals */}
              <div className="px-5 pb-3 space-y-1.5">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>VAT (16%)</span>
                  <span className="font-mono font-medium">{fmt(vatAmount)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-tertiary">
                    <span>Discount</span>
                    <span className="font-mono font-medium">− {fmt(discount)}</span>
                  </div>
                )}
                {maxPointsToRedeem > 0 && (
                  <div className="flex justify-between text-xs text-purple-600 font-bold">
                    <span>Points Redeemed</span>
                    <span className="font-mono font-medium">− {fmt(maxPointsToRedeem)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant mt-1">
                  <span className="font-bold text-on-surface text-sm">Grand Total</span>
                  <span className="font-mono text-primary text-lg font-bold">{fmt(finalGrandTotal)}</span>
                </div>
              </div>

              {/* Payment buttons */}
              <div className="px-5 pb-5 space-y-2">
                <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30">
                  <span className="text-xs font-semibold text-on-surface-variant">Split Payment</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isSplitPayment} 
                      onChange={(e) => {
                        setIsSplitPayment(e.target.checked);
                        // Reset split amounts when toggled
                        setSplitCash(0);
                        setSplitCard(0);
                        setSplitMpesa(0);
                        setSplitMpesaPaid(false);
                        setSplitMpesaRef('');
                      }} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {isSplitPayment ? (
                  <div className="space-y-sm bg-surface-container-low p-sm rounded-xl border border-outline-variant/50 animate-fade-in text-xs">
                    <p className="font-bold text-on-surface text-center uppercase tracking-wider text-[10px]">Split Payment Breakdown</p>
                    
                    <div className="grid grid-cols-3 gap-xs">
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-medium">Cash</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0.00" 
                          value={splitCash || ''} 
                          onChange={e => setSplitCash(Number(e.target.value))}
                          className="input px-xs py-unit text-center font-mono h-8" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-medium">Card</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0.00" 
                          value={splitCard || ''} 
                          onChange={e => setSplitCard(Number(e.target.value))}
                          className="input px-xs py-unit text-center font-mono h-8" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-medium">M-Pesa</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0.00" 
                          value={splitMpesa || ''} 
                          disabled={splitMpesaPaid}
                          onChange={e => setSplitMpesa(Number(e.target.value))}
                          className="input px-xs py-unit text-center font-mono h-8 disabled:opacity-50" 
                        />
                      </div>
                    </div>

                    {splitMpesa > 0 && (
                      <div className="bg-surface-container p-xs rounded-lg space-y-xs border border-outline-variant/30">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-mpesa-green uppercase">M-Pesa STK Push</span>
                          {splitMpesaPaid ? (
                            <span className="text-[9px] font-bold text-success flex items-center gap-unit"><span className="material-symbols-outlined text-[10px]">check_circle</span> Paid</span>
                          ) : (
                            <span className="text-[9px] font-bold text-error flex items-center gap-unit"><span className="material-symbols-outlined text-[10px]">pending</span> Pending Push</span>
                          )}
                        </div>
                        
                        {!splitMpesaPaid ? (
                          <div className="flex gap-xs items-center">
                            <input 
                              type="tel" 
                              placeholder="0712345678" 
                              value={splitMpesaPhone} 
                              onChange={e => setSplitMpesaPhone(e.target.value)}
                              className="input px-xs py-unit text-[11px] h-8 flex-1" 
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!splitMpesaPhone) return toast.error('Enter phone number for M-Pesa push');
                                setSplitMpesaLoading(true);
                                try {
                                  const { data } = await api.post('/mpesa/stk-push', {
                                    phone: splitMpesaPhone, amount: splitMpesa, orderId: `POS-SPLIT-${Date.now()}`
                                  });
                                  toast.success('STK push sent! Check phone.');
                                  setSplitMpesaRef(data.checkoutRequestId);
                                  setSplitMpesaPaid(true);
                                } catch (err) {
                                  toast.error(err.response?.data?.message || 'M-Pesa STK push failed');
                                } finally { setSplitMpesaLoading(false); }
                              }}
                              disabled={splitMpesaLoading || !splitMpesaPhone}
                              className="px-sm h-8 bg-mpesa-green hover:brightness-110 text-white rounded-lg font-bold flex items-center justify-center disabled:opacity-50 text-[10px]">
                              {splitMpesaLoading ? (
                                <span className="material-symbols-outlined animate-spin text-xs">progress_activity</span>
                              ) : (
                                'Push'
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="text-[9px] font-mono text-on-surface-variant truncate">
                            Ref ID: {splitMpesaRef}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-xs border-t border-outline-variant/30 text-[11px] font-medium">
                      <span className="text-on-surface-variant">Paid: <span className="font-mono font-bold text-on-surface">{fmt(Number(splitCash) + Number(splitCard) + Number(splitMpesa))}</span></span>
                      {Math.abs(finalGrandTotal - (Number(splitCash) + Number(splitCard) + Number(splitMpesa))) > 0.05 ? (
                        <span className="text-error font-bold">Remaining: <span className="font-mono">{fmt(finalGrandTotal - (Number(splitCash) + Number(splitCard) + Number(splitMpesa)))}</span></span>
                      ) : (
                        <span className="text-success font-bold flex items-center gap-unit"><span className="material-symbols-outlined text-[12px]">check_circle</span> Balanced</span>
                      )}
                    </div>

                    <button
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
                          setSelectedCustomer(null);
                          setPointsRedemptionApplied(false);
                          setCompletedSaleData(data);
                          fetchProducts();
                          fetchCustomers();
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Sale failed');
                        } finally { setCompletingLoading(false); }
                      }}
                      disabled={completingLoading || Math.abs(Number(splitCash) + Number(splitCard) + Number(splitMpesa) - finalGrandTotal) > 0.05 || (splitMpesa > 0 && !splitMpesaPaid)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-on-primary rounded-xl shadow-md hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span className="font-bold uppercase tracking-wider text-xs">Complete Split Sale</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {finalGrandTotal === 0 && items.length > 0 ? (
                      <button
                        onClick={() => completeSale('cash')}
                        disabled={completingLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl shadow-md hover:bg-purple-700 transition-all active:scale-95">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        <span className="font-bold uppercase tracking-wider text-sm">Complete with Points</span>
                      </button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => completeSale('cash')}
                            disabled={!items.length || completingLoading}
                            className="flex flex-col items-center justify-center gap-1 py-3 bg-surface border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-2xl">payments</span>
                            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant group-hover:text-primary transition-colors">Cash</span>
                          </button>
                          <button
                            onClick={() => completeSale('card')}
                            disabled={!items.length || completingLoading}
                            className="flex flex-col items-center justify-center gap-1 py-3 bg-surface border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-2xl">credit_card</span>
                            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant group-hover:text-primary transition-colors">Card</span>
                          </button>
                        </div>

                        <button
                          onClick={() => setPaymentModal(true)}
                          disabled={!items.length}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-mpesa-green text-white rounded-xl shadow-md hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-mpesa-green text-sm" style={{fontVariationSettings:"'FILL' 1"}}>smartphone</span>
                          </div>
                          <span className="font-bold uppercase tracking-wider text-sm">Pay with M-Pesa</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                {completingLoading && (
                  <div className="flex items-center justify-center gap-2 text-primary text-sm py-1">
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    <span>Processing sale…</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* M-Pesa Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-sm p-xl animate-fade-in">
            <div className="flex items-center justify-between mb-lg">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 bg-mpesa-green rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">smartphone</span>
                </div>
                <div>
                  <h3 className="text-title-md font-bold text-on-surface">M-Pesa Payment</h3>
                  <p className="text-xs text-on-surface-variant">STK Push · {fmt(finalGrandTotal)}</p>
                </div>
              </div>
              <button onClick={() => setPaymentModal(false)} className="text-outline hover:text-primary p-sm">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <label className="label">Customer Phone Number</label>
            <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
              placeholder="0712 345 678" className="input mb-lg" />
            <p className="text-xs text-on-surface-variant mb-lg bg-surface-container-low p-md rounded-lg">
              The customer will receive a prompt on their phone to enter their M-Pesa PIN to authorize <strong>{fmt(finalGrandTotal)}</strong>.
            </p>
            <div className="flex gap-sm">
              <button onClick={() => setPaymentModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={handleMpesa} disabled={mpesaLoading}
                className="flex-1 flex items-center justify-center gap-sm py-sm px-lg bg-mpesa-green text-white rounded-xl font-bold hover:brightness-105 transition-all disabled:opacity-50">
                {mpesaLoading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">send</span>}
                {mpesaLoading ? 'Sending...' : 'Send Request'}
              </button>
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
              <h3 className="text-title-md font-bold text-on-surface">Sale Completed</h3>
              <div className="flex gap-sm">
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
