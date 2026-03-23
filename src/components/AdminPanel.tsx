import React, { useState } from 'react';
import { Layout, Menu, Table, Button, Tag, Space, Card, Row, Col, Upload, Alert, Form, Input, DatePicker, Tabs, Select, message, Switch, Divider } from 'antd';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  DownloadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  DeleteOutlined,
  UserAddOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';
import './AdminPanel.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface User {
  id: string;
  name: string;
  email: string;
  role: 'User' | 'Owner' | 'Manager';
  status: 'Active' | 'Inactive';
  createdAt: string;
}

interface Lot {
  id: string;
  floor: string;
  spot: string;
  status: 'Available' | 'Occupied' | 'Blocked' | 'Maintenance';
  ownerId?: string;
  ownerName?: string;
}

interface ReportRecord {
  id: string;
  date: string;
  requester: string;
  type: 'Request' | 'Approval';
  status: string;
  details: string;
}

interface NotificationWindow {
  id: string;
  startTime: string;
  endTime: string;
}

// Mock data
const mockUsers: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'User', status: 'Active', createdAt: '2024-01-15' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Owner', status: 'Active', createdAt: '2024-01-20' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Active', createdAt: '2024-02-01' },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'Manager', status: 'Active', createdAt: '2024-01-10' },
  { id: '5', name: 'Charlie Wilson', email: 'charlie@example.com', role: 'Owner', status: 'Inactive', createdAt: '2024-01-25' },
];

const mockLots: Lot[] = [
  { id: '1', floor: 'Floor 1', spot: 'A01', status: 'Available', ownerId: '2', ownerName: 'Jane Smith' },
  { id: '2', floor: 'Floor 1', spot: 'A02', status: 'Occupied', ownerId: '2', ownerName: 'Jane Smith' },
  { id: '3', floor: 'Floor 1', spot: 'A03', status: 'Available' },
  { id: '4', floor: 'Floor 1', spot: 'A04', status: 'Blocked' },
  { id: '5', floor: 'Floor 2', spot: 'B01', status: 'Available', ownerId: '5', ownerName: 'Charlie Wilson' },
  { id: '6', floor: 'Floor 2', spot: 'B02', status: 'Maintenance' },
  { id: '7', floor: 'Floor 2', spot: 'B03', status: 'Available' },
  { id: '8', floor: 'Floor 2', spot: 'B04', status: 'Available' },
];

const mockReports: ReportRecord[] = [
  { id: '1', date: '2024-03-20', requester: 'John Doe', type: 'Request', status: 'Approved', details: 'Floor 1, A01 - 09:00-11:00' },
  { id: '2', date: '2024-03-21', requester: 'Jane Smith', type: 'Approval', status: 'Completed', details: 'Approved request from John Doe' },
  { id: '3', date: '2024-03-22', requester: 'Bob Johnson', type: 'Request', status: 'Pending', details: 'Floor 2, B03 - 14:00-16:00' },
  { id: '4', date: '2024-03-23', requester: 'Alice Brown', type: 'Approval', status: 'Completed', details: 'Approved request from Bob Johnson' },
];

const defaultNotificationWindows: NotificationWindow[] = [
  { id: '1', startTime: '09:00', endTime: '12:00' },
  { id: '2', startTime: '14:00', endTime: '17:00' },
];

