import React, { useState, useEffect } from 'react';
import { Card, Button, TimePicker, Alert, Space, Row, Col, Tag, Modal, Form, notification, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
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

// Ensure every day of the week has an entry (even if empty)
function normalise(raw: Record<string, NotificationWindow[]>): DayWindows {
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

// Check if a window overlaps the overnight blackout period (22:00–06:00)
function overlapsWithBlackout(startTime: string, endTime: string): boolean {
  const bs = timeToMinutes(BLACKOUT_START); // 1320
  const be = timeToMinutes(BLACKOUT_END);   // 360
  const ws = timeToMinutes(startTime);
  const we = timeToMinutes(endTime);
  // Blackout spans midnight: any window that starts at/after 22:00 or ends at/before 06:00
  return ws >= bs || we <= be;
}

const NotificationWindows: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [windows, setWindows] = useState<DayWindows>(normalise({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [form] = Form.useForm();

  // ── Load preferences on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    usersApi.getPreferences(user.id)
      .then(prefs => setWindows(normalise(prefs.notificationWindows)))
      .catch(() => notification.error({ message: 'Failed to load notification preferences' }))
      .finally(() => setLoading(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist windows to backend ────────────────────────────────────────────
  const persist = async (next: DayWindows) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await usersApi.updatePreferences(user.id, {
        notification_windows: JSON.stringify(next),
      });
      // Keep AuthContext in sync so other components see the latest preferences
      updateUser({ preferences: { ...user.preferences, notificationWindows: updated.notificationWindows } });
    } catch {
      notification.error({ message: 'Failed to save notification preferences' });
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddWindow = (day: string) => {
    setSelectedDay(day);
    setAddModalVisible(true);
    form.resetFields();
  };

  const handleDeleteWindow = async (day: string, windowId: string) => {
    const next = { ...windows, [day]: windows[day].filter(w => w.id !== windowId) };
    setWindows(next);
    await persist(next);
    notification.success({ message: 'Notification window removed' });
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      const startTime = values.timeRange[0].format('HH:mm');
      const endTime   = values.timeRange[1].format('HH:mm');

      const hasOverlap = (windows[selectedDay] || []).some(w =>
        timeRangesOverlap(startTime, endTime, w.startTime, w.endTime)
      );
      if (hasOverlap) {
        notification.error({ message: 'This time range overlaps with an existing notification window' });
        return;
      }

      if (overlapsWithBlackout(startTime, endTime)) {
        Modal.confirm({
          title: 'Blackout Period Warning',
          content: 'This notification window overlaps with the blackout period (22:00–06:00). Notifications will not be delivered during this time.',
          okText: 'Save Anyway',
          cancelText: 'Cancel',
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
    notification.success({ message: 'Notification window added' });
  };

  const canAddWindow = (day: string) => (windows[day] || []).length < MAX_WINDOWS_PER_DAY;

  if (loading) {
    return (
      <div className="notification-windows" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="notification-windows">
      <h1>Notification Window Preferences</h1>

      <Alert
        message="No notifications are delivered between 22:00 and 06:00"
        description="This blackout period applies system-wide to prevent disturbances during nighttime hours."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Spin spinning={saving} tip="Saving…">
        <Row gutter={[16, 16]}>
          {DAYS_OF_WEEK.map(day => (
            <Col xs={24} sm={12} lg={8} key={day}>
              <Card
                title={<Space><ClockCircleOutlined />{day}</Space>}
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
                    <div style={{ color: '#999', fontStyle: 'italic', padding: '20px 0' }}>
                      No windows set — system default applies
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    disabled={!canAddWindow(day)}
                    onClick={() => handleAddWindow(day)}
                    size="small"
                  >
                    Add Window
                  </Button>
                  {!canAddWindow(day) && (
                    <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px' }}>
                      Maximum {MAX_WINDOWS_PER_DAY} windows per day
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* Add Window Modal */}
      <Modal
        title={`Add Notification Window — ${selectedDay}`}
        open={addModalVisible}
        onOk={handleModalOk}
        onCancel={() => setAddModalVisible(false)}
        okText="Add Window"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="timeRange"
            label="Time Range"
            rules={[
              { required: true, message: 'Please select a time range' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (value[0].isSameOrAfter(value[1]))
                    return Promise.reject('End time must be after start time');
                  return Promise.resolve();
                },
              },
            ]}
          >
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={15}
              placeholder={['Start time', 'End time']}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>Notification Windows:</strong> Set the time slots when you are willing to receive
        parking notifications. Up to {MAX_WINDOWS_PER_DAY} windows per day. Changes are saved immediately.
      </Card>
    </div>
  );
};

export default NotificationWindows;
