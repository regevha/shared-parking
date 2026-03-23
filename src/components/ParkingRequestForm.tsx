import React, { useState, useMemo } from 'react';
import { Form, DatePicker, Select, Button, Card, Alert, notification, Row, Col, Tag } from 'antd';
import { useRequests } from '../contexts/RequestsContext';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import './ParkingRequestForm.css';

interface FormValues {
  date: Dayjs | null;
  startTime: string;
  duration: number;
}

interface ActiveRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
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

const MAX_ACTIVE_REQUESTS = 3;

const ParkingRequestForm: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [simulateMaxRequests, setSimulateMaxRequests] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addPendingRequest } = useRequests();

  // Mock active requests
  const mockActiveRequests: ActiveRequest[] = simulateMaxRequests
    ? [
        { id: '1', date: '2026-03-25', startTime: '09:00', endTime: '11:00' },
        { id: '2', date: '2026-03-26', startTime: '14:00', endTime: '16:00' },
        { id: '3', date: '2026-03-27', startTime: '10:00', endTime: '13:00' },
      ]
    : [];

  const hasMaxRequests = mockActiveRequests.length >= MAX_ACTIVE_REQUESTS;

  // Watch form values for end time calculation
  const startTime = Form.useWatch('startTime', form);
  const duration = Form.useWatch('duration', form);

  // Auto-calculate end time
  const endTime = useMemo(() => {
    if (!startTime || !duration) return null;

    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + duration;

    if (endHours > 23) {
      return null; // Invalid: goes past midnight
    }

    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }, [startTime, duration]);

  const handleFormChange = () => {
    // Trigger re-render to update end time
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

    // Simulate API call
    setTimeout(() => {
      setLoading(false);

      // Add the request to the shared state
      addPendingRequest({
        requesterId: 'current-user',
        requesterName: 'Current User',
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
    }, 1000);
  };

  return (
    <div className="parking-request-form">
      <h1>Submit Parking Request</h1>

      {/* Simulation Toggle */}
      <Card style={{ marginBottom: '24px', backgroundColor: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="checkbox"
            id="simulate-max"
            checked={simulateMaxRequests}
            onChange={(e) => setSimulateMaxRequests(e.target.checked)}
          />
          <label htmlFor="simulate-max" style={{ margin: 0, cursor: 'pointer' }}>
            <strong>Simulate: Already has 3 active requests</strong>
          </label>
        </div>
      </Card>

      {/* Warning Banner */}
      {hasMaxRequests && (
        <Alert
          message="Request Limit Reached"
          description="You currently have the maximum number of active parking requests (3). You cannot submit new requests until one of your existing requests expires."
          type="warning"
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Active Requests List */}
      {mockActiveRequests.length > 0 && (
        <Card
          title="Your Active Requests"
          style={{ marginBottom: '24px' }}
          size="small"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockActiveRequests.map((req) => (
              <div key={req.id} style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <Row gutter={16}>
                  <Col xs={24} sm={6}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Date</div>
                    <div style={{ fontWeight: 'bold' }}>{req.date}</div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Time Slot</div>
                    <div style={{ fontWeight: 'bold' }}>
                      {req.startTime} - {req.endTime}
                    </div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Status</div>
                    <Tag color="blue">Active</Tag>
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
                  options={DURATION_OPTIONS}
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
                  backgroundColor: '#f5f5f5',
                  borderRadius: '2px',
                  border: '1px solid #d9d9d9',
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
                  ⚠️ Invalid: Duration would exceed 23:00
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
          <li>Start time must be on hourly boundaries (08:00 - 20:00)</li>
          <li>Duration can be 1 to 6 hours in 1-hour increments</li>
          <li>End time is auto-calculated and cannot exceed 23:00</li>
        </ul>
      </Card>
    </div>
  );
};

export default ParkingRequestForm;
