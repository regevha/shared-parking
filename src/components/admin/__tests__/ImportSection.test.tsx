import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportSection from '../ImportSection';
import { adminApi } from '../../../api/admin';

jest.mock('../../../api/admin', () => ({ adminApi: { importUsers: jest.fn(), importLots: jest.fn() } }));
const api = adminApi as jest.Mocked<typeof adminApi>;

function upload(name: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['a,b\n1,2'], name, { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
}

beforeEach(() => jest.clearAllMocks());

describe('ImportSection', () => {
  it('imports a lots file through importLots and tells the parent to reload lots', async () => {
    api.importLots.mockResolvedValue({ status: 'ok', imported: 4, errors: [] } as never);
    const onImported = jest.fn();
    render(<ImportSection onImported={onImported} />);
    upload('my-lots.csv');
    await waitFor(() => expect(api.importLots).toHaveBeenCalled());
    expect(api.importUsers).not.toHaveBeenCalled();
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('lots'));
  });

  it('imports any other file as users', async () => {
    api.importUsers.mockResolvedValue({ status: 'ok', imported: 2, errors: [] } as never);
    const onImported = jest.fn();
    render(<ImportSection onImported={onImported} />);
    upload('people.csv');
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('users'));
  });

  it('does not notify the parent when the import fails', async () => {
    api.importUsers.mockRejectedValue(new Error('bad csv'));
    const onImported = jest.fn();
    render(<ImportSection onImported={onImported} />);
    upload('people.csv');
    await waitFor(() => expect(api.importUsers).toHaveBeenCalled());
    expect(onImported).not.toHaveBeenCalled();
  });

  it('hides the "import first" hint after a successful import', async () => {
    api.importUsers.mockResolvedValue({ status: 'ok', imported: 1, errors: [] } as never);
    render(<ImportSection onImported={jest.fn()} />);
    const hint = /import/i;
    expect(document.body.textContent).toMatch(hint);
    const before = document.querySelectorAll('div[style*="rgb(255, 77, 79)"]').length;
    expect(before).toBe(1);
    upload('people.csv');
    await waitFor(() => expect(document.querySelectorAll('div[style*="rgb(255, 77, 79)"]').length).toBe(0));
  });

  it('downloads a CSV template for users and for lots', () => {
    const createObjectURL = jest.fn(() => 'blob:x');
    const revoke = jest.fn();
    (window.URL as any).createObjectURL = createObjectURL;
    (window.URL as any).revokeObjectURL = revoke;
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ImportSection onImported={jest.fn()} />);
    fireEvent.click(screen.getByText(/Users Template/));
    fireEvent.click(screen.getByText(/Lots Template/));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
});
