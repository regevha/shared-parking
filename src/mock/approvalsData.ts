export interface Approval {
  id: string;
  requesterName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  lotId: string;
  floor: string;
  lotOwner: string;
  approvedAt: string;
  submittedAt: string;
}

// Mirrors initialApprovedRequests in RequestsContext — keep in sync
export const mockApprovalsData: Approval[] = [
  { id: 'REQ-001', requesterName: 'Alice Johnson',  date: '2026-03-24', startTime: '09:00', endTime: '11:00', duration: 2, lotId: 'F2-003', floor: 'F2 - Level 1',     lotOwner: 'Lisa Anderson',  approvedAt: '2026-03-22 16:45', submittedAt: '2026-03-22 14:30' },
  { id: 'REQ-002', requesterName: 'Bob Smith',      date: '2026-03-24', startTime: '13:00', endTime: '15:00', duration: 2, lotId: 'F1-002', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',  approvedAt: '2026-03-22 10:15', submittedAt: '2026-03-22 09:45' },
  { id: 'REQ-003', requesterName: 'Carol Williams', date: '2026-03-26', startTime: '10:00', endTime: '13:00', duration: 3, lotId: 'F3-005', floor: 'F3 - Level 2',     lotOwner: 'Jennifer Lee',   approvedAt: '2026-03-23 11:30', submittedAt: '2026-03-23 10:00' },
  { id: 'REQ-004', requesterName: 'Frank Davis',    date: '2026-03-27', startTime: '15:00', endTime: '18:00', duration: 3, lotId: 'F2-001', floor: 'F2 - Level 1',     lotOwner: 'David Wilson',   approvedAt: '2026-03-23 14:20', submittedAt: '2026-03-23 13:15' },
  { id: 'REQ-005', requesterName: 'Emma Brown',     date: '2026-03-24', startTime: '08:00', endTime: '12:00', duration: 4, lotId: 'F1-004', floor: 'F1 - Ground Floor', lotOwner: 'Mike Chen',      approvedAt: '2026-03-22 16:00', submittedAt: '2026-03-22 15:30' },
  { id: 'REQ-006', requesterName: 'George Miller',  date: '2026-03-25', startTime: '14:00', endTime: '17:00', duration: 3, lotId: 'F3-001', floor: 'F3 - Level 2',     lotOwner: 'Patricia Brown', approvedAt: '2026-03-23 09:45', submittedAt: '2026-03-23 09:00' },
  { id: 'REQ-007', requesterName: 'Helen Garcia',   date: '2026-03-26', startTime: '11:00', endTime: '13:00', duration: 2, lotId: 'F2-004', floor: 'F2 - Level 1',     lotOwner: 'James Taylor',   approvedAt: '2026-03-23 12:30', submittedAt: '2026-03-23 11:45' },
  { id: 'REQ-008', requesterName: 'Tom Harris',     date: '2026-03-26', startTime: '09:00', endTime: '11:00', duration: 2, lotId: 'F1-001', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',  approvedAt: '2026-03-24 08:30', submittedAt: '2026-03-24 08:00' },
  { id: 'REQ-009', requesterName: 'Nina Patel',     date: '2026-03-27', startTime: '14:00', endTime: '17:00', duration: 3, lotId: 'F1-006', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',  approvedAt: '2026-03-24 11:00', submittedAt: '2026-03-24 10:30' },
];
