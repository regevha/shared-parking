import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { notification } from 'antd';
import UsersSection from '../UsersSection';
import { usersApi } from '../../../api/users';

jest.mock('../../../api/users', () => ({ usersApi: { update: jest.fn(), delete: jest.fn() } }));
let mockIsMobile = false;
jest.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => mockIsMobile }));
const api = usersApi as jest.Mocked<typeof usersApi>;

const users = [
  { id: 'u1', name: 'Alice', email: 'alice@parking.dev', role: 'user', createdAt: '2025-03-04T10:00:00' },
  { id: 'u2', name: 'Sarah Smith', email: 'sarah@parking.dev', role: 'owner' },
  { id: 'u3', name: 'Admin', email: 'admin@parking.dev', role: 'manager' },
];

function renderIt(over: Partial<React.ComponentProps<typeof UsersSection>> = {}) {
  const refreshUsers = jest.fn().mockResolvedValue(undefined);
  render(<UsersSection users={users} loading={false} refreshUsers={refreshUsers} {...over} />);
  return { refreshUsers };
}

beforeEach(() => {
  mockIsMobile = false;
  jest.spyOn(notification, 'success').mockImplementation(() => {});
  jest.spyOn(notification, 'error').mockImplementation(() => {});
});

describe('UsersSection (desktop)', () => {
  it('lists users with formatted join date and a dash when missing', () => {
    renderIt();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('04/03/2025')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('disables role change and delete for managers', () => {
    renderIt();
    const row = screen.getByText('Admin').closest('tr')!;
    expect(within(row).getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(within(row).getByRole('combobox')).toBeDisabled();
  });

  it('deletes a user after confirming, then refreshes', async () => {
    api.delete.mockResolvedValue(undefined as never);
    const { refreshUsers } = renderIt();
    const row = screen.getByText('Alice').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /delete/i }));
    const ok = (await screen.findAllByRole('button', { name: /delete|ok|yes/i })).pop()!;
    fireEvent.click(ok);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(refreshUsers).toHaveBeenCalled());
    expect(notification.success).toHaveBeenCalled();
  });

  it('reports a failed delete without refreshing', async () => {
    api.delete.mockRejectedValue(new Error('boom'));
    const { refreshUsers } = renderIt();
    const row = screen.getByText('Alice').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /delete/i }));
    const ok = (await screen.findAllByRole('button', { name: /delete|ok|yes/i })).pop()!;
    fireEvent.click(ok);
    await waitFor(() => expect(notification.error).toHaveBeenCalled());
    expect(refreshUsers).not.toHaveBeenCalled();
  });

  it('changes a role and refreshes', async () => {
    api.update.mockResolvedValue(undefined as never);
    const { refreshUsers } = renderIt();
    const row = screen.getByText('Alice').closest('tr')!;
    fireEvent.mouseDown(within(row).getByRole('combobox'));
    const option = await screen.findByText('Owner', { selector: '.ant-select-item-option-content' });
    fireEvent.click(option);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('u1', { role: 'owner' }));
    await waitFor(() => expect(refreshUsers).toHaveBeenCalled());
  });

  it('reports a failed role change', async () => {
    api.update.mockRejectedValue(new Error('nope'));
    const { refreshUsers } = renderIt();
    const row = screen.getByText('Alice').closest('tr')!;
    fireEvent.mouseDown(within(row).getByRole('combobox'));
    fireEvent.click(await screen.findByText('Owner', { selector: '.ant-select-item-option-content' }));
    await waitFor(() => expect(notification.error).toHaveBeenCalled());
    expect(refreshUsers).not.toHaveBeenCalled();
  });
});

describe('UsersSection (mobile)', () => {
  beforeEach(() => { mockIsMobile = true; });

  it('renders cards and hides delete for managers', () => {
    renderIt();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });

  it('deletes from a card', async () => {
    api.delete.mockResolvedValue(undefined as never);
    const { refreshUsers } = renderIt();
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    const ok = (await screen.findAllByRole('button', { name: /delete|ok|yes/i })).pop()!;
    fireEvent.click(ok);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(refreshUsers).toHaveBeenCalled());
  });
});
