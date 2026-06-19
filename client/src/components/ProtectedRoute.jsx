import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const defaultPath = (user?.role === 'admin' || user?.role === 'manager') ? '/dashboard' : '/checkout';
    return <Navigate to={defaultPath} replace />;
  }

  return children;
}
