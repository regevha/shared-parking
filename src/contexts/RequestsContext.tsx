import React, { createContext, useContext, useState, ReactNode } from 'react';

export const CURRENT_OWNER_ID = 'owner-001';

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
  approveRequest: (requestId: string) => void;
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

// Initial mock data
const initialPendingRequests: ParkingRequest[] = [
  {
    id: '1',
    requesterId: 'user1',
    requesterName: 'John Doe',
    date: '2026-03-25',
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    submittedAt: '2026-03-23T10:30:00Z',
    status: 'pending',
  },
  {
    id: '2',
    requesterId: 'user2',
    requesterName: 'Jane Smith',
    date: '2026-03-26',
    startTime: '14:00',
    endTime: '16:00',
    duration: 2,
    submittedAt: '2026-03-23T11:15:00Z',
    status: 'pending',
  },
  {
    id: '3',
    requesterId: 'user3',
    requesterName: 'Bob Johnson',
    date: '2026-03-27',
    startTime: '10:00',
    endTime: '13:00',
    duration: 3,
    submittedAt: '2026-03-23T12:00:00Z',
    status: 'pending',
  },
  {
    id: '4',
    requesterId: 'user4',
    requesterName: 'Alice Brown',
    date: '2026-03-28',
    startTime: '15:00',
    endTime: '17:00',
    duration: 2,
    submittedAt: '2026-03-23T13:45:00Z',
    status: 'pending',
    rejectedByOwner: true,
  },
  {
    id: '5',
    requesterId: 'owner1',
    requesterName: 'Owner One',
    date: '2026-03-29',
    startTime: '08:00',
    endTime: '12:00',
    duration: 4,
    submittedAt: '2026-03-23T14:20:00Z',
    status: 'pending',
  },
];

const initialApprovedRequests: ParkingRequest[] = [
  {
    id: '6',
    requesterId: 'user5',
    requesterName: 'Charlie Wilson',
    date: '2026-03-20',
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    submittedAt: '2026-03-18T09:00:00Z',
    status: 'approved',
    lotId: 'LOT-001',
    floor: 'Floor 1',
    lotOwner: 'Owner One',
    approvedAt: '2026-03-19T10:00:00Z',
  },
  {
    id: '7',
    requesterId: 'user6',
    requesterName: 'Diana Prince',
    date: '2026-03-21',
    startTime: '13:00',
    endTime: '15:00',
    duration: 2,
    submittedAt: '2026-03-19T10:30:00Z',
    status: 'approved',
    lotId: 'LOT-002',
    floor: 'Floor 2',
    lotOwner: 'Owner Two',
    approvedAt: '2026-03-20T11:00:00Z',
  },
];

const initialUserRequests: ParkingRequest[] = [
  {
    id: '8',
    requesterId: 'current-user',
    requesterName: 'Current User',
    date: '2026-03-25',
    startTime: '09:00',
    endTime: '11:00',
    duration: 2,
    submittedAt: '2026-03-23T08:00:00Z',
    status: 'pending',
  },
  {
    id: '9',
    requesterId: 'current-user',
    requesterName: 'Current User',
    date: '2026-03-22',
    startTime: '14:00',
    endTime: '16:00',
    duration: 2,
    submittedAt: '2026-03-20T15:30:00Z',
    status: 'approved',
  },
  {
    id: '10',
    requesterId: 'current-user',
    requesterName: 'Current User',
    date: '2026-03-19',
    startTime: '10:00',
    endTime: '12:00',
    duration: 2,
    submittedAt: '2026-03-17T12:00:00Z',
    status: 'rejected',
  },
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

  const approveRequest = (requestId: string) => {
    setPendingRequests(prev =>
      prev.map(req =>
        req.id === requestId ? { ...req, status: 'approved' } : req
      )
    );

    const approvedRequest = pendingRequests.find(req => req.id === requestId);
    if (approvedRequest) {
      const resolvedApprovedRequest: ParkingRequest = {
        ...approvedRequest,
        status: 'approved' as const,
        approvedAt: new Date().toISOString(),
        lotId: approvedRequest.lotId || 'LOT-100',
        floor: approvedRequest.floor || 'Floor 1',
        lotOwner: approvedRequest.lotOwner || 'System Assigned',
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