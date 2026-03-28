import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { Card, DatePicker, Row, Col, Modal, Descriptions, Tag, Button, notification } from 'antd';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import './CalendarView.css';

const DnDCalendar = withDragAndDrop(Calendar as any) as any;

const localizer = dayjsLocalizer(dayjs);

interface CalendarViewProps {
  role?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ParkingRequest;
  isMine: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#1890ff',
  approved: '#52c41a',
  rejected: '#f5222d',
};

// Defined outside component for stable reference (no closure needed)
const CustomEvent: React.FC<{ event: CalendarEvent }> = ({ event }) => (
  <div className="custom-event">
    <div className="custom-event-title">{event.title}</div>
    <div className="custom-event-time">{event.resource.startTime}–{event.resource.endTime}</div>
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

// Compact event for mobile week view — single line, no time sub-label
const CustomMobileWeekEvent: React.FC<{ event: CalendarEvent }> = ({ event }) => (
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

const CalendarView: React.FC<CalendarViewProps> = ({ role = 'User' }) => {
  const { pendingRequests, userRequests, updateUserRequest } = useRequests();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [view, setView] = useState<View>(() => window.matchMedia('(max-width: 768px)').matches ? 'day' : 'week');
  const scrollTo8AM = useMemo(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; }, []);
  const minTime = useMemo(() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; }, []);
  const maxTime = useMemo(() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; }, []);
  const [date, setDate] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<ParkingRequest | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const myRequestIds = useMemo(() => new Set(userRequests.map((r) => r.id)), [userRequests]);

  // Merge pendingRequests + non-rejected userRequests, deduped by ID
  const allRequests = useMemo(() => {
    const map = new Map<string, ParkingRequest>();
    pendingRequests.forEach((r) => map.set(r.id, r));
    userRequests
      .filter((r) => r.status !== 'rejected')
      .forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [pendingRequests, userRequests]);

  const getStatusColor = (req: ParkingRequest) => {
    if (req.rejectedByOwner) return STATUS_COLORS.rejected;
    return STATUS_COLORS[req.status] ?? STATUS_COLORS.pending;
  };

  const getStatusLabel = (req: ParkingRequest) => {
    if (req.rejectedByOwner) return 'Rejected';
    return getRequestStatusLabel(req.status);
  };

  const getStatusTagColor = (req: ParkingRequest) => {
    if (req.rejectedByOwner) return 'red';
    return getRequestStatusColor(req.status);
  };

  const events: CalendarEvent[] = useMemo(() =>
    allRequests.map((req) => ({
      id: req.id,
      title: `${myRequestIds.has(req.id) ? '★ ' : ''}${req.requesterName.split(' ')[0]}`,
      start: new Date(`${req.date}T${req.startTime}:00`),
      end: new Date(`${req.date}T${req.endTime}:00`),
      resource: req,
      isMine: myRequestIds.has(req.id),
    })),
    [allRequests, myRequestIds]
  );

  const eventStyleGetter = (event: CalendarEvent) => {
    const color = getStatusColor(event.resource);
    return {
      style: {
        backgroundColor: color,
        border: event.isMine ? '2px solid #fadb14' : `1px solid ${color}`,
        color: '#fff',
        borderRadius: '3px',
        fontSize: '12px',
      },
    };
  };

  const applyReschedule = (event: CalendarEvent, start: Date, end: Date) => {
    const startDayjs = dayjs(start);
    const endDayjs = dayjs(end);
    updateUserRequest(event.resource.id, {
      date: startDayjs.format('YYYY-MM-DD'),
      startTime: startDayjs.format('HH:mm'),
      endTime: endDayjs.format('HH:mm'),
      duration: endDayjs.diff(startDayjs, 'hour'),
    });
    notification.success({
      message: 'Request Rescheduled',
      description: `Request ${event.resource.id} moved to ${startDayjs.format('MMM D, HH:mm')} – ${endDayjs.format('HH:mm')}`,
    });
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const handleEventDrop = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (!event.isMine || event.resource.status !== 'pending') return;
    applyReschedule(event, start, end);
  };

  const handleEventResize = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (!event.isMine || event.resource.status !== 'pending') return;
    applyReschedule(event, start, end);
  };

  // Desktop toolbar — matches mobile style, adds DatePicker
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
  ), [date, setDate]);

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
  ), [date, setDate]);

  const desktopComponents = useMemo(() => ({
    toolbar: CustomDesktopToolbar,
    event: CustomEvent,
  }), [CustomDesktopToolbar]);

  const mobileComponents = useMemo(() => ({
    toolbar: CustomMobileToolbar,
    event: CustomEvent,
    header: CustomMobileHeader,
  }), [CustomMobileToolbar]);

  // Week view on mobile: compact event + short time labels
  const mobileWeekComponents = useMemo(() => ({
    toolbar: CustomMobileToolbar,
    event: CustomMobileWeekEvent,
    header: CustomMobileHeader,
  }), [CustomMobileToolbar]);

  const mobileWeekFormats = useMemo(() => ({
    timeGutterFormat: (date: Date) => dayjs(date).format('ha'),
  }), []);

  // Empty state: events visible in current day/week range
  const hasVisibleEvents = useMemo(() => {
    if (view === 'month') return true;
    const rangeStart = (view === 'week' ? dayjs(date).startOf('week') : dayjs(date).startOf('day')).toDate();
    const rangeEnd = (view === 'week' ? dayjs(date).endOf('week') : dayjs(date).endOf('day')).toDate();
    return events.some(e => e.start < rangeEnd && e.end > rangeStart);
  }, [events, date, view]);

  // Stats
  const totalRequests = allRequests.length;
  const pendingCount = allRequests.filter((r) => r.status === 'pending' && !r.rejectedByOwner).length;
  const approvedCount = allRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = allRequests.filter((r) => r.rejectedByOwner).length;

  const mobileCalendarHeight = view === 'month' ? 620 : 500;

  return (
    <div className="calendar-view">
      {/* Calendar */}
      {isMobile ? (
        <div className={`calendar-naked-wrapper${view === 'week' ? ' calendar-week-view' : ''}`}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={handleViewChange}
            date={date}
            onNavigate={setDate}
            views={['day', 'week', 'month']}
            style={{ height: mobileCalendarHeight }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: CalendarEvent) => setSelectedRequest(event.resource)}
            popup
            draggableAccessor={(event: CalendarEvent) => event.isMine && event.resource.status === 'pending'}
            resizableAccessor={(event: CalendarEvent) => event.isMine && event.resource.status === 'pending'}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
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
            <div className="calendar-empty-state">No requests this period</div>
          )}
        </div>
      ) : (
        <Card style={{ marginBottom: '24px' }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={handleViewChange}
            date={date}
            onNavigate={setDate}
            views={['day', 'week', 'month']}
            style={{ height: 700 }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: CalendarEvent) => setSelectedRequest(event.resource)}
            popup
            draggableAccessor={(event: CalendarEvent) => event.isMine && event.resource.status === 'pending'}
            resizableAccessor={(event: CalendarEvent) => event.isMine && event.resource.status === 'pending'}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            scrollToTime={scrollTo8AM}
            step={60}
            timeslots={1}
            min={minTime}
            max={maxTime}
            slotPropGetter={currentHourSlotPropGetter}
            components={desktopComponents}
          />
          {!hasVisibleEvents && (
            <div className="calendar-empty-state">No requests this period</div>
          )}
        </Card>
      )}

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalRequests}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Requests</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{pendingCount}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{approvedCount}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Approved</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>{rejectedCount}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Rejected</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Info */}
      <Card style={{ marginBottom: '16px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        <strong>Requests View:</strong> A calendar overview of all parking requests — pending, approved, and rejected.
      </Card>

      {/* Legend */}
      <Card>
        <h3>Legend</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 16, height: 16, backgroundColor: STATUS_COLORS.pending, borderRadius: 2 }} />
            <span>Pending</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 16, height: 16, backgroundColor: STATUS_COLORS.approved, borderRadius: 2 }} />
            <span>Approved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 16, height: 16, backgroundColor: STATUS_COLORS.rejected, borderRadius: 2 }} />
            <span>Rejected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 16, height: 16, backgroundColor: STATUS_COLORS.pending, borderRadius: 2, outline: '2px solid #fadb14' }} />
            <span>★ My Request</span>
          </div>
        </div>
      </Card>

      {/* Request Detail Modal */}
      <Modal
        open={!!selectedRequest}
        onCancel={() => setSelectedRequest(null)}
        footer={<Button onClick={() => setSelectedRequest(null)}>Close</Button>}
        title={selectedRequest ? `Request — ${selectedRequest.requesterName}` : ''}
      >
        {selectedRequest && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Requester">{selectedRequest.requesterName}</Descriptions.Item>
            <Descriptions.Item label="Date">{dayjs(selectedRequest.date).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Time">{selectedRequest.startTime} – {selectedRequest.endTime}</Descriptions.Item>
            <Descriptions.Item label="Duration">{selectedRequest.duration}h</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusTagColor(selectedRequest)}>{getStatusLabel(selectedRequest)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Submitted">{dayjs(selectedRequest.submittedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
            {selectedRequest.lotId && <Descriptions.Item label="Lot">{selectedRequest.lotId}</Descriptions.Item>}
            {selectedRequest.floor && <Descriptions.Item label="Floor">{selectedRequest.floor}</Descriptions.Item>}
            {selectedRequest.lotOwner && <Descriptions.Item label="Lot Owner">{selectedRequest.lotOwner}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default CalendarView;
