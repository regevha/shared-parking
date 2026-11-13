import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  buildMobileWeekEvents, isClusterEvent, ClusterEvent, ClusterSheet, MobileWeekEvent, WeekEventBase, clusterEventStyle,
} from '../mobileWeek';
import { EVENT_FILL } from '../../../utils/calendarColors';

const ev = (id: string, from: string, to: string, day = '2026-11-14', endDay = day): WeekEventBase => ({
  id,
  title: `Event ${id}`,
  shortTitle: id,
  start: new Date(`${day}T${from}:00`),
  end: new Date(`${endDay}T${to}:00`),
});

describe('buildMobileWeekEvents', () => {
  it('marks an event with no overlap as full width', () => {
    const [only] = buildMobileWeekEvents([ev('a', '09:00', '11:00')]);
    expect(isClusterEvent(only)).toBe(false);
    expect((only as any).fullWidth).toBe(true);
  });

  it('keeps two overlapping events side by side, without the full-width flag', () => {
    const out = buildMobileWeekEvents([ev('a', '09:00', '11:00'), ev('b', '10:00', '12:00')]);
    expect(out.map(e => e.id).sort()).toEqual(['a', 'b']);
    expect(out.some(e => (e as any).fullWidth)).toBe(false);
  });

  it('collapses three simultaneous events into one cluster spanning them all', () => {
    const out = buildMobileWeekEvents([ev('a', '09:00', '11:00'), ev('b', '10:00', '13:00'), ev('c', '10:30', '12:00')]);
    expect(out).toHaveLength(1);
    const cluster = out[0] as ClusterEvent<WeekEventBase>;
    expect(isClusterEvent(cluster)).toBe(true);
    expect(cluster.members.map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(cluster.start).toEqual(new Date('2026-11-14T09:00:00'));
    expect(cluster.end).toEqual(new Date('2026-11-14T13:00:00'));
  });

  it('does not cluster a chain that never has more than two at once', () => {
    const out = buildMobileWeekEvents([ev('a', '08:00', '10:00'), ev('b', '09:00', '11:00'), ev('c', '10:00', '12:00')]);
    expect(out.some(isClusterEvent)).toBe(false);
    expect(out).toHaveLength(3);
  });

  it('treats back-to-back events as separate, full-width events', () => {
    const out = buildMobileWeekEvents([ev('a', '08:00', '12:00'), ev('b', '12:00', '14:00')]);
    expect(out).toHaveLength(2);
    expect(out.every(e => (e as any).fullWidth)).toBe(true);
  });

  it('clusters each day on its own', () => {
    const busy = ['a', 'b', 'c'].map(id => ev(id, '09:00', '11:00', '2026-11-14'));
    const out = buildMobileWeekEvents([...busy, ev('d', '09:00', '11:00', '2026-11-15')]);
    expect(out.filter(isClusterEvent)).toHaveLength(1);
    expect(out.find(e => e.id === 'd')).toMatchObject({ fullWidth: true });
  });

  it('passes multi-day events through untouched and accepts an end at midnight', () => {
    const overnight = ev('n', '22:00', '06:00', '2026-11-14', '2026-11-15');
    const untilMidnight = ev('m', '20:00', '00:00', '2026-11-14', '2026-11-15');
    const out = buildMobileWeekEvents([overnight, untilMidnight]);
    expect(out.find(e => e.id === 'n')).toBe(overnight);
    expect(out.find(e => e.id === 'm')).toMatchObject({ fullWidth: true });
  });

  it('respects a custom column limit', () => {
    const out = buildMobileWeekEvents([ev('a', '09:00', '11:00'), ev('b', '10:00', '12:00')], 1);
    expect(out).toHaveLength(1);
    expect(isClusterEvent(out[0])).toBe(true);
  });
});

describe('MobileWeekEvent', () => {
  it('shows the short title only when the event has a full column', () => {
    const { rerender } = render(<MobileWeekEvent event={{ ...ev('Sarah', '09:00', '11:00'), fullWidth: true }} />);
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Event Sarah' })).toBeInTheDocument();
    rerender(<MobileWeekEvent event={ev('Sarah', '09:00', '11:00')} />);
    expect(screen.queryByText('Sarah')).not.toBeInTheDocument();
  });

  it('prefers the accessible label when one is given', () => {
    render(<MobileWeekEvent event={{ ...ev('a', '09:00', '11:00'), a11yLabel: 'Sarah Cohen, 09:00–11:00' }} />);
    expect(screen.getByRole('img', { name: 'Sarah Cohen, 09:00–11:00' })).toBeInTheDocument();
  });

  it('shows the member count for a cluster', () => {
    const [cluster] = buildMobileWeekEvents(['a', 'b', 'c'].map(id => ev(id, '09:00', '11:00')));
    render(<MobileWeekEvent event={cluster} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('09:00–11:00');
  });

  it('uses a cluster fill that is defined in the shared palette', () => {
    expect(clusterEventStyle.style.backgroundColor).toBe(EVENT_FILL.cluster);
  });
});

describe('ClusterSheet', () => {
  const [cluster] = buildMobileWeekEvents(['a', 'b', 'c'].map(id => ev(id, '09:00', '11:00'))) as ClusterEvent<WeekEventBase>[];

  it('lists every member with its time and reports the one that is tapped', () => {
    const onSelect = jest.fn();
    render(<ClusterSheet cluster={cluster} onClose={jest.fn()} onSelect={onSelect} getColor={() => '#237804'} />);
    expect(screen.getAllByText('09:00–11:00')).toHaveLength(3);
    fireEvent.click(screen.getByText('Event b'));
    expect(onSelect).toHaveBeenCalledWith(cluster.members[1]);
  });

  it('renders nothing listable when closed', () => {
    render(<ClusterSheet cluster={null} onClose={jest.fn()} onSelect={jest.fn()} getColor={() => '#000000'} />);
    expect(screen.queryByText('Event a')).not.toBeInTheDocument();
  });
});
