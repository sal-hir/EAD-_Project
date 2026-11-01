import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Store, Route, ShieldCheck, ArrowRight, UserRound, ClipboardCheck, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../api/client';
import { DeliveryIllustration, TrackingSearch } from '../components/PublicWebsite';

export const Home = () => {
  const { isAuthenticated, user } = useAuth();
  const bookingPath = !isAuthenticated ? '/register' : user?.role === 'CUSTOMER' ? '/customer/new' : dashboardPath(user?.role);
  return <div className="space-y-16 pb-16 sm:space-y-24 sm:pb-24">
    <section className="border-b border-slate-200 bg-gradient-to-br from-white via-white to-blue-50">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-20">
        <div><p className="mb-5 text-xs font-bold uppercase tracking-[.2em] text-blue-700">SwiftDrop · Enterprise Courier</p>
          <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">Deliver Anything.<br /><span className="text-blue-600">Track Everything.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">A simpler place to manage your parcel journey. Create your account, get your business ready, and explore the delivery experience taking shape at SwiftDrop.</p>
          <div className="ui-card mt-7 p-4 sm:p-5"><TrackingSearch /><p className="mt-3 text-xs leading-5 text-slate-500">Tracking and delivery booking are not connected yet. Account registration and merchant applications are available.</p></div>
          <div className="mt-6 flex flex-wrap items-center gap-4"><Link className="ui-button ui-button-primary" to={bookingPath}>Book a Delivery<ArrowRight size={16} aria-hidden="true" /></Link><Link className="ui-button ui-button-secondary" to="/help">How it works</Link></div>
        </div><DeliveryIllustration />
      </div>
    </section>
    <section className="public-container"><div className="mb-8 max-w-2xl"><p className="section-eyebrow">A clear path from start to finish</p><h2 className="section-title">How SwiftDrop works</h2><p className="mt-3 text-slate-600">Start with your account today. Booking and live delivery updates will follow when delivery services are connected.</p></div>
      <div className="grid gap-5 md:grid-cols-3">{[
        [UserRound, '01', 'Create your account', 'Register as a customer and sign in with your password or an available Google account.', 'Available'],
        [Package, '02', 'Prepare your delivery', 'Parcel booking will bring pickup, destination and package details into one place.', 'Coming soon'],
        [MapPin, '03', 'Follow the journey', 'Use your tracking reference to look up public delivery updates when tracking is connected.', 'Coming soon'],
      ].map(([Icon, number, title, text, state]) => <article key={number} className="ui-card p-6"><div className="flex items-center justify-between"><Icon className="h-10 w-10 rounded-lg bg-blue-50 p-2 text-blue-600" aria-hidden="true" /><span className="text-sm font-semibold text-slate-400">{number}</span></div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p><p className="mt-4 text-xs font-semibold text-blue-700">{state}</p></article>)}</div>
    </section>
    <section className="bg-slate-900 py-12 text-white sm:py-16"><div className="public-container"><p className="section-eyebrow text-blue-300">Our services</p><h2 className="section-title text-white">For people and the businesses they build.</h2><div className="mt-8 grid gap-5 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6"><Package size={28} className="text-blue-300" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">Personal parcel delivery</h3><p className="mt-3 text-sm leading-6 text-slate-300">One customer account for your future delivery bookings. Parcel booking, pricing and tracking are coming soon.</p><Link to="/pricing" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-200">Explore delivery pricing<ArrowRight size={16} /></Link></article>
      <article className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6"><Store size={28} className="text-blue-300" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">Merchant business onboarding</h3><p className="mt-3 text-sm leading-6 text-slate-300">Register as a customer, submit a business application and follow its administrator review. Delivery order tools are coming later.</p><Link to={isAuthenticated && ['CUSTOMER', 'MERCHANT'].includes(user?.role) ? '/merchant/apply' : '/help#merchant-registration'} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-200">Explore merchant registration<ArrowRight size={16} /></Link></article>
    </div></div></section>
    <section className="public-container"><p className="section-eyebrow">Why choose SwiftDrop</p><h2 className="section-title">Clarity at every step.</h2><div className="mt-8 grid gap-8 sm:grid-cols-3">{[
      [ShieldCheck, 'An account you control', 'Secure sign-in, password recovery and server-side logout are already part of your account.'],
      [ClipboardCheck, 'A clear business review', 'Merchant applicants can see pending decisions, rejection reasons and the next action.'],
      [Route, 'Built around the journey', 'Public tracking screens are prepared for delivery updates without exposing private recipient details.'],
    ].map(([Icon, title, text]) => <article key={title}><Icon size={27} className="mb-4 text-blue-600" aria-hidden="true" /><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></section>
    <section className="public-container"><div className="ui-card grid gap-8 p-6 sm:p-10 md:grid-cols-2"><div><p className="section-eyebrow">Delivery benefits</p><h2 className="section-title">Less guesswork.<br />A more organized experience.</h2></div><div className="space-y-5"><p className="text-sm leading-7 text-slate-600">The delivery experience is being built around a single reference, clear progress and useful account tools. Live delivery operations are not available in this release.</p><Link to="/help" className="ui-button ui-button-secondary">See what is available</Link></div></div></section>
    <section className="public-container"><div className="rounded-3xl bg-blue-600 p-7 text-white sm:p-12"><div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold sm:text-3xl">Your next step starts here.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Create an account or return to your portal. We will clearly show which services are ready to use.</p></div><Link className="ui-button shrink-0 bg-white text-blue-700 hover:bg-blue-50" to={isAuthenticated ? dashboardPath(user?.role) : '/register'}>{isAuthenticated ? 'Open dashboard' : 'Create your account'}<ArrowRight size={16} /></Link></div></div></section>
  </div>;
};
