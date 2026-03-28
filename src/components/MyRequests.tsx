import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Space, Modal, Form, DatePicker, Select, notification, Popconfirm, Card, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import './MyRequests.css';

interface EditFormValues {
  date: Dayjs | null;
  startTime: string;
  duration: number;
}

const MAX_END_HOUR = 20;

// 20:00 excluded: no valid duration fits (min 1h would exceed 20:00)
const HOUR_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

const ALL_DURATION_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '2 hours', value: 2 },
  { label: '3 hours', value: 3 },
  { label: '4 hours', value: 4 },
  { label: '5 hours', value: 5 },
  { label: '6 hours', value: 6 },
];

const MyRequests: React.FC = () => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ParkingRequest | null>(null);
  const [form] = Form.useForm<EditFormValues>();
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const navigate = useNavigate();
  const { userRequests, cancelUserRequest, updateUserRequest } = useRequests();

  const editStartTime = Form.useWatch('startTime', form);

  const availableDurations = useMemo(() => {
    if (!editStartTime) return ALL_DURATION_OPTIONS;
    const startHour = parseInt(editStartTime.split(':')[0]);
    return ALL_DURATION_OPTIONS.filter(opt => opt.value <= MAX_END_HOUR - startHour);
  }, [editStartTime]);

  // Clear duration when start time changes and current value is no longer valid
  useEffect(() => {
    if (!editStartTime) return;
    const currentDuration = form.getFieldValue('duration');
    if (currentDuration) {
      const startHour = parseInt(editStartTime.split(':')[0]);
      if (startHour + currentDuration > MAX_END_HOUR) {
        form.setFieldValue('duration', undefined);
      }
    }
  }, [editStartTime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Filter to show only PENDING and APPROVED requests
  const visibleRequests = userRequests.filter(
    (req: ParkingRequest) => req.status === 'pending' || req.status === 'approved'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'pending':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const handleEdit = (request: ParkingRequest) => {
    setEditingRequest(request);
    form.setFieldsValue({
      date: dayjs(request.date),
      startTime: request.startTime,
      duration: request.duration,
    });
    setEditModalVisible(true);
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingRequest(null);
    form.resetFields();
  };

  const handleSaveEdit = async (values: EditFormValues) => {
    if (!editingRequest) return;

    const startHour = parseInt(values.startTime.split(':')[0]);
    const endHour = startHour + values.duration;

    if (endHour > MAX_END_HOUR) {
      notification.error({
        message: 'Invalid Time',
        description: `End time ${endHour}:00 exceeds the maximum allowed time of 20:00.`,
      });
      return;
    }

    const endTime = `${String(endHour).padStart(2, '0')}:00`;

    setLoading(true);
    try {
      await updateUserRequest(editingRequest.id, {
        date: values.date?.format('YYYY-MM-DD') || editingRequest.date,
        startTime: values.startTime,
        endTime,
        duration: values.duration,
      });
      setEditModalVisible(false);
      setEditingRequest(null);
      form.resetFields();
      notification.success({
        message: 'Request Updated',
        description: `Request ${editingRequest.id} has been updated successfully.`,
      });
    } catch (err: any) {
      notification.error({
        message: 'Update Failed',
        description: err.message || 'Failed to update the request. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelUserRequest(requestId);
      notification.success({
        message: 'Request Cancelled',
        description: `Request ${requestId} has been cancelled.`,
      });
    } catch (err: any) {
      notification.error({
        message: 'Cancellation Failed',
        description: err.message || 'Failed to cancel the request. Please try again.',
      });
    }
  };

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Time Slot',
      key: 'timeSlot',
      width: 130,
      render: (_, record: ParkingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: 'Dur.',
      dataIndex: 'duration',
      key: 'duration',
      width: 55,
      responsive: ['sm'],
      render: (duration: number) => `${duration}h`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      responsive: ['md'],
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_, record: ParkingRequest) => (
        <Space size={2}>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
              title="Edit"
            />
          )}
          <Popconfirm
            title="Cancel Request"
            description={`Are you sure you want to cancel request ${record.id}?`}
            onConfirm={() => handleCancelRequest(record.id)}
            okText="Yes, Cancel"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              size="small"
              title="Cancel"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = {
    total: visibleRequests.length,
    pending: visibleRequests.filter((r: ParkingRequest) => r.status === 'pending').length,
    approved: visibleRequests.filter((r: ParkingRequest) => r.status === 'approved').length,
  };

  return (
    <div className="my-requests">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>My Requests</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/submit-request')}>
          New Request
        </Button>
      </div>

      {/* Table (desktop) / Card list (mobile) */}
      {isMobile ? (
        <div className="requests-card-list">
          {visibleRequests.length === 0 && (
            <div className="requests-card-empty">No active requests</div>
          )}
          {visibleRequests.map((record: ParkingRequest) => (
            <Card key={record.id} size="small" className="request-card">
              <div className="request-card-header">
                <strong>{record.id}</strong>
                <Tag color={getStatusColor(record.status)}>{getStatusLabel(record.status)}</Tag>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">Date</span>
                <span>{dayjs(record.date).format('DD/MM/YYYY')}</span>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">Time</span>
                <span>{record.startTime} – {record.endTime} ({record.duration}h)</span>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">Submitted</span>
                <span>{dayjs(record.submittedAt).format('DD/MM/YYYY HH:mm')}</span>
              </div>
              <div className="request-card-actions">
                {record.status === 'pending' && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
                )}
                <Popconfirm
                  title="Cancel Request"
                  description={`Cancel request ${record.id}?`}
                  onConfirm={() => handleCancelRequest(record.id)}
                  okText="Yes"
                  cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>Cancel</Button>
                </Popconfirm>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={visibleRequests}
          rowKey="id"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      )}

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginTop: '24px' }}>
        <Col xs={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ fontSize: '11px', color: 'var(--label-color)' }}>Total Active</div>
            </div>
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1890ff' }}>{stats.pending}</div>
              <div style={{ fontSize: '11px', color: 'var(--label-color)' }}>Pending</div>
            </div>
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#52c41a' }}>{stats.approved}</div>
              <div style={{ fontSize: '11px', color: 'var(--label-color)' }}>Approved</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Info */}
      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>My Requests:</strong> Manage your active parking requests. Pending requests can be edited; any active request can be cancelled. Rejected requests are not shown.
      </Card>

      {/* Edit Modal */}
      <Modal
        title={`Edit Request ${editingRequest?.id}`}
        open={editModalVisible}
        onCancel={handleCancelEdit}
        footer={[
          <Button key="cancel" onClick={handleCancelEdit}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={loading}
            onClick={() => form.submit()}
          >
            Save Changes
          </Button>,
        ]}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveEdit}
        >
          <Form.Item
            label="Parking Date"
            name="date"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => {
                return current && current < dayjs().startOf('day');
              }}
              placeholder="Select date"
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              label="Start Time"
              name="startTime"
              rules={[{ required: true, message: 'Please select start time' }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder="Select start time (hourly boundaries)"
                options={HOUR_OPTIONS.map((hour) => ({
                  label: hour,
                  value: hour,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="Duration"
              name="duration"
              rules={[{ required: true, message: 'Please select duration' }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder="Select duration"
                options={availableDurations}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MyRequests;
