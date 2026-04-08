import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Row, Col, Button } from 'antd';
import { CarOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useRequests } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import { getLotStatusTagColor, getStatusLabel } from '../utils/statusUtils';
import { LotStatus } from '../types/enums';
import EmptyState from './EmptyState';
import './MyLots.css';

const MyLots: React.FC = () => {
  const { ownerLots, loading } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const columns: ColumnsType<LotData> = [
    { title: t('myLots.columns.lotId'), dataIndex: 'id', key: 'id', width: '15%', sorter: (a: LotData, b: LotData) => a.id.localeCompare(b.id) },
    { title: t('myLots.columns.floor'), dataIndex: 'floorLabel', key: 'floorLabel', width: '30%', sorter: (a: LotData, b: LotData) => (a.floorLabel || '').localeCompare(b.floorLabel || '') },
    {
      title: t('myLots.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      sorter: (a: LotData, b: LotData) => a.status.localeCompare(b.status),
      render: (status: LotStatus) => {
        return <Tag color={getLotStatusTagColor(status)}>{t(getStatusLabel(status))}</Tag>;
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
          <Col xs={24} sm={12}>
            <div style={{ fontSize: 16 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              <strong>{t('myLots.ownerLabel')}</strong> {user?.name ?? '—'}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ fontSize: 16 }}>
              <CarOutlined style={{ marginRight: 8 }} />
              <strong>{t('myLots.totalLotsLabel')}</strong> {ownerLots.length}
            </div>
          </Col>
        </Row>
      </Card>

      {isMobile ? (
        <div className="my-lots-card-list">
          {ownerLots.length === 0 && (
            <EmptyState icon={<CarOutlined />} title={t('myLots.noLots')} />
          )}
          {ownerLots.map((lot: LotData) => (
            <Card key={lot.id} size="small" className="my-lots-card">
              <div className="my-lots-card-header">
                <strong>{lot.id}</strong>
                <Tag color={getLotStatusTagColor(lot.status)}>{t(getStatusLabel(lot.status))}</Tag>
              </div>
              <div className="my-lots-card-row">
                <span className="my-lots-card-label">{t('myLots.columns.floor')}</span>
                <span>{lot.floorLabel}</span>
              </div>
              {lot.blockedUntil && (
                <div className="my-lots-card-row">
                  <span className="my-lots-card-label">{t('myLots.columns.blockedUntil')}</span>
                  <span>{lot.blockedUntil}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={ownerLots}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 600 }}
            bordered
            locale={{ emptyText: <EmptyState icon={<CarOutlined />} title={t('myLots.noLots')} /> }}
          />
        </>
      )}

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>{t('myLots.title')}:</strong> {t('myLots.info')}
      </Card>
    </div>
  );
};

export default MyLots;
