import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PublicTracking } from './pages/PublicTracking';
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { CreateParcel } from './pages/customer/CreateParcel';
import { ParcelDetail } from './pages/customer/ParcelDetail';
import { CourierDashboard } from './pages/courier/CourierDashboard';
import { MerchantDashboard } from './pages/merchant/MerchantDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// OAuth Callback Route
const OAuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    const role = params.get('role');
    if (token) {
      handleOAuthCallback(token, role);
      if (role === 'COURIER') navigate('/courier');
      else if (role === 'MERCHANT') navigate('/merchant');
      else if (role === 'ADMIN' || role === 'DISPATCHER') navigate('/admin');
      else navigate('/customer');
    } else {
      navigate('/login');
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">Completing login...</p>
      </div>
    </div>
  );
};

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/track" element={<PublicTracking />} />
                <Route path="/track/:trackingNumber" element={<PublicTracking />} />
                <Route path="/auth/callback" element={<OAuthCallback />} />

                {/* Customer Routes */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/new"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                      <CreateParcel />
                    </ProtectedRoute>
                  }
                />

                {/* Parcel Details / Tracking (Authenticated) */}
                <Route
                  path="/parcels/:id"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'COURIER', 'MERCHANT', 'DISPATCHER', 'ADMIN']}>
                      <ParcelDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Courier Routes */}
                <Route
                  path="/courier"
                  element={
                    <ProtectedRoute allowedRoles={['COURIER', 'ADMIN']}>
                      <CourierDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Merchant Routes */}
                <Route
                  path="/merchant"
                  element={
                    <ProtectedRoute allowedRoles={['MERCHANT', 'ADMIN']}>
                      <MerchantDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Admin / Dispatcher Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'DISPATCHER']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
