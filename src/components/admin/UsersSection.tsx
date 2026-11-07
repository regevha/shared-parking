import React, { useState } from 'react';
import { Table, Button, Tag, Card, Select, notification, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import InfoBanner from '../InfoBanner';
import { usersApi, UserData } from '../../api/users';
import { UserRole } from '../../types/enums';
import { useIsMobile } from '../../hooks/useIsMobile';
import { notifyError } from '../../utils/notify';

interface UsersSectionProps {
  users: UserData[];
  loading: boolean;
  refreshUsers: () => Promise<unknown>;
}

const UsersSection: React.FC<UsersSectionProps> = ({ users, loading, refreshUsers }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Per-row action spinner (keyed by record id)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const setBusy = (id: string, busy: boolean) =>
    setActionLoading(prev => ({ ...prev, [id]: busy }));

  const changeRole = async (record: UserData, newRole: string) => {
    setBusy(record.id, true);
    try {
      const translatedRole = t(`adminPanel.users.roles.${newRole}`);
      await usersApi.update(record.id, { role: newRole });
      notification.success({
        message: t('adminPanel.users.notifications.roleUpdated'),
        description: t('adminPanel.users.notifications.roleUpdatedDesc', { name: record.name, role: translatedRole }),
      });
      await refreshUsers();
    } catch (err) {
      notifyError(t('adminPanel.users.notifications.roleUpdateFailed'), err);
    } finally {
      setBusy(record.id, false);
    }
  };

  const deleteUser = async (record: UserData) => {
    setBusy(record.id, true);
    try {
      await usersApi.delete(record.id);
      notification.success({ message: t('adminPanel.users.notifications.userDeleted'), description: record.name });
      await refreshUsers();
    } catch (err) {
      notifyError(t('adminPanel.users.notifications.deleteFailed'), err);
    } finally {
      setBusy(record.id, false);
    }
  };

  const userColumns: ColumnsType<UserData> = [
    { title: t('adminPanel.users.columns.name'), dataIndex: 'name', key: 'name' },
    { title: t('adminPanel.users.columns.email'), dataIndex: 'email', key: 'email' },
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
          onChange={(newRole: string) => changeRole(record, newRole)}
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
      render: (_: unknown, record: UserData) => (
        <Popconfirm
          title={t('adminPanel.users.deleteConfirm')}
          description={t('adminPanel.users.deleteWarning')}
          okText={t('adminPanel.users.deleteOk')}
          okButtonProps={{ danger: true }}
          disabled={record.role === UserRole.MANAGER}
          onConfirm={() => deleteUser(record)}
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
                    onConfirm={() => deleteUser(u)}
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
};

export default UsersSection;
