import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { notification } from 'antd';
import LotsSection from '../LotsSection';
import { lotsApi } from '../../../api/lots';
import { makeLot } from '../../../test-utils/fixtures';
import { LotStatus } from '../../../types/enums';

jest.mock('../../../api/lots', () => ({ lotsApi: { update: jest.fn() } }));
const api = lotsApi as jest.Mocked<typeof lotsApi>;

const owned = makeLot({ id: 'LOT-1', status: LotStatus.AVAILABLE, owner: 'Sarah Smith', ownerId: 'u2' });
const blocked = makeLot({ id: 'LOT-2', status: LotStatus.BLOCKED, owner: 'Sarah Smith', ownerId: 'u2' });
const unowned = makeLot({ id: 'LOT-3', status: LotStatus.UNOWNED, owner: null, ownerId: null });
const users = [
  { id: 'u2', name: 'Sarah Smith', email: 'sarah@parking.dev', role: 'owner' },
  { id: 'u1', name: 'Alice', email: 'alice@parking.dev', role: 'user' },
];

function renderIt(over: Partial<React.ComponentProps<typeof LotsSection>> = {}) {
  const refreshLots = jest.fn().mockResolvedValue(undefined);
  render(<LotsSection lots={[owned, blocked, unowned]} users={users} loading={false} refreshLots={refreshLots} {...over} />);
  return { refreshLots };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(notification, 'success').mockImplementation(() => {});
  jest.spyOn(notification, 'error').mockImplementation(() => {});
});

describe('LotsSection', () => {
  it('shows filter counts and the unowned warning', () => {
    renderIt();
    expect(screen.getByRole('button', { name: /All \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Available \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Blocked \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unowned \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides the unowned warning while loading', () => {
    renderIt({ loading: true });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('filters to blocked lots', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Blocked \(1\)/ }));
    expect(screen.getByText('LOT-2')).toBeInTheDocument();
    expect(screen.queryByText('LOT-1')).not.toBeInTheDocument();
    expect(screen.queryByText('LOT-3')).not.toBeInTheDocument();
  });

  it('removes an owner after confirming, then reloads lots', async () => {
    api.update.mockResolvedValue(undefined as never);
    const { refreshLots } = renderIt();
    const row = screen.getByText('LOT-1').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /remove owner/i }));
    const confirm = await screen.findAllByRole('button', { name: /remove|ok|yes/i });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('LOT-1', { owner: null, owner_id: null, status: 'unowned' }));
    await waitFor(() => expect(refreshLots).toHaveBeenCalled());
  });

  it('opens the assign dialog for an unowned lot and does nothing without a selection', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /assign owner/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /assign/i }));
    expect(api.update).not.toHaveBeenCalled();
  });
});
