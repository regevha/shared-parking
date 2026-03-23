import React from 'react';
import { Card, Table, Tag, Row, Col, Button } from 'antd';
import { CarOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import './MyLots.css';

interface Lot {
  id: string;
  floor: string;
  spot: string;
  status: 'Available' | 'Occupied' | 'Blocked' | 'Maintenance';
  ownerId: string;
  ownerName: string;
  assignedSince: string;
}

// Mock: current user is Jane Smith (ownerId: '2')
const CURRENT_OWNER_ID = '2';

const mockLots: Lot[] = [
  { id: '1', floor: 'Floor 1', spot: 'A01', status: 'Available', ownerId: '2', ownerName: 'Jane Smith', assignedSince: '2024-01-20' },
  { id: '2', floor: 'Floor 1', spot: 'A02', status: 'Occupied', ownerId: '2', ownerName: 'Jane Smith', assignedSince: '2024-01-20' },
  { id: '5', floor: 'Floor 2', spot: 'B01', status: 'Available', ownerId: '5', ownerName: 'Charlie Wilson', assignedSince: '2024-01-25' },
  { id: '8', floor: 'Floor 2', spot: 'B04', status: 'Available', ownerId: '2', ownerName: 'Jane Smith', assignedSince: '2024-02-10' },
];

const myLots = mockLots.filter(lot => lot.ownerId === CURRENT_OWNER_ID);

const columns: ColumnsType<Lot> = [
  { title: 'Lot ID', dataIndex: 'id', key: 'id', width: '10%' },
  { title: 'Floor', dataIndex: 'floor', key: 'floor', width: '15%' },
  { title: 'Spot', dataIndex: 'spot', key: 'spot', width: '15%' },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: '15%',
    render: (status: Lot['status']) => {
      const colors = {
        Available: 'green',
        Occupied: 'blue',
        Blocked: 'red',
        Maintenance: 'orange',
      };
      return <Tag color={colors[status]}>{status}</Tag>;
    },
  },
  { title: 'Assigned Since', dataIndex: 'assignedSince', key: 'assignedSince', width: '20%' },
  {
    title: 'Actions',
    key: 'actions',
    width: '15%',
    render: (_, record) => (
      <Button size="small" icon={<CarOutlined />} disabled>
        View Usage
      </Button>
    ),
  },
];

const MyLots: React.FC = () => {
  return (
    <div className="my-lots">
      <h1>My Lots</h1>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <UserOutlined style={{ marginRight: 8 }} />
              <strong>Owner:</strong> Jane Smith
            </div>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 16 }}>
              <CarOutlined style={{ marginRight: 8 }} />
              <strong>Total Lots:</strong> {myLots.length}
            </div>
          </Col>
        </Row>
      </Card>
      <Table
        columns={columns}
        dataSource={myLots}
        rowKey="id"
        pagination={false}
        bordered
      />
      {myLots.length === 0 && (
        <div style={{ marginTop: 32, color: '#999', textAlign: 'center', fontSize: 18 }}>
          You do not currently own any lots.
        </div>
      )}
    </div>
  );
};

export default MyLots;
