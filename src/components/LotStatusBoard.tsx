import React, { useMemo, useState } from 'react';
import { Tabs, Tag, Space, Row, Col, Card, Alert, Spin, Modal } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LotStatus } from '../types';
import { LotData } from '../api/lots';
import { useRequests } from '../contexts/RequestsContext';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';
import './LotStatusBoard.css';

const LotStatusBoard: React.FC = () => {
  const { allLots, loading } = useRequests();
  const { t } = useTranslation();

  const [selectedLot, setSelectedLot] = useState<LotData | null>(null);

  // Group flat lots by floorLabel
  const floorGroups = useMemo(() => {
    const map = new Map<string, LotData[]>();
    allLots.forEach(lot => {
      const label = lot.floorLabel;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(lot);
    });
    return Array.from(map.entries()).map(([floor, lots]) => ({ floor, lots }));
  }, [allLots]);

  const floorItems = floorGroups.map((floorData, index) => ({
    key: index.toString(),
    label: `${floorData.floor} (${t('lotStatusBoard.lotsCount', { count: floorData.lots.length })})`,
    children: (
      <div className="parking-grid">
        {floorData.lots.map(lot => {
          const bgColor = getStatusColor(lot.status);
          const isBlocked = lot.status === 'blocked' || lot.status === 'unowned-blocked';
          return (
            <div 
              key={lot.id} 
              className="parking-spot" 
              style={{ backgroundColor: bgColor }}
              onClick={() => setSelectedLot(lot)}
            >
              <div className="lot-id">{lot.id}</div>
              {isBlocked && <CarOutlined className="car-icon" />}
            </div>
          );
        })}
      </div>
    ),
  }));

  const stats = useMemo(() => ({
    available:      allLots.filter(l => l.status === 'available').length,
    blocked:        allLots.filter(l => l.status === 'blocked').length,
    unowned:        allLots.filter(l => l.status === 'unowned').length,
    unownedBlocked: allLots.filter(l => l.status === 'unowned-blocked').length,
  }), [allLots]);

  return (
    <div className="lot-status-board">
      <h1>{t('lotStatusBoard.title')}</h1>

      {/* Floors Tabs */}
      <Spin spinning={loading}>
        <Card style={{ marginBottom: '24px' }}>
          <Tabs items={floorItems} defaultActiveKey="0" size="large" />
        </Card>
      </Spin>

      {/* Summary Stats */}
      <Card size="small" style={{ marginBottom: '24px' }}>
        <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <strong style={{ fontSize: '18px', color: '#52c41a', marginRight: '8px' }}>{stats.available}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.available')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#ff4d4f', marginRight: '8px' }}>{stats.blocked}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.blocked')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: 'inherit', marginRight: '8px' }}>{stats.unowned}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.unowned')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#faad14', marginRight: '8px' }}>{stats.unownedBlocked}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.unownedBlocked')}</span>
          </div>
        </Space>
      </Card>

      {/* Legend */}
      <Card style={{ marginBottom: '24px' }} title={t('lotStatusBoard.legendTitle')} size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#52c41a', borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.available')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#ff4d4f', borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.blocked')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#d9d9d9', borderRadius: '4px', border: '1px solid #999' }} />
              <span>{t('lotStatusBoard.legend.unowned')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#faad14', borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.unownedBlocked')}</span>
            </Space>
          </Col>
        </Row>
      </Card>

      <Modal
        title={`${t('lotStatusBoard.columns.lotId')}: ${selectedLot?.id}`}
        open={!!selectedLot}
        onCancel={() => setSelectedLot(null)}
        footer={null}
      >
        {selectedLot && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>{t('lotStatusBoard.columns.status')}: </strong>
              <Tag color={getStatusColor(selectedLot.status)} style={{ color: '#000' }}>
                {getStatusLabel(selectedLot.status)}
              </Tag>
            </div>
            <div>
              <strong>{t('lotStatusBoard.columns.owner')}: </strong>
              {selectedLot.owner || t('lotStatusBoard.unassigned')}
            </div>
            {(selectedLot.status === 'blocked' || selectedLot.status === 'unowned-blocked') && (
              <div>
                <strong>{t('lotStatusBoard.columns.blockedUntil')}: </strong>
                {selectedLot.blockedUntil || '-'}
              </div>
            )}
          </Space>
        )}
      </Modal>

      <Alert
        message={t('lotStatusBoard.infoTitle')}
        description={t('lotStatusBoard.infoDesc')}
        type="info"
        showIcon
        style={{ marginTop: '24px' }}
      />
    </div>
  );
};

export default LotStatusBoard;
