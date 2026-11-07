import React, { useState } from 'react';
import { Alert, Button, Card, Modal, Popconfirm, Select, Space, Table, Tag, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import InfoBanner from '../InfoBanner';
import { lotsApi, LotData } from '../../api/lots';
import type { UserData } from '../../api/users';
import { LotStatus } from '../../types/enums';
import { useIsMobile } from '../../hooks/useIsMobile';
import { notifyError } from '../../utils/notify';

// Colour map for the four real lot-status values from the backend
const LOT_STATUS_COLOR: Record<string, string> = {
  available: 'green',
  blocked: 'red',
  unowned: 'orange',
  'unowned-blocked': 'volcano',
};

interface LotsSectionProps {
  lots: LotData[];
  /** Used to offer the owners in the assign-owner dialog. */
  users: UserData[];
  loading: boolean;
  /** Reload the lots list in the parent after an owner change. */
  refreshLots: () => Promise<unknown>;
}

/** Admin Panel → Lot Management: filter lots, assign or remove owners. */
const LotsSection: React.FC<LotsSectionProps> = ({ lots, users, loading, refreshLots }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [assignOwnerLotId, setAssignOwnerLotId] = useState<string | null>(null);
  const [assignOwnerValue, setAssignOwnerValue] = useState<string | null>(null);
  const [assignOwnerLoading, setAssignOwnerLoading] = useState(false);
  const [lotFilter, setLotFilter] = useState<'All' | 'Available' | 'Blocked' | 'Unowned'>('All');

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
      render: (_: unknown, record: LotData) =>
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
      render: (_: unknown, record: LotData) => {
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
              } catch (err) {
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
                      } catch (err) {
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
          } catch (err) {
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
};

export default LotsSection;
