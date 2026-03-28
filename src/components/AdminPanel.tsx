import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Table, Button, Tag, Space, Card, Row, Col, Upload, Alert,
  Input, DatePicker, Tabs, Select, notification, Switch, Spin, Modal, Popconfirm,
} from 'antd';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  DownloadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { usersApi, UserData } from '../api/users';
import { lotsApi, LotData } from '../api/lots';
import { requestsApi } from '../api/requests';
import type { ParkingRequest } from '../contexts/RequestsContext';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import './AdminPanel.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Colour map for the four real lot-status values from the backend
const LOT_STATUS_COLOR: Record<string, string> = {
  available:         'green',
  blocked:           'red',
  unowned:           'orange',
  'unowned-blocked': 'volcano',
};

const AdminPanel: React.FC = () => {
  // ── Navigation ─────────────────────────────────────────────────────────────
  const [selectedMenu, setSelectedMenu] = useState('users');

  // ── Server data ────────────────────────────────────────────────────────────
  const [users,    setUsers]    = useState<UserData[]>([]);
  const [lots,     setLots]     = useState<LotData[]>([]);
  const [requests, setRequests] = useState<ParkingRequest[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Per-row action spinner (keyed by record id)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Assign-owner modal state ────────────────────────────────────────────────
  const [assignOwnerLotId,   setAssignOwnerLotId]   = useState<string | null>(null);
  const [assignOwnerValue,   setAssignOwnerValue]   = useState<string | null>(null);
  const [assignOwnerLoading, setAssignOwnerLoading] = useState(false);

  // ── UI-only state (sections with no backend) ────────────────────────────────
  const [lotFilter,           setLotFilter]           = useState<'All' | 'Available' | 'Blocked' | 'Unowned'>('All');
  const [reportDateRange,     setReportDateRange]     = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [broadcastMessage,    setBroadcastMessage]    = useState('');
  const [broadcastAudience,   setBroadcastAudience]   = useState<'owners' | 'users' | 'both'>('both');
  const [isBlackoutSimulated, setIsBlackoutSimulated] = useState(false);
  const [hasImportedData,     setHasImportedData]     = useState(false);

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fetchedUsers, fetchedLots, fetchedRequests] = await Promise.all([
          usersApi.getAll(),
          lotsApi.getAll(),
          requestsApi.getAll(),
        ]);
        setUsers(fetchedUsers);
        setLots(fetchedLots);
        setRequests(fetchedRequests);
      } catch (err: any) {
        notification.error({
          message: 'Failed to load admin data',
          description: err.message || 'Could not reach the server.',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refreshUsers = () => usersApi.getAll().then(setUsers).catch(() => {});
  const refreshLots  = () => lotsApi.getAll().then(setLots).catch(() => {});

  // ── Menu items ──────────────────────────────────────────────────────────────
  const menuItems = [
    { key: 'users',     icon: <UserOutlined />,    label: 'User Management' },
    { key: 'lots',      icon: <CarOutlined />,      label: 'Lot Management' },
    { key: 'import',    icon: <UploadOutlined />,   label: 'Import / Export' },
    { key: 'config',    icon: <SettingOutlined />,  label: 'System Configuration' },
    { key: 'reports',   icon: <BarChartOutlined />, label: 'Reports' },
    { key: 'broadcast', icon: <SendOutlined />,     label: 'Broadcast' },
  ];

  // ── User Management columns ─────────────────────────────────────────────────
  const userColumns: ColumnsType<UserData> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: UserData) => (
        <Select
          value={role}
          size="small"
          style={{ width: 110 }}
          disabled={record.role === 'manager'}
          loading={!!actionLoading[record.id]}
          options={[
            { value: 'user',    label: 'User' },
            { value: 'owner',   label: 'Owner' },
            { value: 'manager', label: 'Manager' },
          ]}
          onChange={async (newRole: string) => {
            setActionLoading(prev => ({ ...prev, [record.id]: true }));
            try {
              await usersApi.update(record.id, { role: newRole });
              notification.success({
                message: 'Role updated',
                description: `${record.name} is now ${newRole}.`,
              });
              await refreshUsers();
            } catch (err: any) {
              notification.error({ message: 'Role update failed', description: err.message });
            } finally {
              setActionLoading(prev => ({ ...prev, [record.id]: false }));
            }
          }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: UserData) => (
        <Popconfirm
          title="Delete this user?"
          description="This cannot be undone."
          okText="Delete"
          okButtonProps={{ danger: true }}
          disabled={record.role === 'manager'}
          onConfirm={async () => {
            setActionLoading(prev => ({ ...prev, [record.id]: true }));
            try {
              await usersApi.delete(record.id);
              notification.success({ message: 'User deleted', description: record.name });
              await refreshUsers();
            } catch (err: any) {
              notification.error({ message: 'Delete failed', description: err.message });
            } finally {
              setActionLoading(prev => ({ ...prev, [record.id]: false }));
            }
          }}
        >
          <Button
            danger
            size="small"
            disabled={record.role === 'manager'}
            loading={!!actionLoading[record.id]}
          >
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ── Lot Management helpers ──────────────────────────────────────────────────
  const filteredLots = lots.filter(lot => {
    switch (lotFilter) {
      case 'Available': return lot.status === 'available';
      case 'Blocked':   return lot.status === 'blocked';
      case 'Unowned':   return lot.status === 'unowned' || lot.status === 'unowned-blocked';
      default:          return true;
    }
  });

  const unownedCount = lots.filter(
    l => l.status === 'unowned' || l.status === 'unowned-blocked'
  ).length;

  const lotColumns: ColumnsType<LotData> = [
    { title: 'Lot ID',      dataIndex: 'id',         key: 'id',         width: 90  },
    { title: 'Floor Label', dataIndex: 'floorLabel',  key: 'floorLabel'             },
    { title: 'Floor',       dataIndex: 'floor',       key: 'floor',      width: 70  },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={LOT_STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: any, record: LotData) =>
        record.owner ?? <em style={{ color: '#aaa' }}>Unowned</em>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: LotData) => {
        if (!record.ownerId) {
          return (
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => { setAssignOwnerLotId(record.id); setAssignOwnerValue(null); }}
            >
              Assign Owner
            </Button>
          );
        }
        return (
          <Popconfirm
            title="Remove owner from this lot?"
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              setActionLoading(prev => ({ ...prev, [record.id]: true }));
              try {
                await lotsApi.update(record.id, { owner: null, owner_id: null, status: 'unowned' });
                notification.success({ message: 'Owner removed', description: record.id });
                await refreshLots();
              } catch (err: any) {
                notification.error({ message: 'Failed to remove owner', description: err.message });
              } finally {
                setActionLoading(prev => ({ ...prev, [record.id]: false }));
              }
            }}
          >
            <Button
              danger
              size="small"
              loading={!!actionLoading[record.id]}
            >
              Remove Owner
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  // ── Reports helpers ─────────────────────────────────────────────────────────
  const filteredRequests = requests.filter(r => {
    if (!reportDateRange) return true;
    const d = dayjs(r.date);
    return (
      !d.isBefore(reportDateRange[0].startOf('day')) &&
      !d.isAfter(reportDateRange[1].endOf('day'))
    );
  });

  const reportColumns: ColumnsType<ParkingRequest> = [
    { title: 'ID',        dataIndex: 'id',            key: 'id',            width: 100 },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Requester', dataIndex: 'requesterName', key: 'requesterName'            },
    {
      title: 'Time Slot',
      key: 'timeSlot',
      width: 130,
      render: (_: any, r: ParkingRequest) => `${r.startTime} – ${r.endTime}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getRequestStatusColor(status)}>
          {getRequestStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Dur.',
      dataIndex: 'duration',
      key: 'duration',
      width: 60,
      render: (d: number) => `${d}h`,
    },
  ];

  // ── Broadcast ───────────────────────────────────────────────────────────────
  const handleBroadcastSend = () => {
    if (isBlackoutSimulated) {
      notification.error({
        message: 'Broadcast blocked',
        description: 'Cannot send messages during the blackout period (22:00–06:00).',
      });
      return;
    }
    notification.success({
      message: 'Broadcast sent',
      description: `Message sent to: ${broadcastAudience}`,
    });
    setBroadcastMessage('');
  };

  // ── Import / Export ─────────────────────────────────────────────────────────
  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      notification.success({ message: `${file.name} uploaded successfully` });
      setHasImportedData(true);
      return false;
    },
  };

  // ── Section renderer ────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (selectedMenu) {

      case 'users':
        return (
          <div>
            <h2>User Management</h2>
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
            />
            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>User Management:</strong> View all registered users and manage their roles.
              Manager accounts cannot be deleted or have their role changed here.
            </Card>
          </div>
        );

      case 'lots':
        return (
          <div>
            <h2>Lot Management</h2>

            {!loading && unownedCount > 0 && (
              <Alert
                message={`${unownedCount} lot${unownedCount !== 1 ? 's' : ''} without an owner`}
                description="Assign owners to ensure proper management of these lots."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <span>Filter:</span>
                {(['All', 'Available', 'Blocked', 'Unowned'] as const).map(filter => {
                  const count =
                    filter === 'All'       ? lots.length :
                    filter === 'Available' ? lots.filter(l => l.status === 'available').length :
                    filter === 'Blocked'   ? lots.filter(l => l.status === 'blocked').length :
                    lots.filter(l => l.status === 'unowned' || l.status === 'unowned-blocked').length;
                  return (
                    <Button
                      key={filter}
                      type={lotFilter === filter ? 'primary' : 'default'}
                      onClick={() => setLotFilter(filter)}
                    >
                      {filter} ({count})
                    </Button>
                  );
                })}
              </Space>
            </Card>

            <Table
              columns={lotColumns}
              dataSource={filteredLots}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
            />

            {/* Assign Owner modal */}
            <Modal
              title="Assign Owner to Lot"
              open={assignOwnerLotId !== null}
              confirmLoading={assignOwnerLoading}
              okText="Assign"
              onCancel={() => { setAssignOwnerLotId(null); setAssignOwnerValue(null); }}
              onOk={async () => {
                if (!assignOwnerLotId || !assignOwnerValue) return;
                const ownerUser = users.find(u => u.id === assignOwnerValue);
                if (!ownerUser) return;
                setAssignOwnerLoading(true);
                try {
                  await lotsApi.update(assignOwnerLotId, {
                    owner:    ownerUser.name,
                    owner_id: ownerUser.id,
                  });
                  notification.success({
                    message: 'Owner assigned',
                    description: `${ownerUser.name} → ${assignOwnerLotId}`,
                  });
                  setAssignOwnerLotId(null);
                  setAssignOwnerValue(null);
                  await refreshLots();
                } catch (err: any) {
                  notification.error({
                    message: 'Failed to assign owner',
                    description: err.message,
                  });
                } finally {
                  setAssignOwnerLoading(false);
                }
              }}
            >
              <Select
                style={{ width: '100%' }}
                placeholder="Select an owner"
                value={assignOwnerValue}
                onChange={setAssignOwnerValue}
                options={users
                  .filter(u => u.role === 'owner')
                  .map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              />
            </Modal>

            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>Lot Management:</strong> View all parking lots, filter by status, and assign
              or remove ownership.
            </Card>
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
                    onClick={() => notification.success({ message: 'Master file downloaded' })}
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
            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>Import / Export:</strong> Upload an Excel file to bulk-import parking data,
              or download the current master file for offline use.
            </Card>
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
                    <div><strong>Timezone:</strong> UTC+0 (Server time)</div>
                    <div><strong>Blackout Period:</strong> 22:00 – 06:00</div>
                    <div><strong>Max Active Requests per User:</strong> 3</div>
                    <div><strong>Booking Window:</strong> 08:00 – 20:00</div>
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Default Notification Windows">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Tag color="blue">09:00 – 12:00</Tag>
                    <Tag color="blue">14:00 – 17:00</Tag>
                  </Space>
                  <Button
                    type="primary"
                    size="small"
                    style={{ marginTop: '16px' }}
                    onClick={() => notification.info({
                      message: 'Not yet implemented',
                      description: 'Editing default notification windows requires backend support.',
                    })}
                  >
                    Edit Default Windows
                  </Button>
                </Card>
              </Col>
            </Row>
            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>System Configuration:</strong> View global system settings. Editable
              configuration requires additional backend support.
            </Card>
          </div>
        );

      case 'reports':
        return (
          <div>
            <h2>Reports</h2>
            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <span>Date Range:</span>
                <RangePicker
                  value={reportDateRange}
                  onChange={dates =>
                    setReportDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
                  }
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => notification.info({
                    message: 'Export not yet implemented',
                    description: 'Excel export requires additional backend support.',
                  })}
                >
                  Export to Excel
                </Button>
              </Space>
            </Card>

            <Tabs defaultActiveKey="all" destroyInactiveTabPane>
              <Tabs.TabPane tab={`All (${filteredRequests.length})`} key="all">
                <Table
                  columns={reportColumns}
                  dataSource={filteredRequests}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane
                tab={`Pending (${filteredRequests.filter(r => r.status === 'pending').length})`}
                key="pending"
              >
                <Table
                  columns={reportColumns}
                  dataSource={filteredRequests.filter(r => r.status === 'pending')}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane
                tab={`Approved (${filteredRequests.filter(r => r.status === 'approved').length})`}
                key="approved"
              >
                <Table
                  columns={reportColumns}
                  dataSource={filteredRequests.filter(r => r.status === 'approved')}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                />
              </Tabs.TabPane>
              <Tabs.TabPane
                tab={`Rejected (${filteredRequests.filter(r => r.status === 'rejected').length})`}
                key="rejected"
              >
                <Table
                  columns={reportColumns}
                  dataSource={filteredRequests.filter(r => r.status === 'rejected')}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                />
              </Tabs.TabPane>
            </Tabs>

            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>Reports:</strong> View a complete history of all parking requests filtered
              by date range and status.
            </Card>
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
                  checkedChildren="22:00–06:00"
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
                    onChange={setBroadcastAudience}
                    style={{ width: '220px', marginLeft: '8px' }}
                    options={[
                      { value: 'owners', label: 'All Owners' },
                      { value: 'users',  label: 'All Users' },
                      { value: 'both',   label: 'Both Owners and Users' },
                    ]}
                  />
                </div>

                <div>
                  <strong>Message:</strong>
                  <TextArea
                    rows={4}
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
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

            <Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
              <strong>Broadcast Messages:</strong> Send a system-wide message to all owners,
              all users, or both audiences at once.
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
          <Spin spinning={loading} tip="Loading admin data...">
            {renderContent()}
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminPanel;
