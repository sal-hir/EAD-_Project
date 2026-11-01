import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Button, Input, Select, Modal, DataTable, Pagination } from './components/ui';
import { PortalLayout, TopNavbar, navigationFor } from './layouts/SharedLayouts';

let role = 'CUSTOMER';
const logout = vi.fn();
vi.mock('./context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Test user', role }, isAuthenticated: true, logout }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('shared design foundation', () => {
  it.each(['CUSTOMER', 'MERCHANT', 'COURIER', 'DISPATCHER', 'ADMIN'])('shows only permitted navigation for %s', current => {
    role = current;
    render(<MemoryRouter><PortalLayout><h1>Portal content</h1></PortalLayout></MemoryRouter>);
    expect(screen.getByRole('main').textContent).toContain('Portal content');
    expect(screen.queryAllByRole('link', { name: 'User accounts' }).length).toBe(current === 'ADMIN' ? 1 : 0);
  });
  it('does not invent navigation for an unknown role', () => { expect(navigationFor('UNKNOWN')).toEqual([]); });
  it('opens the drawer, traps keyboard focus and restores focus when closed', () => {
    role = 'CUSTOMER';
    render(<MemoryRouter><TopNavbar portal /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' }); trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const close = screen.getByRole('button', { name: 'Close dialog' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement.textContent).toBe('Account');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
  });
  it('closes the drawer after navigating', () => {
    render(<MemoryRouter><TopNavbar portal /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByRole('link', { name: 'Account' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('associates validation hints with controls and supports selects', () => {
    render(<><Input label="Business email" hint="Use a monitored inbox" error="Invalid email" /><Select label="Status"><option>Pending</option></Select></>);
    const input = screen.getByLabelText('Business email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby').split(' ')).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy();
  });
  it('disables a busy button and uses safe default button types', () => {
    const action = vi.fn(); render(<Button busy onClick={action}>Save</Button>);
    const button = screen.getByRole('button'); fireEvent.click(button);
    expect(action).not.toHaveBeenCalled(); expect(button.type).toBe('button');
  });
  it('renders table headers, mobile cell labels and caller actions', () => {
    const action = vi.fn(); render(<DataTable caption="Applications" rows={[{ id: 1, name: 'Business' }]} columns={[{ key: 'name', label: 'Name' }, { key: 'action', label: 'Review', render: () => <Button onClick={action}>Review</Button> }]} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByText('Business').closest('td').getAttribute('data-label')).toBe('Name');
    fireEvent.click(screen.getByRole('button')); expect(action).toHaveBeenCalledOnce();
  });
  it('bounds pagination at both ends', () => {
    const onPageChange = vi.fn(); render(<Pagination page={0} pages={1} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' })); fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
