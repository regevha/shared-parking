import React, { useState, useMemo, useEffect } from 'react';
import { Form, DatePicker, Select, Button, Card, Alert, notification, Row, Col, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
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

const ParkingRequestForm: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const { addPendingRequest, userRequests } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  const ALL_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6].map(n => ({
    label: t('requestForm.durationOption', { count: n }),
    value: n,
  }));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, t]);

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
        message: t('requestForm.notifications.limitExceeded'),
        description: t('requestForm.notifications.limitExceededDesc'),
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
        message: t('requestForm.notifications.submitted'),
        description: t('requestForm.notifications.submittedDesc', {
          date: values.date?.format('YYYY-MM-DD'),
          startTime: values.startTime,
          endTime,
        }),
        duration: 3,
      });
      form.resetFields();
    } catch (err: any) {
      notification.error({
        message: t('requestForm.notifications.failed'),
        description: err.message || t('requestForm.notifications.failedDesc'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parking-request-form">
      <h1>{t('requestForm.title')}</h1>

      {/* Warning Banner */}
      {hasMaxRequests && (
        <Alert
          title={t('requestForm.limitAlert.title')}
          description={t('requestForm.limitAlert.description')}
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Active Requests List */}
      {activeRequests.length > 0 && (
        <Card
          title={t('requestForm.activeRequestsCard', { count: activeRequests.length, max: MAX_ACTIVE_REQUESTS })}
          style={{ marginBottom: '24px' }}
          size="small"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeRequests.map((req) => (
              <div key={req.id} style={{ padding: '12px', backgroundColor: 'var(--item-bg)', borderRadius: '4px' }}>
                <Row gutter={16}>
                  <Col xs={24} sm={6}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>{t('requestForm.labels.date')}</div>
                    <div style={{ fontWeight: 'bold' }}>{dayjs(req.date).format('DD/MM/YYYY')}</div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>{t('requestForm.labels.timeSlot')}</div>
                    <div style={{ fontWeight: 'bold' }}>{req.startTime} – {req.endTime}</div>
                  </Col>
                  <Col xs={24} sm={9}>
                    <div style={{ fontSize: '12px', color: 'var(--label-color)' }}>{t('requestForm.labels.status')}</div>
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
            label={t('requestForm.labels.parkingDate')}
            name="date"
            rules={[{ required: true, message: t('requestForm.validation.dateRequired') }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => {
                return current && current < dayjs().startOf('day');
              }}
              placeholder={t('requestForm.placeholders.selectDate')}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t('requestForm.labels.startTime')}
                name="startTime"
                rules={[{ required: true, message: t('requestForm.validation.startTimeRequired') }]}
              >
                <Select
                  placeholder={t('requestForm.placeholders.selectStartTime')}
                  options={HOUR_OPTIONS.map((hour) => ({
                    label: hour,
                    value: hour,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={t('requestForm.labels.duration')}
                name="duration"
                rules={[{ required: true, message: t('requestForm.validation.durationRequired') }]}
              >
                <Select
                  placeholder={t('requestForm.placeholders.selectDuration')}
                  options={availableDurations}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* End Time Display */}
          {endTime ? (
            <Form.Item label={t('requestForm.labels.endTime')}>
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
              <Form.Item label={t('requestForm.labels.endTime')}>
                <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                  {t('requestForm.endTimeInvalid')}
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
              {hasMaxRequests ? t('requestForm.submitButtonDisabled') : t('requestForm.submitButton')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Business Rules Info */}
      <Card style={{ marginTop: '24px' }} size="small">
        <h3>{t('requestForm.businessRules.title')}</h3>
        <ul>
          <li>{t('requestForm.businessRules.rule1start')}<strong>{t('requestForm.businessRules.rule1bold')}</strong></li>
          <li>{t('requestForm.businessRules.rule2')}</li>
          <li>{t('requestForm.businessRules.rule3')}</li>
          <li>{t('requestForm.businessRules.rule4')}</li>
          <li>{t('requestForm.businessRules.rule5')}</li>
        </ul>
      </Card>

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('requestForm.title')}:</strong> {t('requestForm.info')}
      </Card>
    </div>
  );
};

export default ParkingRequestForm;
