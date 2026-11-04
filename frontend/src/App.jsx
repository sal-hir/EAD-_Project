import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorProvider } from './context/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';
import { OAuthCallback } from './pages/OAuthCallback';
import { MilestoneUnavailable } from './components/MilestoneUnavailable';
import { ApplicationLayout } from './layouts/SharedLayouts';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminUsers } from './pages/AdminUsers';
import { ActivateAccount } from './pages/ActivateAccount';
import { AccountSettings } from './pages/AccountSettings';
import { ForgotPassword, ResetPassword } from './pages/PasswordRecovery';
import { MerchantApply, MerchantStatus, MerchantDashboard } from './pages/MerchantOnboarding';
import { AdminMerchants } from './pages/AdminMerchants';
import { PublicTracking } from './pages/PublicTracking';
import { Pricing } from './pages/Pricing';
import { Help } from './pages/Help';
import { Contact } from './pages/Contact';

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
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ErrorProvider>

            <ApplicationLayout>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/track" element={<PublicTracking />} />
                  <Route path="/track/:trackingNumber" element={<PublicTracking />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/auth/callback" element={<OAuthCallback />} />
                  <Route path="/activate" element={<ActivateAccount />} />
                  <Route path="/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/merchants" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminMerchants /></ProtectedRoute>} />
                  <Route path="/merchant/apply" element={<ProtectedRoute allowedRoles={['CUSTOMER','MERCHANT']}><MerchantApply /></ProtectedRoute>} />
                  <Route path="/merchant/application-status" element={<ProtectedRoute allowedRoles={['CUSTOMER','MERCHANT']}><MerchantStatus /></ProtectedRoute>} />

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
                        <MerchantDashboard />
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
            </ApplicationLayout>

          </ErrorProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
