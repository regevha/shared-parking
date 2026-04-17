import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Table, Button, Tag, Space, Card, Row, Col, Upload, Alert,
  Input, DatePicker, Tabs, Select, notification, Switch, Spin, Skeleton, Modal, Popconfirm, Drawer,
} from 'antd';
import InfoBanner from './InfoBanner';
import {
  UserOutlined,
  CarOutlined,
  UploadOutlined,
  DownloadOutlined,
  SettingOutlined,
  BarChartOutlined,
  SendOutlined,
  UserAddOutlined,
  ThunderboltOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { usersApi, UserData } from '../api/users';
import { lotsApi, LotData } from '../api/lots';
import { requestsApi } from '../api/requests';
import type { ParkingRequest } from '../contexts/RequestsContext';
import { UserRole, RequestStatus, LotStatus } from '../types/enums';
import { useAuth } from '../contexts/AuthContext';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import { configApi, SystemConfig } from '../api/config';
import { notificationsApi } from '../api/notifications';
import { adminApi } from '../api/admin';
import './AdminPanel.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [siderCollapsed, setSiderCollapsed] = useState(() => window.matchMedia('(max-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setSiderCollapsed(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
  const [reportDateRange, setReportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'owners' | 'users' | 'both'>('both');
  const [isBlackoutSimulated, setIsBlackoutSimulated] = useState(false);
  const [hasImportedData, setHasImportedData] = useState(false);

  // ── System config ───────────────────────────────────────────────────────────
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [autoApprovalLoading, setAutoApprovalLoading] = useState(false);

  useEffect(() => {
    setConfigLoading(true);
    configApi.get()
      .then(setSystemConfig)
      .catch(() => {/* non-critical — fallback text shown */ })
      .finally(() => setConfigLoading(false));
  }, []);

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
          message: t('adminPanel.loadFailed'),
          description: err.message || t('adminPanel.loadFailedDesc'),
        });
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
              notification.error({ message: t('adminPanel.users.notifications.roleUpdateFailed'), description: err.message });
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
              notification.error({ message: t('adminPanel.users.notifications.deleteFailed'), description: err.message });
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
                notification.error({ message: t('adminPanel.lots.notifications.ownerRemoveFailed'), description: err.message });
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

  // ── Reports helpers ─────────────────────────────────────────────────────────
  const filteredRequests = requests
    .filter(r => {
      if (!reportDateRange) return true;
      const d = dayjs(r.date);
      return (
        !d.isBefore(reportDateRange[0].startOf('day')) &&
        !d.isAfter(reportDateRange[1].endOf('day'))
      );
    })
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
    });

  const handleExport = () => {
    const activeTab = document.querySelector('.ant-tabs-tab-active')?.textContent ?? 'All';
    const rows = filteredRequests.map(r => ({
      ID: r.id,
      Date: dayjs(r.date).format('DD/MM/YYYY'),
      Requester: r.requesterName,
      'Time Slot': `${r.startTime} – ${r.endTime}`,
      'Duration': `${r.duration}h`,
      Status: t(getRequestStatusLabel(r.status)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requests');
    const filename = `parking-requests-${dayjs().format('YYYY-MM-DD')}.xlsx`;
    XLSX.writeFile(wb, filename);
    notification.success({ message: t('adminPanel.reports.notifications.exportSuccess', { count: rows.length, filename }) });
  };

  const reportColumns: ColumnsType<ParkingRequest> = [
    { title: t('adminPanel.reports.columns.id'), dataIndex: 'id', key: 'id', width: 100 },
    {
      title: t('adminPanel.reports.columns.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: t('adminPanel.reports.columns.requester'), dataIndex: 'requesterName', key: 'requesterName' },
    {
      title: t('adminPanel.reports.columns.timeSlot'),
      key: 'timeSlot',
      width: 130,
      render: (_: any, r: ParkingRequest) => `${r.startTime} – ${r.endTime}`,
    },
    {
      title: t('adminPanel.reports.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getRequestStatusColor(status)}>
          {t(getRequestStatusLabel(status))}
        </Tag>
      ),
    },
    {
      title: t('adminPanel.reports.columns.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 60,
      render: (d: number) => `${d}h`,
    },
  ];

  // ── Broadcast ───────────────────────────────────────────────────────────────
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const handleBroadcastSend = async () => {
    if (isBlackoutSimulated) {
      notification.error({
        message: t('adminPanel.broadcast.notifications.sent'),
        description: t('adminPanel.broadcast.notifications.blockedDesc'),
      });
      return;
    }

    if (!broadcastMessage.trim()) return;

    setBroadcastLoading(true);
    try {
      const result = await notificationsApi.broadcast(broadcastAudience, broadcastMessage);
      notification.success({
        message: t('adminPanel.broadcast.notifications.sent'),
        description: t('adminPanel.broadcast.notifications.sentDesc', {
          audience: broadcastAudience,
          count: result.delivered_to
        }),
      });
      setBroadcastMessage('');
    } catch (err: any) {
      notification.error({
        message: t('adminPanel.broadcast.notifications.blocked'),
        description: err.message,
      });
    } finally {
      setBroadcastLoading(false);
    }
  };

  // ── Import / Export ─────────────────────────────────────────────────────────
  const [importLoading, setImportLoading] = useState(false);

  const handleDownloadTemplate = (type: 'users' | 'lots') => {
    const csv = type === 'users'
      ? 'name,email,role,password\nJohn Doe,john@parking.dev,user,pass123\nJane Smith,jane@parking.dev,owner,pass123'
      : 'id,floor,floor_label,owner_email\nA-101,1,Floor 1,owner@parking.dev\nB-202,2,Floor 2,';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${type}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uploadProps: UploadProps = {
    beforeUpload: async (file) => {
      setImportLoading(true);
      try {
        const isLots = file.name.toLowerCase().includes('lot');
        const res = isLots ? await adminApi.importLots(file) : await adminApi.importUsers(file);

        if (res.errors && res.errors.length > 0) {
          notification.warning({
            message: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported }),
            description: t('adminPanel.import.notifications.partialSuccess', { count: res.imported }),
          });
        } else {
          notification.success({
            message: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported }),
            description: t('adminPanel.import.notifications.uploadSuccess', { filename: file.name, count: res.imported })
          });
        }
        setHasImportedData(true);
        // Refresh data tables
        if (isLots) {
          lotsApi.getAll().then(setLots);
        } else {
          usersApi.getAll().then(setUsers);
        }
      } catch (err: any) {
        notification.error({
          message: t('adminPanel.import.notifications.uploadFailed'),
          description: err.message,
        });
      } finally {
        setImportLoading(false);
      }
      return false; // Prevent auto-upload
    },
    showUploadList: false,
  };

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
                              notification.error({ message: t('adminPanel.users.notifications.deleteFailed'), description: err.message });
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
                              notification.error({ message: t('adminPanel.lots.notifications.ownerRemoveFailed'), description: err.message });
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
                  notification.error({
                    message: t('adminPanel.lots.notifications.ownerAssignFailed'),
                    description: err.message,
                  });
                } finally {
                  setAssignOwnerLoading(false);
                }
              }}
            >
              <Select
                style={{ width: '100%' }}
                placeholder={t('adminPanel.lots.assignModal.placeholder')}
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
          <div>
            <h2>{t('adminPanel.import.title')}</h2>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card title={t('adminPanel.import.importCardTitle')}>
                  <Upload {...uploadProps} accept=".csv">
                    <Button icon={<UploadOutlined />} size="large" block loading={importLoading}>
                      {t('adminPanel.import.uploadButton')}
                    </Button>
                  </Upload>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--label-color)' }}>
                    {t('adminPanel.import.uploadHint')}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card title={t('adminPanel.import.exportCardTitle')}>
                  <Button
                    icon={<DownloadOutlined />}
                    size="large"
                    block
                    onClick={() => handleDownloadTemplate('users')}
                  >
                    {t('adminPanel.import.downloadButton')} (Users Template)
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    size="large"
                    block
                    style={{ marginTop: '12px' }}
                    onClick={() => handleDownloadTemplate('lots')}
                  >
                    {t('adminPanel.import.downloadButton')} (Lots Template)
                  </Button>
                  {!hasImportedData && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff4d4f' }}>
                      {t('adminPanel.import.downloadHint')}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
            <InfoBanner label={`${t('adminPanel.import.title')}:`} description={t('adminPanel.import.info')} />
          </div>
        );

      case 'config':
        return (
          <div>
            <h2>{t('adminPanel.config.title')}</h2>
            {configLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card title={t('adminPanel.config.cardTitle')}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div><strong>{t('adminPanel.config.timezone')}</strong> {systemConfig?.timezone ?? '—'}</div>
                      <div>
                        <strong>{t('adminPanel.config.blackoutPeriod')}</strong>{' '}
                        {systemConfig ? `${systemConfig.blackoutStart} – ${systemConfig.blackoutEnd}` : '—'}
                      </div>
                      <div>
                        <strong>{t('adminPanel.config.maxRequests')}</strong>{' '}
                        {systemConfig?.maxPendingRequestsPerUser ?? '—'}
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card title={t('adminPanel.config.schedulerTitle')}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>{t('adminPanel.config.schedulerDesc')}</div>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={autoApprovalLoading}
                        onClick={async () => {
                          setAutoApprovalLoading(true);
                          try {
                            const result = await configApi.triggerAutoApproval();
                            notification.success({
                              message: t('adminPanel.config.autoApprovalSuccess'),
                              description: t('adminPanel.config.autoApprovalSuccessDesc', {
                                approved: result.approved,
                                remaining: result.remainingPending,
                              }),
                            });
                          } catch (err: any) {
                            notification.error({
                              message: t('adminPanel.config.autoApprovalFailed'),
                              description: err.message,
                            });
                          } finally {
                            setAutoApprovalLoading(false);
                          }
                        }}
                        size="large"
                        block
                      >
                        {t('adminPanel.config.runAutoApproval')}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              </Row>}
            <InfoBanner label={`${t('adminPanel.config.title')}:`} description={t('adminPanel.config.info')} />
          </div>
        );

      case 'reports':
        return (
          <div>
            <h2>{t('adminPanel.reports.title')}</h2>
            <Card style={{ marginBottom: '16px' }}>
              <Space wrap>
                <span>{t('adminPanel.reports.dateRange')}</span>
                <RangePicker
                  value={reportDateRange}
                  onChange={dates =>
                    setReportDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
                  }
                  style={{ width: isMobile ? '100%' : 'auto' }}
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  disabled={filteredRequests.length === 0}
                  onClick={handleExport}
                >
                  {t('adminPanel.reports.exportButton')}
                </Button>
              </Space>
            </Card>

            <Tabs defaultActiveKey="all" destroyInactiveTabPane>
              {[
                { key: 'all', data: filteredRequests },
                { key: 'pending', data: filteredRequests.filter(r => r.status === RequestStatus.PENDING) },
                { key: 'approved', data: filteredRequests.filter(r => r.status === RequestStatus.APPROVED) },
                { key: 'rejected', data: filteredRequests.filter(r => r.status === RequestStatus.REJECTED) },
              ].map(({ key, data }) => (
                <Tabs.TabPane tab={t(`adminPanel.reports.tabs.${key}`, { count: data.length })} key={key}>
                  {isMobile ? (
                    <div className="admin-card-list">
                      {data.map(r => (
                        <Card key={r.id} size="small" className="admin-card">
                          <div className="admin-card-header">
                            <strong>{r.requesterName}</strong>
                            <Tag color={getRequestStatusColor(r.status)}>
                              {t(getRequestStatusLabel(r.status))}
                            </Tag>
                          </div>
                          <div className="admin-card-row">
                            <span className="admin-card-label">{t('adminPanel.reports.columns.id')}</span>
                            <span>{r.id}</span>
                          </div>
                          <div className="admin-card-row">
                            <span className="admin-card-label">{t('adminPanel.reports.columns.date')}</span>
                            <span>{dayjs(r.date).format('DD/MM/YYYY')}</span>
                          </div>
                          <div className="admin-card-row">
                            <span className="admin-card-label">{t('adminPanel.reports.columns.timeSlot')}</span>
                            <span>{r.startTime} – {r.endTime}</span>
                          </div>
                          <div className="admin-card-row">
                            <span className="admin-card-label">{t('adminPanel.reports.columns.duration')}</span>
                            <span>{r.duration}h</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <Table
                        columns={reportColumns}
                        dataSource={data}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        scroll={{ x: 'max-content' }}
                      />
                    </div>
                  )}
                </Tabs.TabPane>
              ))}
            </Tabs>

            <InfoBanner label={`${t('adminPanel.reports.title')}:`} description={t('adminPanel.reports.info')} />
          </div>
        );

      case 'broadcast':
        return (
          <div>
            <h2>{t('adminPanel.broadcast.title')}</h2>

            <Card style={{ marginBottom: '16px' }}>
              <Space>
                <span>{t('adminPanel.broadcast.simulateBlackout')}</span>
                <Switch
                  checked={isBlackoutSimulated}
                  onChange={setIsBlackoutSimulated}
                  checkedChildren={t('adminPanel.broadcast.blackoutOn')}
                  unCheckedChildren={t('adminPanel.broadcast.blackoutOff')}
                />
              </Space>
            </Card>

            {isBlackoutSimulated && (
              <Alert
                message={t('adminPanel.broadcast.blackoutAlert')}
                description={t('adminPanel.broadcast.blackoutAlertDesc')}
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}

            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>{t('adminPanel.broadcast.audienceLabel')}</strong>
                  <Select
                    value={broadcastAudience}
                    onChange={setBroadcastAudience}
                    style={{ width: isMobile ? '100%' : '220px', marginLeft: isMobile ? 0 : '8px' }}
                    options={[
                      { value: 'owners', label: t('adminPanel.broadcast.audiences.owners') },
                      { value: 'users', label: t('adminPanel.broadcast.audiences.users') },
                      { value: 'both', label: t('adminPanel.broadcast.audiences.both') },
                    ]}
                  />
                </div>

                <div>
                  <strong>{t('adminPanel.broadcast.messageLabel')}</strong>
                  <TextArea
                    rows={4}
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder={t('adminPanel.broadcast.messagePlaceholder')}
                    style={{ marginTop: '8px' }}
                  />
                </div>

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={isBlackoutSimulated || !broadcastMessage.trim()}
                  loading={broadcastLoading}
                  onClick={handleBroadcastSend}
                  size="large"
                >
                  {t('adminPanel.broadcast.sendButton')}
                </Button>
              </Space>
            </Card>

            <InfoBanner label={`${t('adminPanel.broadcast.title')}:`} description={t('adminPanel.broadcast.info')} />
          </div>
        );

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
