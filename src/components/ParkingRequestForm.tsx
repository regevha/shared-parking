import React, { useState, useMemo, useEffect } from 'react';
import { Form, DatePicker, Select, Button, Card, Alert, notification, Row, Col, Tag } from 'antd';
import { useRequests } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import './ParkingRequestForm.css';

interface FormValues {
  date: Dayjs | null;
  startTime: string;
  duration: number;
}

const MAX_END_HOUR = 20;
const MAX_ACTIVE_REQUESTS = 3;

// 20:00 is excluded: no valid duration fits (min 1h would exceed 20:00)
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

const ParkingRequestForm: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const { addPendingRequest, userRequests } = useRequests();
  const { user } = useAuth();

  const activeRequests = userRequests.filter(
    r => r.status === 'pending' || r.status === 'approved'
  );
  const hasMaxRequests = activeRequests.length >= MAX_ACTIVE_REQUESTS;

  // Watch form values for end time calculation and duration filtering
  const startTime = Form.useWatch('startTime', form);
  const duration = Form.useWatch('duration', form);

  // Filter durations so end time never exceeds MAX_END_HOUR
  const availableDurations = useMemo(() => {
    if (!startTime) return ALL_DURATION_OPTIONS;
    const startHour = parseInt(startTime.split(':')[0]);
    const maxDuration = MAX_END_HOUR - startHour;
    return ALL_DURATION_OPTIONS.filter(opt => opt.value <= maxDuration);
  }, [startTime]);

  // Clear duration when start time changes and the current value is no longer valid
  useEffect(() => {
    if (!startTime || !duration) return;
    const startHour = parseInt(startTime.split(':')[0]);
    if (startHour + duration > MAX_END_HOUR) {
      form.setFieldValue('duration', undefined);
    }
  }, [startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate end time
  const endTime = useMemo(() => {
    if (!startTime || !duration) return null;
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = startHour + duration;
    if (endHour > MAX_END_HOUR) return null;
    return `${String(endHour).padStart(2, '0')}:00`;
  }, [startTime, duration]);

  const handleFormChange = () => {
    form.validateFields();
  };

  const handleSubmit = async (values: FormValues) => {
    if (hasMaxRequests) {
      notification.error({
        message: 'Request Limit Exceeded',
        description: 'You already have the maximum number of active requests (3). Please wait for an existing request to expire.',
      });
      return;
    }

    setLoading(true);
    try {
      await addPendingRequest({
        requesterId:   user?.id   ?? '',
        requesterName: user?.name ?? '',
        date: values.date?.format('YYYY-MM-DD') || '',
        startTime: values.startTime,
        endTime: endTime || '',
        duration: values.duration,
      });
      notification.success({
        message: 'Request Submitted',
        description: `Parking request submitted for ${values.date?.format('YYYY-MM-DD')} from ${values.startTime} to ${endTime}`,
        duration: 3,
      });
      form.resetFields();
    } catch (err: any) {
      notification.error({
        message: 'Submission Failed',
        description: err.message || 'Failed to submit the request. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parking-request-form">
      <h1>Submit Parking Request</h1>

      {/* Warning Banner */}
      {hasMaxRequests && (
        <Alert
          message="Request Limit Reached"
          description="You currently have the maximum number of active parking requests (3). You cannot submit new requests until one of your existing requests is approved or cancelled."
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Active Requests List */}
      {activeRequests.length > 0 && (
        <Card
          title={`Your Active Requests (${activeRequests.length} / ${MAX_ACTIVE_REQUESTS})`}
          style={{ marginBottom: '24px' }}
          size="small"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeRequests.map((req) => (
              <div key={req.id} style={{ padding: '12px', backgroundColor: 'var(--item-bg)', borderRadius: '4px' }}>
                <Row gutter={16}>
                  <Col xs={24} sm={6}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>Date</div>
                    <div style={{ fontWeight: 'bold' }}>{dayjs(req.date).format('DD/MM/YYYY')}</div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>Time Slot</div>
                    <div style={{ fontWeight: 'bold' }}>{req.startTime} – {req.endTime}</div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>Status</div>
                    <Tag color={getRequestStatusColor(req.status)}>
                      {getRequestStatusLabel(req.status)}
                    </Tag>
                  </Col>
                </Row>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Form */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleFormChange}
          disabled={hasMaxRequests}
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

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Start Time"
                name="startTime"
                rules={[{ required: true, message: 'Please select start time' }]}
              >
                <Select
                  placeholder="Select start time (hourly boundaries)"
                  options={HOUR_OPTIONS.map((hour) => ({
                    label: hour,
                    value: hour,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Duration"
                name="duration"
                rules={[{ required: true, message: 'Please select duration' }]}
              >
                <Select
                  placeholder="Select duration"
                  options={availableDurations}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* End Time Display */}
          {endTime ? (
            <Form.Item label="End Time">
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--item-bg)',
                  borderRadius: '2px',
                  border: '1px solid var(--message-bubble-border)',
                  fontWeight: 'bold',
                }}
              >
                {endTime}
              </div>
            </Form.Item>
          ) : (
            form.getFieldValue('startTime') && form.getFieldValue('duration') && (
              <Form.Item label="End Time">
                <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  ⚠️ Invalid: End time would exceed 20:00
                </div>
              </Form.Item>
            )
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              disabled={hasMaxRequests || !endTime}
            >
              {hasMaxRequests ? 'Cannot Submit (Max Requests Reached)' : 'Submit Request'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Business Rules Info */}
      <Card style={{ marginTop: '24px' }} size="small">
        <h3>Business Rules</h3>
        <ul>
          <li>You can have a maximum of <strong>3 concurrent active requests</strong></li>
          <li>Select any date from today onwards</li>
          <li>Start time must be on hourly boundaries (08:00 – 19:00)</li>
          <li>Duration is 1–6 hours, automatically limited so end time never exceeds 20:00</li>
          <li>End time is auto-calculated and cannot exceed 20:00</li>
        </ul>
      </Card>
    </div>
  );
};

export default ParkingRequestForm;
