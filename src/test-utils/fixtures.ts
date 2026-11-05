import dayjs from 'dayjs';
import { ParkingRequest } from '../contexts/RequestsContext';
import { LotData } from '../api/lots';
import { AuthUser } from '../api/auth';
import { RequestStatus, LotStatus } from '../types/enums';

let _reqCounter = 1;

// Relative dates: the UI hides requests dated before yesterday, so a hardcoded
// date makes every fixture-based test fail once that date passes.
const FIXTURE_DATE = dayjs().add(7, 'day').format('YYYY-MM-DD');
const FIXTURE_SUBMITTED_AT = dayjs().subtract(2, 'day').toISOString();

export function makeParkingRequest(overrides: Partial<ParkingRequest> = {}): ParkingRequest {
  const id = String(_reqCounter++);
  return {
    id,
    requesterId: 'user-1',
    requesterName: 'Alice Johnson',
    date: FIXTURE_DATE,
    startTime: '09:00',
    endDate: FIXTURE_DATE,
    endTime: '10:00',
    duration: 1,
    submittedAt: FIXTURE_SUBMITTED_AT,
    status: RequestStatus.PENDING,
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
    status: LotStatus.AVAILABLE,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@parking.dev',
    role: 'user',
    preferences: {
      darkMode: false,
      availabilityWindows: {},
      notificationWindows: {},
      language: 'en'
    },
    ...overrides,
  };
}

export function makeOwnerUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({ id: 'owner-1', name: 'Sarah Smith', email: 'sarah@parking.dev', role: 'owner', ...overrides });
}

export function makeManagerUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeUser({ id: 'mgr-1', name: 'Admin User', email: 'admin@parking.dev', role: 'manager', ...overrides });
}
