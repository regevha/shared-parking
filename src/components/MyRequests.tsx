import React, { useState } from 'react';
import { Table, Button, Tag, Space, Modal, Form, DatePicker, Select, notification, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
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

const HOUR_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const DURATION_OPTIONS = [
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
  const { userRequests, cancelUserRequest, updateUserRequest } = useRequests();

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
    const endTime = `${String(startHour + values.duration).padStart(2, '0')}:00`;

    setLoading(true);
    setTimeout(() => {
      updateUserRequest(editingRequest.id, {
        date: values.date?.format('YYYY-MM-DD') || editingRequest.date,
        startTime: values.startTime,
        endTime,
        duration: values.duration,
      });
      setLoading(false);
      setEditModalVisible(false);
      setEditingRequest(null);
      form.resetFields();
      notification.success({
        message: 'Request Updated',
        description: `Request ${editingRequest.id} has been updated successfully.`,
      });
    }, 500);
  };

  const handleCancelRequest = (requestId: string) => {
    // Remove the request from the list
    cancelUserRequest(requestId);

    notification.success({
      message: 'Request Cancelled',
      description: `Request ${requestId} has been cancelled.`,
    });
  };

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: 'Request ID',
      dataIndex: 'id',
      key: 'id',
      width: '15%',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Time Slot',
      key: 'timeSlot',
      width: '20%',
      render: (_, record: ParkingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: '12%',
      render: (duration: number) => `${duration}h`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '15%',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} style={{ color: '#000' }}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: '20%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '18%',
      render: (_, record: ParkingRequest) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            >
              Edit
            </Button>
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
            >
              Cancel
            </Button>
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
      <h1>My Requests</h1>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', backgroundColor: '#f0f2f5', borderRadius: '4px', minWidth: '120px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Active</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#e6f7ff', borderRadius: '4px', minWidth: '120px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{stats.pending}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '4px', minWidth: '120px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{stats.approved}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Approved</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f2f5', borderRadius: '4px' }}>
        <strong>My Requests:</strong> View and manage your parking requests. You can edit pending requests or cancel any active request.
        Rejected requests are not shown here.
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={visibleRequests}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
        size="middle"
      />

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
                options={DURATION_OPTIONS}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MyRequests;
