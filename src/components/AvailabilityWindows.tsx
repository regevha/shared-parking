import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker, Alert, Space, Row, Col, Tag, Modal, Form, notification, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../api/users';
import type { AvailabilityWindow } from '../api/auth';
import './AvailabilityWindows.css';

interface DayWindows {
  [key: string]: AvailabilityWindow[];
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

const MAX_WINDOWS_PER_DAY = 5;

// Ensure every day of the week has an entry (even if empty)
function normalise(raw: Record<string, AvailabilityWindow[]>): DayWindows {
  const out: DayWindows = {};
  DAYS_OF_WEEK.forEach(day => { out[day] = raw[day] ?? []; });
  return out;
}

// Convert HH:MM to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}

const AvailabilityWindows: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const [windows, setWindows] = useState<DayWindows>(normalise({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    if (!user) return;
    usersApi.getPreferences(user.id)
      .then(prefs => setWindows(normalise(prefs.availabilityWindows)))
      .catch(() => notification.error({ message: t('availabilityWindows.notifications.loadFailed') }))
      .finally(() => setLoading(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (next: DayWindows) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await usersApi.updatePreferences(user.id, {
        availability_windows: JSON.stringify(next),
      });
      updateUser({ preferences: { ...user.preferences, availabilityWindows: updated.availabilityWindows } });
    } catch {
      notification.error({ message: t('availabilityWindows.notifications.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleAddWindow = (day: string) => {
    setSelectedDay(day);
    setAddModalVisible(true);
    form.resetFields();
  };

  const handleDeleteWindow = async (day: string, windowId: string) => {
    const next = { ...windows, [day]: windows[day].filter(w => w.id !== windowId) };
    setWindows(next);
    await persist(next);
    notification.success({ message: t('availabilityWindows.notifications.removed') });
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const startTime = values.timeRange[0].format('HH:mm');
      const endTime   = values.timeRange[1].format('HH:mm');

      const hasOverlap = (windows[selectedDay] || []).some(w =>
        timeRangesOverlap(startTime, endTime, w.startTime, w.endTime)
      );
      if (hasOverlap) {
        notification.error({ message: t('availabilityWindows.notifications.overlap') });
        return;
      }

      saveWindow(startTime, endTime);
    });
  };

  const saveWindow = async (startTime: string, endTime: string) => {
    const newWindow: AvailabilityWindow = { id: Date.now().toString(), startTime, endTime };
    const next = { ...windows, [selectedDay]: [...(windows[selectedDay] || []), newWindow] };
    setWindows(next);
    setAddModalVisible(false);
    await persist(next);
    notification.success({ message: t('availabilityWindows.notifications.added') });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: '80px' }}><Spin size="large" /></div>;
  }

  return (
    <div className="availability-windows">
      <h1>{t('availabilityWindows.title')}</h1>

      <Spin spinning={saving} tip={t('availabilityWindows.saving')}>
        <Row gutter={[16, 16]}>
          {DAYS_OF_WEEK.map(day => (
            <Col xs={24} sm={12} lg={8} key={day}>
              <Card
                title={<Space><ClockCircleOutlined />{t(`availabilityWindows.days.${day.toLowerCase()}`)}</Space>}
                size="small"
              >
                <div style={{ minHeight: '120px' }}>
                  {windows[day] && windows[day].length > 0 ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {windows[day].map(w => (
                        <div key={w.id} className="window-item">
                          <Tag color="green">{w.startTime} – {w.endTime}</Tag>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteWindow(day, w.id)}
                          />
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <div className="no-windows-text">
                      {t('availabilityWindows.noWindows')}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    disabled={(windows[day] || []).length >= MAX_WINDOWS_PER_DAY}
                    onClick={() => handleAddWindow(day)}
                    size="small"
                  >
                    {t('availabilityWindows.addWindow')}
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Modal
        title={t('availabilityWindows.modal.title', { day: t(`availabilityWindows.days.${selectedDay.toLowerCase()}`) })}
        open={addModalVisible}
        onOk={handleModalOk}
        onCancel={() => setAddModalVisible(false)}
        okText={t('availabilityWindows.modal.okText')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="timeRange"
            label={t('availabilityWindows.modal.timeRangeLabel')}
            rules={[
              { required: true, message: t('availabilityWindows.modal.timeRangeRequired') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (value[0].isSameOrAfter(value[1])) return Promise.reject(t('availabilityWindows.modal.endAfterStart'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={15}
              placeholder={[t('availabilityWindows.modal.startPlaceholder'), t('availabilityWindows.modal.endPlaceholder')]}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('availabilityWindows.title')}:</strong> {t('availabilityWindows.info', { max: MAX_WINDOWS_PER_DAY })}
      </Card>
    </div>
  );
};

export default AvailabilityWindows;