const AdminPanel: React.FC = () => {
  const [selectedMenu, setSelectedMenu] = useState('users');
  const [lotFilter, setLotFilter] = useState<'All' | 'Available' | 'Blocked' | 'Unowned'>('All');
  const [reportDateRange, setReportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'owners' | 'users' | 'both'>('both');
  const [isBlackoutSimulated, setIsBlackoutSimulated] = useState(false);
  const [hasImportedData, setHasImportedData] = useState(false);

  const menuItems = [
    { key: 'users', icon: <UserOutlined />, label: 'User Management' },
    { key: 'lots', icon: <CarOutlined />, label: 'Lot Management' },
    { key: 'import', icon: <UploadOutlined />, label: 'Import / Export' },
    { key: 'config', icon: <SettingOutlined />, label: 'System Configuration' },
    { key: 'reports', icon: <BarChartOutlined />, label: 'Reports' },
    { key: 'broadcast', icon: <SendOutlined />, label: 'Broadcast' },
  ];

  // User Management columns
  const userColumns: ColumnsType<User> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors = { User: 'blue', Owner: 'green', Manager: 'red' };
        return <Tag color={colors[role as keyof typeof colors]}>{role}</Tag>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      )
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          danger
          size="small"
          disabled={record.role === 'Manager'}
          onClick={() => message.success(`User ${record.name} deactivated`)}
        >
          Deactivate
        </Button>
      )
    }
  ];

  // Lot Management columns
  const lotColumns: ColumnsType<Lot> = [
    { title: 'Floor', dataIndex: 'floor', key: 'floor' },
    { title: 'Spot', dataIndex: 'spot', key: 'spot' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          Available: 'green',
          Occupied: 'blue',
          Blocked: 'red',
          Maintenance: 'orange'
        };
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      }
    },
    { title: 'Owner', dataIndex: 'ownerName', key: 'ownerName', render: (owner) => owner || 'Unowned' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        !record.ownerId ? (
          <Button
            type="primary"
            size="small"
            icon={<UserAddOutlined />}
            onClick={() => message.success(`Assign owner to ${record.floor} ${record.spot}`)}
          >
            Assign Owner
          </Button>
        ) : null
      )
    }
  ];

  // Report columns
  const reportColumns: ColumnsType<ReportRecord> = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Requester', dataIndex: 'requester', key: 'requester' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'Request' ? 'blue' : 'green'}>{type}</Tag>
      )
    },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Details', dataIndex: 'details', key: 'details' },
  ];

  const filteredLots = mockLots.filter(lot => {
    switch (lotFilter) {
      case 'Available': return lot.status === 'Available';
      case 'Blocked': return lot.status === 'Blocked';
      case 'Unowned': return !lot.ownerId;
      default: return true;
    }
  });

  const unownedLotsCount = mockLots.filter(lot => !lot.ownerId).length;

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      message.success(`${file.name} uploaded successfully`);
      setHasImportedData(true);
      return false;
    },
  };

  const handleBroadcastSend = () => {
    if (isBlackoutSimulated) {
      message.error('Cannot send broadcast during blackout period (22:00-06:00)');
      return;
    }
    message.success(`Broadcast sent to ${broadcastAudience}`);
    setBroadcastMessage('');
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'users':
        return (
          <div>
            <h2>User Management</h2>
            <Table
              columns={userColumns}
              dataSource={mockUsers}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </div>
        );

      case 'lots':
        return (
          <div>
            <h2>Lot Management</h2>

            {unownedLotsCount > 0 && (
              <Alert
                message={`${unownedLotsCount} unowned lots require assignment`}
                description="Please assign owners to unowned lots to ensure proper management."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Card style={{ marginBottom: '16px' }}>
              <Space>
                <span>Filter:</span>
                {['All', 'Available', 'Blocked', 'Unowned'].map(filter => (
                  <Button
                    key={filter}
                    type={lotFilter === filter ? 'primary' : 'default'}
                    onClick={() => setLotFilter(filter as any)}
                  >
                    {filter} ({filter === 'All' ? mockLots.length :
                              filter === 'Available' ? mockLots.filter(l => l.status === 'Available').length :
                              filter === 'Blocked' ? mockLots.filter(l => l.status === 'Blocked').length :
                              mockLots.filter(l => !l.ownerId).length})
                  </Button>
                ))}
              </Space>
            </Card>

            <Table
              columns={lotColumns}
              dataSource={filteredLots}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </div>
        );

      case 'import':
        return (
          <div>
            <h2>Import / Export</h2>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Import Data">
                  <Upload {...uploadProps} accept=".xlsx,.xls">
                    <Button icon={<UploadOutlined />} size="large" block>
                      Upload Excel File
                    </Button>
                  </Upload>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    Drag and drop or click to upload Excel files
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Export Data">
                  <Button
                    icon={<DownloadOutlined />}
                    size="large"
                    block
                    disabled={!hasImportedData}
                    onClick={() => message.success('Master file downloaded')}
                  >
                    Download Master File
                  </Button>
                  {!hasImportedData && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff4d4f' }}>
                      Import data first to enable download
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'config':
        return (
          <div>
            <h2>System Configuration</h2>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="System Settings">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div><strong>Timezone:</strong> UTC-5 (Eastern Time)</div>
                    <div><strong>Blackout Period:</strong> 22:00 - 06:00</div>
                    <div><strong>First Import Date:</strong> 2024-01-15</div>
                    <div><strong>Last Import Date:</strong> 2024-03-20</div>
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Default Notification Windows">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {defaultNotificationWindows.map(window => (
                      <Tag key={window.id} color="blue">
                        {window.startTime} - {window.endTime}
                      </Tag>
                    ))}
                  </Space>
                  <Button
                    type="primary"
                    size="small"
                    style={{ marginTop: '16px' }}
                    onClick={() => message.info('Edit default windows (not implemented in mock)')}
                  >
                    Edit Default Windows
                  </Button>
                </Card>
              </Col>
            </Row>
          </div>
        );

      case 'reports':
        return (
          <div>
            <h2>Reports</h2>
            <Card style={{ marginBottom: '16px' }}>
              <Space>
                <span>Date Range:</span>
                <RangePicker
                  value={reportDateRange}
                  onChange={(dates) => setReportDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                />
                <Button type="primary" icon={<DownloadOutlined />}>
                  Export to Excel
                </Button>
              </Space>
            </Card>

            <Tabs defaultActiveKey="requests">
              <Tabs.TabPane tab="Requests" key="requests">
                <Table
                  columns={reportColumns}
                  dataSource={mockReports.filter(r => r.type === 'Request')}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane tab="Approvals" key="approvals">
                <Table
                  columns={reportColumns}
                  dataSource={mockReports.filter(r => r.type === 'Approval')}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Tabs.TabPane>
            </Tabs>
          </div>
        );

      case 'broadcast':
        return (
          <div>
            <h2>Broadcast Messages</h2>

            <Card style={{ marginBottom: '16px' }}>
              <Space>
                <span>Simulate blackout period:</span>
                <Switch
                  checked={isBlackoutSimulated}
                  onChange={setIsBlackoutSimulated}
                  checkedChildren="22:00-06:00"
                  unCheckedChildren="Normal hours"
                />
              </Space>
            </Card>

            {isBlackoutSimulated && (
              <Alert
                message="Broadcast disabled during blackout period"
                description="Messages cannot be sent between 22:00 and 06:00 to prevent disturbances."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>Target Audience:</strong>
                  <Select
                    value={broadcastAudience}
                    onChange={(value) => setBroadcastAudience(value)}
                    style={{ width: '200px', marginLeft: '8px' }}
                  >
                    <Select.Option value="owners">All Owners</Select.Option>
                    <Select.Option value="users">All Users</Select.Option>
                    <Select.Option value="both">Both Owners and Users</Select.Option>
                  </Select>
                </div>

                <div>
                  <strong>Message:</strong>
                  <TextArea
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter your broadcast message..."
                    style={{ marginTop: '8px' }}
                  />
                </div>

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={isBlackoutSimulated || !broadcastMessage.trim()}
                  onClick={handleBroadcastSend}
                  size="large"
                >
                  Send Broadcast
                </Button>
              </Space>
            </Card>
          </div>
        );

      default:
        return <div>Select a menu item</div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="light">
        <div style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
          Admin Panel
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedMenu]}
          onClick={({ key }) => setSelectedMenu(key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: '24px', background: '#fff' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminPanel;