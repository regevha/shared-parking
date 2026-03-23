export interface UserRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'pending' | 'approved' | 'expired';
  submittedAt: string;
}

export const mockUserRequests: UserRequest[] = [
  {
    id: 'REQ-001',
    date: '2026-03-24',
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    status: 'pending',
    submittedAt: '2026-03-23 14:30',
  },
  {
    id: 'REQ-002',
    date: '2026-03-25',
    startTime: '13:00',
    endTime: '16:00',
    duration: 3,
    status: 'approved',
    submittedAt: '2026-03-23 15:45',
  },
  {
    id: 'REQ-003',
    date: '2026-03-26',
    startTime: '10:00',
    endTime: '13:00',
    duration: 3,
    status: 'pending',
    submittedAt: '2026-03-23 16:00',
  },
  {
    id: 'REQ-004',
    date: '2026-03-22',
    startTime: '14:00',
    endTime: '17:00',
    duration: 3,
    status: 'expired', // This will be hidden from the UI
    submittedAt: '2026-03-21 10:30',
  },
];
