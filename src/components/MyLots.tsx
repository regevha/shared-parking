import React from 'react';
import { Card, Table, Tag, Row, Col, Button } from 'antd';
import { CarOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRequests } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { LotData } from '../api/lots';
import './MyLots.css';

const columns: ColumnsType<LotData> = [
  { title: 'Lot ID', dataIndex: 'id', key: 'id', width: '15%' },
  { title: 'Floor', dataIndex: 'floorLabel', key: 'floorLabel', width: '30%' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: '20%',
    render: (status: LotData['status']) => {
      const colors: Record<string, string> = {
        available: 'green',
        blocked:   'red',
        unowned:   'default',
        'unowned-blocked': 'orange',
      };
      return <Tag color={colors[status] ?? 'default'}>{status}</Tag>;
    },
  },
  {
    title: 'Blocked Until',
    dataIndex: 'blockedUntil',
    key: 'blockedUntil',
    width: '20%',
    render: (v?: string) => v ?? '—',
  },
  {
    title: 'Actions',
    key: 'actions',
    width: '15%',
    render: () => (
      <Button size="small" icon={<CarOutlined />} disabled>
        View Usage
      </Button>
    ),
  },
];

const MyLots: React.FC = () => {
  const { ownerLots } = useRequests();
  const { user } = useAuth();

  return (
    <div className="my-lots">
      <h1>My Lots</h1>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              <strong>Owner:</strong> {user?.name ?? '—'}
            </div>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <CarOutlined style={{ marginRight: 8 }} />
              <strong>Total Lots:</strong> {ownerLots.length}
            </div>
          </Col>
        </Row>
      </Card>
      <Table
        columns={columns}
        dataSource={ownerLots}
        rowKey="id"
        pagination={false}
        bordered
      />
      {ownerLots.length === 0 && (
        <div style={{ marginTop: 32, color: '#999', textAlign: 'center', fontSize: 18 }}>
          You do not currently own any lots.
        </div>
      )}

      <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
        <strong>My Lots:</strong> Shows all parking lots assigned to you and their current availability status.
      </Card>
    </div>
  );
};

export default MyLots;
