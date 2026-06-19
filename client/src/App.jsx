import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#2d3133',
                color: '#eff1f3',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#4de082', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ba1a1a', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}><Checkout /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Products /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Inventory /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}><Customers /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Reports /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}><Transactions /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Finance /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}><Profile /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
