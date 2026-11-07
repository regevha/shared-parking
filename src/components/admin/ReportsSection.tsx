import React, { useState } from 'react';
import { Button, Card, DatePicker, Space, Table, Tabs, Tag, notification } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import InfoBanner from '../InfoBanner';
import type { ParkingRequest } from '../../contexts/RequestsContext';
import { RequestStatus } from '../../types/enums';
import { getRequestStatusColor, getRequestStatusLabel } from '../../utils/statusUtils';
import { useIsMobile } from '../../hooks/useIsMobile';

const { RangePicker } = DatePicker;

interface ReportsSectionProps {
  requests: ParkingRequest[];
  loading: boolean;
}

/** Admin Panel → Reports: all requests, filterable by date range, per-status tabs and Excel export. */
const ReportsSection: React.FC<ReportsSectionProps> = ({ requests, loading }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [reportDateRange, setReportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

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
      title: t('adminPanel.reports.columns.submitted'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: t('adminPanel.reports.columns.timeSlot'),
      key: 'timeSlot',
      width: 130,
      render: (_: unknown, r: ParkingRequest) => `${r.startTime} – ${r.endTime}`,
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

  return (
    <div>
      <h2>{t('adminPanel.reports.title')}</h2>
      <Card className="mb-16">
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
};

export default ReportsSection;
