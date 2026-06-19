import { createContext, useContext, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext(null);

const VAT_RATE = 0.16;

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [heldSales, setHeldSales] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('retailedge_held_sales') || '[]');
    } catch { return []; }
  });

  const addItem = useCallback((product) => {
    setItems((prev) => {
      const exists = prev.find((i) => i._id === product._id);
      if (exists) {
        return prev.map((i) =>
          i._id === product._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    // Determine the correct toast message using the current items state
    const exists = items.some((i) => i._id === product._id);
    if (exists) {
      toast.success(`${product.name} qty updated`);
    } else {
      toast.success(`${product.name} added`);
    }
  }, [items]);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
  }, []);

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (i._id === id ? { ...i, quantity: qty } : i)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscount(0);
  }, []);

  const holdCurrentSale = useCallback((customerName) => {
    if (items.length === 0) return;
    const newHold = {
      id: Date.now(),
      customerName: customerName || 'Walk-in',
      items: [...items],
      discount,
      createdAt: new Date().toISOString()
    };
    setHeldSales(prev => {
      const updated = [newHold, ...prev];
      localStorage.setItem('retailedge_held_sales', JSON.stringify(updated));
      return updated;
    });
    setItems([]);
    setDiscount(0);
  }, [items, discount]);

  const resumeSale = useCallback((heldId) => {
    const sale = heldSales.find(s => s.id === heldId);
    if (!sale) return;
    setItems(sale.items);
    setDiscount(sale.discount);
    setHeldSales(prev => {
      const updated = prev.filter(s => s.id !== heldId);
      localStorage.setItem('retailedge_held_sales', JSON.stringify(updated));
      return updated;
    });
  }, [heldSales]);

  const deleteHeldSale = useCallback((heldId) => {
    setHeldSales(prev => {
      const updated = prev.filter(s => s.id !== heldId);
      localStorage.setItem('retailedge_held_sales', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const vatAmount = subtotal * VAT_RATE;
  const grandTotal = subtotal + vatAmount - discount;

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
