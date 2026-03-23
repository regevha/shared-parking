import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Table, Tag, Space, Card, Row, Col, Button, Modal, notification } from 'antd';
import { EyeOutlined, MessageOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import './AllApprovals.css';

const AllApprovals: React.FC = () => {
  const { approvedRequests } = useRequests();

  const columns: ColumnsType<ParkingRequest> = [
    {
      title: 'Request ID',
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Requester',
      dataIndex: 'requesterName',
      key: 'requesterName',
      width: '15%',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: '12%',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Time Slot',
      key: 'timeSlot',
      width: '15%',
      render: (_, record: ParkingRequest) => `${record.startTime} - ${record.endTime}`,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: '8%',
      render: (duration: number) => `${duration}h`,
    },
    {
      title: 'Assigned Lot',
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
      title: 'Lot Owner',
      dataIndex: 'lotOwner',
      key: 'lotOwner',
      width: '15%',
    },
    {
      title: 'Approved At',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: '15%',
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '8%',
      render: (_, record: ParkingRequest) => (
        <Space>
          <Link to={`/request/${record.id}`}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              size="small"
              title="View Details"
            />
          </Link>
          <Button
            type="link"
            icon={<MessageOutlined />}
            size="small"
            title="View Messages"
            onClick={() => handleViewMessages(record)}
          />
        </Space>
      ),
    },
  ];

  const handleViewMessages = (record: ParkingRequest) => {
    Modal.info({
      title: `Messages for ${record.id}`,
      content: (
        <div>
          <p><strong>Requester:</strong> {record.requesterName}</p>
          <p><strong>Lot Owner:</strong> {record.lotOwner}</p>
          <p>Click "View Details" to see the full message thread.</p>
        </div>
      ),
      onOk() {},
    });
  };

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
      <h1>All Approvals</h1>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Approvals</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {stats.today}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Approved Today</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                {stats.thisWeek}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>This Week</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Info */}
      <Card style={{ marginBottom: '24px', backgroundColor: '#f0f2f5' }} size="small">
        <strong>All Approvals:</strong> View all approved parking requests across the system.
        Click the eye icon to view request details and message threads.
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={approvedRequests}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1000 }}
        size="middle"
      />
    </div>
  );
};

export default AllApprovals;
