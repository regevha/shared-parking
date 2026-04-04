import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Space, Modal, Form, DatePicker, Select, notification, Popconfirm, Card, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
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

const MyRequests: React.FC = () => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ParkingRequest | null>(null);
  const [form] = Form.useForm<EditFormValues>();
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userRequests, cancelUserRequest, updateUserRequest } = useRequests();

  const ALL_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6].map(n => ({
    label: t('myRequests.durationOption', { count: n }),
    value: n,
  }));

  const editStartTime = Form.useWatch('startTime', form);

  const availableDurations = useMemo(() => {
    if (!editStartTime) return ALL_DURATION_OPTIONS;
    const startHour = parseInt(editStartTime.split(':')[0]);
    return ALL_DURATION_OPTIONS.filter(opt => opt.value <= MAX_END_HOUR - startHour);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editStartTime, t]);

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

  // Filter to show only PENDING and APPROVED requests, newest date+time first
  const visibleRequests = userRequests
    .filter((req: ParkingRequest) => req.status === 'pending' || req.status === 'approved')
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : b.startTime.localeCompare(a.startTime);
    });


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
        message: t('myRequests.notifications.invalidTime'),
        description: t('myRequests.notifications.invalidTimeDesc', { endHour }),
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
        message: t('myRequests.notifications.updated'),
        description: t('myRequests.notifications.updatedDesc', { id: editingRequest.id }),
      });
    } catch (err: any) {
      notification.error({
        message: t('myRequests.notifications.updateFailed'),
        description: err.message || t('myRequests.notifications.updateFailedDesc'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelUserRequest(requestId);
      notification.success({
        message: t('myRequests.notifications.cancelled'),
        description: t('myRequests.notifications.cancelledDesc', { id: requestId }),
      });
    } catch (err: any) {
      notification.error({
        message: t('myRequests.notifications.cancelFailed'),
        description: err.message || t('myRequests.notifications.cancelFailedDesc'),
      });
    }
  };

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: t('myRequests.columns.id'),
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: t('myRequests.columns.timeSlot'),
      key: 'timeSlot',
      width: 130,
      render: (_, record: ParkingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: t('myRequests.columns.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 55,
      responsive: ['sm'],
      render: (duration: number) => `${duration}h`,
    },
    {
      title: t('myRequests.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (_: any, record: ParkingRequest) => (
        <>
          <Tag color={getRequestStatusColor(record.status)}>
            {getRequestStatusLabel(record.status)}
          </Tag>
          {record.approvedBy === 'auto' && (
            <Tag color="purple" style={{ fontSize: '11px' }}>Auto</Tag>
          )}
        </>
      ),
    },
    {
      title: t('myRequests.columns.submitted'),
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
              title={t('myRequests.actions.edit')}
            />
          )}
          <Popconfirm
            title={t('myRequests.cancelConfirm.title')}
            description={t('myRequests.cancelConfirm.description', { id: record.id })}
            onConfirm={() => handleCancelRequest(record.id)}
            okText={t('myRequests.cancelConfirm.ok')}
            cancelText={t('myRequests.cancelConfirm.no')}
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              size="small"
              title={t('myRequests.actions.cancel')}
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
        <h1 style={{ margin: 0 }}>{t('myRequests.title')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/submit-request')}>
          {t('myRequests.newRequest')}
        </Button>
      </div>

      {/* Table (desktop) / Card list (mobile) */}
      {isMobile ? (
        <div className="requests-card-list">
          {visibleRequests.length === 0 && (
            <div className="requests-card-empty">{t('myRequests.noActiveRequests')}</div>
          )}
          {visibleRequests.map((record: ParkingRequest) => (
            <Card key={record.id} size="small" className="request-card">
              <div className="request-card-header">
                <strong>{record.id}</strong>
                <div>
                  <Tag color={getRequestStatusColor(record.status)}>{getRequestStatusLabel(record.status)}</Tag>
                  {record.approvedBy === 'auto' && (
                    <Tag color="purple" style={{ fontSize: '11px' }}>Auto</Tag>
                  )}
                </div>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">{t('myRequests.mobile.date')}</span>
                <span>{dayjs(record.date).format('DD/MM/YYYY')}</span>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">{t('myRequests.mobile.time')}</span>
                <span>{record.startTime} – {record.endTime} ({record.duration}h)</span>
              </div>
              <div className="request-card-row">
                <span className="request-card-label">{t('myRequests.mobile.submitted')}</span>
                <span>{dayjs(record.submittedAt).format('DD/MM/YYYY HH:mm')}</span>
              </div>
              <div className="request-card-actions">
                {record.status === 'pending' && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                    {t('myRequests.actions.edit')}
                  </Button>
                )}
                <Popconfirm
                  title={t('myRequests.cancelConfirm.title')}
                  description={t('myRequests.cancelConfirm.descriptionMobile', { id: record.id })}
                  onConfirm={() => handleCancelRequest(record.id)}
                  okText={t('myRequests.cancelConfirm.okMobile')}
                  cancelText={t('myRequests.cancelConfirm.no')}
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    {t('myRequests.actions.cancel')}
                  </Button>
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
      <Card size="small" style={{ marginTop: '24px' }}>
        <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <strong style={{ fontSize: '18px', color: '#000', marginRight: '8px' }}>{stats.total}</strong>
            <span style={{ color: '#666' }}>{t('myRequests.stats.totalActive')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#1890ff', marginRight: '8px' }}>{stats.pending}</strong>
            <span style={{ color: '#666' }}>{t('myRequests.stats.pending')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#52c41a', marginRight: '8px' }}>{stats.approved}</strong>
            <span style={{ color: '#666' }}>{t('myRequests.stats.approved')}</span>
          </div>
        </Space>
      </Card>

      {/* Info */}
      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('myRequests.title')}:</strong> {t('myRequests.info')}
      </Card>

      {/* Edit Modal */}
      <Modal
        title={t('myRequests.editModal.title', { id: editingRequest?.id })}
        open={editModalVisible}
        onCancel={handleCancelEdit}
        footer={[
          <Button key="cancel" onClick={handleCancelEdit}>
            {t('myRequests.editModal.cancel')}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={loading}
            onClick={() => form.submit()}
          >
            {t('myRequests.editModal.saveChanges')}
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
            label={t('myRequests.editModal.parkingDate')}
            name="date"
            rules={[{ required: true, message: t('myRequests.editModal.dateRequired') }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => {
                return current && current < dayjs().startOf('day');
              }}
              placeholder={t('myRequests.editModal.selectDate')}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              label={t('myRequests.editModal.startTime')}
              name="startTime"
              rules={[{ required: true, message: t('myRequests.editModal.startTimeRequired') }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder={t('myRequests.editModal.selectStartTime')}
                options={HOUR_OPTIONS.map((hour) => ({
                  label: hour,
                  value: hour,
                }))}
              />
            </Form.Item>
            <Form.Item
              label={t('myRequests.editModal.duration')}
              name="duration"
              rules={[{ required: true, message: t('myRequests.editModal.durationRequired') }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder={t('myRequests.editModal.selectDuration')}
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
