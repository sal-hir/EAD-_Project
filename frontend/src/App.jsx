import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OAuthCallback } from './pages/OAuthCallback';
import { MilestoneUnavailable } from './components/MilestoneUnavailable';
import { Navbar } from './components/Navbar';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

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

export const App = () => {
  return (
    <Router>
      <AuthProvider>

          <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/track" element={<MilestoneUnavailable title="Parcel tracking" />} />
                <Route path="/track/:trackingNumber" element={<MilestoneUnavailable title="Parcel tracking" />} />
                <Route path="/auth/callback" element={<OAuthCallback />} />

                {/* Customer Routes */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                      <MilestoneUnavailable title="Customer dashboard" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/new"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                      <MilestoneUnavailable title="Create parcel" />
                    </ProtectedRoute>
                  }
                />

                {/* Parcel Details / Tracking (Authenticated) */}
                <Route
                  path="/parcels/:id"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'COURIER', 'MERCHANT', 'DISPATCHER', 'ADMIN']}>
                      <MilestoneUnavailable title="Parcel details" />
                    </ProtectedRoute>
                  }
                />

                {/* Courier Routes */}
                <Route
                  path="/courier"
                  element={
                    <ProtectedRoute allowedRoles={['COURIER', 'ADMIN']}>
                      <MilestoneUnavailable title="Courier dashboard" />
                    </ProtectedRoute>
                  }
                />

                {/* Merchant Routes */}
                <Route
                  path="/merchant"
                  element={
                    <ProtectedRoute allowedRoles={['MERCHANT', 'ADMIN']}>
                      <MilestoneUnavailable title="Merchant dashboard" />
                    </ProtectedRoute>
                  }
                />

                {/* Admin / Dispatcher Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'DISPATCHER']}>
                      <MilestoneUnavailable title="Administration" />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>

      </AuthProvider>
    </Router>
  );
};

export default App;
