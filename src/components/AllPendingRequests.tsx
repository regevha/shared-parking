import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { Table, Button, Tag, Space, Row, Col, Card, Segmented, Modal, notification } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Role } from '../types';
import { useRequests, CURRENT_OWNER_ID, ParkingRequest } from '../contexts/RequestsContext';
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

  const isOwner = role === 'Owner';

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = [...pendingRequests];

    if (isOwner && filterMode === 'active') {
      filtered = filtered.filter((req) => !req.rejectedByOwner);
    }

    return filtered;
  }, [filterMode, isOwner, pendingRequests]);

  const handleApprove = (requestId: string, requesterName: string) => {
    Modal.confirm({
      title: 'Approve Request',
      content: `Approve parking request from ${requesterName}?`,
      okText: 'Approve',
      cancelText: 'Cancel',
      onOk: () => {
        setApprovalInProgress(requestId);
        setTimeout(() => {
          setApprovalInProgress(null);
          approveRequest(requestId);
          notification.success({
            message: 'Request Approved',
            description: `Parking request from ${requesterName} has been approved.`,
          });
        }, 1000);
      },
    });
  };

  const handleReject = (requestId: string, requesterName: string) => {
    Modal.confirm({
      title: 'Reject Request',
      content: `Reject parking request from ${requesterName}?`,
      okText: 'Reject',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        setApprovalInProgress(requestId);
        setTimeout(() => {
          setApprovalInProgress(null);
          rejectRequest(requestId);
          notification.success({
            message: 'Request Rejected',
            description: `Parking request from ${requesterName} has been rejected.`,
          });
        }, 1000);
      },
    });
  };

  const columns: ColumnsType<PendingRequest> = [
    {
      title: 'Requester Name',
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: '20%',
      render: (text: string, record: PendingRequest) => {
        const isOwnRequest = record.requesterId === CURRENT_OWNER_ID;
        return (
          <div>
            <strong>{text}</strong>
            {isOwnRequest && <Tag color="blue" style={{ marginLeft: '8px' }}>(You)</Tag>}
          </div>
        );
      },
    },
    {
      title: 'Time Slot',
      key: 'timeSlot',
      width: '18%',
      render: (_, record: PendingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: '12%',
      render: (duration: number) => `${duration}h`,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: '15%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: '15%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_, record: PendingRequest) => {
        const isOwnRequest = record.requesterId === CURRENT_OWNER_ID;
        const isRejected = record.rejectedByOwner;

        if (!isOwner) {
          return <span style={{ color: '#999' }}>No actions</span>;
        }

        if (isOwnRequest) {
          return <span style={{ color: '#999' }}>Cannot approve own request</span>;
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
              Approve
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              loading={approvalInProgress === record.id}
              onClick={() => handleReject(record.id, record.requesterName)}
            >
              Reject
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
      <h1>All Pending Requests</h1>

      {/* Filter Toggle (Owner only) */}
      {isOwner && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <strong>Show Requests:</strong>
            </span>
            <Segmented
              value={filterMode}
              onChange={(value) => setFilterMode(value as 'all' | 'active')}
              options={[
                { label: 'Show all', value: 'all' },
                { label: 'Hide already rejected', value: 'active' },
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
            <span>= Rejected by you (can reapprove by clicking Approve)</span>
          </div>
        </Card>
      )}

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Requests</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{stats.pending}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
            </div>
          </Card>
        </Col>
        {isOwner && (
          <Col xs={12} sm={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#999' }}>{stats.rejected}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Rejected by You</div>
              </div>
            </Card>
          </Col>
        )}
      </Row>

      {/* Role-specific Info */}
      <Card style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        {isOwner ? (
          <div>
            <strong>Pending Requests:</strong> Lists all parking requests awaiting your approval. Requests you have already rejected are shown in grey.
          </div>
        ) : (
          <div>
            <strong>Pending Requests:</strong> Lists all parking requests currently awaiting owner approval.
          </div>
        )}
      </Card>
    </div>
  );
};

export default AllPendingRequests;
