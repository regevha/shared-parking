import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Button, Skeleton, Drawer,
} from 'antd';
import BroadcastSection from './admin/BroadcastSection';
import ImportSection from './admin/ImportSection';
import ConfigSection from './admin/ConfigSection';
import ReportsSection from './admin/ReportsSection';
import LotsSection from './admin/LotsSection';
import UsersSection from './admin/UsersSection';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usersApi, UserData } from '../api/users';
import { lotsApi, LotData } from '../api/lots';
import { requestsApi } from '../api/requests';
import type { ParkingRequest } from '../contexts/RequestsContext';
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

  // ── Section renderer ────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (selectedMenu) {

      case 'users':
        return <UsersSection users={users} loading={loading} refreshUsers={refreshUsers} />;

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
