import React, { useState } from 'react';
import { Button, Card, Col, Row, Upload, notification } from 'antd';
import type { UploadProps } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import InfoBanner from '../InfoBanner';
import { adminApi } from '../../api/admin';
import { notifyError } from '../../utils/notify';

interface ImportSectionProps {
  /** Called after a successful CSV import so the parent can reload that table. */
  onImported: (kind: 'users' | 'lots') => void;
}

/** Admin Panel → Import: CSV upload for users/lots plus downloadable templates. */
const ImportSection: React.FC<ImportSectionProps> = ({ onImported }) => {
  const { t } = useTranslation();
  const [hasImportedData, setHasImportedData] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const handleDownloadTemplate = (type: 'users' | 'lots') => {
    const csv = type === 'users'
      ? 'name,email,role,password\nJohn Doe,john@parking.dev,user,pass123\nJane Smith,jane@parking.dev,owner,pass123'
      : 'id,floor,floor_label,owner_email\nA-101,1,Floor 1,owner@parking.dev\nB-202,2,Floor 2,';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${type}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uploadProps: UploadProps = {
    beforeUpload: async (file) => {
      setImportLoading(true);
      try {
        const isLots = file.name.toLowerCase().includes('lot');
        const res = isLots ? await adminApi.importLots(file) : await adminApi.importUsers(file);

        if (res.errors && res.errors.length > 0) {
          notification.warning({
            message: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported }),
            description: t('adminPanel.import.notifications.partialSuccess', { count: res.imported }),
          });
        } else {
          notification.success({
            message: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported }),
            description: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported })
          });
        }
        setHasImportedData(true);
        onImported(isLots ? 'lots' : 'users'); // let the parent refresh its tables
      } catch (err: any) {
        notifyError(t('adminPanel.import.notifications.uploadFailed'), err);
      } finally {
        setImportLoading(false);
      }
      return false; // Prevent auto-upload
    },
    showUploadList: false,
  };

  return (
    <div>
      <h2>{t('adminPanel.import.title')}</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title={t('adminPanel.import.importCardTitle')}>
            <Upload {...uploadProps} accept=".csv">
              <Button icon={<UploadOutlined />} size="large" block loading={importLoading}>
                {t('adminPanel.import.uploadButton')}
              </Button>
            </Upload>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--label-color)' }}>
              {t('adminPanel.import.uploadHint')}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('adminPanel.import.exportCardTitle')}>
            <Button
              icon={<DownloadOutlined />}
              size="large"
              block
              onClick={() => handleDownloadTemplate('users')}
            >
              {t('adminPanel.import.downloadButton')} (Users Template)
            </Button>
            <Button
              icon={<DownloadOutlined />}
              size="large"
              block
              style={{ marginTop: '12px' }}
              onClick={() => handleDownloadTemplate('lots')}
            >
              {t('adminPanel.import.downloadButton')} (Lots Template)
            </Button>
            {!hasImportedData && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff4d4f' }}>
                {t('adminPanel.import.downloadHint')}
              </div>
            )}
          </Card>
        </Col>
      </Row>
      <InfoBanner label={`${t('adminPanel.import.title')}:`} description={t('adminPanel.import.info')} />
    </div>
  );
};

export default ImportSection;
