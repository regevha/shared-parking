import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, Collapse, DatePicker, Row, Col, Modal, Descriptions, Tag, Button, Select, notification, Space, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import { LotStatus, RequestStatus } from '../types/enums';
import { getRequestStatusColor, getRequestStatusLabel, getLotStatusTagColor } from '../utils/statusUtils';
import StatsBar from './StatsBar';
import './CalendarView.css';
import './LotCalendarView.css';
import AuditTrailModal from './AuditTrailModal';

const localizer = dayjsLocalizer(dayjs);

type EventType = 'booked' | 'pending' | 'blocked' | 'available';

interface LotCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: EventType;
  resource: ParkingRequest | LotData;
  availableCount?: number;
  totalLots?: number;
}

const EVENT_COLORS: Record<EventType, string> = {
  booked: '#52c41a',
  pending: '#fa8c16',
  blocked: '#f5222d',
  available: '#13c2c2',
};

// Defined outside component for stable reference
const CustomEvent: React.FC<{ event: LotCalendarEvent }> = ({ event }) => {
  const isRequest = event.type === 'booked' || event.type === 'pending';
  const resource = event.resource as ParkingRequest;
  return (
    <div className="custom-event">
      <div className="custom-event-title">
        {event.title}
        {isRequest && resource.requesterRole && (
          <span className="event-role-tag"> ({resource.requesterRole})</span>
        )}
      </div>
      {isRequest && (
        <div className="custom-event-time">{resource.startTime}–{resource.endTime}</div>
      )}
    </div>
  );
};

const CustomMobileHeader: React.FC<{ date: Date }> = ({ date: headerDate }) => {
  const isToday = dayjs(headerDate).isSame(dayjs(), 'day');
  return (
    <div className="mobile-week-header">
      <span className="mobile-week-header-day">{dayjs(headerDate).format('ddd').slice(0, 2).toUpperCase()}</span>
      <span className={`mobile-week-header-num${isToday ? ' mobile-week-header-today' : ''}`}>
        {dayjs(headerDate).format('D')}
      </span>
    </div>
  );
};

const CustomMobileWeekEvent: React.FC<{ event: LotCalendarEvent }> = ({ event }) => {
  const isRequest = event.type === 'booked' || event.type === 'pending';
  const resource = event.resource as ParkingRequest;
  return (
    <div className="custom-event-week-mobile">
      <span className="custom-event-week-mobile-title">
        {event.title}
        {isRequest && resource.requesterRole && (
          ` (${resource.requesterRole.charAt(0).toUpperCase()})`
        )}
      </span>
    </div>
  );
};

const currentHourSlotPropGetter = (date: Date) => {
  const now = new Date();
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate() &&
    date.getHours() === now.getHours()
  ) {
    return { style: { backgroundColor: 'rgba(22, 119, 255, 0.18)' } };
  }
  return {};
};

const yesterday = dayjs().subtract(1, 'day').startOf('day');

