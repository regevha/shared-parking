import {
  getStatusColor,
  getStatusLabel,
  getLotStatusTagColor,
  getRequestStatusColor,
  getRequestStatusLabel,
} from '../statusUtils';
import { LotStatus } from '../../types';

// ── getStatusColor ───────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green hex for available', () => {
    expect(getStatusColor('available')).toBe('#52c41a');
  });

  it('returns red hex for blocked', () => {
    expect(getStatusColor('blocked')).toBe('#ff4d4f');
  });

  it('returns grey hex for unowned', () => {
    expect(getStatusColor('unowned')).toBe('#d9d9d9');
  });

  it('returns amber hex for unowned-blocked', () => {
    expect(getStatusColor('unowned-blocked')).toBe('#faad14');
  });

  it('returns grey hex for unknown value', () => {
    expect(getStatusColor('mystery' as LotStatus)).toBe('#d9d9d9');
  });
});

// ── getStatusLabel ───────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it.each<[LotStatus, string]>([
    ['available',       'Available'],
    ['blocked',         'Blocked'],
    ['unowned',         'Unowned'],
    ['unowned-blocked', 'Unowned-Blocked'],
  ])('returns %s label for %s status', (status, expected) => {
    expect(getStatusLabel(status)).toBe(expected);
  });

  it('returns "Unknown" for unrecognised status', () => {
    expect(getStatusLabel('future-status' as LotStatus)).toBe('Unknown');
  });
});

// ── getLotStatusTagColor ─────────────────────────────────────────────────────

describe('getLotStatusTagColor', () => {
  it('returns green tag for available', () => {
    expect(getLotStatusTagColor('available')).toBe('green');
  });

  it('returns red tag for blocked', () => {
    expect(getLotStatusTagColor('blocked')).toBe('red');
  });

  it('returns default tag for unowned', () => {
    expect(getLotStatusTagColor('unowned')).toBe('default');
  });

  it('returns orange tag for unowned-blocked', () => {
    expect(getLotStatusTagColor('unowned-blocked')).toBe('orange');
  });

  it('returns default tag for unknown status', () => {
    expect(getLotStatusTagColor('whatever' as LotStatus)).toBe('default');
  });
});

// ── getRequestStatusColor ────────────────────────────────────────────────────

describe('getRequestStatusColor', () => {
  it.each([
    ['approved',  'green'],
    ['pending',   'blue'],
    ['rejected',  'red'],
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
    expect(getRequestStatusColor('pending')).toBe('blue');
  });
});

// ── getRequestStatusLabel ────────────────────────────────────────────────────

describe('getRequestStatusLabel', () => {
  it.each([
    ['approved',  'Approved'],
    ['pending',   'Pending'],
    ['rejected',  'Rejected'],
    ['expired',   'Expired'],
    ['cancelled', 'Cancelled'],
  ])('returns %s label for %s status', (status, expected) => {
    expect(getRequestStatusLabel(status)).toBe(expected);
  });

  it('returns the raw status string for unknown values', () => {
    expect(getRequestStatusLabel('some-new-status')).toBe('some-new-status');
  });
});
