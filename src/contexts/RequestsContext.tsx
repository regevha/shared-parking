import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { requestsApi } from '../api/requests';
import { lotsApi, LotData } from '../api/lots';
import { useAuth } from './AuthContext';
import { RequestStatus } from '../types/enums';

export interface ParkingRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole?: string;
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  duration: number;
  submittedAt: string;
  status: RequestStatus;
  rejectedByOwner?: boolean;
  lotId?: string;
  floor?: string;
  lotOwner?: string;
  approvedAt?: string;
  approvedBy?: string;
  updatedAt?: string;
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
  updateUserRequest: (requestId: string, updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endDate' | 'endTime' | 'duration'>) => Promise<void>;
}

export const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

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
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [pendingRequests, setPendingRequests] = useState<ParkingRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ParkingRequest[]>([]);
  const [userRequests, setUserRequests] = useState<ParkingRequest[]>([]);
  const [allLots, setAllLots] = useState<LotData[]>([]);
  const [ownerLots, setOwnerLots] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-load whenever the authenticated user changes
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const commonLoads = [
          requestsApi.getPending(),
          requestsApi.getApproved(),
          requestsApi.getMe(),   // server-scoped to current user
          lotsApi.getAll(),
        ] as const;

        if (isOwner) {
          const [pending, approved, mine, lots, myLots] = await Promise.all([
            ...commonLoads,
            lotsApi.getMine(),   // server-scoped to owner
          ]);
          setPendingRequests(pending);
          setApprovedRequests(approved);
          setUserRequests(mine);
          setAllLots(lots);
          setOwnerLots(myLots);
        } else {
          const [pending, approved, mine, lots] = await Promise.all(commonLoads);
          setPendingRequests(pending);
          setApprovedRequests(approved);
          setUserRequests(mine);
          setAllLots(lots);
          setOwnerLots([]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data from API');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPendingRequest = async (requestData: Omit<ParkingRequest, 'id' | 'submittedAt' | 'status'>) => {
    const created = await requestsApi.create({
      requester_id:   requestData.requesterId,
      requester_name: requestData.requesterName,
      date:           requestData.date,
      start_time:     requestData.startTime,
      end_date:       requestData.endDate,
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
    updates: Pick<ParkingRequest, 'date' | 'startTime' | 'endDate' | 'endTime' | 'duration'>
  ) => {
    const updated = await requestsApi.update(requestId, {
      date:       updates.date,
      start_time: updates.startTime,
      end_date:   updates.endDate,
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
