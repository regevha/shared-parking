import React, { useState, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Dropdown, Button, ConfigProvider, theme, Spin, Grid } from 'antd';
import { SettingOutlined, UserOutlined, CrownOutlined, TeamOutlined, SunOutlined, MoonOutlined, LogoutOutlined, GlobalOutlined } from '@ant-design/icons';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import heIL from 'antd/locale/he_IL';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/he';
import { useTranslation } from 'react-i18next';
import { Role } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequestsProvider } from './contexts/RequestsContext';
import { usersApi } from './api/users';
import { type SupportedLanguage, SUPPORTED_LANGUAGES, getStoredLanguage, storeLanguage, isRTL } from './i18n';
import LotStatusBoard from './components/LotStatusBoard';
import AllPendingRequests from './components/AllPendingRequests';
import AllApprovals from './components/AllApprovals';
import MyRequests from './components/MyRequests';
import ParkingRequestForm from './components/ParkingRequestForm';
import RequestDetail from './components/RequestDetail';
import AvailabilityWindows from './components/AvailabilityWindows';
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
interface AppShellProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const AppShell: React.FC<AppShellProps> = ({ darkMode, toggleDarkMode, language, setLanguage }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const role: Role = toAppRole(user?.role ?? 'user');
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const getMenuItems = () => {
    const items: { key: string; label: React.ReactNode }[] = [];

    if (role === 'User' || role === 'Owner') {
      items.push({ key: 'my-requests', label: <Link to="/my-requests">{t('nav.myRequests')}</Link> });
    }

    items.push({ key: 'calendar',   label: <Link to="/calendar">{t('nav.requestsView')}</Link> });
    items.push({ key: 'pending',    label: <Link to="/pending">{t('nav.pendingRequests')}</Link> });
    items.push({ key: 'approvals',  label: <Link to="/approvals">{t('nav.approvals')}</Link> });
    items.push({ key: 'lot-status', label: <Link to="/lot-status">{t('nav.parkingStatus')}</Link> });

    if (role === 'Owner') {
      items.push({ key: 'lot-calendar', label: <Link to="/lot-calendar">{t('nav.lotCalendar')}</Link> });
      items.push({ key: 'my-lots',      label: <Link to="/my-lots">{t('nav.myLots')}</Link> });
    }

    if (role === 'Manager') {
      items.push({ key: 'admin', label: <Link to="/admin">{t('nav.adminPanel')}</Link> });
    }

    return items;
  };

  const settingsMenu = {
    items: [
      { key: 'availability', label: <Link to="/availability">{t('nav.availabilityWindows')}</Link> },
      { key: 'notifications', label: <Link to="/notifications">{t('nav.notificationWindows')}</Link> },
    ],
  };

  const languageMenu = {
    items: SUPPORTED_LANGUAGES.map(lang => ({
      key: lang.code,
      label: lang.nativeLabel,
      onClick: () => setLanguage(lang.code),
    })),
    selectedKeys: [language],
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

  const currentLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeLabel ?? 'EN';

  return (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, direction: 'ltr' }}>
                <Dropdown menu={languageMenu} trigger={['click']}>
                  <Button
                    type="text"
                    icon={<GlobalOutlined />}
                    style={{ ...headerBtnStyle, fontWeight: 600, fontSize: 13 }}
                    title="Change language"
                  >
                    {currentLangLabel}
                  </Button>
                </Dropdown>
                <Button
                  type="text"
                  icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
                  onClick={toggleDarkMode}
                  style={headerBtnStyle}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                />
                <Dropdown menu={settingsMenu} trigger={['click']}>
                  <Button type="text" icon={<SettingOutlined />} style={headerBtnStyle} />
                </Dropdown>
                {/* User menu — name + logout */}
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'logout',
                        label: t('nav.signOut'),
                        icon: <LogoutOutlined />,
                        danger: true,
                        onClick: logout,
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button type="text" style={{ ...headerBtnStyle, marginLeft: 8 }}>
                    {roleIcon}{!isMobile && ` ${user?.name ?? role}`}
                  </Button>
                </Dropdown>
              </div>
            </Header>
            <Content style={{ padding: isMobile ? '0 8px' : '0 50px' }}>
              <div style={{ padding: isMobile ? 12 : 24, minHeight: 380 }}>
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
                   <Route path="/availability" element={<AvailabilityWindows />} />
                  <Route path="/notifications" element={<NotificationWindows />} />
                  <Route path="/request/:id"  element={<RequestDetail />} />
                  <Route path="/"             element={<LotStatusBoard />} />
                </Routes>
              </div>
            </Content>
          </Layout>
        </Router>
      </RequestsProvider>
  );
};

// ── Root: handles auth gating ─────────────────────────────────────────────────
const AppRoot: React.FC = () => {
  const { user, authLoading, updateUser } = useAuth();
  const { i18n } = useTranslation();

  // Default to dark while loading; sync from user.darkMode once authenticated
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [language, setLanguageState] = useState<SupportedLanguage>(getStoredLanguage);

  useEffect(() => {
    if (user) {
      setDarkMode(user.preferences.darkMode);
      const lang = (user.preferences.language ?? 'en') as SupportedLanguage;
      setLanguage(lang);
      storeLanguage(lang);
      i18n.changeLanguage(lang);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useLayoutEffect(() => {
    const dir = isRTL(language) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    if (user) {
      updateUser({ preferences: { ...user.preferences, darkMode: next } });
      // Fire-and-forget — don't block the UI on the network call
      usersApi.updatePreferences(user.id, { dark_mode: next }).catch(() => {});
    }
  };

  const setLanguage = (next: SupportedLanguage) => {
    setLanguageState(next);
    storeLanguage(next);
    i18n.changeLanguage(next);

    dayjs.locale(next);
    if (user) {
      updateUser({ preferences: { ...user.preferences, language: next } });
      usersApi.updatePreferences(user.id, { language: next }).catch(() => {});
    }
  };

  const antdLocale = language === 'fr' ? frFR : language === 'he' ? heIL : enUS;
  const direction  = isRTL(language) ? 'rtl' : 'ltr';

  if (authLoading) {
    return (
      <ConfigProvider
        theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}
        locale={antdLocale}
        direction={direction}
      >
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      theme={{ algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}
      locale={antdLocale}
      direction={direction}
    >
      {user
        ? <AppShell darkMode={darkMode} toggleDarkMode={toggleDarkMode} language={language} setLanguage={setLanguage} />
        : <LoginPage />}
    </ConfigProvider>
  );
};

// ── Top-level export ──────────────────────────────────────────────────────────
const App: React.FC = () => (
  <AuthProvider>
    <AppRoot />
  </AuthProvider>
);

export default App;
