import React from 'react';
import dayjs from 'dayjs';
import { Table, Space, Card, Row, Col, Button, Modal } from 'antd';
import { EyeOutlined, MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import './AllApprovals.css';

const AllApprovals: React.FC = () => {
  const { approvedRequests, loading } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleViewMessages = (record: ParkingRequest) => {
    Modal.info({
      title: t('approvals.messagesModal.title', { id: record.id }),
      content: (
        <div>
          <p><strong>{t('approvals.messagesModal.requester')}</strong> {record.requesterName}</p>
          <p><strong>{t('approvals.messagesModal.lotOwner')}</strong> {record.lotOwner}</p>
          <p>{t('approvals.messagesModal.hint')}</p>
        </div>
      ),
      onOk() {},
    });
  };

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: t('approvals.columns.requestId'),
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: t('approvals.columns.requester'),
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: '15%',
    },
    {
      title: t('approvals.columns.date'),
      dataIndex: 'date',
      key: 'date',
      width: '12%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: t('approvals.columns.timeSlot'),
      key: 'timeSlot',
      width: '15%',
      render: (_, record: ParkingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: t('approvals.columns.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: '8%',
      render: (duration: number) => `${duration}h`,
    },
    {
      title: t('approvals.columns.assignedLot'),
      dataIndex: 'lotId',
      key: 'lotId',
      width: '12%',
      render: (lotId: string, record: ParkingRequest) => (
        <div>
          <div><strong>{lotId}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.floor}</div>
        </div>
      ),
    },
    {
      title: t('approvals.columns.lotOwner'),
      dataIndex: 'lotOwner',
      key: 'lotOwner',
      width: '15%',
    },
    {
      title: t('approvals.columns.approvedAt'),
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: '15%',
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: t('approvals.columns.actions'),
      key: 'actions',
      width: '8%',
      render: (_, record: ParkingRequest) => (
        <Space>
          <Link to={`/request/${record.id}`}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              size="small"
              title={t('approvals.actions.viewDetails')}
            />
          </Link>
          <Button
            type="link"
            icon={<MessageOutlined />}
            size="small"
            title={t('approvals.actions.viewMessages')}
            onClick={() => handleViewMessages(record)}
          />
        </Space>
      ),
    },
  ];

  const stats = {
    total: approvedRequests.length,
    today: approvedRequests.filter(a => a.date === new Date().toISOString().split('T')[0]).length,
    thisWeek: approvedRequests.filter(a => {
      if (!a.approvedAt) return false;
      const approvalDate = new Date(a.approvedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return approvalDate >= weekAgo;
    }).length,
  };

  return (
    <div className="all-approvals">
      <h1>{t('approvals.title')}</h1>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={[...approvedRequests].sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          return d !== 0 ? d : b.startTime.localeCompare(a.startTime);
        })}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 1000 }}
        size="middle"
        rowClassName={(record: ParkingRequest) =>
          record.lotOwner === user?.name ? 'owner-approval-row' : ''
        }
      />

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>{t('approvals.stats.total')}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {stats.today}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>{t('approvals.stats.today')}</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                {stats.thisWeek}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>{t('approvals.stats.thisWeek')}</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Info */}
      <Card style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }} size="small">
        <strong>{t('approvals.title')}:</strong> {t('approvals.info')}
      </Card>
    </div>
  );
};

export default AllApprovals;
