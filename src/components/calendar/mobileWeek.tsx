import React from 'react';
import { Drawer } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { EVENT_FILL } from '../../utils/calendarColors';

/**
 * Phone week view helpers.
 *
 * Seven day-columns on a phone are ~46px wide, so more than two side-by-side events turn into
 * slivers that cannot be read or tapped. `buildMobileWeekEvents` therefore collapses any group of
 * overlapping events that would need more than `maxColumns` columns into one "cluster" block
 * showing a count; tapping it opens `ClusterSheet`, a bottom sheet listing the members.
 * When the caller says which status each event has (`getBand`), the block is filled with one
 * vertical stripe per status, each as wide as that status's share of the members.
 */

export interface WeekEventBase {
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** Very short text (a first name, a lot id) shown inside the block when it has a full column. */
  shortTitle?: string;
  /** Screen-reader label; falls back to `title`. */
  a11yLabel?: string;
}

/** How one event is counted in a cluster's stripes: its fill colour and a translated status name. */
export interface BandKey {
  color: string;
  label: string;
}

export interface ClusterBand extends BandKey {
  count: number;
}

export interface ClusterEvent<E extends WeekEventBase> {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isCluster: true;
  members: E[];
  /** One entry per status among the members, largest first. Empty when no `getBand` was given. */
  bands: ClusterBand[];
}

export type MobileWeekItem<E extends WeekEventBase> = (E & { fullWidth?: boolean }) | ClusterEvent<E>;

export const MOBILE_WEEK_MAX_COLUMNS = 2;

export function isClusterEvent(event: unknown): event is ClusterEvent<any> {
  return !!event && (event as { isCluster?: boolean }).isCluster === true;
}

const dayKey = (d: Date) => dayjs(d).format('YYYY-MM-DD');

/** Timed events that sit inside one day column (an end at exactly midnight still counts). */
function fitsOneDay(e: WeekEventBase): boolean {
  if (!(e.end > e.start)) return false;
  const lastInstant = new Date(e.end.getTime() - 1);
  return dayKey(e.start) === dayKey(lastInstant);
}

/** Highest number of events running at the same moment. Touching ends do not overlap. */
function maxConcurrency(group: WeekEventBase[]): number {
  const points: Array<[number, number]> = [];
  group.forEach(e => { points.push([e.start.getTime(), 1], [e.end.getTime(), -1]); });
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // ends before starts at the same instant
  let current = 0;
  let max = 0;
  points.forEach(([, delta]) => { current += delta; max = Math.max(max, current); });
  return max;
}

/** Groups members by status (colour + label), largest group first; ties keep first-seen order. */
export function clusterBands<E>(members: E[], getBand: (member: E) => BandKey): ClusterBand[] {
  const bands: ClusterBand[] = [];
  members.forEach(member => {
    const key = getBand(member);
    const existing = bands.find(b => b.color === key.color && b.label === key.label);
    if (existing) existing.count += 1;
    else bands.push({ ...key, count: 1 });
  });
  return bands
    .map((band, order) => ({ band, order }))
    .sort((a, b) => b.band.count - a.band.count || a.order - b.order)
    .map(({ band }) => band);
}

