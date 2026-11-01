import React, { useCallback, useEffect, useState } from 'react';
import { api, authError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Pagination } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

const roles = ['MERCHANT', 'COURIER', 'DISPATCHER'];
const initial = { name: '', email: '', phone: '', role: 'COURIER', active: true };
export const AdminUsers = () => {
  const { user: actor } = useAuth();
  const [result, setResult] = useState({ users: [], page: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(initial);
  const [selectedRoles, setSelectedRoles] = useState({});
  const [activation, setActivation] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (page = 0, term = '') => {
    const response = await api.get('/auth/admin/users', { params: { page, search: term } });
    setResult(response.data.data);
  }, []);
  useEffect(() => { load().catch(e => setError(authError(e, 'Could not load users'))); }, [load]);
  const run = async task => {
    if (busy) return;
    setBusy(true); setError(''); setActivation(null);
    try { await task(); } catch (e) { setError(authError(e, 'Account operation failed')); }
    finally { setBusy(false); }
  };
  const post = async (id, operation, body = {}) => {
    const response = await api.post(`/auth/admin/users/${id}/${operation}`, body);
    if (operation === 'activation') setActivation(response.data.data);
    await load(result.page, search);
  };
  return <section className="max-w-6xl mx-auto p-6 space-y-6">
    <PageHeader title="User accounts" />
    <p className="text-slate-600">Provision authentication identities. Review merchant business applications separately under Merchant applications.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <form className="bg-white rounded-xl border p-5 grid sm:grid-cols-2 gap-4" onSubmit={e => {
      e.preventDefault(); run(async () => {
        const response = await api.post('/auth/admin/users', form);
        setActivation(response.data.data); setForm(initial); await load(0, search);
      });
    }}>
      <h2 className="sm:col-span-2 font-semibold">Create staff or merchant identity</h2>
      {['name', 'email', 'phone'].map(field => <label key={field} className="text-sm capitalize">{field}
        <input className="border rounded-lg p-2 block w-full mt-1" type={field === 'email' ? 'email' : 'text'}
          required={field !== 'phone'} maxLength={field === 'name' ? 120 : field === 'email' ? 254 : 30}
          value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} />
      </label>)}
      <label className="text-sm">Role<select className="border rounded-lg p-2 block w-full mt-1" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
        {roles.map(role => <option key={role}>{role}</option>)}
      </select></label>
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Active</label>
      <button disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">Create identity</button>
    </form>
    {activation && <div role="status" className="bg-blue-50 rounded-xl p-4 break-all space-y-2">
      <p>Share this single-use activation link privately with the intended user. It expires in 30 minutes. The user chooses their own password.</p>
      <a href={activation.activationUrl} className="text-blue-700 underline">{activation.activationUrl}</a>
      {!activation.user.active && <p>Activate this identity and issue a new link before the user sets their password.</p>}
      <button className="block underline" onClick={() => setActivation(null)}>Dismiss link</button>
    </div>}
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); run(() => load(0, search)); }}>
      <label className="flex-1">Search users<input className="border rounded-lg p-2 w-full" value={search} maxLength={120} onChange={e => setSearch(e.target.value)} /></label>
      <button disabled={busy} className="border rounded-lg px-4 self-end py-2">Search</button>
    </form>
    <div className="overflow-x-auto bg-white rounded-xl border"><table className="responsive-table w-full text-sm text-left">
      <thead><tr>{['Name', 'Email', 'Role', 'Status', 'Actions'].map(label => <th scope="col" className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody>{result.users.map(user => {
        const protectedUser = user.role === 'ADMIN' || user.id === actor.id;
        return <tr className="border-t" key={user.id}>
          <td data-label="Name" className="p-3">{user.name}</td><td data-label="Email" className="p-3">{user.email}</td>
          <td data-label="Role" className="p-3"><div>{protectedUser ? user.role : <>
            <select aria-label={`Role for ${user.email}`} value={selectedRoles[user.id] || user.role}
              onChange={e => setSelectedRoles({ ...selectedRoles, [user.id]: e.target.value })}>
              {user.role === 'CUSTOMER' && <option>CUSTOMER</option>}{roles.map(role => <option key={role}>{role}</option>)}
            </select>
            <button disabled={busy || !(selectedRoles[user.id] && selectedRoles[user.id] !== user.role)} className="block text-blue-700 disabled:text-slate-400"
              onClick={() => run(() => post(user.id, 'role', { role: selectedRoles[user.id] }))}>Change role</button>
          </>}</div></td>
          <td data-label="Status" className="p-3"><StatusBadge status={user.active ? 'ACTIVE' : 'INACTIVE'} /></td>
          <td data-label="Actions" className="p-3"><div className="flex flex-wrap gap-2">
            {!protectedUser && <><button disabled={busy} className="text-blue-700" onClick={() => run(() => post(user.id, 'status', { active: !user.active }))}>{user.active ? 'Deactivate' : 'Activate'}</button>
              <button disabled={busy} className="text-blue-700" onClick={() => run(() => post(user.id, 'activation'))}>New activation link</button></>}
            <button disabled={busy} className="text-blue-700" onClick={() => run(async () => setAudit((await api.get(`/auth/admin/users/${user.id}/audit`)).data.data))}>Audit</button>
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>
    <Pagination page={result.page} pages={result.pages} disabled={busy} onPageChange={page => run(() => load(page, search))} />
    {audit && <div className="bg-white border rounded-xl p-4"><h2 className="font-semibold">Identity audit (latest 100)</h2>
      {audit.length === 0 && <p>No recorded identity changes.</p>}
      {audit.map(event => <p key={event.id} className="text-sm break-all">{new Date(event.createdAt).toLocaleString()} · {event.action} · {event.detail} · Actor: {event.actorId || 'Local bootstrap'}</p>)}
    </div>}
  </section>;
};
