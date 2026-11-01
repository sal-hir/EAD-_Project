import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { PublicTracking, PublicTrackingResult } from './pages/PublicTracking';
import { Pricing } from './pages/Pricing';
import { Help } from './pages/Help';
import { Contact } from './pages/Contact';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AccountSettings } from './pages/AccountSettings';
import { PasswordInput } from './components/PublicWebsite';
import { publicServices, PublicServiceError } from './api/publicServices';
import { api } from './api/client';

let signedIn = false, user;
const login = vi.fn(), register = vi.fn(), logout = vi.fn();
vi.mock('./context/AuthContext', () => ({ useAuth: () => ({ user, isAuthenticated: signedIn, login, register, logout }) }));
vi.mock('./api/client', async original => ({ ...await original(), api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./api/publicServices', async original => ({ ...await original(), publicServices: { track: vi.fn(), quote: vi.fn(), contact: vi.fn() } }));
const wrap = (element, route = '/') => render(<MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>);
const track = code => render(<MemoryRouter initialEntries={[code ? `/track/${code}` : '/track']}><Routes><Route path="/track" element={<PublicTracking />} /><Route path="/track/:trackingNumber" element={<PublicTracking />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); signedIn = false; user = { id: 'fixture', name: 'Verified customer', email: 'customer@example.test', role: 'CUSTOMER', active: true };
  for (const adapter of Object.values(publicServices)) adapter.mockRejectedValue(new PublicServiceError('unavailable'));
  api.get.mockImplementation(async path => ({ data: { data: path === '/auth/providers' ? { google: false } : { passwordEnabled: true, googleLinked: false, googleAvailable: true } } }));
  login.mockResolvedValue(user); register.mockResolvedValue({}); logout.mockResolvedValue();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('public website and future service boundaries', () => {
  it('shows honest service availability and registration CTA on the home page', () => {
    wrap(<Home />); expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Deliver Anything.');
    expect(screen.getByRole('link', { name: 'Book a Delivery' }).getAttribute('href')).toBe('/register');
    expect(screen.getByText(/Tracking and delivery booking are not connected/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /parcel journey/ })).toBeTruthy();
  });
  it('uses the verified role for an authenticated home CTA', () => {
    signedIn = true; user.role = 'COURIER'; wrap(<Home />);
    expect(screen.getByRole('link', { name: 'Open dashboard' }).getAttribute('href')).toBe('/courier');
  });
  it('rejects malformed tracking references before invoking an adapter', () => {
    track(); fireEvent.change(screen.getByLabelText('Tracking number'), { target: { value: '<bad>' } }); fireEvent.click(screen.getByRole('button', { name: 'Track Parcel' }));
    expect(screen.getByText(/Enter 4–64/)).toBeTruthy(); expect(publicServices.track).not.toHaveBeenCalled();
  });
  it('normalizes a tracking search and clearly reports unavailable service', async () => {
    track(); fireEvent.change(screen.getByLabelText('Tracking number'), { target: { value: ' sd-test ' } }); fireEvent.click(screen.getByRole('button', { name: 'Track Parcel' }));
    expect(await screen.findByRole('heading', { name: 'Tracking is not connected yet' })).toBeTruthy(); expect(publicServices.track).toHaveBeenCalledWith('SD-TEST');
    expect(screen.queryByRole('article', { name: 'Tracking result' })).toBeNull();
  });
  it('validates references opened directly in the detail route', async () => {
    track('x'); expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('invalid')); expect(publicServices.track).not.toHaveBeenCalled();
  });
  it('handles a future not-found result without showing a parcel', async () => {
    publicServices.track.mockResolvedValue(null); track('SD-404');
    expect(await screen.findByRole('heading', { name: 'No parcel found' })).toBeTruthy();
  });
  it('shows loading while a lookup is pending', async () => {
    publicServices.track.mockImplementation(() => new Promise(() => {})); track('SD-PENDING');
    expect(await screen.findByRole('status', { name: 'Looking up your parcel...' })).toBeTruthy();
  });
  it('offers a retry after tracking network failure', async () => {
    publicServices.track.mockRejectedValue(new Error('Network')); track('SD-TEST');
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' })); await waitFor(() => expect(publicServices.track).toHaveBeenCalledTimes(2));
  });
  it('labels sample tracking as a demonstration and never as a live lookup', () => {
    track(); fireEvent.click(screen.getByRole('button', { name: 'View demonstration' }));
    expect(screen.getByText(/Demonstration only — not a real shipment/)).toBeTruthy(); expect(publicServices.track).not.toHaveBeenCalled();
    expect(screen.getByRole('list', { name: 'Parcel event timeline' })).toBeTruthy();
  });
  it('projects only public tracking fields and omits a missing delivery estimate', () => {
    wrap(<PublicTrackingResult parcel={{ trackingNumber: 'SD-TEST', status: 'CREATED', originCity: 'Colombo', destinationCity: 'Kandy', recipient: 'PRIVATE NAME', dropoffAddress: 'PRIVATE ADDRESS', phone: 'PRIVATE PHONE', events: [{ status: 'CREATED', note: 'PRIVATE NOTE' }] }} />);
    expect(document.body.textContent).not.toContain('PRIVATE'); expect(document.body.textContent).not.toContain('Estimated delivery supplied');
    expect(screen.getByText('Colombo')).toBeTruthy();
  });
  it('validates pricing inputs without inventing a fee', () => {
    wrap(<Pricing />); fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
    expect(screen.getByText('Enter a pickup city or district.')).toBeTruthy(); expect(screen.getByText('Enter a parcel weight greater than zero.')).toBeTruthy(); expect(publicServices.quote).not.toHaveBeenCalled();
  });
  it('shows pricing unavailable after a valid calculator request', async () => {
    wrap(<Pricing />); fireEvent.change(screen.getByLabelText('Origin city / district'), { target: { value: 'Colombo' } }); fireEvent.change(screen.getByLabelText('Destination city / district'), { target: { value: 'Kandy' } }); fireEvent.change(screen.getByLabelText('Parcel weight (kg)'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' })); await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No fee was calculated'));
    expect(screen.getByText('No live estimate available')).toBeTruthy();
  });
  it('searches FAQ answers and toggles accessible accordions', () => {
    wrap(<Help />); fireEvent.change(screen.getByLabelText('Search help'), { target: { value: 'rejected' } });
    const question = screen.getByRole('button', { name: 'What if my business application is rejected?' }); expect(question.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(question); expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(question.getAttribute('aria-controls')).hidden).toBe(false);
    fireEvent.change(screen.getByLabelText('Search help'), { target: { value: 'no-match-xyz' } }); expect(screen.getByRole('heading', { name: 'No matching answers' })).toBeTruthy();
  });
  it('validates contact fields before attempting submission', () => {
    wrap(<Contact />); fireEvent.click(screen.getByRole('button', { name: 'Submit message' }));
    expect(screen.getByText('Enter your name.')).toBeTruthy(); expect(screen.getByText('Enter a valid email address.')).toBeTruthy(); expect(publicServices.contact).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'network'])('does not claim a contact message was sent on %s failure', async kind => {
    publicServices.contact.mockRejectedValue(new PublicServiceError(kind)); wrap(<Contact />);
    for (const [label, value] of [['Name', 'Test user'], ['Email', 'test@example.test'], ['Subject', 'Question'], ['Message', 'A test message']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit message' }));
    expect(await screen.findByRole(kind === 'unavailable' ? 'status' : 'alert')).toHaveProperty('textContent', expect.stringContaining(kind === 'unavailable' ? 'has not been sent' : 'could not be sent'));
    expect(screen.queryByText('Your message was accepted by the connected contact service.')).toBeNull();
  });
});
describe('authentication presentation', () => {
  it('toggles password visibility without changing the value', () => {
    wrap(<PasswordInput label="Password" value="fixture-password" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' })); expect(screen.getByLabelText('Password').type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' })); expect(screen.getByLabelText('Password').value).toBe('fixture-password'); expect(screen.getByLabelText('Password').type).toBe('password');
  });
  it('uses the current login contract and disables unconfigured Google sign-in', async () => {
    wrap(<Login />); fireEvent.change(screen.getByLabelText('Email address'), { target: { value: user.email } }); fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Fixture@123' } }); fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await waitFor(() => expect(login).toHaveBeenCalledWith(user.email, 'Fixture@123'));
    expect(screen.getByRole('button', { name: 'Google sign-in unavailable until configured' }).disabled).toBe(true);
  });
  it('rejects mismatched registration passwords before the API call', () => {
    wrap(<Register />); fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Fixture@123' } }); fireEvent.submit(document.querySelector('form'));
    expect(screen.getByRole('alert').textContent).toBe('Passwords must match'); expect(register).not.toHaveBeenCalled();
  });
  it('registers only existing customer fields and keeps confirmation local', async () => {
    wrap(<Register />); for (const [label, value] of [['Full Name', 'Customer'], ['Email address', user.email], ['Password', 'Fixture@123'], ['Confirm password', 'Fixture@123']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.submit(document.querySelector('form')); await waitFor(() => expect(register).toHaveBeenCalledWith({ name: 'Customer', email: user.email, phone: '', password: 'Fixture@123' }));
  });
  it('shows verified account details and automatic Google linking guidance', async () => {
    signedIn = true; user.role = 'MERCHANT'; wrap(<AccountSettings />);
    expect(await screen.findByText(/Sign in with Google using the same verified email/)).toBeTruthy(); expect(screen.getByText(user.name)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect Google Account' })).toBeNull();
    expect(screen.queryByLabelText('Current password')).toBeNull();
    expect(screen.getByRole('link', { name: 'Return to dashboard' }).getAttribute('href')).toBe('/merchant'); expect(screen.getByRole('link', { name: 'Request password recovery' })).toBeTruthy();
  });
  it('handles failed account logout without claiming the session ended', async () => {
    logout.mockRejectedValue(new Error('Unavailable')); signedIn = true; wrap(<AccountSettings />); fireEvent.click(screen.getByRole('button', { name: 'Log out of account' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Could not end your session')); expect(screen.getByText(user.email)).toBeTruthy();
  });
  it('shows Google-only account guidance without offering password enrollment', async () => {
    api.get.mockResolvedValue({ data: { data: { passwordEnabled: false, googleLinked: true, googleAvailable: true } } });
    signedIn = true; wrap(<AccountSettings />);
    expect(await screen.findByText('Google account connected.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Request password recovery' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect Google Account' })).toBeNull();
    expect(screen.getByText(/Password recovery does not create a password/)).toBeTruthy();
  });
  it('explains required activation after a blocked Google login without offering manual linking', () => {
    window.history.replaceState(null, '', '/login?error=google_activation_required'); wrap(<Login />);
    expect(screen.getByRole('alert').textContent).toContain('Complete the activation or verification required');
    expect(screen.queryByRole('button', { name: 'Connect Google Account' })).toBeNull();
    window.history.replaceState(null, '', '/');
  });

});
