import { FloorData } from '../types';

export const mockLotsData: FloorData[] = [
  {
    floor: 'F1 - Ground Floor',
    lots: [
      { id: 'F1-001', floor: 'F1', owner: 'Sarah Johnson', status: 'available' },
      { id: 'F1-002', floor: 'F1', owner: 'Sarah Johnson', status: 'blocked', blockedUntil: '2026-03-28 14:00' },
      { id: 'F1-003', floor: 'F1', owner: null, status: 'unowned' },
      { id: 'F1-004', floor: 'F1', owner: 'Mike Chen', status: 'available' },
      { id: 'F1-005', floor: 'F1', owner: null, status: 'unowned-blocked', blockedUntil: '2026-03-29 10:00' },
      { id: 'F1-006', floor: 'F1', owner: 'Sarah Johnson', status: 'available' },
    ],
  },
  {
    floor: 'F2 - Level 1',
    lots: [
      { id: 'F2-001', floor: 'F2', owner: 'David Wilson', status: 'available' },
      { id: 'F2-002', floor: 'F2', owner: null, status: 'unowned' },
      { id: 'F2-003', floor: 'F2', owner: 'Lisa Anderson', status: 'blocked', blockedUntil: '2026-03-28 09:30' },
      { id: 'F2-004', floor: 'F2', owner: 'James Taylor', status: 'available' },
      { id: 'F2-005', floor: 'F2', owner: null, status: 'unowned-blocked', blockedUntil: '2026-03-30 18:00' },
    ],
  },
  {
    floor: 'F3 - Level 2',
    lots: [
      { id: 'F3-001', floor: 'F3', owner: 'Patricia Brown', status: 'available' },
      { id: 'F3-002', floor: 'F3', owner: null, status: 'unowned' },
      { id: 'F3-003', floor: 'F3', owner: 'Robert Garcia', status: 'available' },
      { id: 'F3-004', floor: 'F3', owner: null, status: 'unowned-blocked', blockedUntil: '2026-03-28 16:30' },
      { id: 'F3-005', floor: 'F3', owner: 'Jennifer Lee', status: 'blocked', blockedUntil: '2026-03-29 11:00' },
      { id: 'F3-006', floor: 'F3', owner: 'Christopher Martinez', status: 'available' },
    ],
  },
];
