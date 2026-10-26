import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('swiftdrop_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('swiftdrop_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If token exists, verify and fetch latest profile
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data.success) {
            setUser(res.data.data);
            localStorage.setItem('swiftdrop_user', JSON.stringify(res.data.data));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      const { token: newToken, user: userData } = res.data.data;
      localStorage.setItem('swiftdrop_token', newToken);
      localStorage.setItem('swiftdrop_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      return userData;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    return res.data;
  };

  const handleOAuthCallback = (newToken, userRole) => {
    localStorage.setItem('swiftdrop_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('swiftdrop_token');
    localStorage.removeItem('swiftdrop_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    handleOAuthCallback,
    isAuthenticated: !!user,
    isCustomer: user?.role === 'CUSTOMER',
    isMerchant: user?.role === 'MERCHANT',
    isCourier: user?.role === 'COURIER',
    isDispatcher: user?.role === 'DISPATCHER',
    isAdmin: user?.role === 'ADMIN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
