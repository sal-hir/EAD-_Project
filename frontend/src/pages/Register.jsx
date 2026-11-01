import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authError, dashboardPath } from '../api/client';
import { AuthPanel, PasswordInput, passwordRules } from '../components/PublicWebsite';
import { Input, Button, ErrorState } from '../components/ui';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password !== confirmation) { setError('Passwords must match'); return; }
    setLoading(true);

    try {
      await register({
        name,
        email,
        password,
        phone,
      });

      // Auto login after registration
      const user = await login(email, password);
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(authError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return <AuthPanel title="Create your account" description="Start with a customer account. You can apply for a merchant business after signing in." footer={<>Already have an account? <Link className="font-semibold text-blue-700 hover:underline" to="/login">Log in</Link></>}>
    {error && <ErrorState message={error} />}
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Full Name" id="full-name" autoComplete="name" maxLength={120} required value={name} disabled={loading} onChange={e => setName(e.target.value)} placeholder="Kamal Perera" />
      <Input label="Email address" id="email" autoComplete="email" type="email" maxLength={254} required value={email} disabled={loading} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
      <Input label="Phone Number (optional)" id="phone" autoComplete="tel" type="tel" maxLength={30} value={phone} disabled={loading} onChange={e => setPhone(e.target.value)} placeholder="+94 77 123 4567" />
      <PasswordInput label="Password" id="password" autoComplete="new-password" {...passwordRules} required value={password} disabled={loading} onChange={e => setPassword(e.target.value)} hint="Use 8–72 printable ASCII characters. Avoid a password you use elsewhere." />
      <PasswordInput label="Confirm password" autoComplete="new-password" maxLength={72} required value={confirmation} disabled={loading} onChange={e => setConfirmation(e.target.value)} />
      <Button type="submit" busy={loading} className="w-full">{loading ? 'Creating account...' : 'Create Account'}</Button>
    </form>
    <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Public registration creates a customer identity. Merchant business access requires a separate application and administrator approval.</p>
  </AuthPanel>;
};
