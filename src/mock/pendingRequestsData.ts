// Current owner ID for the mockup (to simulate owner's own requests)
export const CURRENT_OWNER_ID = 'owner-001';

export interface PendingRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  submittedAt: string;
  rejectedByOwner?: boolean;
}

export const mockPendingRequests: PendingRequest[] = [
  {
    id: 'REQ-001',
    requesterId: 'user-001',
    requesterName: 'Alice Johnson',
    date: '2026-03-24',
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    submittedAt: '2026-03-23 14:30',
  },
  {
    id: 'REQ-002',
    requesterId: 'user-002',
    requesterName: 'Bob Smith',
    date: '2026-03-24',
    startTime: '13:00',
    endTime: '15:00',
    duration: 2,
    submittedAt: '2026-03-23 15:45',
  },
  {
    id: 'REQ-003',
    requesterId: 'user-003',
    requesterName: 'Carol Williams',
    date: '2026-03-25',
    startTime: '10:00',
    endTime: '13:00',
    duration: 3,
    submittedAt: '2026-03-23 16:00',
    rejectedByOwner: true, // This request was rejected by the current owner
  },
  {
    id: 'REQ-004',
    requesterId: CURRENT_OWNER_ID,
    requesterName: 'David Chen',
    date: '2026-03-25',
    startTime: '14:00',
    endTime: '17:00',
    duration: 3,
    submittedAt: '2026-03-23 16:30',
    // This is the owner's own request - no approve/reject buttons
  },
  {
    id: 'REQ-005',
    requesterId: 'user-004',
    requesterName: 'Emma Brown',
    date: '2026-03-26',
    startTime: '08:00',
    endTime: '12:00',
    duration: 4,
    submittedAt: '2026-03-23 17:00',
  },
  {
    id: 'REQ-006',
    requesterId: 'user-005',
    requesterName: 'Frank Davis',
    date: '2026-03-26',
    startTime: '15:00',
    endTime: '18:00',
    duration: 3,
    submittedAt: '2026-03-23 17:15',
  },
];
