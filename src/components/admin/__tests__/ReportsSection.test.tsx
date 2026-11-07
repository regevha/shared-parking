import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { notification } from 'antd';
import * as XLSX from 'xlsx';
import ReportsSection from '../ReportsSection';
import { makeParkingRequest } from '../../../test-utils/fixtures';
import { RequestStatus } from '../../../types/enums';

jest.mock('xlsx', () => ({
  utils: { json_to_sheet: jest.fn(() => ({})), book_new: jest.fn(() => ({})), book_append_sheet: jest.fn() },
  writeFile: jest.fn(),
}));

const requests = [
  makeParkingRequest({ id: 'r2', requesterName: 'Bob Brown', date: '2026-03-12', startTime: '10:00', status: RequestStatus.APPROVED }),
  makeParkingRequest({ id: 'r1', requesterName: 'Alice Johnson', date: '2026-03-10', startTime: '09:00', status: RequestStatus.PENDING }),
  makeParkingRequest({ id: 'r3', requesterName: 'Carol Cole', date: '2026-03-11', startTime: '08:00', status: RequestStatus.REJECTED }),
];

beforeEach(() => {
  jest.clearAllMocks();
  (XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({});
  (XLSX.utils.book_new as jest.Mock).mockReturnValue({});
  jest.spyOn(notification, 'success').mockImplementation(() => {});
});

describe('ReportsSection', () => {
  it('shows per-status tab counts', () => {
    render(<ReportsSection requests={requests} loading={false} />);
    expect(screen.getByRole('tab', { name: 'All (3)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pending (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Approved (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rejected (1)' })).toBeInTheDocument();
  });

  it('lists requests sorted by date then start time', () => {
    render(<ReportsSection requests={requests} loading={false} />);
    const rows = screen.getAllByRole('row').slice(1);
    const names = rows.map(r => within(r).queryByText(/Alice|Bob|Carol/)?.textContent);
    expect(names).toEqual(['Alice Johnson', 'Carol Cole', 'Bob Brown']);
  });

  it('shows only the matching requests in a status tab', () => {
    render(<ReportsSection requests={requests} loading={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rejected (1)' }));
    expect(screen.getAllByText('Carol Cole').length).toBeGreaterThan(0);
  });

  it('exports the filtered rows to an .xlsx file and confirms', () => {
    render(<ReportsSection requests={requests} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /export to excel/i }));
    expect((XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0]).toHaveLength(3);
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^parking-requests-\d{4}-\d{2}-\d{2}\.xlsx$/));
    expect(notification.success).toHaveBeenCalled();
  });

  it('disables export when there are no requests', () => {
    render(<ReportsSection requests={[]} loading={false} />);
    expect(screen.getByRole('button', { name: /export to excel/i })).toBeDisabled();
  });
});
