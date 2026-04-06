import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Popover, List, Button, Typography, Space, Spin, notification } from 'antd';
import { BellOutlined, CheckOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { notificationsApi, Notification } from '../api/notifications';
import './NotificationBell.css';

dayjs.extend(relativeTime);

const { Text } = Typography;

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const { t, i18n } = useTranslation();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for MVP
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      notification.error({ message: t('notificationCenter.errorLoading') });
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      notification.success({ message: t('notificationCenter.markAllRead') });
    } catch (err) {
      notification.error({ message: t('notificationCenter.errorLoading') });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="notification-popover">
      <div className="notification-header">
        <Text strong>{t('notificationCenter.title')}</Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={handleMarkAllRead} loading={loading}>
            {t('notificationCenter.markAllRead')}
          </Button>
        )}
      </div>
      <List
        className="notification-list"
        itemLayout="horizontal"
        dataSource={notifications}
        locale={{ emptyText: (
          <div className="notification-empty">
            <InboxOutlined style={{ fontSize: '24px', color: '#ccc' }} />
            <div style={{ marginTop: '8px' }}>{t('notificationCenter.noNotifications')}</div>
          </div>
        )}}
        renderItem={(item) => (
          <List.Item
            className={`notification-item ${item.is_read ? 'read' : 'unread'}`}
            actions={[
              !item.is_read && (
                <Button 
                  type="text" 
                  icon={<CheckOutlined />} 
                  size="small" 
                  onClick={() => handleMarkAsRead(item.id)}
                  title={t('notificationCenter.markAsRead')}
                />
              )
            ].filter(Boolean) as React.ReactNode[]}
          >
            <List.Item.Meta
              title={<div className="notification-item-msg">{item.message}</div>}
              description={
                <div className="notification-item-time">
                  {dayjs(item.created_at).locale(i18n.language).fromNow()}
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={visible}
      onOpenChange={setVisible}
      placement="bottomRight"
      overlayClassName="notification-overlay"
    >
      <div className="notification-trigger">
        <Badge count={unreadCount} overflowCount={9} size="small" offset={[2, 0]}>
          <BellOutlined style={{ fontSize: '20px', cursor: 'pointer' }} />
        </Badge>
      </div>
    </Popover>
  );
};

export default NotificationBell;
