import React, { useState } from 'react';
import { Card, Button, TimePicker, Alert, Space, Row, Col, Tag, Modal, Form, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import './NotificationWindows.css';

interface NotificationWindow {
  id: string;
  startTime: string;
  endTime: string;
}

interface DayWindows {
  [key: string]: NotificationWindow[];
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Mock data - hardcoded notification windows
const initialWindows: DayWindows = {
  'Monday': [
    { id: '1', startTime: '09:00', endTime: '12:00' },
    { id: '2', startTime: '14:00', endTime: '17:00' }
  ],
  'Tuesday': [
    { id: '3', startTime: '10:00', endTime: '15:00' }
  ],
  'Wednesday': [],
  'Thursday': [
    { id: '4', startTime: '08:00', endTime: '11:00' }
  ],
  'Friday': [],
  'Saturday': [],
  'Sunday': []
};

const NotificationWindows: React.FC = () => {
  const [windows, setWindows] = useState<DayWindows>(initialWindows);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [form] = Form.useForm();

  const BLACKOUT_START = '22:00';
  const BLACKOUT_END = '06:00';
  const MAX_WINDOWS_PER_DAY = 2;

  // Check if two time ranges overlap
  const timeRangesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    const start1Minutes = timeToMinutes(start1);
    const end1Minutes = timeToMinutes(end1);
    const start2Minutes = timeToMinutes(start2);
    const end2Minutes = timeToMinutes(end2);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  };

  // Convert HH:MM to minutes since midnight
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if a time range overlaps with blackout period (22:00-06:00)
  const overlapsWithBlackout = (startTime: string, endTime: string): boolean => {
    const blackoutStart = timeToMinutes(BLACKOUT_START);
    const blackoutEnd = timeToMinutes(BLACKOUT_END);
    const windowStart = timeToMinutes(startTime);
    const windowEnd = timeToMinutes(endTime);

    // Handle overnight blackout period (22:00 to 06:00 next day)
    if (blackoutStart > blackoutEnd) {
      // Blackout spans midnight
      return (windowStart < blackoutEnd || windowStart >= blackoutStart) ||
             (windowEnd <= blackoutEnd && windowEnd > blackoutStart) ||
             (windowStart <= blackoutEnd && windowEnd >= blackoutStart);
    } else {
      // Normal case
      return windowStart < blackoutEnd && windowEnd > blackoutStart;
    }
  };

  const handleAddWindow = (day: string) => {
    setSelectedDay(day);
    setAddModalVisible(true);
    form.resetFields();
  };

  const handleDeleteWindow = (day: string, windowId: string) => {
    setWindows(prev => ({
      ...prev,
      [day]: prev[day].filter(w => w.id !== windowId)
    }));
    message.success('Notification window deleted');
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      const startTime = values.timeRange[0].format('HH:mm');
      const endTime = values.timeRange[1].format('HH:mm');

      // Check for overlaps with existing windows
      const existingWindows = windows[selectedDay] || [];
      const hasOverlap = existingWindows.some(window =>
        timeRangesOverlap(startTime, endTime, window.startTime, window.endTime)
      );

      if (hasOverlap) {
        message.error('This time range overlaps with an existing notification window');
        return;
      }

      // Check blackout overlap and show warning
      if (overlapsWithBlackout(startTime, endTime)) {
        Modal.confirm({
          title: 'Blackout Period Warning',
          content: 'This notification window overlaps with the blackout period (22:00-06:00). Notifications will not be delivered during this time.',
          okText: 'Save Anyway',
          cancelText: 'Cancel',
          onOk: () => saveWindow(startTime, endTime),
        });
      } else {
        saveWindow(startTime, endTime);
      }
    });
  };

  const saveWindow = (startTime: string, endTime: string) => {
    const newWindow: NotificationWindow = {
      id: Date.now().toString(),
      startTime,
      endTime
    };

    setWindows(prev => ({
      ...prev,
      [selectedDay]: [...(prev[selectedDay] || []), newWindow]
    }));

    setAddModalVisible(false);
    message.success('Notification window added');
  };

  const canAddWindow = (day: string): boolean => {
    return (windows[day] || []).length < MAX_WINDOWS_PER_DAY;
  };

  return (
    <div className="notification-windows">
      <h1>Notification Window Preferences</h1>

      {/* Permanent blackout notice */}
      <Alert
        message="No notifications are delivered between 22:00 and 06:00"
        description="This blackout period applies system-wide to prevent disturbances during nighttime hours."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Row gutter={[16, 16]}>
        {DAYS_OF_WEEK.map(day => (
          <Col xs={24} sm={12} lg={8} key={day}>
            <Card
              title={
                <Space>
                  <ClockCircleOutlined />
                  {day}
                </Space>
              }
              size="small"
            >
              <div style={{ minHeight: '120px' }}>
                {windows[day] && windows[day].length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {windows[day].map(window => (
                      <div key={window.id} className="window-item">
                        <Tag color="blue">
                          {window.startTime} - {window.endTime}
                        </Tag>
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteWindow(day, window.id)}
                        />
                      </div>
                    ))}
                  </Space>
                ) : (
                  <div style={{ color: '#999', fontStyle: 'italic', padding: '20px 0' }}>
                    System default applies
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

      {/* Add Window Modal */}
      <Modal
        title={`Add Notification Window - ${selectedDay}`}
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
                  const start = value[0];
                  const end = value[1];
                  if (start.isSameOrAfter(end)) {
                    return Promise.reject('End time must be after start time');
                  }
                  return Promise.resolve();
                }
              }
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
    </div>
  );
};

export default NotificationWindows;