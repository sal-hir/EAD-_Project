import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Input, PageHeader, EmptyState } from '../components/ui';

const faqs = [
  ['Getting Started', 'What can I use today?', 'Customer registration, password and configured Google sign-in, account security, and merchant applications are available. Booking, pricing, delivery tracking and courier operations are not connected yet.'],
  ['Getting Started', 'How do I get started?', 'Create a customer account from Register, then sign in. Your verified role determines your portal and available actions.'],
  ['Customer Accounts', 'Can I register as an administrator or courier?', 'Public registration creates CUSTOMER accounts only. An administrator provisions merchant, courier and dispatcher identities through User accounts.'],
  ['Customer Accounts', 'Will I stay signed in after a refresh?', 'The browser restores an active session using a protected refresh cookie. Logout, expiry, password reset or an administrator account change can require you to sign in again.'],
  ['Parcel Booking', 'Can I book a delivery now?', 'Parcel booking is coming soon. Creating an account does not create a parcel or delivery request.'],
  ['Parcel Booking', 'Are the pricing estimates live?', 'No. The pricing page prepares your route and package inputs, but it does not calculate a fee until a pricing service is connected.'],
  ['Parcel Tracking', 'Where do I find a tracking number?', 'Use the reference supplied with an actual shipment. This release does not create shipments or tracking references. The tracking screen includes a clearly labeled fictional demonstration.'],
  ['Parcel Tracking', 'Why does tracking say it is not connected?', 'The public tracking API is not available in this release. The page cannot confirm a parcel, delivery date or live status. A demonstration is never a real shipment.'],
  ['Merchant Registration', 'How do I become a merchant?', 'Create a customer account and select Become a Merchant. Submit your business application and follow its status. An administrator must approve it before the business is approved.'],
  ['Merchant Registration', 'What if my business application is rejected?', 'Read the rejection reason, edit your business details, save corrections and explicitly resubmit. Existing MERCHANT identities also need business approval.'],
  ['Delivery and Courier', 'Are courier assignments available?', 'Courier accounts can sign in, but delivery assignments and courier operations are not implemented in this release.'],
  ['Delivery and Courier', 'Are delivery times guaranteed?', 'No delivery guarantees or service schedules are published here. Confirmed delivery information must come from the connected delivery service when it becomes available.'],
  ['Password and Account Security', 'How do I reset a forgotten password?', 'Open Forgot password, enter your email and follow the single-use link if your account is eligible and mail delivery is configured. Links expire after 20 minutes. You must sign in again after changing the password.'],
  ['Password and Account Security', 'Can I reset a Google-only account password?', 'Use Google sign-in for a Google-only account. Password recovery does not create a password for it. Signing in with Google automatically connects a matching verified email to an active account that has completed its required activation.'],
];
const slug = value => value.toLowerCase().replaceAll(' ', '-');
export function Help() {
  const [search, setSearch] = useState(''), [open, setOpen] = useState(null);
  const matches = faqs.filter(entry => entry.join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const categories = [...new Set(matches.map(([category]) => category))];
  return <section className="public-container max-w-5xl space-y-8 py-10 sm:py-14"><PageHeader title="How can we help?" description="Practical answers about your SwiftDrop account and the services available today." />
    <div className="ui-card p-5"><Input label="Search help" type="search" placeholder="Try password, merchant or tracking" maxLength={120} value={search} onChange={e => { setSearch(e.target.value); setOpen(null); }} /><p className="mt-3 text-xs text-slate-500" role="status">{matches.length} answers found</p></div>
    <nav aria-label="Help categories" className="flex flex-wrap gap-2">{[...new Set(faqs.map(([category]) => category))].map(category => <a className="ui-button ui-button-secondary text-xs" key={category} href={`#${slug(category)}`} onClick={() => { setSearch(''); setOpen(null); }}>{category}</a>)}</nav>
    {!matches.length && <EmptyState title="No matching answers" description="Try a different word, or clear your search to browse all topics." />}
    {categories.map(category => <section id={slug(category)} key={category} className="scroll-mt-24"><h2 className="mb-4 text-xl font-bold">{category}</h2><div className="ui-card divide-y divide-slate-200 overflow-hidden">{matches.filter(entry => entry[0] === category).map(([, question, answer]) => {
      const id = faqs.findIndex(entry => entry[1] === question), expanded = open === id;
      return <div key={question}><h3><button type="button" className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50" aria-expanded={expanded} aria-controls={`faq-answer-${id}`} onClick={() => setOpen(expanded ? null : id)}>{question}<ChevronDown size={18} className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" /></button></h3><div id={`faq-answer-${id}`} hidden={!expanded} className="px-5 pb-5 text-sm leading-7 text-slate-600">{answer}</div></div>;
    })}</div></section>)}
    <div className="rounded-2xl bg-blue-50 p-6"><h2 className="font-bold">Still have a question?</h2><p className="mt-2 text-sm text-slate-600">Check contact availability or return to your account.</p><Link className="ui-button ui-button-secondary mt-4" to="/contact">Contact information</Link></div>
  </section>;
}
