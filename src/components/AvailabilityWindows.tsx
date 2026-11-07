import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, TimePicker, Space, Row, Col, Tag, Modal, Form,
  notification, Spin, Skeleton, Switch, Table, Select, DatePicker, Alert, Tabs,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined, CarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useRequests } from '../contexts/RequestsContext';
import { availabilityApi, type AvailabilityWindowData, type AvailabilityWindowCreate, DAY_LABELS } from '../api/availability';
import { errorMessage } from '../utils/notify';
import type { LotData } from '../api/lots';
import InfoBanner from './InfoBanner';
import './AvailabilityWindows.css';
import { useIsMobile } from '../hooks/useIsMobile';
import { isBeforeToday } from '../utils/dates';

const DOW_OPTIONS = Object.entries(DAY_LABELS).map(([v, label]) => ({
  value: Number(v),
  label,
}));

type WindowsByLot = Record<string, AvailabilityWindowData[]>;

const AvailabilityWindows: React.FC = () => {
  const { ownerLots, loading: lotsLoading } = useRequests();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [windowsByLot, setWindowsByLot] = useState<WindowsByLot>({});
  const [windowsLoading, setWindowsLoading] = useState(true);
  const [addModalLot, setAddModalLot] = useState<LotData | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [slotType, setSlotType] = useState<'recurring' | 'specific'>('recurring');


  const loadAllWindows = useCallback(async (lots: LotData[]) => {
    if (!lots.length) { setWindowsLoading(false); return; }
    setWindowsLoading(true);
    try {
      const results = await Promise.all(lots.map(l => availabilityApi.list(l.id)));
      const map: WindowsByLot = {};
      lots.forEach((l, i) => { map[l.id] = results[i]; });
      setWindowsByLot(map);
    } catch {
      notification.error({ message: t('availabilityWindows.notifications.loadFailed') });
    } finally {
      setWindowsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!lotsLoading) {
      loadAllWindows(ownerLots);
    }
  }, [lotsLoading, ownerLots, loadAllWindows]);

  const handleAddClick = (lot: LotData) => {
    setAddModalLot(lot);
    setSlotType('recurring');
    form.resetFields();
  };

  const handleModalOk = async () => {
    if (!addModalLot) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: AvailabilityWindowCreate = {
        start_time: values.timeRange[0].format('HH:mm'),
        end_time: values.timeRange[1].format('HH:mm'),
      };
      if (slotType === 'recurring') {
        payload.day_of_week = values.day_of_week;
      } else {
        payload.specific_date = values.specific_date.format('YYYY-MM-DD');
      }
      const created = await availabilityApi.create(addModalLot.id, payload);
      setWindowsByLot(prev => ({
        ...prev,
        [addModalLot.id]: [...(prev[addModalLot.id] ?? []), created],
      }));
      setAddModalLot(null);
      notification.success({ message: t('availabilityWindows.notifications.added') });
    } catch (err) {
      if ((err as { errorFields?: unknown } | null)?.errorFields) return; // form validation error — stay open
      notification.error({ message: errorMessage(err) ?? t('availabilityWindows.notifications.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (lotId: string, win: AvailabilityWindowData) => {
    try {
      const updated = await availabilityApi.update(lotId, win.id, { is_active: !win.isActive });
      setWindowsByLot(prev => ({
        ...prev,
        [lotId]: (prev[lotId] ?? []).map(w => w.id === win.id ? updated : w),
      }));
    } catch {
      notification.error({ message: t('availabilityWindows.notifications.saveFailed') });
    }
  };

  const handleDelete = async (lotId: string, windowId: number) => {
    try {
      await availabilityApi.delete(lotId, windowId);
      setWindowsByLot(prev => ({
        ...prev,
        [lotId]: (prev[lotId] ?? []).filter(w => w.id !== windowId),
      }));
      notification.success({ message: t('availabilityWindows.notifications.removed') });
    } catch {
      notification.error({ message: t('availabilityWindows.notifications.saveFailed') });
    }
  };

  const windowColumns = (lotId: string): ColumnsType<AvailabilityWindowData> => [
    {
      title: t('availabilityWindows.columns.schedule'),
      key: 'schedule',
      render: (_, w) =>
        w.specificDate
          ? <Tag color="purple">{dayjs(w.specificDate).format('DD/MM/YYYY')}</Tag>
          : <Tag color="blue">{DAY_LABELS[w.dayOfWeek!]}</Tag>,
    },
    {
      title: t('availabilityWindows.columns.time'),
      key: 'time',
      render: (_, w) => <Tag color="green">{w.startTime} – {w.endTime}</Tag>,
    },
    {
      title: t('availabilityWindows.columns.active'),
      key: 'active',
      width: 80,
      render: (_, w) => (
        <Switch
          checked={w.isActive}
          size="small"
          onChange={() => handleToggle(lotId, w)}
        />
      ),
    },
    {
      title: '',
      key: 'delete',
      width: 48,
      render: (_, w) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(lotId, w.id)}
        />
      ),
    },
  ];

  if (lotsLoading || windowsLoading) {
    return <div style={{ padding: '24px' }}><Skeleton active paragraph={{ rows: 10 }} /></div>;
  }

  if (ownerLots.length === 0) {
    return (
      <div className="availability-windows">
        <h1>{t('availabilityWindows.title')}</h1>
        <Alert
          type="info"
          showIcon
          message={t('availabilityWindows.noLotsMessage')}
        />
      </div>
    );
  }

  const tabItems = ownerLots.map(lot => {
    const wins = windowsByLot[lot.id] ?? [];
    const activeCount = wins.filter(w => w.isActive).length;

    return {
      key: lot.id,
      label: (
        <span>
          <CarOutlined style={{ marginRight: 4 }} />
          {lot.id}
          {activeCount > 0 && (
            <Tag color="green" style={{ marginLeft: 6 }}>{activeCount}</Tag>
          )}
        </span>
      ),
      children: (
        <Spin spinning={saving}>
          <div style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <ClockCircleOutlined />
                  <strong>{lot.floorLabel}</strong>
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => handleAddClick(lot)}
                >
                  {t('availabilityWindows.addWindow')}
                </Button>
              </Col>
            </Row>
          </div>

          {wins.length === 0 ? (
            <div className="no-windows-text">
              {t('availabilityWindows.noWindowsLot')}
            </div>
          ) : isMobile ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              {wins.map(w => (
                <Card key={w.id} size="small" style={{ opacity: w.isActive ? 1 : 0.5 }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space>
                        {w.specificDate
                          ? <Tag color="purple">{dayjs(w.specificDate).format('DD/MM/YYYY')}</Tag>
                          : <Tag color="blue">{DAY_LABELS[w.dayOfWeek!]}</Tag>}
                        <Tag color="green">{w.startTime} – {w.endTime}</Tag>
                      </Space>
                    </Col>
                    <Col>
                      <Space>
                        <Switch checked={w.isActive} size="small" onChange={() => handleToggle(lot.id, w)} />
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(lot.id, w.id)} />
                      </Space>
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>
          ) : (
            <Table
              dataSource={wins}
              columns={windowColumns(lot.id)}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              rowClassName={w => w.isActive ? '' : 'row-inactive'}
            />
          )}
        </Spin>
      ),
    };
  });

  return (
    <div className="availability-windows">
      <h1>{t('availabilityWindows.title')}</h1>

      <Alert
        type="info"
        showIcon
        message={t('availabilityWindows.infoAlert.message')}
        description={t('availabilityWindows.infoAlert.description')}
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={t('availabilityWindows.modal.title', { lot: addModalLot?.id ?? '' })}
        open={!!addModalLot}
        onOk={handleModalOk}
        onCancel={() => setAddModalLot(null)}
        okText={t('availabilityWindows.modal.okText')}
        confirmLoading={saving}
        width={isMobile ? '95vw' : 480}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t('availabilityWindows.modal.slotTypeLabel')}>
            <Select
              value={slotType}
              onChange={v => { setSlotType(v); form.resetFields(['day_of_week', 'specific_date']); }}
              options={[
                { value: 'recurring', label: t('availabilityWindows.modal.recurring') },
                { value: 'specific', label: t('availabilityWindows.modal.specificDate') },
              ]}
            />
          </Form.Item>

          {slotType === 'recurring' ? (
            <Form.Item
              name="day_of_week"
              label={t('availabilityWindows.modal.dayLabel')}
              rules={[{ required: true, message: t('availabilityWindows.modal.dayRequired') }]}
            >
              <Select options={DOW_OPTIONS} placeholder={t('availabilityWindows.modal.dayPlaceholder')} />
            </Form.Item>
          ) : (
            <Form.Item
              name="specific_date"
              label={t('availabilityWindows.modal.dateLabel')}
              rules={[{ required: true, message: t('availabilityWindows.modal.dateRequired') }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={d => d && isBeforeToday(d)}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          )}

          <Form.Item
            name="timeRange"
            label={t('availabilityWindows.modal.timeRangeLabel')}
            rules={[
              { required: true, message: t('availabilityWindows.modal.timeRangeRequired') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (value[0].isSameOrAfter(value[1])) return Promise.reject(t('availabilityWindows.modal.endAfterStart'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={15}
              placeholder={[t('availabilityWindows.modal.startPlaceholder'), t('availabilityWindows.modal.endPlaceholder')]}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <InfoBanner label={`${t('availabilityWindows.title')}:`} description={t('availabilityWindows.info', { max: 10 })} />
    </div>
  );
};

export default AvailabilityWindows;
