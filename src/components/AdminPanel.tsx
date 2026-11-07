import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Table, Button, Tag, Card,
  Select, notification, Skeleton, Popconfirm, Drawer,
} from 'antd';
import InfoBanner from './InfoBanner';
import BroadcastSection from './admin/BroadcastSection';
import ImportSection from './admin/ImportSection';
import ConfigSection from './admin/ConfigSection';
import ReportsSection from './admin/ReportsSection';
import LotsSection from './admin/LotsSection';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { usersApi, UserData } from '../api/users';
import { lotsApi, LotData } from '../api/lots';
import { requestsApi } from '../api/requests';
import type { ParkingRequest } from '../contexts/RequestsContext';
import { UserRole } from '../types/enums';
import { useAuth } from '../contexts/AuthContext';
import './AdminPanel.css';
import { useIsMobile } from '../hooks/useIsMobile';
import { notifyError } from '../utils/notify';

const { Sider, Content } = Layout;

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
        return <LotsSection lots={lots} users={users} loading={loading} refreshLots={refreshLots} />;

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
