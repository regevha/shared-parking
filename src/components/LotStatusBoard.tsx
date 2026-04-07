import React, { useMemo, useState } from 'react';
import { Tag, Space, Row, Col, Card, Alert, Spin, Modal, DatePicker, Button } from 'antd';
import { CarOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { LotStatus } from '../types/enums';
import { LotData } from '../api/lots';
import { useRequests } from '../contexts/RequestsContext';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';
import './LotStatusBoard.css';

const OCCUPIED_COLOR = '#1677ff';

type DisplayStatus = LotStatus | 'occupied';

function getDisplayColor(status: DisplayStatus): string {
  if (status === 'occupied') return OCCUPIED_COLOR;
  return getStatusColor(status as LotStatus);
}

const LotStatusBoard: React.FC = () => {
  const { allLots, approvedRequests, loading } = useRequests();
  const { t } = useTranslation();

  const [selectedLot, setSelectedLot] = useState<LotData | null>(null);
  const [viewTime, setViewTime] = useState<Dayjs>(dayjs());

  // For each lot, find the active approved request at viewTime (if any)
  const occupancyMap = useMemo(() => {
    const map = new Map<string, typeof approvedRequests[0] | null>();
    allLots.forEach(lot => {
      const active = approvedRequests.find(r => {
        if (r.lotId !== lot.id) return false;
        const start = dayjs(`${r.date}T${r.startTime}`);
        const end   = dayjs(`${r.endDate || r.date}T${r.endTime}`);
        return !viewTime.isBefore(start) && viewTime.isBefore(end);
      });
      map.set(lot.id, active ?? null);
    });
    return map;
  }, [allLots, approvedRequests, viewTime]);

  const getEffectiveStatus = (lot: LotData): DisplayStatus =>
    occupancyMap.get(lot.id) ? 'occupied' : lot.status;

  const stats = useMemo(() => ({
    occupied:       allLots.filter(l => !!occupancyMap.get(l.id)).length,
    available:      allLots.filter(l => !occupancyMap.get(l.id) && l.status === LotStatus.AVAILABLE).length,
    blocked:        allLots.filter(l => !occupancyMap.get(l.id) && l.status === LotStatus.BLOCKED).length,
    unowned:        allLots.filter(l => !occupancyMap.get(l.id) && l.status === LotStatus.UNOWNED).length,
    unownedBlocked: allLots.filter(l => !occupancyMap.get(l.id) && l.status === LotStatus.UNOWNED_BLOCKED).length,
  }), [allLots, occupancyMap]);

  const isNow = viewTime.diff(dayjs(), 'minute') === 0;

  return (
    <div className="lot-status-board">
      <h1>{t('lotStatusBoard.title')}</h1>

      {/* Datetime selector */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Space wrap>
          <ClockCircleOutlined />
          <DatePicker
            showTime={{ format: 'HH:mm', minuteStep: 15 }}
            format="DD/MM/YYYY HH:mm"
            value={viewTime}
            onChange={v => v && setViewTime(v)}
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={() => setViewTime(dayjs())}>
            {t('lotStatusBoard.now')}
          </Button>
        </Space>
      </Card>

      {/* All Lots Grid */}
      <Spin spinning={loading}>
        <Card style={{ marginBottom: '24px' }}>
          <div className="parking-grid">
            {allLots.map(lot => {
              const status = getEffectiveStatus(lot);
              const bgColor = getDisplayColor(status);
              const isBlocked = status === LotStatus.BLOCKED || status === LotStatus.UNOWNED_BLOCKED;
              return (
                <div
                  key={lot.id}
                  className="parking-spot"
                  style={{ backgroundColor: bgColor }}
                  onClick={() => setSelectedLot(lot)}
                >
                  <div className="lot-id">{lot.id}</div>
                  {isBlocked && <CarOutlined className="car-icon" />}
                  {status === 'occupied' && <CarOutlined className="car-icon" />}
                </div>
              );
            })}
          </div>
        </Card>
      </Spin>

      {/* Summary Stats */}
      <Card size="small" style={{ marginBottom: '24px' }}>
        <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <strong style={{ fontSize: '18px', color: OCCUPIED_COLOR, marginRight: '8px' }}>{stats.occupied}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.occupied')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: getStatusColor(LotStatus.AVAILABLE), marginRight: '8px' }}>{stats.available}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.available')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: getStatusColor(LotStatus.BLOCKED), marginRight: '8px' }}>{stats.blocked}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.blocked')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: getStatusColor(LotStatus.UNOWNED), marginRight: '8px' }}>{stats.unowned}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.unowned')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: getStatusColor(LotStatus.UNOWNED_BLOCKED), marginRight: '8px' }}>{stats.unownedBlocked}</strong>
            <span style={{ color: 'var(--label-color)' }}>{t('lotStatusBoard.stats.unownedBlocked')}</span>
          </div>
        </Space>
      </Card>

      {/* Legend */}
      <Card style={{ marginBottom: '24px' }} title={t('lotStatusBoard.legendTitle')} size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: OCCUPIED_COLOR, borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.occupied')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: getStatusColor(LotStatus.AVAILABLE), borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.available')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: getStatusColor(LotStatus.BLOCKED), borderRadius: '4px' }} />
              <span>{t('lotStatusBoard.legend.blocked')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: getStatusColor(LotStatus.UNOWNED), borderRadius: '4px', border: '1px solid #999' }} />
              <span>{t('lotStatusBoard.legend.unowned')}</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: getStatusColor(LotStatus.UNOWNED_BLOCKED), borderRadius: '4px' }} />
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
        {selectedLot && (() => {
          const status = getEffectiveStatus(selectedLot);
          const activeReq = occupancyMap.get(selectedLot.id);
          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong>{t('lotStatusBoard.columns.status')}: </strong>
                {status === 'occupied' ? (
                  <Tag color={OCCUPIED_COLOR}>{t('lotStatusBoard.legend.occupied')}</Tag>
                ) : (
                  <Tag color={getStatusColor(status as LotStatus)} style={{ color: '#000' }}>
                    {t(getStatusLabel(status as LotStatus))}
                  </Tag>
                )}
              </div>
              <div>
                <strong>{t('lotStatusBoard.columns.owner')}: </strong>
                {selectedLot.owner || t('lotStatusBoard.unassigned')}
              </div>
              {activeReq && (
                <>
                  <div>
                    <strong>{t('lotStatusBoard.columns.occupiedBy')}: </strong>
                    {activeReq.requesterName}
                  </div>
                  <div>
                    <strong>{t('lotStatusBoard.columns.occupiedUntil')}: </strong>
                    {activeReq.endDate || activeReq.date} {activeReq.endTime}
                  </div>
                </>
              )}
              {(status === LotStatus.BLOCKED || status === LotStatus.UNOWNED_BLOCKED) && (
                <div>
                  <strong>{t('lotStatusBoard.columns.blockedUntil')}: </strong>
                  {selectedLot.blockedUntil || '-'}
                </div>
              )}
            </Space>
          );
        })()}
      </Modal>

      <Alert
        message={t('lotStatusBoard.infoTitle')}
        description={isNow ? t('lotStatusBoard.infoDesc') : t('lotStatusBoard.infoDescAt', { time: viewTime.format('DD/MM/YYYY HH:mm') })}
        type="info"
        showIcon
        style={{ marginTop: '24px' }}
      />
    </div>
  );
};

export default LotStatusBoard;
