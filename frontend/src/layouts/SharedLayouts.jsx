import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Truck, LayoutDashboard, UserRound, Store, Users, ClipboardList, Menu, LogOut, Search, PlusCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Modal } from '../components/ui';
import { PublicFooter, publicLinks } from '../components/PublicWebsite';
import { NotificationBellDropdown } from '../components/NotificationBellDropdown';

export const roleLabels = { CUSTOMER: 'Customer', MERCHANT: 'Merchant', COURIER: 'Courier', DISPATCHER: 'Dispatcher', ADMIN: 'Admin' };
const dashboards = { CUSTOMER: '/customer', MERCHANT: '/merchant', COURIER: '/courier', DISPATCHER: '/admin', ADMIN: '/admin' };
export function navigationFor(role) {
  if (!dashboards[role]) return [];
  return [
    { to: dashboards[role], label: 'Dashboard', icon: LayoutDashboard, end: true },
    ...(role === 'CUSTOMER' ? [{ to: '/merchant/apply', label: 'Become a Merchant', icon: Store }, { to: '/customer/new', label: 'New Delivery', icon: PlusCircle }] : []),
    ...(['CUSTOMER', 'MERCHANT'].includes(role) ? [{ to: '/merchant/application-status', label: 'Business application', icon: ClipboardList }] : []),
    ...(role === 'MERCHANT' ? [{ to: '/merchant/credentials', label: 'API credentials', icon: Store }] : []),
    ...(role === 'MERCHANT' ? [{ to: '/merchant/oauth-clients', label: 'OAuth clients', icon: Store }] : []),
    ...(role === 'ADMIN' ? [{ to: '/admin/merchants', label: 'Merchant applications', icon: Store }, { to: '/admin/users', label: 'User accounts', icon: Users }] : []),
    { to: '/account', label: 'Account', icon: UserRound },
  ];
}
export function Brand({ dark = false, compact = false }) {
  return <Link to="/" aria-label="SwiftDrop home" className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F95716] text-white shadow-sm font-bold text-base leading-none">→</span><span className={`whitespace-nowrap text-xl font-extrabold tracking-tight ${compact ? 'hidden sm:inline' : ''} ${dark ? 'text-white' : 'text-slate-900'}`}>SwiftDrop</span></Link>;
}
function NavigationLinks({ role, onNavigate, dark = false }) {
  return <nav aria-label="Portal navigation" className="space-y-1.5">{navigationFor(role).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={onNavigate}
    className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#F95716] text-white shadow-sm' : (dark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-700 hover:bg-slate-100')}`}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>;
}
export function Sidebar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (e) { console.error(e); }
  };
  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#0E131F] p-5 lg:flex">
    <Brand dark />
    <p className="mb-4 mt-8 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{roleLabels[role]} portal</p>
    <NavigationLinks role={role} dark />
    <div className="mt-auto pt-6">
      <div className="rounded-2xl bg-[#181E2E] p-3.5 border border-white/5">
        <p className="truncate text-xs font-bold text-white">{user?.name || 'SwiftDrop User'}</p>
        <p className="text-[11px] text-slate-400">{roleLabels[user?.role] || 'User'}</p>
        <button type="button" onClick={handleLogout} className="mt-2 text-[11px] text-slate-400 hover:text-[#F95716] transition font-medium">Sign out</button>
      </div>
    </div>
  </aside>;
}
export function MobileNavigation({ open, onClose, role, publicPage = false }) {
  return <Modal open={open} onClose={onClose} title={role ? `${roleLabels[role]} navigation` : 'Navigation'} className="fixed inset-y-0 left-0 max-h-dvh max-w-xs rounded-none p-5">
    {(!role || publicPage) && <nav aria-label="Public navigation" className="mb-4 flex flex-col gap-2">{[...publicLinks, ...(!role ? [['/login', 'Log in'], ['/register', 'Register']] : [])].map(([to, label]) => <Link key={to} to={to} className="ui-button ui-button-ghost justify-start" onClick={onClose}>{label}</Link>)}</nav>}
    {role && <NavigationLinks role={role} onNavigate={onClose} />}
  </Modal>;
}
export function TopNavbar({ portal = false }) {
  const { user, isAuthenticated, logout } = useAuth(); const navigate = useNavigate(); const { pathname } = useLocation();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)');
    const close = e => { if (e.matches) setOpen(false); };
    media?.addEventListener('change', close); return () => media?.removeEventListener('change', close);
  }, []);
  const handleLogout = async () => { if (busy) return; setBusy(true); setError(''); try { await logout(); navigate('/login'); } catch { setError('Could not end your session. Please try logging out again.'); } finally { setBusy(false); } };
  return <><header className="sticky top-0 z-30 border-b border-[#EBE7DF] bg-[#FBF9F4]/90 backdrop-blur"><div className={`mx-auto flex min-h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 ${portal ? 'lg:px-8' : 'lg:px-10'}`}>
    <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" aria-label="Open navigation" aria-expanded={open} className="px-2 lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></Button>{portal ? <span className="truncate text-sm font-semibold text-slate-700">{roleLabels[user?.role]} portal</span> : <Brand compact={isAuthenticated} />}</div>
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      {!portal && <nav aria-label="Public navigation" className="hidden items-center gap-4 lg:flex">{publicLinks.map(([to, label]) => <NavLink end={to === '/'} key={to} to={to} className={({ isActive }) => `inline-flex min-h-11 items-center text-sm font-medium ${isActive ? 'text-[#F95716]' : 'text-slate-600 hover:text-[#F95716]'}`}>{label}</NavLink>)}</nav>}
      {isAuthenticated ? <>
        {!portal && <Link to={dashboards[user.role] || '/account'} className="ui-button ui-button-secondary">Dashboard</Link>}
        <NotificationBellDropdown />
        <div className={`hidden min-w-0 text-right ${portal ? 'sm:block' : 'xl:block'}`}><p className="max-w-44 truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-500">{roleLabels[user.role]}</p></div>
        <Button variant="ghost" aria-label="Logout" title="Logout" busy={busy} onClick={handleLogout} className="px-2 text-slate-500"><LogOut size={20} /></Button>
      </> : <div className="hidden gap-2 sm:flex"><Link to="/login" className="ui-button ui-button-ghost">Log in</Link><Link to="/register" className="ui-button ui-button-primary">Register</Link></div>}
    </div>
  </div>{error && <p role="alert" className="px-4 pb-3 text-sm text-rose-700">{error}</p>}</header><MobileNavigation open={open} onClose={() => setOpen(false)} role={isAuthenticated ? user?.role : null} publicPage={!portal} /></>;
}
const routeNames = { customer: 'Customer', merchant: 'Merchant', courier: 'Courier', admin: 'Administration', account: 'Account', users: 'User accounts', merchants: 'Merchant applications', apply: 'Business application', 'application-status': 'Application status', new: 'New delivery', parcels: 'Parcel details' };
export function Breadcrumbs() {
  const { pathname } = useLocation(); const parts = pathname.split('/').filter(Boolean);
  return <nav aria-label="Breadcrumb" className="px-4 pt-5 sm:px-6 lg:px-8"><ol className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><li><Link to="/" className="hover:text-[#F95716]">Home</Link></li>{parts.map((part, i) => <li key={i} className="flex min-w-0 items-center gap-2"><ChevronRight size={12} aria-hidden="true" /><span aria-current={i === parts.length - 1 ? 'page' : undefined}>{routeNames[part] || 'Details'}</span></li>)}</ol></nav>;
}
const SkipLink = () => <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[110] focus:rounded-lg focus:bg-white focus:p-3 focus:text-[#F95716] focus:shadow-lg">Skip to content</a>;
export function PublicLayout({ children }) {
  return <div className="min-h-dvh bg-[#FBF9F4] text-slate-900"><SkipLink /><TopNavbar /><main id="main-content" tabIndex={-1}>{children}</main><PublicFooter /></div>;
}
export function AuthLayout({ children }) {
  return <PublicLayout><div className="auth-content mx-auto w-full max-w-5xl px-4 py-1 sm:px-6">{children}</div></PublicLayout>;
}
export function PortalLayout({ children }) {
  const { user } = useAuth();
  return <div className="min-h-dvh bg-[#FBF9F4] text-slate-900"><SkipLink /><Sidebar role={user?.role} /><div className="min-w-0 lg:pl-64"><TopNavbar portal /><Breadcrumbs /><main id="main-content" tabIndex={-1} className="portal-content mx-auto w-full max-w-screen-2xl pb-10">{children}</main></div></div>;
}
// Named portal boundaries share one shell and derive navigation from AuthContext.
export const CustomerLayout = PortalLayout;
export const MerchantLayout = PortalLayout;
export const CourierLayout = PortalLayout;
export const DispatcherLayout = PortalLayout;
export const AdminLayout = PortalLayout;
export function ApplicationLayout({ children }) {
  const { pathname, hash } = useLocation(); const { user, isAuthenticated } = useAuth();
  useEffect(() => {
    // Only ordinary public section anchors participate; auth fragments stay in
    // their existing page handlers and are never copied, decoded or logged here.
    const target = /^#[a-z][a-z0-9-]*$/.test(hash) ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
  }, [pathname, hash]);
  if (['/login', '/register', '/forgot-password', '/reset-password', '/activate', '/auth/callback'].includes(pathname)) return <AuthLayout>{children}</AuthLayout>;
  if (isAuthenticated && /^\/(customer|merchant|courier|admin|account|parcels)(\/|$)/.test(pathname)) {
    const Layout = { CUSTOMER: CustomerLayout, MERCHANT: MerchantLayout, COURIER: CourierLayout, DISPATCHER: DispatcherLayout, ADMIN: AdminLayout }[user?.role] || PortalLayout;
    return <Layout>{children}</Layout>;
  }
  return <PublicLayout>{children}</PublicLayout>;
}
