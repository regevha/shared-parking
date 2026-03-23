import React, { useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { Card, Row, Col, Modal, Descriptions, Tag, Button, notification } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
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

const CalendarView: React.FC<CalendarViewProps> = ({ role = 'User' }) => {
  const { pendingRequests, userRequests, updateUserRequest } = useRequests();
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<ParkingRequest | null>(null);

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
    if (req.status === 'approved') return 'Approved';
    return 'Pending';
  };

  const getStatusTagColor = (req: ParkingRequest) => {
    if (req.rejectedByOwner) return 'red';
    if (req.status === 'approved') return 'green';
    return 'blue';
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

  const handleEventDrop = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (!event.isMine || event.resource.status !== 'pending') return;
    applyReschedule(event, start, end);
  };

  const handleEventResize = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (!event.isMine || event.resource.status !== 'pending') return;
    applyReschedule(event, start, end);
  };

  // Stats
  const totalRequests = allRequests.length;
  const pendingCount = allRequests.filter((r) => r.status === 'pending' && !r.rejectedByOwner).length;
  const approvedCount = allRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = allRequests.filter((r) => r.rejectedByOwner).length;

  return (
    <div className="calendar-view">
      {/* Calendar */}
      <Card style={{ marginBottom: '24px' }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
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
        />
      </Card>

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
