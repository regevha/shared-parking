import React, { useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Switch, notification } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import InfoBanner from '../InfoBanner';
import { notificationsApi } from '../../api/notifications';
import { useIsMobile } from '../../hooks/useIsMobile';
import { notifyError } from '../../utils/notify';

const { TextArea } = Input;

/** Admin Panel → Broadcast: send a message to owners, users or both (with a blackout simulation). */
const BroadcastSection: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'owners' | 'users' | 'both'>('both');
  const [isBlackoutSimulated, setIsBlackoutSimulated] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const handleBroadcastSend = async () => {
    if (isBlackoutSimulated) {
      notification.error({
        message: t('adminPanel.broadcast.notifications.sent'),
        description: t('adminPanel.broadcast.notifications.blockedDesc'),
      });
      return;
    }

    if (!broadcastMessage.trim()) return;

    setBroadcastLoading(true);
    try {
      const result = await notificationsApi.broadcast(broadcastAudience, broadcastMessage);
      notification.success({
        message: t('adminPanel.broadcast.notifications.sent'),
        description: t('adminPanel.broadcast.notifications.sentDesc', {
          audience: broadcastAudience,
          count: result.delivered_to
        }),
      });
      setBroadcastMessage('');
    } catch (err: any) {
      notifyError(t('adminPanel.broadcast.notifications.blocked'), err);
    } finally {
      setBroadcastLoading(false);
    }
  };

  return (
    <div>
      <h2>{t('adminPanel.broadcast.title')}</h2>

      <Card style={{ marginBottom: '16px' }}>
        <Space>
          <span>{t('adminPanel.broadcast.simulateBlackout')}</span>
          <Switch
            checked={isBlackoutSimulated}
            onChange={setIsBlackoutSimulated}
            checkedChildren={t('adminPanel.broadcast.blackoutOn')}
            unCheckedChildren={t('adminPanel.broadcast.blackoutOff')}
          />
        </Space>
      </Card>

      {isBlackoutSimulated && (
        <Alert
          message={t('adminPanel.broadcast.blackoutAlert')}
          description={t('adminPanel.broadcast.blackoutAlertDesc')}
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <strong>{t('adminPanel.broadcast.audienceLabel')}</strong>
            <Select
              value={broadcastAudience}
              aria-label={t('adminPanel.broadcast.audienceLabel')}
              onChange={setBroadcastAudience}
              style={{ width: isMobile ? '100%' : '220px', marginLeft: isMobile ? 0 : '8px' }}
              options={[
                { value: 'owners', label: t('adminPanel.broadcast.audiences.owners') },
                { value: 'users', label: t('adminPanel.broadcast.audiences.users') },
                { value: 'both', label: t('adminPanel.broadcast.audiences.both') },
              ]}
            />
          </div>

          <div>
            <strong>{t('adminPanel.broadcast.messageLabel')}</strong>
            <TextArea
              rows={4}
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              placeholder={t('adminPanel.broadcast.messagePlaceholder')}
              style={{ marginTop: '8px' }}
            />
          </div>

          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={isBlackoutSimulated || !broadcastMessage.trim()}
            loading={broadcastLoading}
            onClick={handleBroadcastSend}
            size="large"
          >
            {t('adminPanel.broadcast.sendButton')}
          </Button>
        </Space>
      </Card>

      <InfoBanner label={`${t('adminPanel.broadcast.title')}:`} description={t('adminPanel.broadcast.info')} />
    </div>
  );
};

export default BroadcastSection;
