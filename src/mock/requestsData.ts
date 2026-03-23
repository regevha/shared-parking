export interface ParkingRequest {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
}

export const mockRequestsData: ParkingRequest[] = [
  {
    id: 'REQ-001',
    userId: 'user-001',
    date: '2026-03-23',
    startTime: '09:00',
    endTime: '11:00',
    status: 'active',
    createdAt: '2026-03-22 14:30',
  },
  {
    id: 'REQ-002',
    userId: 'user-001',
    date: '2026-03-24',
    startTime: '14:00',
    endTime: '17:00',
    status: 'pending',
    createdAt: '2026-03-22 15:45',
  },
  {
    id: 'REQ-003',
    userId: 'user-001',
    date: '2026-03-25',
    startTime: '10:00',
    endTime: '13:00',
    status: 'approved',
    createdAt: '2026-03-22 16:00',
  },
  {
    id: 'REQ-004',
    userId: 'user-002',
    date: '2026-03-23',
    startTime: '08:00',
    endTime: '12:00',
    status: 'active',
    createdAt: '2026-03-21 10:20',
  },
  {
    id: 'REQ-005',
    userId: 'user-002',
    date: '2026-03-26',
    startTime: '15:00',
    endTime: '18:00',
    status: 'pending',
    createdAt: '2026-03-22 11:30',
  },
  {
    id: 'REQ-006',
    userId: 'user-003',
    date: '2026-03-23',
    startTime: '13:00',
    endTime: '16:00',
    status: 'approved',
    createdAt: '2026-03-20 09:15',
  },
];
