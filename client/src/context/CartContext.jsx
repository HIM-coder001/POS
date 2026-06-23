import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext(null);
const VAT_RATE = 0.16;

const CART_KEY        = 'retailedge_cart';
const HELD_SALES_KEY  = 'retailedge_held_sales';

/** Safely read from localStorage — returns fallback on parse error */
const readLS = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};

/** Safely write to localStorage — silently fails if storage is full */
const writeLS = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => readLS(CART_KEY, []));
  const [discount, setDiscount] = useState(0);

  // Keep a ref that always mirrors the latest items state so callbacks
  // can read the true current value without stale-closure issues.
  const itemsRef = useRef(items);

  const _setItems = (updater) => {
    setItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      itemsRef.current = next;
      writeLS(CART_KEY, next); // persist on every change
      return next;
    });
  };

  // Sync ref on initial load (items come from localStorage)
  useEffect(() => {
    itemsRef.current = items;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [heldSales, setHeldSales] = useState(() => readLS(HELD_SALES_KEY, []));

  // ── addItem ───────────────────────────────────────────────────────────────
  const addItem = useCallback((product) => {
    const current = itemsRef.current;
    const existing = current.find(i => i._id === product._id);

    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error(
          `Max stock reached — only ${product.stock} unit${product.stock !== 1 ? 's' : ''} available for "${product.name}"`
        );
        return;
      }
      const newQty = existing.quantity + 1;
      itemsRef.current = current.map(i =>
        i._id === product._id ? { ...i, quantity: newQty } : i
      );
      setItems(itemsRef.current);
      writeLS(CART_KEY, itemsRef.current);
      toast.success(`${product.name} ×${newQty}`);
    } else {
      itemsRef.current = [...current, { ...product, quantity: 1 }];
      setItems(itemsRef.current);
      writeLS(CART_KEY, itemsRef.current);
      toast.success(`${product.name} added`);
    }
  }, []);

  // ── removeItem ────────────────────────────────────────────────────────────
  const removeItem = useCallback((id) => {
    _setItems(prev => prev.filter(i => i._id !== id));
  }, []);

  // ── updateQty ─────────────────────────────────────────────────────────────
  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return;
    const current = itemsRef.current;
    const item = current.find(i => i._id === id);
    if (!item) return;

    if (qty > item.stock) {
      toast.error(`Only ${item.stock} unit${item.stock !== 1 ? 's' : ''} in stock for "${item.name}"`);
      return;
    }

    itemsRef.current = current.map(i => i._id === id ? { ...i, quantity: qty } : i);
    setItems(itemsRef.current);
    writeLS(CART_KEY, itemsRef.current);
  }, []);

  // ── clearCart ─────────────────────────────────────────────────────────────
  const clearCart = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setDiscount(0);
    writeLS(CART_KEY, []);
  }, []);

  // ── holdCurrentSale ───────────────────────────────────────────────────────
  const holdCurrentSale = useCallback((customerName) => {
    const current = itemsRef.current;
    if (current.length === 0) return;
    const newHold = {
      id: Date.now(),
      customerName: customerName || 'Walk-in',
      items: [...current],
      discount,
      createdAt: new Date().toISOString(),
    };
    setHeldSales(prev => {
      const updated = [newHold, ...prev];
      writeLS(HELD_SALES_KEY, updated);
      return updated;
    });
    itemsRef.current = [];
    setItems([]);
    setDiscount(0);
    writeLS(CART_KEY, []);
  }, [discount]);

  // ── resumeSale ────────────────────────────────────────────────────────────
  const resumeSale = useCallback((heldId) => {
    setHeldSales(prev => {
      const sale = prev.find(s => s.id === heldId);
      if (!sale) return prev;
      itemsRef.current = sale.items;
      setItems(sale.items);
      setDiscount(sale.discount);
      writeLS(CART_KEY, sale.items);
      const updated = prev.filter(s => s.id !== heldId);
      writeLS(HELD_SALES_KEY, updated);
      return updated;
    });
  }, []);

  // ── deleteHeldSale ────────────────────────────────────────────────────────
  const deleteHeldSale = useCallback((heldId) => {
    setHeldSales(prev => {
      const updated = prev.filter(s => s.id !== heldId);
      writeLS(HELD_SALES_KEY, updated);
      return updated;
    });
  }, []);

  // ── Derived totals ────────────────────────────────────────────────────────
  const subtotal   = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const vatAmount  = subtotal * VAT_RATE;
  const grandTotal = Math.max(0, subtotal + vatAmount - discount);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQty, clearCart,
      discount, setDiscount,
      subtotal, vatAmount, grandTotal,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      heldSales, holdCurrentSale, resumeSale, deleteHeldSale,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
};
