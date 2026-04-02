import React from 'react';
import { Card, Table, Tag, Row, Col, Button } from 'antd';
import { CarOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useRequests } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import { getLotStatusTagColor } from '../utils/statusUtils';
import { LotStatus } from '../types';
import './MyLots.css';

const MyLots: React.FC = () => {
  const { ownerLots, loading } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  const columns: ColumnsType<LotData> = [
    { title: t('myLots.columns.lotId'), dataIndex: 'id', key: 'id', width: '15%' },
    { title: t('myLots.columns.floor'), dataIndex: 'floorLabel', key: 'floorLabel', width: '30%' },
    {
      title: t('myLots.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      render: (status: LotStatus) => {
        return <Tag color={getLotStatusTagColor(status)}>{status}</Tag>;
      },
    },
    {
      title: t('myLots.columns.blockedUntil'),
      dataIndex: 'blockedUntil',
      key: 'blockedUntil',
      width: '20%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('myLots.columns.actions'),
      key: 'actions',
      width: '15%',
      render: () => (
        <Button size="small" icon={<CarOutlined />} disabled>
          {t('myLots.viewUsage')}
        </Button>
      ),
    },
  ];

  return (
    <div className="my-lots">
      <h1>{t('myLots.title')}</h1>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              <strong>{t('myLots.ownerLabel')}</strong> {user?.name ?? '—'}
            </div>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <CarOutlined style={{ marginRight: 8 }} />
              <strong>{t('myLots.totalLotsLabel')}</strong> {ownerLots.length}
            </div>
          </Col>
        </Row>
      </Card>
      <Table
        columns={columns}
        dataSource={ownerLots}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        bordered
      />
      {ownerLots.length === 0 && (
        <div style={{ marginTop: 32, color: '#999', textAlign: 'center', fontSize: 18 }}>
          {t('myLots.noLots')}
        </div>
      )}

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('myLots.title')}:</strong> {t('myLots.info')}
      </Card>
    </div>
  );
};

export default MyLots;
