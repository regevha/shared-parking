import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker, Alert, Space, Row, Col, Tag, Modal, Form, notification, Spin, Skeleton } from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../api/users';
import type { NotificationWindow } from '../api/auth';
import './NotificationWindows.css';

interface DayWindows {
  [key: string]: NotificationWindow[];
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

const BLACKOUT_START = '22:00';
const BLACKOUT_END = '06:00';
const MAX_WINDOWS_PER_DAY = 2;

function normalise(raw: Record<string, NotificationWindow[]>): DayWindows {
  const out: DayWindows = {};
  DAYS_OF_WEEK.forEach(day => { out[day] = raw[day] ?? []; });
  return out;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}

function overlapsWithBlackout(startTime: string, endTime: string): boolean {
  const bs = timeToMinutes(BLACKOUT_START);
  const be = timeToMinutes(BLACKOUT_END);
  const ws = timeToMinutes(startTime);
  const we = timeToMinutes(endTime);
  return ws >= bs || we <= be;
}

const NotificationWindows: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [windows, setWindows] = useState<DayWindows>(normalise({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    setWindows(normalise(user.preferences.notificationWindows));
    setLoading(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (next: DayWindows) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await usersApi.updatePreferences(user.id, {
        notification_windows: JSON.stringify(next),
      });
      updateUser({ preferences: { ...user.preferences, notificationWindows: updated.notificationWindows } });
    } catch {
      notification.error({ message: t('notificationWindows.notifications.saveFailed') });
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
    notification.success({ message: t('notificationWindows.notifications.removed') });
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const startTime = values.timeRange[0].format('HH:mm');
      const endTime   = values.timeRange[1].format('HH:mm');

      const hasOverlap = (windows[selectedDay] || []).some(w =>
        timeRangesOverlap(startTime, endTime, w.startTime, w.endTime)
      );
      if (hasOverlap) {
        notification.error({ message: t('notificationWindows.notifications.overlap') });
        return;
      }

      if (overlapsWithBlackout(startTime, endTime)) {
        Modal.confirm({
          title: t('notificationWindows.blackoutWarning.title'),
          content: t('notificationWindows.blackoutWarning.content'),
          okText: t('notificationWindows.blackoutWarning.ok'),
          cancelText: t('notificationWindows.blackoutWarning.cancel'),
          onOk: () => saveWindow(startTime, endTime),
        });
      } else {
        saveWindow(startTime, endTime);
      }
    });
  };

  const saveWindow = async (startTime: string, endTime: string) => {
    const newWindow: NotificationWindow = { id: Date.now().toString(), startTime, endTime };
    const next = { ...windows, [selectedDay]: [...(windows[selectedDay] || []), newWindow] };
    setWindows(next);
    setAddModalVisible(false);
    await persist(next);
    notification.success({ message: t('notificationWindows.notifications.added') });
  };

  if (loading) {
    return <div style={{ padding: '24px' }}><Skeleton active paragraph={{ rows: 8 }} /></div>;
  }

  return (
    <div className="notification-windows">
      <h1>{t('notificationWindows.title')}</h1>

      <Alert
        message={t('notificationWindows.blackoutAlert.message')}
        description={t('notificationWindows.blackoutAlert.description')}
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Spin spinning={saving} tip={t('notificationWindows.saving')}>
        <Row gutter={[16, 16]}>
          {DAYS_OF_WEEK.map(day => (
            <Col xs={24} sm={12} lg={8} key={day}>
              <Card
                title={<Space><ClockCircleOutlined />{t(`notificationWindows.days.${day.toLowerCase()}`)}</Space>}
                size="small"
              >
                <div style={{ minHeight: '120px' }}>
                  {windows[day] && windows[day].length > 0 ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {windows[day].map(w => (
                        <div key={w.id} className="window-item">
                          <Tag color="blue">{w.startTime} – {w.endTime}</Tag>
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
                      {t('notificationWindows.noWindows')}
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
                    {t('notificationWindows.addWindow')}
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Modal
        title={t('notificationWindows.modal.title', { day: t(`notificationWindows.days.${selectedDay.toLowerCase()}`) })}
        open={addModalVisible}
        width={isMobile ? '95vw' : 520}
        onOk={handleModalOk}
        onCancel={() => setAddModalVisible(false)}
        okText={t('notificationWindows.modal.okText')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="timeRange"
            label={t('notificationWindows.modal.timeRangeLabel')}
            rules={[
              { required: true, message: t('notificationWindows.modal.timeRangeRequired') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (value[0].isSameOrAfter(value[1])) return Promise.reject(t('notificationWindows.modal.endAfterStart'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={15}
              placeholder={[t('notificationWindows.modal.startPlaceholder'), t('notificationWindows.modal.endPlaceholder')]}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('notificationWindows.title')}:</strong> {t('notificationWindows.info', { max: MAX_WINDOWS_PER_DAY })}
      </Card>
    </div>
  );
};

export default NotificationWindows;
