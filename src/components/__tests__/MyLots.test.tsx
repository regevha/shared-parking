import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import MyLots from '../MyLots';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeLot, makeOwnerUser } from '../../test-utils/fixtures';
import { LotStatus } from '../../types/enums';

describe('MyLots', () => {
  it('renders table with lot ID, floor, status', async () => {
    const lot = makeLot({ id: 'LOT-M1', floorLabel: 'Floor 2', status: LotStatus.AVAILABLE });
    renderWithProviders(<MyLots />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { ownerLots: [lot] },
    });
    await waitFor(() => {
      expect(screen.getByText('LOT-M1')).toBeInTheDocument();
      expect(screen.getByText('Floor 2')).toBeInTheDocument();
    });
  });

  it('shows empty state when ownerLots is empty', async () => {
    renderWithProviders(<MyLots />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { ownerLots: [] },
    });
    // No lot IDs rendered
    await waitFor(() => {
      expect(screen.queryByText(/LOT-/)).not.toBeInTheDocument();
    });
  });

  it('renders multiple lots', async () => {
    const lots = [
      makeLot({ id: 'LOT-1', floor: 'F1', floorLabel: 'Floor 1' }),
      makeLot({ id: 'LOT-2', floor: 'F2', floorLabel: 'Floor 2' }),
      makeLot({ id: 'LOT-3', floor: 'F3', floorLabel: 'Floor 3', status: LotStatus.BLOCKED }),
    ];
    renderWithProviders(<MyLots />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { ownerLots: lots },
    });
    await waitFor(() => {
      expect(screen.getByText('LOT-1')).toBeInTheDocument();
      expect(screen.getByText('LOT-2')).toBeInTheDocument();
      expect(screen.getByText('LOT-3')).toBeInTheDocument();
    });
  });

  it('displays owner name in info card', async () => {
    renderWithProviders(<MyLots />, {
      authValue: { user: makeOwnerUser({ name: 'Sarah Smith' }) },
      requestsValue: { ownerLots: [makeLot()] },
    });
    await waitFor(() => {
      expect(screen.getByText('Sarah Smith')).toBeInTheDocument();
    });
  });
});
