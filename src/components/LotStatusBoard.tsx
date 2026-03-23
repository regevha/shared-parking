import React from 'react';
import { Collapse, Tag, Table, Space, Row, Col, Card, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Lot, LotStatus } from '../types';
import { mockLotsData } from '../mock/lotsData';
import { getStatusColor, getStatusLabel } from '../utils/statusUtils';
import './LotStatusBoard.css';

const LotStatusBoard: React.FC = () => {
  const columns: ColumnsType<Lot> = [
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
      render: (blockedUntil: string | undefined, record: Lot) => {
        if (record.status === 'blocked' || record.status === 'unowned-blocked') {
          return blockedUntil || '-';
        }
        return '-';
      },
    },
  ];

  const floorItems = mockLotsData.map((floorData, index) => ({
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

  return (
    <div className="lot-status-board">
      <h1>Lot Status Board</h1>

      {/* Legend */}
      <Card
        style={{ marginBottom: '24px' }}
        title="Status Legend"
        size="small"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#52c41a',
                  borderRadius: '4px',
                }}
              />
              <span>Available - Owner, No Block</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#ff4d4f',
                  borderRadius: '4px',
                }}
              />
              <span>Blocked - Active Block</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#d9d9d9',
                  borderRadius: '4px',
                  border: '1px solid #999',
                }}
              />
              <span>Unowned - No Owner</span>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#faad14',
                  borderRadius: '4px',
                }}
              />
              <span>Unowned-Blocked - Legacy Block</span>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {mockLotsData.reduce((acc, floor) => acc + floor.lots.filter(l => l.status === 'available').length, 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Available</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {mockLotsData.reduce((acc, floor) => acc + floor.lots.filter(l => l.status === 'blocked').length, 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Blocked</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#999' }}>
                {mockLotsData.reduce((acc, floor) => acc + floor.lots.filter(l => l.status === 'unowned').length, 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Unowned</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {mockLotsData.reduce((acc, floor) => acc + floor.lots.filter(l => l.status === 'unowned-blocked').length, 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Unowned-Blocked</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Alert
        message="Read-Only View"
        description="You are viewing lot status information. To request or manage lots, use the menu options."
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* Floors Collapse */}
      <Collapse items={floorItems} accordion />
    </div>
  );
};

export default LotStatusBoard;
