import React, { useState, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Dropdown, Button, ConfigProvider, theme } from 'antd';
import { SettingOutlined, UserOutlined, CrownOutlined, TeamOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { Role } from './types';
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
import './App.css';

const { Header, Content } = Layout;

type AppRole = Role;

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>('User');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('darkMode');
    return stored !== null ? stored === 'true' : true; // default: dark
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

    items.push({ key: 'calendar', label: <Link to="/calendar">Requests</Link> });
    items.push({ key: 'pending', label: <Link to="/pending">All Pending Requests</Link> });
    items.push({ key: 'approvals', label: <Link to="/approvals">All Approvals</Link> });
    items.push({ key: 'lot-status', label: <Link to="/lot-status">Parking Status</Link> });

    if (role === 'Owner') {
      items.push({ key: 'lot-calendar', label: <Link to="/lot-calendar">Lot Calendar</Link> });
      items.push({ key: 'my-lots', label: <Link to="/my-lots">My Lots</Link> });
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

  const roleMenu = {
    items: [
      { key: 'User', label: 'User', icon: <UserOutlined /> },
      { key: 'Owner', label: 'Owner', icon: <CrownOutlined /> },
      { key: 'Manager', label: 'Manager', icon: <TeamOutlined /> },
    ],
    onClick: ({ key }: { key: string }) => setRole(key as AppRole),
  };

  const headerBg   = darkMode ? '#141414' : '#ffffff';
  const headerBtnStyle = { color: darkMode ? 'white' : 'rgba(0,0,0,0.88)' };
  const headerStyle = {
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
              <Dropdown menu={roleMenu} trigger={['click']}>
                <Button type="text" style={{ ...headerBtnStyle, marginLeft: 8 }}>
                  {role} <UserOutlined />
                </Button>
              </Dropdown>
            </div>
          </Header>
          <Content style={{ padding: '0 50px', marginTop: 64 }}>
            <div style={{ padding: 24, minHeight: 380 }}>
              <Routes>
                <Route path="/lot-status" element={<LotStatusBoard />} />
                <Route path="/pending" element={<AllPendingRequests role={role} />} />
                <Route path="/calendar" element={<CalendarView role={role} />} />
                <Route path="/approvals" element={<AllApprovals />} />
                <Route path="/submit-request" element={<ParkingRequestForm />} />
                <Route path="/my-requests" element={<MyRequests />} />
                <Route path="/my-lots" element={<MyLots />} />
                <Route path="/lot-calendar" element={<LotCalendarView />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/notifications" element={<NotificationWindows />} />
                <Route path="/request/:id" element={<RequestDetail />} />
                <Route path="/" element={<LotStatusBoard />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Router>
    </RequestsProvider>
    </ConfigProvider>
  );
};

export default App;
