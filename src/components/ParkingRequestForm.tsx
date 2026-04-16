import React, { useState, useMemo, useEffect } from 'react';
import { Form, DatePicker, Select, Button, Card, Alert, notification, Row, Col, Tag } from 'antd';
import InfoBanner from './InfoBanner';
import { useTranslation } from 'react-i18next';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { RequestStatus } from '../types/enums';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import './ParkingRequestForm.css';

interface FormValues {
  date: Dayjs | null;
  startTime: string;
  duration: number;
}

const MAX_PENDING_REQUESTS = 5;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const ParkingRequestForm: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const { addPendingRequest, userRequests } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  const ALL_DURATION_OPTIONS = Array.from({ length: 36 }, (_, i) => i + 1).map(n => ({
    label: t('requestForm.durationOption', { count: n }),
    value: n,
  }));

  const activeRequests = useMemo(() => {
    return userRequests
      .filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.APPROVED)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });
  }, [userRequests]);

  const hasMaxRequests = activeRequests.length >= MAX_PENDING_REQUESTS;

  // Watch form values for end time calculation
  const dateValue = Form.useWatch('date', form);
  const startTime = Form.useWatch('startTime', form);
  const duration = Form.useWatch('duration', form);

  // Auto-calculate end date and time
  const { endDate, endTime } = useMemo(() => {
    if (!dateValue || !startTime || !duration) return { endDate: null, endTime: null };
    const startHour = parseInt(startTime.split(':')[0]);
    const endDateTime = dayjs(dateValue).startOf('day').add(startHour + duration, 'hour');
    return {
      endDate: endDateTime.format('YYYY-MM-DD'),
      endTime: endDateTime.format('HH:mm'),
    };
  }, [dateValue, startTime, duration]);

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

    if (!user?.id || !user?.name) {
      notification.error({
        message: t('requestForm.notifications.failed'),
        description: 'User not authenticated. Please log in again.',
      });
      return;
    }

    setLoading(true);
    try {
      await addPendingRequest({
        requesterId:   user.id,
        requesterName: user.name,
        date: values.date?.format('YYYY-MM-DD') || '',
        startTime: values.startTime,
        endDate: endDate || '',
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
          message={t('requestForm.limitAlert.title')}
          description={t('requestForm.limitAlert.description')}
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {/* Active Requests List */}
      {activeRequests.length > 0 && (
        <Card
          title={t('requestForm.activeRequestsCard', { count: activeRequests.length, max: MAX_PENDING_REQUESTS })}
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
                      {t(getRequestStatusLabel(req.status))}
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
                  options={ALL_DURATION_OPTIONS}
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
                {endDate !== dateValue?.format('YYYY-MM-DD') && (
                  <Tag color="blue" style={{ marginRight: '8px' }}>
                    {dayjs(endDate).format('DD/MM')}
                  </Tag>
                )}
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

      <InfoBanner label={`${t('requestForm.title')}:`} description={t('requestForm.info')} />
    </div>
  );
};

export default ParkingRequestForm;
