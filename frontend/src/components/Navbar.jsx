import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, Truck, LayoutDashboard, LogOut, User, PlusCircle, Search } from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'ADMIN':
      case 'DISPATCHER':
        return '/admin';
      case 'COURIER':
        return '/courier';
      case 'MERCHANT':
        return '/merchant';
      default:
        return '/customer';
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                  Swift<span className="text-blue-600">Drop</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Enterprise Courier</span>
              </div>
            </Link>

            {/* Quick Public Track */}
            <Link
              to="/track"
              className="hidden md:flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-blue-50 transition"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track Parcel</span>
            </Link>
          </div>

          {/* Navigation Links & Profile */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="flex items-center space-x-1 text-sm font-medium text-slate-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>

                {user?.role === 'CUSTOMER' && (
                  <Link
                    to="/customer/new"
                    className="flex items-center space-x-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-lg shadow-sm shadow-blue-600/30 transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>New Delivery</span>
                  </Link>
                )}

                {/* User menu / Role chip */}
                <div className="flex items-center pl-3 border-l border-slate-200 space-x-3">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {user.role}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-700 hover:text-blue-600 px-3 py-2"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
