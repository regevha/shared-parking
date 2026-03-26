import React, { createContext, useContext, useState, ReactNode } from 'react';

export const CURRENT_OWNER_ID = 'owner-001';
export const CURRENT_OWNER_NAME = 'Sarah Johnson';

export interface ParkingRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectedByOwner?: boolean;
  lotId?: string;
  floor?: string;
  lotOwner?: string;
  approvedAt?: string;
}

interface RequestsContextType {
  pendingRequests: ParkingRequest[];
  approvedRequests: ParkingRequest[];
  userRequests: ParkingRequest[];
  addPendingRequest: (request: Omit<ParkingRequest, 'id' | 'submittedAt' | 'status'>) => void;
  approveRequest: (requestId: string, lotInfo?: { lotId: string; floor: string; lotOwner: string }) => void;
  rejectRequest: (requestId: string) => void;
  cancelUserRequest: (requestId: string) => void;
  updateUserRequest: (requestId: string, updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endTime' | 'duration'>) => void;
}

const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export const useRequests = () => {
  const context = useContext(RequestsContext);
  if (!context) {
    throw new Error('useRequests must be used within a RequestsProvider');
  }
  return context;
};

interface RequestsProviderProps {
  children: ReactNode;
}

// Initial mock data — IDs REQ-001..REQ-009 = approved, REQ-010..REQ-015 = pending, REQ-016..REQ-017 = user history
const initialPendingRequests: ParkingRequest[] = [
  { id: 'REQ-010', requesterId: 'user-001', requesterName: 'Alice Johnson',  date: '2026-03-28', startTime: '09:00', endTime: '11:00', duration: 2, submittedAt: '2026-03-25T14:30:00Z', status: 'pending' },
  { id: 'REQ-011', requesterId: 'user-002', requesterName: 'Bob Smith',      date: '2026-03-29', startTime: '13:00', endTime: '15:00', duration: 2, submittedAt: '2026-03-25T15:45:00Z', status: 'pending' },
  { id: 'REQ-012', requesterId: 'user-003', requesterName: 'Carol Williams', date: '2026-03-29', startTime: '10:00', endTime: '13:00', duration: 3, submittedAt: '2026-03-25T16:00:00Z', status: 'pending', rejectedByOwner: true },
  { id: 'REQ-013', requesterId: CURRENT_OWNER_ID, requesterName: CURRENT_OWNER_NAME, date: '2026-03-30', startTime: '14:00', endTime: '17:00', duration: 3, submittedAt: '2026-03-25T16:30:00Z', status: 'pending' },
  { id: 'REQ-014', requesterId: 'user-004', requesterName: 'Emma Brown',     date: '2026-03-30', startTime: '08:00', endTime: '12:00', duration: 4, submittedAt: '2026-03-26T09:00:00Z', status: 'pending' },
  { id: 'REQ-015', requesterId: 'user-005', requesterName: 'Frank Davis',    date: '2026-03-31', startTime: '15:00', endTime: '18:00', duration: 3, submittedAt: '2026-03-26T10:00:00Z', status: 'pending' },
];

const initialApprovedRequests: ParkingRequest[] = [
  { id: 'REQ-001', requesterId: 'user-001', requesterName: 'Alice Johnson',  date: '2026-03-24', startTime: '09:00', endTime: '11:00', duration: 2, submittedAt: '2026-03-22T14:30:00Z', status: 'approved', lotId: 'F2-003', floor: 'F2 - Level 1',     lotOwner: 'Lisa Anderson',       approvedAt: '2026-03-22T16:45:00Z' },
  { id: 'REQ-002', requesterId: 'user-002', requesterName: 'Bob Smith',      date: '2026-03-24', startTime: '13:00', endTime: '15:00', duration: 2, submittedAt: '2026-03-22T09:45:00Z', status: 'approved', lotId: 'F1-002', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',       approvedAt: '2026-03-22T10:15:00Z' },
  { id: 'REQ-003', requesterId: 'user-003', requesterName: 'Carol Williams', date: '2026-03-26', startTime: '10:00', endTime: '13:00', duration: 3, submittedAt: '2026-03-23T10:00:00Z', status: 'approved', lotId: 'F3-005', floor: 'F3 - Level 2',     lotOwner: 'Jennifer Lee',        approvedAt: '2026-03-23T11:30:00Z' },
  { id: 'REQ-004', requesterId: 'user-005', requesterName: 'Frank Davis',    date: '2026-03-27', startTime: '15:00', endTime: '18:00', duration: 3, submittedAt: '2026-03-23T13:15:00Z', status: 'approved', lotId: 'F2-001', floor: 'F2 - Level 1',     lotOwner: 'David Wilson',        approvedAt: '2026-03-23T14:20:00Z' },
  { id: 'REQ-005', requesterId: 'user-004', requesterName: 'Emma Brown',     date: '2026-03-24', startTime: '08:00', endTime: '12:00', duration: 4, submittedAt: '2026-03-22T15:30:00Z', status: 'approved', lotId: 'F1-004', floor: 'F1 - Ground Floor', lotOwner: 'Mike Chen',           approvedAt: '2026-03-22T16:00:00Z' },
  { id: 'REQ-006', requesterId: 'user-006', requesterName: 'George Miller',  date: '2026-03-25', startTime: '14:00', endTime: '17:00', duration: 3, submittedAt: '2026-03-23T09:00:00Z', status: 'approved', lotId: 'F3-001', floor: 'F3 - Level 2',     lotOwner: 'Patricia Brown',      approvedAt: '2026-03-23T09:45:00Z' },
  { id: 'REQ-007', requesterId: 'user-007', requesterName: 'Helen Garcia',   date: '2026-03-26', startTime: '11:00', endTime: '13:00', duration: 2, submittedAt: '2026-03-23T11:45:00Z', status: 'approved', lotId: 'F2-004', floor: 'F2 - Level 1',     lotOwner: 'James Taylor',        approvedAt: '2026-03-23T12:30:00Z' },
  { id: 'REQ-008', requesterId: 'user-008', requesterName: 'Tom Harris',     date: '2026-03-26', startTime: '09:00', endTime: '11:00', duration: 2, submittedAt: '2026-03-24T08:00:00Z', status: 'approved', lotId: 'F1-001', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',       approvedAt: '2026-03-24T08:30:00Z' },
  { id: 'REQ-009', requesterId: 'user-009', requesterName: 'Nina Patel',     date: '2026-03-27', startTime: '14:00', endTime: '17:00', duration: 3, submittedAt: '2026-03-24T10:30:00Z', status: 'approved', lotId: 'F1-006', floor: 'F1 - Ground Floor', lotOwner: 'Sarah Johnson',       approvedAt: '2026-03-24T11:00:00Z' },
];

// Current user (Sarah Johnson) own parking requests at other people's lots
const initialUserRequests: ParkingRequest[] = [
  { id: 'REQ-013', requesterId: CURRENT_OWNER_ID, requesterName: CURRENT_OWNER_NAME, date: '2026-03-30', startTime: '14:00', endTime: '17:00', duration: 3, submittedAt: '2026-03-25T16:30:00Z', status: 'pending' },
  { id: 'REQ-016', requesterId: CURRENT_OWNER_ID, requesterName: CURRENT_OWNER_NAME, date: '2026-03-22', startTime: '14:00', endTime: '16:00', duration: 2, submittedAt: '2026-03-21T10:00:00Z', status: 'approved', lotId: 'F3-003', floor: 'F3 - Level 2', lotOwner: 'Robert Garcia', approvedAt: '2026-03-21T11:00:00Z' },
  { id: 'REQ-017', requesterId: CURRENT_OWNER_ID, requesterName: CURRENT_OWNER_NAME, date: '2026-03-19', startTime: '10:00', endTime: '12:00', duration: 2, submittedAt: '2026-03-17T12:00:00Z', status: 'rejected', lotId: 'F2-001', floor: 'F2 - Level 1', lotOwner: 'David Wilson' },
];

export const RequestsProvider: React.FC<RequestsProviderProps> = ({ children }) => {
  const [pendingRequests, setPendingRequests] = useState<ParkingRequest[]>(initialPendingRequests);
  const [approvedRequests, setApprovedRequests] = useState<ParkingRequest[]>(initialApprovedRequests);
  const [userRequests, setUserRequests] = useState<ParkingRequest[]>(initialUserRequests);

  const addPendingRequest = (requestData: Omit<ParkingRequest, 'id' | 'submittedAt' | 'status'>) => {
    const newRequest: ParkingRequest = {
      ...requestData,
      id: Date.now().toString(),
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    setPendingRequests(prev => [...prev, newRequest]);
    setUserRequests(prev => [...prev, newRequest]);
  };

  const approveRequest = (requestId: string, lotInfo?: { lotId: string; floor: string; lotOwner: string }) => {
    const approvedRequest = pendingRequests.find(req => req.id === requestId);
    if (approvedRequest) {
      const resolvedApprovedRequest: ParkingRequest = {
        ...approvedRequest,
        status: 'approved' as const,
        approvedAt: new Date().toISOString(),
        lotId: lotInfo?.lotId || approvedRequest.lotId || 'LOT-100',
        floor: lotInfo?.floor || approvedRequest.floor || 'Floor 1',
        lotOwner: lotInfo?.lotOwner || approvedRequest.lotOwner || 'System Assigned',
      };
      setApprovedRequests(prev => [...prev, resolvedApprovedRequest]);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    }
  };

  const rejectRequest = (requestId: string) => {
    setPendingRequests(prev =>
      prev.map(req =>
        req.id === requestId ? { ...req, status: 'rejected' } : req
      )
    );

    const rejectedRequest = pendingRequests.find(req => req.id === requestId);
    if (rejectedRequest) {
      setUserRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: 'rejected' } : req
        )
      );
    }
  };

  const cancelUserRequest = (requestId: string) => {
    setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    setUserRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const updateUserRequest = (requestId: string, updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endTime' | 'duration'>) => {
    const applyUpdate = (req: ParkingRequest) =>
      req.id === requestId ? { ...req, ...updates } : req;
    setUserRequests(prev => prev.map(applyUpdate));
    setPendingRequests(prev => prev.map(applyUpdate));
  };

  return (
    <RequestsContext.Provider
      value={{
        pendingRequests,
        approvedRequests,
        userRequests,
        addPendingRequest,
        approveRequest,
        rejectRequest,
        cancelUserRequest,
        updateUserRequest,
      }}
    >
      {children}
    </RequestsContext.Provider>
  );
};