import React, { useMemo } from 'react';
import { Collapse, Tag, Table, Space, Row, Col, Card, Alert, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LotStatus } from '../types';
import { LotData } from '../api/lots';
import { useRequests } from '../contexts/RequestsContext';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';
import './LotStatusBoard.css';

const LotStatusBoard: React.FC = () => {
  const { allLots, loading } = useRequests();

  const columns: ColumnsType<LotData> = [
    {
      title: 'Lot ID',
      dataIndex: 'id',
      key: 'id',
      width: '20%',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      key: 'owner',
      width: '30%',
      render: (owner: string | null) => owner || 'Unassigned',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '25%',
      render: (status: LotStatus) => (
        <Tag color={getStatusColor(status)} style={{ color: '#000' }}>
          {getStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Blocked Until',
      dataIndex: 'blockedUntil',
      key: 'blockedUntil',
      width: '25%',
      render: (blockedUntil: string | undefined, record: LotData) => {
        if (record.status === 'blocked' || record.status === 'unowned-blocked') {
          return blockedUntil || '-';
        }
        return '-';
      },
    },
  ];

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
    label: (
      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
        {floorData.floor} ({floorData.lots.length} lots)
      </div>
    ),
    children: (
      <Table
        columns={columns}
        dataSource={floorData.lots}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 600 }}
      />
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
      <h1>Parking Status</h1>

      {/* Legend */}
      <Card style={{ marginBottom: '24px' }} title="Status Legend" size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#52c41a', borderRadius: '4px' }} />
              <span>Available - Owner, No Block</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#ff4d4f', borderRadius: '4px' }} />
              <span>Blocked - Active Block</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#d9d9d9', borderRadius: '4px', border: '1px solid #999' }} />
              <span>Unowned - No Owner</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div style={{ width: '20px', height: '20px', backgroundColor: '#faad14', borderRadius: '4px' }} />
              <span>Unowned-Blocked - Legacy Block</span>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Floors Collapse */}
      {loading ? <Spin /> : <Collapse items={floorItems} accordion />}

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{stats.available}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Available</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>{stats.blocked}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Blocked</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#999' }}>{stats.unowned}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Unowned</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>{stats.unownedBlocked}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Unowned-Blocked</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Alert
        message="Parking Status"
        description="Displays the current status of all parking lots across all floors."
        type="info"
        showIcon
        style={{ marginTop: '24px' }}
      />
    </div>
  );
};

export default LotStatusBoard;
