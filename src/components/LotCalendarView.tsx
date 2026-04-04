import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, DatePicker, Row, Col, Modal, Descriptions, Tag, Button, Select, notification, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import { getRequestStatusColor, getRequestStatusLabel, getLotStatusTagColor } from '../utils/statusUtils';
import './CalendarView.css';
import './LotCalendarView.css';
import AuditTrailModal from './AuditTrailModal';

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

  // Lot selector options — current owner's lots only (ownerLots loaded server-side)
  const lotOptions = useMemo(() => [
    { value: 'all', label: t('lotCalendarView.allMyLots') },
    ...ownerLots.map(l => ({ value: l.id, label: `${l.id} — ${l.floorLabel}` })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ownerLots, t]);

  // Booked events — sourced from context so newly approved requests appear immediately
  const bookedEvents = useMemo(() =>
    approvedRequests
      .filter(a => a.lotOwner === user?.name && (selectedLot === 'all' || a.lotId === selectedLot))
      .map(a => ({
        id: a.id,
        title: `${a.requesterName.split(' ')[0]} · ${a.lotId}`,
        start: new Date(`${a.date}T${a.startTime}:00`),
        end: new Date(`${a.endDate || a.date}T${a.endTime}:00`),
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
        end: new Date(`${r.endDate || r.date}T${r.endTime}:00`),
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

  const handleApprove = (requestId: string) => {
    const targetLot = selectedLot !== 'all'
      ? ownerLots.find(l => l.id === selectedLot)
      : ownerLots.find(l => l.status === 'available');
    approveRequest(requestId, targetLot ? {
      lotId: targetLot.id,
      floor: targetLot.floorLabel,
      lotOwner: user?.name ?? '',
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
    if (selectedEvent.type === 'booked')  return t('lotCalendarView.modal.bookedTitle', { name: (selectedEvent.resource as ParkingRequest).requesterName });
    if (selectedEvent.type === 'pending') return t('lotCalendarView.modal.pendingTitle', { name: (selectedEvent.resource as ParkingRequest).requesterName });
    return t('lotCalendarView.modal.blockedTitle', { id: (selectedEvent.resource as LotData).id });
  }, [selectedEvent, t]);

  const renderModalContent = () => {
    if (!selectedEvent) return null;

    if (selectedEvent.type === 'booked') {
      const a = selectedEvent.resource as ParkingRequest;
      return (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('lotCalendarView.modal.requester')}>{a.requesterName}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.date')}>{dayjs(a.date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.time')}>
            {a.startTime} – {a.endTime}
            {a.endDate && a.endDate !== a.date && (
              <span style={{ fontSize: '11px', color: 'var(--label-color)', marginLeft: '8px' }}>
                ({dayjs(a.endDate).format('DD/MM')})
              </span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.duration')}>{a.duration}h</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.lot')}>{a.lotId}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.floor')}>{a.floor}</Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getRequestStatusColor('approved')}>{getRequestStatusLabel('approved')}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('lotCalendarView.modal.approvedAt')}>{dayjs(a.approvedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
        </Descriptions>
      );
    }

    if (selectedEvent.type === 'pending') {
      const r = selectedEvent.resource as ParkingRequest;
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('lotCalendarView.modal.requester')}>{r.requesterName}</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.date')}>{dayjs(r.date).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.time')}>
              {r.startTime} – {r.endTime}
              {r.endDate && r.endDate !== r.date && (
                <span style={{ fontSize: '11px', color: 'var(--label-color)', marginLeft: '8px' }}>
                  ({dayjs(r.endDate).format('DD/MM')})
                </span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.duration')}>{r.duration}h</Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getRequestStatusColor('pending')}>{getRequestStatusLabel('pending')}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('lotCalendarView.modal.submitted')}>{dayjs(r.submittedAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={() => handleApprove(r.id)}>{t('lotCalendarView.modal.approve')}</Button>
            <Button danger onClick={() => handleReject(r.id)}>{t('lotCalendarView.modal.reject')}</Button>
          </div>
        </>
      );
    }

    // blocked
    const l = selectedEvent.resource as LotData;
    return (
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('lotCalendarView.modal.lotId')}>{l.id}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.floor')}>{l.floor}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.owner')}>{l.owner ?? t('lotCalendarView.modal.unowned')}</Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.status')}><Tag color={getLotStatusTagColor('blocked')}>{t('lotCalendarView.legend.blocked')}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('lotCalendarView.modal.blockedUntil')}>{dayjs(l.blockedUntil).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
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
      <Card size="small" style={{ marginBottom: '24px' }}>
        <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <strong style={{ fontSize: '18px', color: 'inherit', marginRight: '8px' }}>
              {bookedEvents.length + pendingEvents.length + blockedEvents.length}
            </strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotCalendarView.stats.total')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: EVENT_COLORS.booked, marginRight: '8px' }}>{bookedEvents.length}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotCalendarView.stats.booked')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: EVENT_COLORS.pending, marginRight: '8px' }}>{pendingEvents.length}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotCalendarView.stats.pending')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: EVENT_COLORS.blocked, marginRight: '8px' }}>{blockedEvents.length}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotCalendarView.stats.blocked')}</span>
          </div>
        </Space>
      </Card>

      {/* Info */}
      <Card style={{ marginBottom: '16px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        <strong>{t('lotCalendarView.infoTitle')}:</strong> {t('lotCalendarView.info')}
      </Card>

      {/* Legend */}
      <Card>
        <h3 style={{ marginTop: 0 }}>{t('lotCalendarView.legendTitle')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
          {(['booked', 'pending', 'blocked'] as EventType[]).map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 16, height: 16, backgroundColor: EVENT_COLORS[type], borderRadius: 2, flexShrink: 0 }} />
              <span>{t(`lotCalendarView.legend.${type}`)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
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
