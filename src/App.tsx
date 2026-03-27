import React, { useState, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Dropdown, Button, ConfigProvider, theme, Spin } from 'antd';
import { SettingOutlined, UserOutlined, CrownOutlined, TeamOutlined, SunOutlined, MoonOutlined, LogoutOutlined } from '@ant-design/icons';
import { Role } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequestsProvider } from './contexts/RequestsContext';
import LotStatusBoard from './components/LotStatusBoard';
import AllPendingRequests from './components/AllPendingRequests';
import AllApprovals from './components/AllApprovals';
import MyRequests from './components/MyRequests';
import ParkingRequestForm from './components/ParkingRequestForm';
import RequestDetail from './components/RequestDetail';
import NotificationWindows from './components/NotificationWindows';
import AdminPanel from './components/AdminPanel';
import MyLots from './components/MyLots';
import CalendarView from './components/CalendarView';
import LotCalendarView from './components/LotCalendarView';
import LoginPage from './components/LoginPage';
import './App.css';

const { Header, Content } = Layout;

/** Map backend role string → frontend Role type */
function toAppRole(backendRole: string): Role {
  const map: Record<string, Role> = { user: 'User', owner: 'Owner', manager: 'Manager' };
  return map[backendRole] ?? 'User';
}

// ── Inner app (rendered after auth) ──────────────────────────────────────────
const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const role: Role = toAppRole(user?.role ?? 'user');

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('darkMode');
    return stored !== null ? stored === 'true' : true;
  });

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const getMenuItems = () => {
    const items: { key: string; label: React.ReactNode }[] = [];

    if (role === 'User' || role === 'Owner') {
      items.push({ key: 'my-requests', label: <Link to="/my-requests">My Requests</Link> });
    }

    items.push({ key: 'calendar',   label: <Link to="/calendar">Requests View</Link> });
    items.push({ key: 'pending',    label: <Link to="/pending">Pending Requests</Link> });
    items.push({ key: 'approvals',  label: <Link to="/approvals">Approvals</Link> });
    items.push({ key: 'lot-status', label: <Link to="/lot-status">Parking Status</Link> });

    if (role === 'Owner') {
      items.push({ key: 'lot-calendar', label: <Link to="/lot-calendar">Lot Calendar</Link> });
      items.push({ key: 'my-lots',      label: <Link to="/my-lots">My Lots</Link> });
    }

    if (role === 'Manager') {
      items.push({ key: 'admin', label: <Link to="/admin">Admin Panel</Link> });
    }

    return items;
  };

  const settingsMenu = {
    items: [
      { key: 'notifications', label: <Link to="/notifications">Notification Windows</Link> },
    ],
  };

  const roleIcon = role === 'Owner' ? <CrownOutlined /> : role === 'Manager' ? <TeamOutlined /> : <UserOutlined />;

  const headerBg       = darkMode ? '#141414' : '#ffffff';
  const headerBtnStyle = { color: darkMode ? 'white' : 'rgba(0,0,0,0.88)' };
  const headerStyle    = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    background: headerBg,
    borderBottom: darkMode ? 'none' : '1px solid #f0f0f0',
  };

  return (
    <ConfigProvider theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <RequestsProvider>
        <Router>
          <Layout>
            <Header style={headerStyle}>
              <Menu
                theme={darkMode ? 'dark' : 'light'}
                mode="horizontal"
                items={getMenuItems()}
                style={{ flex: 1, minWidth: 0, background: 'transparent' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button
                  type="text"
                  icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
                  onClick={() => setDarkMode(d => !d)}
                  style={headerBtnStyle}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                />
                <Dropdown menu={settingsMenu} trigger={['click']}>
                  <Button type="text" icon={<SettingOutlined />} style={headerBtnStyle} />
                </Dropdown>
                {/* User identity badge — read-only, role comes from JWT */}
                <Button type="text" style={{ ...headerBtnStyle, marginLeft: 8, cursor: 'default' }}>
                  {roleIcon} {user?.name ?? role}
                </Button>
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                  style={headerBtnStyle}
                  title="Sign out"
                />
              </div>
            </Header>
            <Content style={{ padding: '0 50px' }}>
              <div style={{ padding: 24, minHeight: 380 }}>
                <Routes>
                  <Route path="/lot-status"   element={<LotStatusBoard />} />
                  <Route path="/pending"      element={<AllPendingRequests role={role} />} />
                  <Route path="/calendar"     element={<CalendarView role={role} />} />
                  <Route path="/approvals"    element={<AllApprovals />} />
                  <Route path="/submit-request" element={<ParkingRequestForm />} />
                  <Route path="/my-requests"  element={<MyRequests />} />
                  <Route path="/my-lots"      element={<MyLots />} />
                  <Route path="/lot-calendar" element={<LotCalendarView />} />
                  <Route path="/admin"        element={<AdminPanel />} />
                  <Route path="/notifications" element={<NotificationWindows />} />
                  <Route path="/request/:id"  element={<RequestDetail />} />
                  <Route path="/"             element={<LotStatusBoard />} />
                </Routes>
              </div>
            </Content>
          </Layout>
        </Router>
      </RequestsProvider>
    </ConfigProvider>
  );
};

// ── Root: handles auth gating ─────────────────────────────────────────────────
const AppRoot: React.FC = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return user ? <AppShell /> : <LoginPage />;
};

// ── Top-level export ──────────────────────────────────────────────────────────
const App: React.FC = () => (
  <AuthProvider>
    <AppRoot />
  </AuthProvider>
);

export default App;
