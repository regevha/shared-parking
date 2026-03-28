import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, DatePicker, Row, Col, Modal, Descriptions, Tag, Button, Select, notification } from 'antd';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import './CalendarView.css';
import './LotCalendarView.css';

const localizer = dayjsLocalizer(dayjs);

type EventType = 'booked' | 'pending' | 'blocked';

interface LotCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: EventType;
  resource: ParkingRequest | LotData;
}

const EVENT_COLORS: Record<EventType, string> = {
  booked: '#52c41a',
  pending: '#fa8c16',
  blocked: '#f5222d',
};

// Defined outside component for stable reference
const CustomEvent: React.FC<{ event: LotCalendarEvent }> = ({ event }) => (
  <div className="custom-event">
    <div className="custom-event-title">{event.title}</div>
  </div>
);

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

const CustomMobileWeekEvent: React.FC<{ event: LotCalendarEvent }> = ({ event }) => (
  <div className="custom-event-week-mobile">
    <span className="custom-event-week-mobile-title">{event.title}</span>
  </div>
);

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

const LotCalendarView: React.FC = () => {
  const { pendingRequests, approvedRequests, approveRequest, rejectRequest, ownerLots } = useRequests();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [view, setView] = useState<View>(() => window.matchMedia('(max-width: 768px)').matches ? 'day' : 'week');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<LotCalendarEvent | null>(null);
  const [selectedLot, setSelectedLot] = useState<string>('all');

  const scrollTo8AM = useMemo(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; }, []);
  const minTime    = useMemo(() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; }, []);
  const maxTime    = useMemo(() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Lot selector options — current owner's lots only (ownerLots loaded server-side)
  const lotOptions = useMemo(() => [
    { value: 'all', label: 'All My Lots' },
    ...ownerLots.map(l => ({ value: l.id, label: `${l.id} — ${l.floorLabel}` })),
  ], [ownerLots]);

  // Booked events — sourced from context so newly approved requests appear immediately
  const bookedEvents = useMemo(() =>
    approvedRequests
      .filter(a => a.lotOwner === user?.name && (selectedLot === 'all' || a.lotId === selectedLot))
      .map(a => ({
        id: a.id,
        title: `${a.requesterName.split(' ')[0]} · ${a.lotId}`,
        start: new Date(`${a.date}T${a.startTime}:00`),
        end: new Date(`${a.date}T${a.endTime}:00`),
        type: 'booked' as EventType,
        resource: a as ParkingRequest,
      })),
  [approvedRequests, selectedLot, user?.name]);

  // Pending events — only shown in "All My Lots" view (not yet assigned to a specific lot)
  const pendingEvents = useMemo(() =>
    selectedLot !== 'all' ? [] :
    pendingRequests
      .filter(r => !r.rejectedByOwner && r.status !== 'rejected')
      .map(r => ({
        id: `pending-${r.id}`,
        title: `⏳ ${r.requesterName.split(' ')[0]}`,
        start: new Date(`${r.date}T${r.startTime}:00`),
        end: new Date(`${r.date}T${r.endTime}:00`),
        type: 'pending' as EventType,
        resource: r as ParkingRequest,
      })),
  [pendingRequests, selectedLot]);

  // Blocked events — current owner's lots only
  const blockedEvents = useMemo(() =>
    ownerLots
      .filter(l => l.status === 'blocked' && l.blockedUntil && (selectedLot === 'all' || l.id === selectedLot))
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
      }),
  [ownerLots, selectedLot]);

  const events: LotCalendarEvent[] = useMemo(() => [
    ...bookedEvents,
    ...pendingEvents,
    ...blockedEvents,
  ], [bookedEvents, pendingEvents, blockedEvents]);

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

  const floorNames: Record<string, string> = { F1: 'F1 - Ground Floor', F2: 'F2 - Level 1', F3: 'F3 - Level 2' };

  const handleApprove = (requestId: string) => {
    const targetLot = selectedLot !== 'all'
      ? ownerLots.find(l => l.id === selectedLot)
      : ownerLots.find(l => l.status === 'available');
    approveRequest(requestId, targetLot ? {
      lotId: targetLot.id,
      floor: floorNames[targetLot.floor] || targetLot.floor,
      lotOwner: user?.name ?? '',
    } : undefined);
    setSelectedEvent(null);
    notification.success({ message: 'Request approved successfully' });
  };

  const handleReject = (requestId: string) => {
    rejectRequest(requestId);
    setSelectedEvent(null);
    notification.warning({ message: 'Request rejected' });
  };

  // Desktop toolbar
  const CustomDesktopToolbar = useCallback((tb: any) => (
    <div className="desktop-toolbar">
      <div className="desktop-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>Today</button>
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
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [date]);

  // Mobile toolbar
  const CustomMobileToolbar = useCallback((tb: any) => (
    <div className="mobile-toolbar">
      <div className="mobile-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>Today</button>
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
              {v === 'week' ? 'Wk' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [date]);

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
    if (selectedEvent.type === 'booked')  return `Booked — ${(selectedEvent.resource as ParkingRequest).requesterName}`;
    if (selectedEvent.type === 'pending') return `Pending — ${(selectedEvent.resource as ParkingRequest).requesterName}`;
    return `Blocked — ${(selectedEvent.resource as LotData).id}`;
  }, [selectedEvent]);

  const renderModalContent = () => {
    if (!selectedEvent) return null;

    if (selectedEvent.type === 'booked') {
      const a = selectedEvent.resource as ParkingRequest;
      return (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Requester">{a.requesterName}</Descriptions.Item>
          <Descriptions.Item label="Date">{dayjs(a.date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Time">{a.startTime} – {a.endTime}</Descriptions.Item>
          <Descriptions.Item label="Duration">{a.duration}h</Descriptions.Item>
          <Descriptions.Item label="Lot">{a.lotId}</Descriptions.Item>
          <Descriptions.Item label="Floor">{a.floor}</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color="green">Approved</Tag></Descriptions.Item>
          <Descriptions.Item label="Approved At">{dayjs(a.approvedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
        </Descriptions>
      );
    }

    if (selectedEvent.type === 'pending') {
      const r = selectedEvent.resource as ParkingRequest;
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Requester">{r.requesterName}</Descriptions.Item>
            <Descriptions.Item label="Date">{dayjs(r.date).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Time">{r.startTime} – {r.endTime}</Descriptions.Item>
            <Descriptions.Item label="Duration">{r.duration}h</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color="orange">Pending</Tag></Descriptions.Item>
            <Descriptions.Item label="Submitted">{dayjs(r.submittedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => handleApprove(r.id)}>Approve</Button>
            <Button danger onClick={() => handleReject(r.id)}>Reject</Button>
          </div>
        </>
      );
    }

    // blocked
    const l = selectedEvent.resource as LotData;
    return (
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Lot ID">{l.id}</Descriptions.Item>
        <Descriptions.Item label="Floor">{l.floor}</Descriptions.Item>
        <Descriptions.Item label="Owner">{l.owner ?? 'Unowned'}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag color="red">Blocked</Tag></Descriptions.Item>
        <Descriptions.Item label="Blocked Until">{dayjs(l.blockedUntil).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
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
          />
          {!hasVisibleEvents && (
            <div className="calendar-empty-state">No events this period</div>
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
          />
          {!hasVisibleEvents && (
            <div className="calendar-empty-state">No events this period</div>
          )}
        </Card>
      )}

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {bookedEvents.length + pendingEvents.length + blockedEvents.length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Events</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: EVENT_COLORS.booked }}>{bookedEvents.length}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Booked</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: EVENT_COLORS.pending }}>{pendingEvents.length}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: EVENT_COLORS.blocked }}>{blockedEvents.length}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Blocked</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Info */}
      <Card style={{ marginBottom: '16px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        <strong>Lot Calendar:</strong> A calendar view of your lots showing bookings, pending requests, and blocked periods.
      </Card>

      {/* Legend */}
      <Card>
        <h3 style={{ marginTop: 0 }}>Legend</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
          {(['booked', 'pending', 'blocked'] as EventType[]).map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 16, height: 16, backgroundColor: EVENT_COLORS[type], borderRadius: 2, flexShrink: 0 }} />
              <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
        onCancel={() => setSelectedEvent(null)}
        footer={<Button onClick={() => setSelectedEvent(null)}>Close</Button>}
        title={modalTitle}
      >
        {renderModalContent()}
      </Modal>
    </div>
  );
};

export default LotCalendarView;
