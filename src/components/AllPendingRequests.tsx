import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { Table, Button, Tag, Space, Row, Col, Card, Segmented, Modal, notification } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { UserRole } from '../types/enums';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import './AllPendingRequests.css';

interface AllPendingRequestsProps {
  role: UserRole;
}

const AllPendingRequests: React.FC<AllPendingRequestsProps> = ({ role }) => {
  const isOwner = role === UserRole.OWNER;
  const isManager = role === UserRole.MANAGER;
  const canApprove = isOwner || isManager;
  const [filterMode, setFilterMode] = useState<'all' | 'active'>(isOwner ? 'active' : 'all');
  const [approvalInProgress, setApprovalInProgress] = useState<string | null>(null);
  const { pendingRequests, approveRequest, rejectRequest } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = [...pendingRequests];

    if (isOwner && filterMode === 'active') {
      filtered = filtered.filter((req) => !req.rejectedByOwner);
    }

    // Oldest date + time first (ascending)
    return filtered.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
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

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: t('pendingRequests.columns.requesterName'),
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: '20%',
      render: (text: string, record: ParkingRequest) => {
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
      render: (_, record: ParkingRequest) => (
        <>
          {record.startTime} - {record.endTime}
          {record.endDate && record.endDate !== record.date && (
            <div style={{ fontSize: '11px', color: 'var(--label-color)' }}>
              ({dayjs(record.endDate).format('DD/MM')})
            </div>
          )}
        </>
      ),
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
      render: (_, record: ParkingRequest) => {
        const isOwnRequest = record.requesterId === user?.id;

        if (!canApprove) {
          return <span style={{ color: '#999', fontSize: '12px' }}>{t('pendingRequests.noActions')}</span>;
        }

        if (isOwnRequest) {
          return <Tag>{t('pendingRequests.cannotApproveOwn')}</Tag>;
        }

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id, record.requesterName)}
              loading={approvalInProgress === record.id}
            >
              {t('pendingRequests.actions.approve')}
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleReject(record.id, record.requesterName)}
              loading={approvalInProgress === record.id}
            >
              {t('pendingRequests.actions.reject')}
            </Button>
          </Space>
        );
      },
    },
  ];

  const getRowClassName = (record: ParkingRequest) => {
    if (isOwner && record.rejectedByOwner) {
      return 'rejected-row';
    }
    return '';
  };

  return (
    <div className="pending-requests">
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <h1>{t('pendingRequests.title')}</h1>
        </Col>
        {isOwner && (
          <Col>
            <Space>
              <span>{t('pendingRequests.filterLabel')}</span>
              <Segmented
                options={[
                  { label: t('pendingRequests.filterAll'), value: 'all' },
                  { label: t('pendingRequests.filterHideRejected'), value: 'active' },
                ]}
                value={filterMode}
                onChange={(v) => setFilterMode(v as any)}
              />
            </Space>
          </Col>
        )}
      </Row>

      <Table
        columns={columns}
        dataSource={filteredRequests}
        rowKey="id"
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        size="middle"
        rowClassName={getRowClassName}
      />

      <div className="legend-and-info" style={{ marginTop: '24px' }}>
        {isOwner && (
          <div className="legend" style={{ marginBottom: '16px' }}>
            <span className="rejected-sample"></span>
            <span style={{ fontSize: '13px', color: '#666' }}>
              {t('pendingRequests.rejectedLegend')}
            </span>
          </div>
        )}
        
        <Row gutter={16}>
          <Col xs={24} md={8}>
             <Card size="small" title={t('pendingRequests.stats.total')} style={{ height: '100%' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{pendingRequests.length}</div>
             </Card>
          </Col>
          <Col xs={24} md={8}>
             <Card size="small" title={t('pendingRequests.stats.pending')} style={{ height: '100%' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {pendingRequests.filter(r => !r.rejectedByOwner).length}
                </div>
             </Card>
          </Col>
          {isOwner && (
            <Col xs={24} md={8}>
              <Card size="small" title={t('pendingRequests.stats.rejectedByYou')} style={{ height: '100%' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                    {pendingRequests.filter(r => r.rejectedByOwner).length}
                  </div>
              </Card>
            </Col>
          )}
        </Row>

        <Card style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }} size="small">
          <strong>{t('pendingRequests.title')}:</strong> {isOwner ? t('pendingRequests.infoOwner') : t('pendingRequests.infoManager')}
        </Card>
      </div>
    </div>
  );
};

export default AllPendingRequests;
