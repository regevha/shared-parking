import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Table, Space, Card, Row, Col, Statistic, Button, Modal, Tag, Input, Switch } from 'antd';
import { EyeOutlined, MessageOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from './EmptyState';
import InfoBanner from './InfoBanner';
import './AllApprovals.css';
import { useIsMobile } from '../hooks/useIsMobile';

const yesterday = dayjs().subtract(1, 'day').startOf('day');

const AllApprovals: React.FC = () => {
  const { approvedRequests, loading } = useRequests();
  const { user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchText, setSearchText] = useState('');
  const [myLotOnly, setMyLotOnly] = useState(false);


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
      sorter: (a: ParkingRequest, b: ParkingRequest) => a.requesterName.localeCompare(b.requesterName),
    },
    {
      title: t('approvals.columns.date'),
      dataIndex: 'date',
      key: 'date',
      width: '12%',
      sorter: (a: ParkingRequest, b: ParkingRequest) => a.date.localeCompare(b.date),
      defaultSortOrder: 'ascend' as const,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: t('approvals.columns.timeSlot'),
      key: 'timeSlot',
      width: '15%',
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
      title: t('approvals.columns.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: '8%',
      sorter: (a: ParkingRequest, b: ParkingRequest) => a.duration - b.duration,
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
      sorter: (a: ParkingRequest, b: ParkingRequest) => (a.lotOwner || '').localeCompare(b.lotOwner || ''),
    },
    {
      title: t('approvals.columns.approvedAt'),
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: '15%',
      sorter: (a: ParkingRequest, b: ParkingRequest) => (a.approvedAt || '').localeCompare(b.approvedAt || ''),
      render: (_: any, record: ParkingRequest) => (
        <div>
          <div>{record.approvedAt ? dayjs(record.approvedAt).format('DD/MM/YYYY HH:mm') : '—'}</div>
          {record.approvedBy === 'auto' && (
            <Tag color="purple" style={{ fontSize: '11px', marginTop: '2px' }}>Auto</Tag>
          )}
        </div>
      ),
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

  const recentApprovedRequests = approvedRequests.filter(a => !dayjs(a.date).isBefore(yesterday));

  const stats = {
    total: recentApprovedRequests.length,
    today: recentApprovedRequests.filter(a => a.date === new Date().toISOString().split('T')[0]).length,
    thisWeek: recentApprovedRequests.filter(a => {
      if (!a.approvedAt) return false;
      const approvalDate = new Date(a.approvedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return approvalDate >= weekAgo;
    }).length,
  };

  const filteredRequests = React.useMemo(() => {
    let filtered = approvedRequests.filter(a => !dayjs(a.date).isBefore(yesterday));

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter((r) =>
        r.requesterName.toLowerCase().includes(q) ||
        (r.lotOwner || '').toLowerCase().includes(q)
      );
    }

    if (myLotOnly && user?.name) {
      filtered = filtered.filter((r) => r.lotOwner === user.name);
    }

    return filtered.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
    });
  }, [approvedRequests, searchText, myLotOnly, user?.name]);

  return (
    <div className="all-approvals">
      <h1>{t('approvals.title')}</h1>

      <Space wrap style={{ marginBottom: '16px', width: '100%' }}>
        <Input
          placeholder={t('approvals.searchPlaceholder')}
          prefix={<SearchOutlined style={{ color: 'var(--label-color)' }} />}
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: isMobile ? '100%' : 300 }}
        />
        <Space>
          <Switch size="small" checked={myLotOnly} onChange={setMyLotOnly} aria-label={t('approvals.myLotOnly')} />
          <span style={{ fontSize: '13px' }}>{t('approvals.myLotOnly')}</span>
        </Space>
      </Space>

      {isMobile ? (
        <>
          {/* Stats chips — top on mobile */}
          <div className="approvals-stats-chips">
            <span className="approvals-stat-chip">
              <strong>{stats.total}</strong> {t('approvals.stats.total')}
            </span>
            <span className="approvals-stat-chip approvals-stat-chip--blue">
              <strong>{stats.today}</strong> {t('approvals.stats.today')}
            </span>
            <span className="approvals-stat-chip approvals-stat-chip--purple">
              <strong>{stats.thisWeek}</strong> {t('approvals.stats.thisWeek')}
            </span>
          </div>

          {/* Card list */}
          <div className="approvals-card-list">
            {filteredRequests.length === 0 && (
              <EmptyState icon={<CheckCircleOutlined />} title={t('approvals.emptyTitle')} description={t('approvals.emptyDescription')} />
            )}
            {filteredRequests.map((record: ParkingRequest) => (
              <Card
                key={record.id}
                size="small"
                className={`approval-card${record.lotOwner === user?.name ? ' approval-card--owner' : ''}`}
              >
                <div className="approval-card-header">
                  <strong className="approval-card-requester">{record.requesterName}</strong>
                  {record.approvedBy === 'auto' && (
                    <Tag color="purple" style={{ fontSize: '11px' }}>Auto</Tag>
                  )}
                </div>
                <div className="approval-card-row">
                  <span className="approval-card-label">{t('approvals.columns.date')}</span>
                  <span>{dayjs(record.date).format('DD/MM/YYYY')} · {record.startTime} – {record.endTime}</span>
                </div>
                <div className="approval-card-row">
                  <span className="approval-card-label">{t('approvals.columns.assignedLot')}</span>
                  <span><strong>{record.lotId}</strong>{record.floor ? ` · ${record.floor}` : ''}</span>
                </div>
                <div className="approval-card-row">
                  <span className="approval-card-label">{t('approvals.columns.lotOwner')}</span>
                  <span>{record.lotOwner}</span>
                </div>
                <div className="approval-card-row">
                  <span className="approval-card-label">{t('approvals.columns.approvedAt')}</span>
                  <span>{record.approvedAt ? dayjs(record.approvedAt).format('DD/MM/YYYY HH:mm') : '—'}</span>
                </div>
                {record.approvedBy && record.approvedBy !== 'auto' && (
                  <div className="approval-card-row">
                    <span className="approval-card-label">{t('approvals.columns.approvedBy')}</span>
                    <span>{record.approvedBy}</span>
                  </div>
                )}
                <div className="approval-card-actions">
                  <Link to={`/request/${record.id}`}>
                    <Button size="small" icon={<EyeOutlined />}>
                      {t('approvals.actions.viewDetails')}
                    </Button>
                  </Link>
                  <Button
                    size="small"
                    icon={<MessageOutlined />}
                    onClick={() => handleViewMessages(record)}
                  >
                    {t('approvals.actions.viewMessages')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Stats — desktop: 3 visual cards at top */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title={t('approvals.stats.total')}
                  value={stats.total}
                  valueStyle={{ fontSize: '32px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title={t('approvals.stats.today')}
                  value={stats.today}
                  valueStyle={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title={t('approvals.stats.thisWeek')}
                  value={stats.thisWeek}
                  valueStyle={{ fontSize: '32px', fontWeight: 'bold', color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredRequests}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 1000 }}
            size="middle"
            rowClassName={(record: ParkingRequest) =>
              record.lotOwner === user?.name ? 'owner-approval-row' : ''
            }
            locale={{ emptyText: <EmptyState icon={<CheckCircleOutlined />} title={t('approvals.emptyTitle')} description={t('approvals.emptyDescription')} /> }}
          />
        </>
      )}

      <InfoBanner label={`${t('approvals.title')}:`} description={t('approvals.info')} />
    </div>
  );
};

export default AllApprovals;
