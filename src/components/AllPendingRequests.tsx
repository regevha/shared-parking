import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { Table, Button, Tag, Space, Row, Col, Card, Segmented, Modal, notification } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { Role } from '../types';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import './AllPendingRequests.css';

interface PendingRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  submittedAt: string;
  rejectedByOwner?: boolean;
}

interface AllPendingRequestsProps {
  role: Role;
}

const AllPendingRequests: React.FC<AllPendingRequestsProps> = ({ role }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active'>('all');
  const [approvalInProgress, setApprovalInProgress] = useState<string | null>(null);
  const { pendingRequests, approveRequest, rejectRequest } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  const isOwner = role === 'Owner';

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = [...pendingRequests];

    if (isOwner && filterMode === 'active') {
      filtered = filtered.filter((req) => !req.rejectedByOwner);
    }

    // Newest date + time first
    return filtered.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      return d !== 0 ? d : b.startTime.localeCompare(a.startTime);
    });
  }, [filterMode, isOwner, pendingRequests]);

  const handleApprove = (requestId: string, requesterName: string) => {
    Modal.confirm({
      title: t('pendingRequests.approveModal.title'),
      content: t('pendingRequests.approveModal.content', { name: requesterName }),
      okText: t('pendingRequests.approveModal.ok'),
      cancelText: t('pendingRequests.approveModal.cancel'),
      onOk: async () => {
        setApprovalInProgress(requestId);
        try {
          await approveRequest(requestId);
          notification.success({
            message: t('pendingRequests.notifications.approved'),
            description: t('pendingRequests.notifications.approvedDesc', { name: requesterName }),
          });
        } catch (err: any) {
          notification.error({
            message: t('pendingRequests.notifications.approvalFailed'),
            description: err.message || t('pendingRequests.notifications.approvalFailedDesc'),
          });
        } finally {
          setApprovalInProgress(null);
        }
      },
    });
  };

  const handleReject = (requestId: string, requesterName: string) => {
    Modal.confirm({
      title: t('pendingRequests.rejectModal.title'),
      content: t('pendingRequests.rejectModal.content', { name: requesterName }),
      okText: t('pendingRequests.rejectModal.ok'),
      okButtonProps: { danger: true },
      cancelText: t('pendingRequests.rejectModal.cancel'),
      onOk: async () => {
        setApprovalInProgress(requestId);
        try {
          await rejectRequest(requestId);
          notification.success({
            message: t('pendingRequests.notifications.rejected'),
            description: t('pendingRequests.notifications.rejectedDesc', { name: requesterName }),
          });
        } catch (err: any) {
          notification.error({
            message: t('pendingRequests.notifications.rejectionFailed'),
            description: err.message || t('pendingRequests.notifications.rejectionFailedDesc'),
          });
        } finally {
          setApprovalInProgress(null);
        }
      },
    });
  };

  const columns: ColumnsType<PendingRequest> = [
    {
      title: t('pendingRequests.columns.requesterName'),
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: '20%',
      render: (text: string, record: PendingRequest) => {
        const isOwnRequest = record.requesterId === user?.id;
        return (
          <div>
            <strong>{text}</strong>
            {isOwnRequest && <Tag color="blue" style={{ marginLeft: '8px' }}>({t('pendingRequests.youTag')})</Tag>}
          </div>
        );
      },
    },
    {
      title: t('pendingRequests.columns.timeSlot'),
      key: 'timeSlot',
      width: '18%',
      render: (_, record: PendingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: t('pendingRequests.columns.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: '12%',
      render: (duration: number) => `${duration}h`,
    },
    {
      title: t('pendingRequests.columns.date'),
      dataIndex: 'date',
      key: 'date',
      width: '15%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: t('pendingRequests.columns.submitted'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: '15%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('pendingRequests.columns.actions'),
      key: 'actions',
      width: '20%',
      render: (_, record: PendingRequest) => {
        const isOwnRequest = record.requesterId === user?.id;

        if (!isOwner) {
          return <span style={{ color: '#999' }}>{t('pendingRequests.noActions')}</span>;
        }

        if (isOwnRequest) {
          return <span style={{ color: '#999' }}>{t('pendingRequests.cannotApproveOwn')}</span>;
        }

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              loading={approvalInProgress === record.id}
              onClick={() => handleApprove(record.id, record.requesterName)}
            >
              {t('pendingRequests.actions.approve')}
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              loading={approvalInProgress === record.id}
              onClick={() => handleReject(record.id, record.requesterName)}
            >
              {t('pendingRequests.actions.reject')}
            </Button>
          </Space>
        );
      },
    },
  ];

  const getRowClassName = (record: PendingRequest) => {
    if (isOwner && record.rejectedByOwner) {
      return 'rejected-row';
    }
    return '';
  };

  const stats = {
    total: pendingRequests.length,
    pending: pendingRequests.filter((r: ParkingRequest) => r.status === 'pending').length,
    rejected: pendingRequests.filter((r: ParkingRequest) => r.status === 'rejected' || r.rejectedByOwner).length,
  };

  return (
    <div className="all-pending-requests">
      <h1>{t('pendingRequests.title')}</h1>

      {/* Filter Toggle (Owner only) */}
      {isOwner && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <strong>{t('pendingRequests.filterLabel')}</strong>
            </span>
            <Segmented
              value={filterMode}
              onChange={(value) => setFilterMode(value as 'all' | 'active')}
              options={[
                { label: t('pendingRequests.filterAll'), value: 'all' },
                { label: t('pendingRequests.filterHideRejected'), value: 'active' },
              ]}
            />
          </div>
        </Card>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredRequests}
        rowKey="id"
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 800 }}
        rowClassName={getRowClassName}
        size="middle"
      />

      {/* Legend for rejected requests (Owner only) */}
      {isOwner && stats.rejected > 0 && (
        <Card style={{ marginTop: '24px' }} size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#f5f5f5',
                borderRadius: '2px',
                border: '1px solid #d9d9d9',
              }}
            />
            <span>{t('pendingRequests.rejectedLegend')}</span>
          </div>
        </Card>
      )}

      {/* Stats */}
      <Card size="small" style={{ marginTop: '24px' }}>
        <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
          <div>
            <strong style={{ fontSize: '18px', color: '#000', marginRight: '8px' }}>{stats.total}</strong>
            <span style={{ color: '#666' }}>{t('pendingRequests.stats.total')}</span>
          </div>
          <div>
            <strong style={{ fontSize: '18px', color: '#1890ff', marginRight: '8px' }}>{stats.pending}</strong>
            <span style={{ color: '#666' }}>{t('pendingRequests.stats.pending')}</span>
          </div>
          {isOwner && (
            <div>
              <strong style={{ fontSize: '18px', color: '#999', marginRight: '8px' }}>{stats.rejected}</strong>
              <span style={{ color: '#666' }}>{t('pendingRequests.stats.rejectedByYou')}</span>
            </div>
          )}
        </Space>
      </Card>

      {/* Role-specific Info */}
      <Card style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        {isOwner ? (
          <div>
            <strong>{t('pendingRequests.title')}:</strong> {t('pendingRequests.infoOwner')}
          </div>
        ) : (
          <div>
            <strong>{t('pendingRequests.title')}:</strong> {t('pendingRequests.infoManager')}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AllPendingRequests;
