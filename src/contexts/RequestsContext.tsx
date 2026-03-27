import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { requestsApi } from '../api/requests';
import { lotsApi, LotData } from '../api/lots';

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
  allLots: LotData[];
  ownerLots: LotData[];
  loading: boolean;
  error: string | null;
  addPendingRequest: (request: Omit<ParkingRequest, 'id' | 'submittedAt' | 'status'>) => Promise<void>;
  approveRequest: (requestId: string, lotInfo?: { lotId: string; floor: string; lotOwner: string }) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  cancelUserRequest: (requestId: string) => Promise<void>;
  updateUserRequest: (requestId: string, updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endTime' | 'duration'>) => Promise<void>;
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

export const RequestsProvider: React.FC<RequestsProviderProps> = ({ children }) => {
  const [pendingRequests, setPendingRequests] = useState<ParkingRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ParkingRequest[]>([]);
  const [userRequests, setUserRequests] = useState<ParkingRequest[]>([]);
  const [allLots, setAllLots] = useState<LotData[]>([]);
  const [ownerLots, setOwnerLots] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all data from API on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [pending, approved, user, lots, myLots] = await Promise.all([
          requestsApi.getPending(),
          requestsApi.getApproved(),
          requestsApi.getByUser(CURRENT_OWNER_ID),
          lotsApi.getAll(),
          lotsApi.getByOwner(CURRENT_OWNER_NAME),
        ]);
        setPendingRequests(pending);
        setApprovedRequests(approved);
        setUserRequests(user);
        setAllLots(lots);
        setOwnerLots(myLots);
      } catch (err: any) {
        setError(err.message || 'Failed to load data from API');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addPendingRequest = async (requestData: Omit<ParkingRequest, 'id' | 'submittedAt' | 'status'>) => {
    const created = await requestsApi.create({
      requester_id:   requestData.requesterId,
      requester_name: requestData.requesterName,
      date:           requestData.date,
      start_time:     requestData.startTime,
      end_time:       requestData.endTime,
      duration:       requestData.duration,
    });
    setPendingRequests(prev => [...prev, created]);
    setUserRequests(prev => [...prev, created]);
  };

  const approveRequest = async (requestId: string, lotInfo?: { lotId: string; floor: string; lotOwner: string }) => {
    const updated = await requestsApi.approve(requestId, lotInfo ? {
      lot_id:    lotInfo.lotId,
      floor:     lotInfo.floor,
      lot_owner: lotInfo.lotOwner,
    } : undefined);
    setApprovedRequests(prev => [...prev, updated]);
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const rejectRequest = async (requestId: string) => {
    const updated = await requestsApi.reject(requestId);
    setPendingRequests(prev =>
      prev.map(r => r.id === requestId ? updated : r)
    );
    setUserRequests(prev =>
      prev.map(r => r.id === requestId ? updated : r)
    );
  };

  const cancelUserRequest = async (requestId: string) => {
    await requestsApi.cancel(requestId);
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    setUserRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const updateUserRequest = async (
    requestId: string,
    updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endTime' | 'duration'>
  ) => {
    const updated = await requestsApi.update(requestId, {
      date:       updates.date,
      start_time: updates.startTime,
      end_time:   updates.endTime,
      duration:   updates.duration,
    });
    const applyUpdate = (r: ParkingRequest) => r.id === requestId ? updated : r;
    setUserRequests(prev => prev.map(applyUpdate));
    setPendingRequests(prev => prev.map(applyUpdate));
  };

  return (
    <RequestsContext.Provider
      value={{
        pendingRequests,
        approvedRequests,
        userRequests,
        allLots,
        ownerLots,
        loading,
        error,
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