export function buildMobileWeekEvents<E extends WeekEventBase>(
  events: E[],
  getBand?: (member: E) => BandKey,
  maxColumns: number = MOBILE_WEEK_MAX_COLUMNS,
): MobileWeekItem<E>[] {
  const result: MobileWeekItem<E>[] = [];
  const byDay = new Map<string, E[]>();

  events.forEach(e => {
    if (!fitsOneDay(e)) { result.push(e); return; } // multi-day: left to react-big-calendar
    const key = dayKey(e.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  });

  byDay.forEach((dayEvents, key) => {
    const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
    let group: E[] = [];
    let groupEnd = 0;

    const flush = () => {
      if (group.length === 0) return;
      if (group.length === 1) {
        result.push({ ...group[0], fullWidth: true });
      } else if (maxConcurrency(group) <= maxColumns) {
        group.forEach(e => result.push(e));
      } else {
        result.push({
          id: `cluster-${key}-${group[0].id}`,
          title: String(group.length),
          start: group[0].start,
          end: new Date(groupEnd),
          isCluster: true,
          members: group,
          bands: getBand ? clusterBands(group, getBand) : [],
        });
      }
      group = [];
    };

    sorted.forEach(e => {
      if (group.length > 0 && e.start.getTime() >= groupEnd) flush();
      group.push(e);
      groupEnd = group.length === 1 ? e.end.getTime() : Math.max(groupEnd, e.end.getTime());
    });
    flush();
  });

  return result;
}

/** Style for a cluster block: the stripes fill it edge to edge, the count sits on a neutral chip. */
export const clusterEventStyle = {
  style: {
    backgroundColor: EVENT_FILL.cluster,
    border: `1px solid ${EVENT_FILL.cluster}`,
    color: '#fff',
    borderRadius: '3px',
    fontSize: '12px',
    padding: 0,
    overflow: 'hidden',
  },
};

const timeRange = (start: Date, end: Date) => `${dayjs(start).format('HH:mm')}–${dayjs(end).format('HH:mm')}`;

/** Event renderer for the phone week view: a count for clusters, a short label when there is room. */
export const MobileWeekEvent: React.FC<{ event: MobileWeekItem<WeekEventBase> }> = ({ event }) => {
  const { t } = useTranslation();
  if (isClusterEvent(event)) {
    const n = event.members.length;
    const time = timeRange(event.start, event.end);
    const label = event.bands.length > 0
      ? t('calendarView.cluster.labelWithBreakdown', { n, time, breakdown: event.bands.map(b => `${b.count} ${b.label}`).join(', ') })
      : t('calendarView.cluster.label', { n, time });
    return (
      <div className="mobile-week-cluster" role="img" aria-label={label} title={label}>
        {event.bands.length > 0 && (
          <div className="mobile-week-cluster-bands" aria-hidden="true">
            {event.bands.map(band => (
              <span
                key={`${band.color}-${band.label}`}
                className="mobile-week-cluster-band"
                data-testid="cluster-band"
                style={{ backgroundColor: band.color, flexGrow: band.count }}
              />
            ))}
          </div>
        )}
        <span className="mobile-week-cluster-count" aria-hidden="true">{n}</span>
      </div>
    );
  }
  const label = event.a11yLabel ?? event.title;
  return (
    <div className="custom-event-week-mobile" role="img" aria-label={label} title={label}>
      {event.fullWidth && event.shortTitle && (
        <span className="mobile-week-event-label" aria-hidden="true">{event.shortTitle}</span>
      )}
    </div>
  );
};

interface ClusterSheetProps<E extends WeekEventBase> {
  cluster: ClusterEvent<E> | null;
  onClose: () => void;
  onSelect: (member: E) => void;
  getColor: (member: E) => string;
}

/** Bottom sheet listing the events hidden behind a cluster block; tap one to open its details. */
export function ClusterSheet<E extends WeekEventBase>({ cluster, onClose, onSelect, getColor }: ClusterSheetProps<E>) {
  const { t } = useTranslation();
  return (
    <Drawer
      open={!!cluster}
      placement="bottom"
      height="auto"
      onClose={onClose}
      title={cluster ? t('calendarView.cluster.title', { n: cluster.members.length, day: dayjs(cluster.start).format('ddd D MMM') }) : ''}
      styles={{ body: { maxHeight: '60vh', overflowY: 'auto', padding: '8px 12px' } }}
    >
      {cluster && (
        <ul className="cluster-sheet-list">
          {cluster.members.map(member => (
            <li key={member.id}>
              <button type="button" className="cluster-sheet-item" onClick={() => onSelect(member)}>
                <span className="cluster-sheet-swatch" style={{ backgroundColor: getColor(member) }} aria-hidden="true" />
                <span className="cluster-sheet-title">{member.title}</span>
                <span className="cluster-sheet-time">{timeRange(member.start, member.end)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
