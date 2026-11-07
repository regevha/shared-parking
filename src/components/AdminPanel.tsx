import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Table, Button, Tag, Space, Card, Alert,
  Select, notification, Skeleton, Modal, Popconfirm, Drawer,
} from 'antd';
import InfoBanner from './InfoBanner';
import BroadcastSection from './admin/BroadcastSection';
import ImportSection from './admin/ImportSection';
import ConfigSection from './admin/ConfigSection';
import ReportsSection from './admin/ReportsSection';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  UserAddOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { usersApi, UserData } from '../api/users';
import { lotsApi, LotData } from '../api/lots';
import { requestsApi } from '../api/requests';
import type { ParkingRequest } from '../contexts/RequestsContext';
import { UserRole, LotStatus } from '../types/enums';
import { useAuth } from '../contexts/AuthContext';
import './AdminPanel.css';
import { useIsMobile } from '../hooks/useIsMobile';
import { notifyError } from '../utils/notify';

const { Sider, Content } = Layout;

// Colour map for the four real lot-status values from the backend
const LOT_STATUS_COLOR: Record<string, string> = {
  available: 'green',
  blocked: 'red',
  unowned: 'orange',
  'unowned-blocked': 'volcano',
};

const AdminPanel: React.FC = () => {
  // ── Theme ───────────────────────────────────────────────────────────────────
  const { user } = useAuth();
  const { t } = useTranslation();
  const isDark = user?.preferences?.darkMode ?? true;
  const isMobile = useIsMobile();
  const [siderCollapsed, setSiderCollapsed] = useState(isMobile);

  // The sider collapses/expands whenever the viewport crosses the mobile breakpoint.
  useEffect(() => { setSiderCollapsed(isMobile); }, [isMobile]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [selectedMenu, setSelectedMenu] = useState('users');

  // ── Server data ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserData[]>([]);
  const [lots, setLots] = useState<LotData[]>([]);
  const [requests, setRequests] = useState<ParkingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-row action spinner (keyed by record id)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Assign-owner modal state ────────────────────────────────────────────────
  const [assignOwnerLotId, setAssignOwnerLotId] = useState<string | null>(null);
  const [assignOwnerValue, setAssignOwnerValue] = useState<string | null>(null);
  const [assignOwnerLoading, setAssignOwnerLoading] = useState(false);

  // ── UI-only state (sections with no backend) ────────────────────────────────
  const [lotFilter, setLotFilter] = useState<'All' | 'Available' | 'Blocked' | 'Unowned'>('All');

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
        notifyError(t('adminPanel.loadFailed'), err, t('adminPanel.loadFailedDesc'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshUsers = () => usersApi.getAll().then(setUsers).catch(() => { });
  const refreshLots = () => lotsApi.getAll().then(setLots).catch(() => { });

  // ── Menu items ──────────────────────────────────────────────────────────────
  const menuItems = [
    { key: 'users', icon: <UserOutlined />, label: t('adminPanel.menu.users') },
    { key: 'lots', icon: <CarOutlined />, label: t('adminPanel.menu.lots') },
    { key: 'import', icon: <UploadOutlined />, label: t('adminPanel.menu.import') },
    { key: 'config', icon: <SettingOutlined />, label: t('adminPanel.menu.config') },
    { key: 'reports', icon: <BarChartOutlined />, label: t('adminPanel.menu.reports') },
    { key: 'broadcast', icon: <SendOutlined />, label: t('adminPanel.menu.broadcast') },
  ];

  // ── User Management columns ─────────────────────────────────────────────────
  const userColumns: ColumnsType<UserData> = [
    {
      title: t('adminPanel.users.columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('adminPanel.users.columns.email'),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: t('adminPanel.users.columns.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: UserData) => (
        <Select
          value={role}
          aria-label={`${t('adminPanel.users.columns.role')}: ${record.name}`}
          size="small"
          style={{ width: 110 }}
          disabled={record.role === 'manager'}
          loading={!!actionLoading[record.id]}
          options={[
            { value: UserRole.USER, label: t('adminPanel.users.roles.user') },
            { value: UserRole.OWNER, label: t('adminPanel.users.roles.owner') },
            { value: UserRole.MANAGER, label: t('adminPanel.users.roles.manager') },
          ]}
          onChange={async (newRole: string) => {
            setActionLoading(prev => ({ ...prev, [record.id]: true }));
            try {
              const translatedRole = t(`adminPanel.users.roles.${newRole}`);
              await usersApi.update(record.id, { role: newRole });
              notification.success({
                message: t('adminPanel.users.notifications.roleUpdated'),
                description: t('adminPanel.users.notifications.roleUpdatedDesc', { name: record.name, role: translatedRole }),
              });
              await refreshUsers();
            } catch (err: any) {
              notifyError(t('adminPanel.users.notifications.roleUpdateFailed'), err);
            } finally {
              setActionLoading(prev => ({ ...prev, [record.id]: false }));
            }
          }}
        />
      ),
    },
    {
      title: t('adminPanel.users.columns.joined'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (v?: string) => v ? dayjs(v).format('DD/MM/YYYY') : <em style={{ color: 'var(--label-color)' }}>—</em>,
    },
    {
      title: t('adminPanel.users.columns.actions'),
      key: 'actions',
      render: (_: any, record: UserData) => (
        <Popconfirm
          title={t('adminPanel.users.deleteConfirm')}
          description={t('adminPanel.users.deleteWarning')}
          okText={t('adminPanel.users.deleteOk')}
          okButtonProps={{ danger: true }}
          disabled={record.role === UserRole.MANAGER}
          onConfirm={async () => {
            setActionLoading(prev => ({ ...prev, [record.id]: true }));
            try {
              await usersApi.delete(record.id);
              notification.success({ message: t('adminPanel.users.notifications.userDeleted'), description: record.name });
              await refreshUsers();
            } catch (err: any) {
              notifyError(t('adminPanel.users.notifications.deleteFailed'), err);
            } finally {
              setActionLoading(prev => ({ ...prev, [record.id]: false }));
            }
          }}
        >
          <Button
            danger
            size="small"
            disabled={record.role === UserRole.MANAGER}
            loading={!!actionLoading[record.id]}
          >
            {t('adminPanel.users.deleteButton')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ── Lot Management helpers ──────────────────────────────────────────────────
  const filteredLots = lots.filter(lot => {
    switch (lotFilter) {
      case 'Available': return lot.status === LotStatus.AVAILABLE;
      case 'Blocked': return lot.status === LotStatus.BLOCKED;
      case 'Unowned': return lot.status === LotStatus.UNOWNED || lot.status === LotStatus.UNOWNED_BLOCKED;
      default: return true;
    }
  });

  const unownedCount = lots.filter(
    l => l.status === LotStatus.UNOWNED || l.status === LotStatus.UNOWNED_BLOCKED
  ).length;

  const lotColumns: ColumnsType<LotData> = [
    { title: t('adminPanel.lots.columns.lotId'), dataIndex: 'id', key: 'id', width: 90 },
    { title: t('adminPanel.lots.columns.floorLabel'), dataIndex: 'floorLabel', key: 'floorLabel' },
    { title: t('adminPanel.lots.columns.floor'), dataIndex: 'floor', key: 'floor', width: 70 },
    {
      title: t('adminPanel.lots.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={LOT_STATUS_COLOR[status] ?? 'default'}>
          {t(`adminPanel.lots.filters.${status.replace('-', '_')}`) || status}
        </Tag>
      ),
    },
    {
      title: t('adminPanel.lots.columns.owner'),
      key: 'owner',
      render: (_: any, record: LotData) =>
        record.owner ?? <em style={{ color: 'var(--label-color)' }}>{t('adminPanel.lots.unowned')}</em>,
    },
    {
      title: t('adminPanel.lots.columns.lastModified'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 130,
      render: (v?: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : <em style={{ color: 'var(--label-color)' }}>—</em>,
    },
    {
      title: t('adminPanel.lots.columns.actions'),
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
              {t('adminPanel.lots.assignOwnerButton')}
            </Button>
          );
        }
        return (
          <Popconfirm
            title={t('adminPanel.lots.removeOwnerConfirm')}
            okText={t('adminPanel.lots.removeOwnerOk')}
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              setActionLoading(prev => ({ ...prev, [record.id]: true }));
              try {
                await lotsApi.update(record.id, { owner: null, owner_id: null, status: 'unowned' });
                notification.success({ message: t('adminPanel.lots.notifications.ownerRemoved'), description: record.id });
                await refreshLots();
              } catch (err: any) {
                notifyError(t('adminPanel.lots.notifications.ownerRemoveFailed'), err);
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
              {t('adminPanel.lots.removeOwnerButton')}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  // ── Section renderer ────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (selectedMenu) {

      case 'users':
        return (
          <div>
            <h2>{t('adminPanel.users.title')}</h2>
            {isMobile ? (
              <div className="admin-card-list">
                {users.map(u => (
                  <Card key={u.id} size="small" className="admin-card">
                    <div className="admin-card-header">
                      <strong>{u.name}</strong>
                      <Tag color={u.role === 'manager' ? 'purple' : u.role === 'owner' ? 'blue' : 'green'}>
                        {t(`adminPanel.users.roles.${u.role}`)}
                      </Tag>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">{t('adminPanel.users.columns.email')}</span>
                      <span>{u.email}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">{t('adminPanel.users.columns.joined')}</span>
                      <span>{u.createdAt ? dayjs(u.createdAt).format('DD/MM/YYYY') : '—'}</span>
                    </div>
                    {u.role !== UserRole.MANAGER && (
                      <div className="admin-card-actions">
                        <Popconfirm
                          title={t('adminPanel.users.deleteConfirm')}
                          description={t('adminPanel.users.deleteWarning')}
                          okText={t('adminPanel.users.deleteOk')}
                          okButtonProps={{ danger: true }}
                          onConfirm={async () => {
                            setActionLoading(prev => ({ ...prev, [u.id]: true }));
                            try {
                              await usersApi.delete(u.id);
                              notification.success({ message: t('adminPanel.users.notifications.userDeleted'), description: u.name });
                              await refreshUsers();
                            } catch (err: any) {
                              notifyError(t('adminPanel.users.notifications.deleteFailed'), err);
                            } finally {
                              setActionLoading(prev => ({ ...prev, [u.id]: false }));
                            }
                          }}
                        >
                          <Button danger size="small" loading={!!actionLoading[u.id]}>
                            {t('adminPanel.users.deleteButton')}
                          </Button>
                        </Popconfirm>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Table
                columns={userColumns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: 'max-content' }}
              />
            )}
            <InfoBanner label={`${t('adminPanel.users.title')}:`} description={t('adminPanel.users.info')} />
          </div>
        );

      case 'lots':
        return (
          <div>
            <h2>{t('adminPanel.lots.title')}</h2>

            {!loading && unownedCount > 0 && (
              <Alert
                message={t('adminPanel.lots.unownedAlert', { count: unownedCount })}
                description={t('adminPanel.lots.unownedAlertDesc')}
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <span>{t('adminPanel.lots.filterLabel')}</span>
                {(['All', 'Available', 'Blocked', 'Unowned'] as const).map(filter => {
                  const count =
                    filter === 'All' ? lots.length :
                      filter === 'Available' ? lots.filter(l => l.status === 'available').length :
                        filter === 'Blocked' ? lots.filter(l => l.status === 'blocked').length :
                          lots.filter(l => l.status === 'unowned' || l.status === 'unowned-blocked').length;
                  const filterKey = filter.toLowerCase() as 'all' | 'available' | 'blocked' | 'unowned';
                  return (
                    <Button
                      key={filter}
                      type={lotFilter === filter ? 'primary' : 'default'}
                      onClick={() => setLotFilter(filter)}
                    >
                      {t(`adminPanel.lots.filters.${filterKey}`)} ({count})
                    </Button>
                  );
                })}
              </Space>
            </Card>

            {isMobile ? (
              <div className="admin-card-list">
                {filteredLots.map(lot => (
                  <Card key={lot.id} size="small" className="admin-card">
                    <div className="admin-card-header">
                      <strong>{lot.id}</strong>
                      <Tag color={LOT_STATUS_COLOR[lot.status] ?? 'default'}>
                        {t(`adminPanel.lots.filters.${lot.status.replace('-', '_')}`) || lot.status}
                      </Tag>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">{t('adminPanel.lots.columns.floorLabel')}</span>
                      <span>{lot.floorLabel}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">{t('adminPanel.lots.columns.owner')}</span>
                      <span>{lot.owner ?? <em style={{ color: 'var(--label-color)' }}>{t('adminPanel.lots.unowned')}</em>}</span>
                    </div>
                    <div className="admin-card-actions">
                      {!lot.ownerId ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<UserAddOutlined />}
                          onClick={() => { setAssignOwnerLotId(lot.id); setAssignOwnerValue(null); }}
                        >
                          {t('adminPanel.lots.assignOwnerButton')}
                        </Button>
                      ) : (
                        <Popconfirm
                          title={t('adminPanel.lots.removeOwnerConfirm')}
                          okText={t('adminPanel.lots.removeOwnerOk')}
                          okButtonProps={{ danger: true }}
                          onConfirm={async () => {
                            setActionLoading(prev => ({ ...prev, [lot.id]: true }));
                            try {
                              await lotsApi.update(lot.id, { owner: null, owner_id: null, status: 'unowned' });
                              notification.success({ message: t('adminPanel.lots.notifications.ownerRemoved'), description: lot.id });
                              await refreshLots();
                            } catch (err: any) {
                              notifyError(t('adminPanel.lots.notifications.ownerRemoveFailed'), err);
                            } finally {
                              setActionLoading(prev => ({ ...prev, [lot.id]: false }));
                            }
                          }}
                        >
                          <Button danger size="small" loading={!!actionLoading[lot.id]}>
                            {t('adminPanel.lots.removeOwnerButton')}
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table
                  columns={lotColumns}
                  dataSource={filteredLots}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 'max-content' }}
                />
              </div>
            )}

            {/* Assign Owner modal */}
            <Modal
              title={t('adminPanel.lots.assignModal.title')}
              open={assignOwnerLotId !== null}
              confirmLoading={assignOwnerLoading}
              okText={t('adminPanel.lots.assignModal.okText')}
              onCancel={() => { setAssignOwnerLotId(null); setAssignOwnerValue(null); }}
              onOk={async () => {
                if (!assignOwnerLotId || !assignOwnerValue) return;
                const ownerUser = users.find(u => u.id === assignOwnerValue);
                if (!ownerUser) return;
                setAssignOwnerLoading(true);
                try {
                  await lotsApi.update(assignOwnerLotId, {
                    owner: ownerUser.name,
                    owner_id: ownerUser.id,
                  });
                  notification.success({
                    message: t('adminPanel.lots.notifications.ownerAssigned'),
                    description: t('adminPanel.lots.notifications.ownerAssignedDesc', { name: ownerUser.name, lotId: assignOwnerLotId }),
                  });
                  setAssignOwnerLotId(null);
                  setAssignOwnerValue(null);
                  await refreshLots();
                } catch (err: any) {
                  notifyError(t('adminPanel.lots.notifications.ownerAssignFailed'), err);
                } finally {
                  setAssignOwnerLoading(false);
                }
              }}
            >
              <Select
                style={{ width: '100%' }}
                placeholder={t('adminPanel.lots.assignModal.placeholder')}
                aria-label={t('adminPanel.lots.assignModal.placeholder')}
                value={assignOwnerValue}
                onChange={setAssignOwnerValue}
                options={users
                  .filter(u => u.role === 'owner')
                  .map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              />
            </Modal>

            <InfoBanner label={`${t('adminPanel.lots.title')}:`} description={t('adminPanel.lots.info')} />
          </div>
        );

      case 'import':
        return (
          <ImportSection
            onImported={(kind) => {
              if (kind === 'lots') lotsApi.getAll().then(setLots);
              else usersApi.getAll().then(setUsers);
            }}
          />
        );

      case 'config':
        return <ConfigSection />;

      case 'reports':
        return <ReportsSection requests={requests} loading={loading} />;

      case 'broadcast':
        return <BroadcastSection />;

      default:
        return <div>{t('adminPanel.defaultContent')}</div>;
    }
  };

  const siderMenu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedMenu]}
      theme={isDark ? 'dark' : 'light'}
      onClick={({ key }) => { setSelectedMenu(key); if (isMobile) setSiderCollapsed(true); }}
      items={menuItems}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          open={!siderCollapsed}
          onClose={() => setSiderCollapsed(true)}
          placement="left"
          width={250}
          styles={{ body: { padding: 0 } }}
          title={t('adminPanel.sidebarTitle')}
        >
          {siderMenu}
        </Drawer>
      ) : (
        <Sider
          width={250}
          theme={isDark ? 'dark' : 'light'}
          breakpoint="md"
          collapsedWidth={0}
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
        >
          <div style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
            {t('adminPanel.sidebarTitle')}
          </div>
          {siderMenu}
        </Sider>
      )}
      <Layout>
        <Content style={{ padding: isMobile ? '16px' : '24px' }}>
          {isMobile && (
            <Button
              icon={<MenuOutlined />}
              onClick={() => setSiderCollapsed(false)}
              style={{ marginBottom: 16 }}
            >
              {menuItems.find(m => m.key === selectedMenu)?.label}
            </Button>
          )}
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            renderContent()
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminPanel;
