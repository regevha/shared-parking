import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Skeleton, Space, notification } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import InfoBanner from '../InfoBanner';
import { configApi, SystemConfig } from '../../api/config';
import { notifyError } from '../../utils/notify';

/** Admin Panel → System Config: read-only server settings and a manual auto-approval run. */
const ConfigSection: React.FC = () => {
  const { t } = useTranslation();
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [autoApprovalLoading, setAutoApprovalLoading] = useState(false);

  useEffect(() => {
    setConfigLoading(true);
    configApi.get()
      .then(setSystemConfig)
      .catch(() => {/* non-critical — fallback text shown */ })
      .finally(() => setConfigLoading(false));
  }, []);

  return (
    <div>
      <h2>{t('adminPanel.config.title')}</h2>
      {configLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card title={t('adminPanel.config.cardTitle')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div><strong>{t('adminPanel.config.timezone')}</strong> {systemConfig?.timezone ?? '—'}</div>
                <div>
                  <strong>{t('adminPanel.config.blackoutPeriod')}</strong>{' '}
                  {systemConfig ? `${systemConfig.blackoutStart} – ${systemConfig.blackoutEnd}` : '—'}
                </div>
                <div>
                  <strong>{t('adminPanel.config.maxRequests')}</strong>{' '}
                  {systemConfig?.maxPendingRequestsPerUser ?? '—'}
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card title={t('adminPanel.config.schedulerTitle')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>{t('adminPanel.config.schedulerDesc')}</div>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={autoApprovalLoading}
                  onClick={async () => {
                    setAutoApprovalLoading(true);
                    try {
                      const result = await configApi.triggerAutoApproval();
                      notification.success({
                        message: t('adminPanel.config.autoApprovalSuccess'),
                        description: t('adminPanel.config.autoApprovalSuccessDesc', {
                          approved: result.approved,
                          remaining: result.remainingPending,
                        }),
                      });
                    } catch (err) {
                      notifyError(t('adminPanel.config.autoApprovalFailed'), err);
                    } finally {
                      setAutoApprovalLoading(false);
                    }
                  }}
                  size="large"
                  block
                >
                  {t('adminPanel.config.runAutoApproval')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>}
      <InfoBanner label={`${t('adminPanel.config.title')}:`} description={t('adminPanel.config.info')} />
    </div>
  );
};

export default ConfigSection;
