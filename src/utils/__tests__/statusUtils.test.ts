import {
  getStatusColor,
  getStatusLabel,
  getLotStatusTagColor,
  getRequestStatusColor,
  getRequestStatusLabel,
} from '../statusUtils';
import { LotStatus, RequestStatus } from '../../types/enums';

// ── getStatusColor ───────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green hex for available', () => {
    expect(getStatusColor(LotStatus.AVAILABLE)).toBe('#52c41a');
  });

  it('returns red hex for blocked', () => {
    expect(getStatusColor(LotStatus.BLOCKED)).toBe('#ff4d4f');
  });

  it('returns grey hex for unowned', () => {
    expect(getStatusColor(LotStatus.UNOWNED)).toBe('#d9d9d9');
  });

  it('returns amber hex for unowned-blocked', () => {
    expect(getStatusColor(LotStatus.UNOWNED_BLOCKED)).toBe('#faad14');
  });

  it('returns grey hex for unknown value', () => {
    expect(getStatusColor('mystery' as LotStatus)).toBe('#d9d9d9');
  });
});

// ── getStatusLabel ───────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it.each<[LotStatus, string]>([
    [LotStatus.AVAILABLE,       'lotStatusBoard.legend.available'],
    [LotStatus.BLOCKED,         'lotStatusBoard.legend.blocked'],
    [LotStatus.UNOWNED,         'lotStatusBoard.legend.unowned'],
    [LotStatus.UNOWNED_BLOCKED, 'lotStatusBoard.legend.unownedBlocked'],
  ])('returns %s label for %s status', (status, expected) => {
    expect(getStatusLabel(status)).toBe(expected);
  });

  it('returns "status.unknown" for unrecognised status', () => {
    expect(getStatusLabel('future-status' as LotStatus)).toBe('status.unknown');
  });
});

// ── getLotStatusTagColor ─────────────────────────────────────────────────────

describe('getLotStatusTagColor', () => {
  it('returns green tag for available', () => {
    expect(getLotStatusTagColor(LotStatus.AVAILABLE)).toBe('green');
  });

  it('returns red tag for blocked', () => {
    expect(getLotStatusTagColor(LotStatus.BLOCKED)).toBe('red');
  });

  it('returns default tag for unowned', () => {
    expect(getLotStatusTagColor(LotStatus.UNOWNED)).toBe('default');
  });

  it('returns orange tag for unowned-blocked', () => {
    expect(getLotStatusTagColor(LotStatus.UNOWNED_BLOCKED)).toBe('orange');
  });

  it('returns default tag for unknown status', () => {
    expect(getLotStatusTagColor('whatever' as LotStatus)).toBe('default');
  });
});

// ── getRequestStatusColor ────────────────────────────────────────────────────

describe('getRequestStatusColor', () => {
  it.each([
    [RequestStatus.APPROVED,  'green'],
    [RequestStatus.PENDING,   'blue'],
    [RequestStatus.REJECTED,  'red'],
    ['expired',   'orange'],
    ['cancelled', 'default'],
  ])('returns %s for %s status', (status, expected) => {
    expect(getRequestStatusColor(status)).toBe(expected);
  });

  it('returns default for unknown status', () => {
    expect(getRequestStatusColor('archived')).toBe('default');
  });

  // Guard: pending must be blue, NOT orange — this was a real bug in LotCalendarView
  it('pending is blue (not orange)', () => {
    expect(getRequestStatusColor(RequestStatus.PENDING)).toBe('blue');
  });
});

// ── getRequestStatusLabel ────────────────────────────────────────────────────

describe('getRequestStatusLabel', () => {
  it.each([
    [RequestStatus.APPROVED,  'calendarView.legend.approved'],
    [RequestStatus.PENDING,   'calendarView.legend.pending'],
    [RequestStatus.REJECTED,  'calendarView.legend.rejected'],
    ['expired',   'calendarView.legend.expired'],
    ['cancelled', 'calendarView.legend.cancelled'],
  ])('returns %s label for %s status', (status, expected) => {
    expect(getRequestStatusLabel(status)).toBe(expected);
  });

  it('returns the raw status string for unknown values', () => {
    expect(getRequestStatusLabel('some-new-status')).toBe('some-new-status');
  });
});
