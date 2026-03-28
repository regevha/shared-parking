import { ParkingRequest } from '../contexts/RequestsContext';
import { LotData } from '../api/lots';
import { AuthUser } from '../api/auth';

let _reqCounter = 1;

export function makeParkingRequest(overrides: Partial<ParkingRequest> = {}): ParkingRequest {
  const id = String(_reqCounter++);
  return {
    id,
    requesterId: 'user-1',
    requesterName: 'Alice Johnson',
    date: '2026-04-10',
    startTime: '09:00',
    endTime: '10:00',
    duration: 1,
    submittedAt: '2026-03-28T08:00:00Z',
    status: 'pending',
    rejectedByOwner: false,
    ...overrides,
  };
}

export function makeLot(overrides: Partial<LotData> = {}): LotData {
  return {
    id: 'A-01',
    floor: 'A',
    floorLabel: 'Floor A',
    owner: 'Sarah',
    ownerId: 'owner-1',
    status: 'available',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@parking.dev',
    role: 'user',
    preferences: { darkMode: false },
    ...overrides,
  };
}

export function makeOwnerUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({ id: 'owner-1', name: 'Sarah Smith', email: 'sarah@parking.dev', role: 'owner', ...overrides });
}

export function makeManagerUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({ id: 'mgr-1', name: 'Admin User', email: 'admin@parking.dev', role: 'manager', ...overrides });
}