const LotCalendarView: React.FC = () => {
  const { pendingRequests, approvedRequests, approveRequest, rejectRequest, ownerLots, allLots } = useRequests();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const visibleLots = isManager ? allLots : ownerLots;
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [view, setView] = useState<View>(() => window.matchMedia('(max-width: 768px)').matches ? 'day' : 'week');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<LotCalendarEvent | null>(null);
  const [selectedLot, setSelectedLot] = useState<string>('all');
  const [showHistory, setShowHistory] = useState(false);

  const scrollTo8AM = useMemo(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; }, []);
  const minTime    = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const maxTime    = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Lot selector options
  const lotOptions = useMemo(() => [
    { value: 'all', label: t('lotCalendarView.allMyLots') },
    { value: 'all-system', label: t('lotCalendarView.allLots') },
    { value: 'available', label: t('lotCalendarView.availableSlots') },
    ...visibleLots.map(l => ({ value: l.id, label: `${l.id} — ${l.floorLabel}` })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [visibleLots, t]);

  // Booked events — sourced from context so newly approved requests appear immediately
  const bookedEvents = useMemo(() =>
    approvedRequests
      .filter(a => !dayjs(a.date).isBefore(yesterday))
      .filter(a => {
        if (selectedLot === 'all-system') return true;                          // all lots system-wide
        if (selectedLot === 'all' || selectedLot === 'available')
          return isManager || a.lotOwner === user?.name;                        // owner's lots only
        return a.lotId === selectedLot;                                         // specific lot
      })
      .map(a => ({
        id: a.id,
        title: `${a.requesterName.split(' ')[0]} · ${a.lotId}`,
        start: new Date(`${a.date}T${a.startTime}:00`),
        end: new Date(`${a.endDate || a.date}T${a.endTime}:00`),
        type: 'booked' as EventType,
        resource: a as ParkingRequest,
      })),
  [approvedRequests, selectedLot, isManager, user?.name]);

  // Pending events — shown in "All My Lots" and "All Lots" views
  const pendingEvents = useMemo(() =>
    (selectedLot !== 'all' && selectedLot !== 'all-system') ? [] :
    pendingRequests
      .filter(r => !r.rejectedByOwner && r.status !== 'rejected' && !dayjs(r.date).isBefore(yesterday))
      .map(r => ({
        id: `pending-${r.id}`,
        title: `⏳ ${r.requesterName.split(' ')[0]}`,
        start: new Date(`${r.date}T${r.startTime}:00`),
        end: new Date(`${r.endDate || r.date}T${r.endTime}:00`),
        type: 'pending' as EventType,
        resource: r as ParkingRequest,
      })),
  [pendingRequests, selectedLot]);

  // Blocked events
  const blockedEvents = useMemo(() => {
    const lotsToShow = selectedLot === 'all-system' ? allLots : visibleLots;
    return lotsToShow
      .filter(l => l.status === 'blocked' && l.blockedUntil && (selectedLot === 'all' || selectedLot === 'all-system' || l.id === selectedLot))
      .map(l => {
        const until = dayjs(l.blockedUntil);
        return {
          id: `blocked-${l.id}`,
          title: `🔒 ${l.id}`,
          start: until.startOf('day').toDate(),
          end: until.toDate(),
          type: 'blocked' as EventType,
          resource: l as LotData,
        };
      });
  }, [allLots, visibleLots, selectedLot]);

  // All owner booked events regardless of lot filter — used for availability computation
  const allOwnerBookedEvents = useMemo(() =>
    approvedRequests
      .filter(a => isManager || a.lotOwner === user?.name)
      .map(a => ({
        lotId: a.lotId,
        start: new Date(`${a.date}T${a.startTime}:00`),
        end: new Date(`${a.endDate || a.date}T${a.endTime}:00`),
      })),
  [approvedRequests, user?.name]);

  // Available slots — timeslots where at least 1 owner lot is free
  const availableEvents = useMemo((): LotCalendarEvent[] => {
    if (selectedLot !== 'available' || visibleLots.length === 0) return [];
    const WORK_START = 7, WORK_END = 20;

    let rangeStart = view === 'week'  ? dayjs(date).startOf('week')
                   : view === 'month' ? dayjs(date).startOf('month')
                   : dayjs(date).startOf('day');
    let rangeEnd   = view === 'week'  ? dayjs(date).endOf('week').startOf('day')
                   : view === 'month' ? dayjs(date).endOf('month').startOf('day')
                   : dayjs(date).startOf('day');

    const result: LotCalendarEvent[] = [];
    let day = rangeStart;

    while (!day.isAfter(rangeEnd)) {
      // Per-lot busy hour flags [WORK_START..WORK_END)
      const lotBusy: Record<string, boolean[]> = {};
      visibleLots.forEach(l => { lotBusy[l.id] = new Array(WORK_END - WORK_START).fill(false); });

      // Mark blocked lots as fully busy for this day
      visibleLots.forEach(l => {
        if (l.status === 'blocked' && l.blockedUntil && dayjs(l.blockedUntil).isAfter(day)) {
          lotBusy[l.id].fill(true);
        }
      });

      // Mark booked hours
      const dayWorkStart = day.hour(WORK_START).minute(0).second(0).toDate();
      const dayWorkEnd   = day.hour(WORK_END).minute(0).second(0).toDate();
      allOwnerBookedEvents.forEach(({ lotId, start, end }) => {
        if (!lotId || !lotBusy[lotId] || start >= dayWorkEnd || end <= dayWorkStart) return;
        for (let h = WORK_START; h < WORK_END; h++) {
          const slotStart = day.hour(h).minute(0).second(0).toDate();
          const slotEnd   = day.hour(h + 1).minute(0).second(0).toDate();
          if (start < slotEnd && end > slotStart) {
            lotBusy[lotId][h - WORK_START] = true;
          }
        }
      });

      // For each hour, check free lot count and emit a per-hour event
      for (let h = WORK_START; h < WORK_END; h++) {
        const freeLots = visibleLots.filter(l => !lotBusy[l.id][h - WORK_START]);
        if (freeLots.length > 0) {
          result.push({
            id: `avail-${day.format('YYYY-MM-DD')}-${h}`,
            title: `✓ ${freeLots.length}/${visibleLots.length}`,
            start: day.hour(h).minute(0).second(0).toDate(),
            end:   day.hour(h + 1).minute(0).second(0).toDate(),
            type: 'available' as EventType,
            resource: {} as ParkingRequest,
            availableCount: freeLots.length,
            totalLots: visibleLots.length,
          });
        }
      }

      day = day.add(1, 'day');
    }
    return result;
  }, [selectedLot, date, view, visibleLots, allOwnerBookedEvents, t]);

  const events: LotCalendarEvent[] = useMemo(() =>
    selectedLot === 'available'
      ? availableEvents
      : [...bookedEvents, ...pendingEvents, ...blockedEvents],
  [bookedEvents, pendingEvents, blockedEvents, availableEvents, selectedLot]);

  const eventStyleGetter = (event: LotCalendarEvent) => {
    const color = EVENT_COLORS[event.type];
    return {
      style: {
        backgroundColor: color,
        border: `1px solid ${color}`,
        color: '#fff',
        borderRadius: '3px',
        fontSize: '12px',
      },
    };
  };

  const handleApprove = (requestId: string) => {
    if (!user?.name) {
      notification.error({
        message: t('lotCalendarView.notifications.error'),
        description: 'User not authenticated. Please log in again.',
      });
      return;
    }

    const targetLot = selectedLot !== 'all'
      ? visibleLots.find(l => l.id === selectedLot)
      : visibleLots.find(l => l.status === 'available');
    approveRequest(requestId, targetLot ? {
      lotId: targetLot.id,
      floor: targetLot.floorLabel,
      lotOwner: user.name,
    } : undefined);
    setSelectedEvent(null);
    notification.success({ message: t('lotCalendarView.notifications.approved') });
  };

  const handleReject = (requestId: string) => {
    rejectRequest(requestId);
    setSelectedEvent(null);
    notification.warning({ message: t('lotCalendarView.notifications.rejected') });
  };

  // Desktop toolbar
  const CustomDesktopToolbar = useCallback((tb: any) => (
    <div className="desktop-toolbar">
      <div className="desktop-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>{t('lotCalendarView.toolbar.today')}</button>
        <button onClick={() => tb.onNavigate('PREV')}>‹</button>
        <button onClick={() => tb.onNavigate('NEXT')}>›</button>
      </div>
      <span className="desktop-toolbar-label">{tb.label}</span>
      <div className="desktop-toolbar-right">
        <DatePicker
          size="small"
          value={dayjs(date)}
          onChange={(d) => { if (d) setDate(d.toDate()); }}
          allowClear={false}
          inputReadOnly
          style={{ width: 120 }}
        />
        <div className="desktop-toolbar-views">
          {tb.views.map((v: View) => (
            <button key={v} className={tb.view === v ? 'rbc-active' : ''} onClick={() => tb.onView(v)}>
              {t(`lotCalendarView.viewNames.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [date, t]);

  // Mobile toolbar
  const CustomMobileToolbar = useCallback((tb: any) => (
    <div className="mobile-toolbar">
      <div className="mobile-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>{t('lotCalendarView.toolbar.today')}</button>
        <button onClick={() => tb.onNavigate('PREV')}>‹</button>
        <button onClick={() => tb.onNavigate('NEXT')}>›</button>
      </div>
      <span className="mobile-toolbar-label">{tb.label}</span>
      <div className="mobile-toolbar-right">
        <DatePicker
          size="small"
          value={dayjs(date)}
          onChange={(d) => { if (d) setDate(d.toDate()); }}
          allowClear={false}
          inputReadOnly
          style={{ width: 110 }}
        />
        <div className="mobile-toolbar-views">
          {tb.views.map((v: View) => (
            <button key={v} className={tb.view === v ? 'rbc-active' : ''} onClick={() => tb.onView(v)}>
              {v === 'week' ? t('lotCalendarView.toolbar.weekShort') : t(`lotCalendarView.viewNames.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [date, t]);

  const desktopComponents = useMemo(() => ({
    toolbar: CustomDesktopToolbar,
    event: CustomEvent,
  }), [CustomDesktopToolbar]);

  const mobileComponents = useMemo(() => ({
    toolbar: CustomMobileToolbar,
    event: CustomEvent,
    header: CustomMobileHeader,
  }), [CustomMobileToolbar]);

  const mobileWeekComponents = useMemo(() => ({
    toolbar: CustomMobileToolbar,
    event: CustomMobileWeekEvent,
    header: CustomMobileHeader,
  }), [CustomMobileToolbar]);

  const mobileWeekFormats = useMemo(() => ({
    timeGutterFormat: (d: Date) => dayjs(d).format('ha'),
  }), []);

  const hasVisibleEvents = useMemo(() => {
    if (view === 'month') return true;
    const rangeStart = (view === 'week' ? dayjs(date).startOf('week') : dayjs(date).startOf('day')).toDate();
    const rangeEnd   = (view === 'week' ? dayjs(date).endOf('week')   : dayjs(date).endOf('day')).toDate();
    return events.some(e => e.start < rangeEnd && e.end > rangeStart);
  }, [events, date, view]);

  const mobileCalendarHeight = view === 'month' ? 620 : 500;

  // Modal title + content based on event type
  const modalTitle = useMemo(() => {
    if (!selectedEvent) return '';
    if (selectedEvent.type === 'booked')    return t('lotCalendarView.modal.bookedTitle', { name: (selectedEvent.resource as ParkingRequest).requesterName });
    if (selectedEvent.type === 'pending')   return t('lotCalendarView.modal.pendingTitle', { name: (selectedEvent.resource as ParkingRequest).requesterName });
    if (selectedEvent.type === 'available') return t('lotCalendarView.modal.availableTitle');
    return t('lotCalendarView.modal.blockedTitle', { id: (selectedEvent.resource as LotData).id });
  }, [selectedEvent, t]);

  const renderModalContent = () => {
    if (!selectedEvent) return null;

    if (selectedEvent.type === 'booked') {
      const a = selectedEvent.resource as ParkingRequest;
      return (
        <Descriptions column={isMobile ? 1 : 2} size="small">
          <Descriptions.Item label={t('lotCalendarView.modal.requestId')}>{a.id}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.requester')}>{a.requesterName}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.date')}>{dayjs(a.date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.duration')}>{a.duration}h</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.time')} span={2}>
            {a.startTime} – {a.endTime}
            {a.endDate && a.endDate !== a.date && (
              <span style={{ fontSize: '11px', color: 'var(--label-color)', marginLeft: '8px' }}>
                ({dayjs(a.endDate).format('DD/MM')})
              </span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.lot')}>{a.lotId}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.floor')}>{a.floor}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getRequestStatusColor(RequestStatus.APPROVED)}>{t(getRequestStatusLabel(RequestStatus.APPROVED))}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.approvedAt')}>{dayjs(a.approvedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
        </Descriptions>
      );
    }

    if (selectedEvent.type === 'pending') {
      const r = selectedEvent.resource as ParkingRequest;
      const isSelfRequest = r.requesterName === user?.name;
      return (
        <>
          <Descriptions column={isMobile ? 1 : 2} size="small">
            <Descriptions.Item label={t('lotCalendarView.modal.requestId')}>{r.id}</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.requester')}>{r.requesterName}</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.date')}>{dayjs(r.date).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.duration')}>{r.duration}h</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.time')} span={2}>
              {r.startTime} – {r.endTime}
              {r.endDate && r.endDate !== r.date && (
                <span style={{ fontSize: '11px', color: 'var(--label-color)', marginLeft: '8px' }}>
                  ({dayjs(r.endDate).format('DD/MM')})
                </span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getRequestStatusColor(RequestStatus.PENDING)}>{t(getRequestStatusLabel(RequestStatus.PENDING))}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.submitted')}>{dayjs(r.submittedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Tooltip title={isSelfRequest ? t('lotCalendarView.modal.selfRequestGuard') : undefined}>
              <Button type="primary" disabled={isSelfRequest} onClick={() => handleApprove(r.id)}>{t('lotCalendarView.modal.approve')}</Button>
            </Tooltip>
            <Tooltip title={isSelfRequest ? t('lotCalendarView.modal.selfRequestGuard') : undefined}>
              <Button danger disabled={isSelfRequest} onClick={() => handleReject(r.id)}>{t('lotCalendarView.modal.reject')}</Button>
            </Tooltip>
          </div>
        </>
      );
    }

    if (selectedEvent.type === 'available') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, color: EVENT_COLORS.available, marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {dayjs(selectedEvent.start).format('DD/MM/YYYY')} &nbsp;
            {dayjs(selectedEvent.start).format('HH:mm')} – {dayjs(selectedEvent.end).format('HH:mm')}
          </div>
          <div style={{ fontSize: 20, color: EVENT_COLORS.available, fontWeight: 700, margin: '8px 0' }}>
            {selectedEvent.availableCount}/{selectedEvent.totalLots} {t('lotCalendarView.modal.availableLotsLabel')}
          </div>
          <div style={{ color: 'var(--label-color)' }}>{t('lotCalendarView.modal.availableDesc')}</div>
        </div>
      );
    }

    // blocked
    const l = selectedEvent.resource as LotData;
    return (
      <Descriptions column={isMobile ? 1 : 2} size="small">
        <Descriptions.Item label={t('lotCalendarView.modal.lotId')}>{l.id}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.floor')}>{l.floor}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.owner')}>{l.owner ?? t('lotCalendarView.modal.unowned')}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getLotStatusTagColor(LotStatus.BLOCKED)}>{t('lotCalendarView.legend.blocked')}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.blockedUntil')} span={2}>{dayjs(l.blockedUntil).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
      </Descriptions>
    );
  };

  return (
    <div className="calendar-view lot-calendar-view">

      {/* Lot Selector */}
      <div className="lot-selector">
        <Select
          value={selectedLot}
          onChange={setSelectedLot}
          options={lotOptions}
          style={{ width: isMobile ? '100%' : 260 }}
          size={isMobile ? 'large' : 'middle'}
        />
      </div>

      {/* Calendar */}
      {isMobile ? (
        <div className={`calendar-naked-wrapper${view === 'week' ? ' calendar-week-view' : ''}`}>
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={['day', 'week', 'month']}
            style={{ height: mobileCalendarHeight }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: LotCalendarEvent) => setSelectedEvent(event)}
            popup
            scrollToTime={scrollTo8AM}
            step={60}
            timeslots={1}
            min={minTime}
            max={maxTime}
            slotPropGetter={currentHourSlotPropGetter}
            components={view === 'week' ? mobileWeekComponents : mobileComponents}
            formats={view === 'week' ? mobileWeekFormats : undefined}
            dayLayoutAlgorithm="no-overlap"
          />
          {!hasVisibleEvents && (
            <div className="calendar-empty-state">{t('lotCalendarView.emptyState')}</div>
          )}
        </div>
      ) : (
        <Card style={{ marginBottom: '24px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={['day', 'week', 'month']}
            style={{ height: 700 }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: LotCalendarEvent) => setSelectedEvent(event)}
            popup
            scrollToTime={scrollTo8AM}
            step={60}
            timeslots={1}
            min={minTime}
            max={maxTime}
            slotPropGetter={currentHourSlotPropGetter}
            components={desktopComponents}
            dayLayoutAlgorithm="no-overlap"
          />
          {!hasVisibleEvents && (
            <div className="calendar-empty-state">{t('lotCalendarView.emptyState')}</div>
          )}
        </Card>
      )}

      {/* Stats */}
      <StatsBar
        style={{ marginBottom: '24px' }}
        items={selectedLot === 'available'
          ? [{ label: t('lotCalendarView.stats.availableWindows'), value: availableEvents.length, color: EVENT_COLORS.available }]
          : [
              { label: t('lotCalendarView.stats.total'), value: bookedEvents.length + pendingEvents.length + blockedEvents.length },
              { label: t('lotCalendarView.stats.booked'), value: bookedEvents.length, color: EVENT_COLORS.booked },
              { label: t('lotCalendarView.stats.pending'), value: pendingEvents.length, color: EVENT_COLORS.pending },
              { label: t('lotCalendarView.stats.blocked'), value: blockedEvents.length, color: EVENT_COLORS.blocked },
            ]
        }
      />

      {/* Info */}
      <Card style={{ marginBottom: '16px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        <strong>{t('lotCalendarView.infoTitle')}:</strong> {t('lotCalendarView.info')}
      </Card>

      {/* Legend */}
      {(() => {
        const legendGrid = (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
            {(['booked', 'pending', 'blocked', 'available'] as EventType[]).map(type => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 16, height: 16, backgroundColor: EVENT_COLORS[type], borderRadius: 2, flexShrink: 0 }} />
                <span>{t(`lotCalendarView.legend.${type}`)}</span>
              </div>
            ))}
          </div>
        );
        return isMobile ? (
          <Collapse size="small" items={[{ key: 'legend', label: t('lotCalendarView.legendTitle'), children: legendGrid }]} />
        ) : (
          <Card>
            <h3 style={{ marginTop: 0 }}>{t('lotCalendarView.legendTitle')}</h3>
            {legendGrid}
          </Card>
        );
      })()}

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
        width={isMobile ? '95vw' : 520}
        onCancel={() => setSelectedEvent(null)}
        footer={
          <Space>
            {(selectedEvent?.type === 'booked' || selectedEvent?.type === 'pending') && (
              <Button onClick={() => setShowHistory(true)}>{t('lotCalendarView.modal.history') || 'View History'}</Button>
            )}
            <Button type="primary" onClick={() => setSelectedEvent(null)}>{t('lotCalendarView.modal.close')}</Button>
          </Space>
        }
        title={modalTitle}
      >
        {renderModalContent()}
      </Modal>

      {showHistory && selectedEvent?.resource?.id && (
        <AuditTrailModal 
          requestId={selectedEvent.resource.id} 
          onClose={() => setShowHistory(false)} 
        />
      )}
    </div>
  );
};

export default LotCalendarView;
