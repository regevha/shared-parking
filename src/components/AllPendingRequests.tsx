import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { Table, Button, Tag, Space, Row, Col, Card, Segmented, Modal, notification, Input } from 'antd';
import { CheckOutlined, CloseOutlined, InboxOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { UserRole } from '../types/enums';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from './EmptyState';
import InfoBanner from './InfoBanner';
import './AllPendingRequests.css';
import { useIsMobile } from '../hooks/useIsMobile';

interface AllPendingRequestsProps {
  role: UserRole;
}

const yesterday = dayjs().subtract(1, 'day').startOf('day');

const AllPendingRequests: React.FC<AllPendingRequestsProps> = ({ role }) => {
  const isOwner = role === UserRole.OWNER;
  const isManager = role === UserRole.MANAGER;
  const canApprove = isOwner || isManager;
  const [filterMode, setFilterMode] = useState<'all' | 'active'>(isOwner ? 'active' : 'all');
  const [approvalInProgress, setApprovalInProgress] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const { pendingRequests, approveRequest, rejectRequest } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();


  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = pendingRequests.filter(req => !dayjs(req.date).isBefore(yesterday));

    if (isOwner && filterMode === 'active') {
      filtered = filtered.filter((req) => !req.rejectedByOwner);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter((req) => req.requesterName.toLowerCase().includes(q));
    }

    // Oldest date + time first (ascending) — default sort; Ant Design sorters override this
    return filtered.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
    });
  }, [filterMode, isOwner, pendingRequests, searchText]);

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
      sorter: (a: ParkingRequest, b: ParkingRequest) => a.requesterName.localeCompare(b.requesterName),
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
      sorter: (a: ParkingRequest, b: ParkingRequest) => a.date.localeCompare(b.date),
      defaultSortOrder: 'ascend' as const,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: t('pendingRequests.columns.submitted'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: '15%',
      sorter: (a: ParkingRequest, b: ParkingRequest) => (a.submittedAt || '').localeCompare(b.submittedAt || ''),
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
      <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
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
      <Input
        placeholder={t('pendingRequests.searchPlaceholder')}
        prefix={<SearchOutlined style={{ color: 'var(--label-color)' }} />}
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: '16px', width: isMobile ? '100%' : 300 }}
      />

      {isMobile ? (
        <>
          {/* Stats chips — top on mobile */}
          <div className="pending-stats-chips">
            <span className="pending-stat-chip">
              <strong>{pendingRequests.length}</strong> {t('pendingRequests.stats.total')}
            </span>
            <span className="pending-stat-chip pending-stat-chip--blue">
              <strong>{pendingRequests.filter(r => !r.rejectedByOwner).length}</strong> {t('pendingRequests.stats.pending')}
            </span>
            {isOwner && (
              <span className="pending-stat-chip pending-stat-chip--red">
                <strong>{pendingRequests.filter(r => r.rejectedByOwner).length}</strong> {t('pendingRequests.stats.rejectedByYou')}
              </span>
            )}
          </div>

          {/* Card list */}
          <div className="pending-card-list">
            {filteredRequests.length === 0 && (
              <EmptyState icon={<InboxOutlined />} title={t('pendingRequests.emptyTitle')} description={t('pendingRequests.emptyDescription')} />
            )}
            {filteredRequests.map((record: ParkingRequest) => {
              const isOwnRequest = record.requesterId === user?.id;
              const isRejected = isOwner && record.rejectedByOwner;
              return (
                <Card
                  key={record.id}
                  size="small"
                  className={`pending-card${isRejected ? ' pending-card--rejected' : ''}`}
                >
                  <div className="pending-card-header">
                    <strong className="pending-card-requester">{record.requesterName}</strong>
                    {isOwnRequest && <Tag color="blue">({t('pendingRequests.youTag')})</Tag>}
                  </div>
                  <div className="pending-card-row">
                    <span className="pending-card-label">{t('pendingRequests.columns.date')}</span>
                    <span>{dayjs(record.date).format('DD/MM/YYYY')}</span>
                  </div>
                  <div className="pending-card-row">
                    <span className="pending-card-label">{t('pendingRequests.columns.timeSlot')}</span>
                    <span>
                      {record.startTime} – {record.endTime}
                      {record.endDate && record.endDate !== record.date && ` (${dayjs(record.endDate).format('DD/MM')})`}
                    </span>
                  </div>
                  <div className="pending-card-row">
                    <span className="pending-card-label">{t('pendingRequests.columns.duration')}</span>
                    <span>{record.duration}h</span>
                  </div>
                  <div className="pending-card-row">
                    <span className="pending-card-label">{t('pendingRequests.columns.submitted')}</span>
                    <span>{dayjs(record.submittedAt).format('DD/MM/YYYY HH:mm')}</span>
                  </div>
                  {canApprove && !isOwnRequest && (
                    <div className="pending-card-actions">
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
                    </div>
                  )}
                  {canApprove && isOwnRequest && (
                    <div className="pending-card-actions">
                      <Tag>{t('pendingRequests.cannotApproveOwn')}</Tag>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={filteredRequests}
            rowKey="id"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 800 }}
            size="middle"
            rowClassName={getRowClassName}
            locale={{ emptyText: <EmptyState icon={<InboxOutlined />} title={t('pendingRequests.emptyTitle')} description={t('pendingRequests.emptyDescription')} /> }}
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
          </div>
        </>
      )}

      <InfoBanner label={`${t('pendingRequests.title')}:`} description={isOwner ? t('pendingRequests.infoOwner') : t('pendingRequests.infoManager')} />
    </div>
  );
};

export default AllPendingRequests;
