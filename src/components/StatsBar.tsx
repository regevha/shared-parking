import React from 'react';
import { Card, Space } from 'antd';

export interface StatItem {
  label: string;
  value: number;
  color?: string;
}

interface StatsBarProps {
  items: StatItem[];
  style?: React.CSSProperties;
}

const StatsBar: React.FC<StatsBarProps> = ({ items, style }) => (
  <Card size="small" style={style}>
    <Space wrap size="large" style={{ width: '100%', justifyContent: 'space-around' }}>
      {items.map((item, i) => (
        <div key={i}>
          <strong style={{ fontSize: '18px', color: item.color ?? 'inherit', marginRight: '8px' }}>
            {item.value}
          </strong>
          <span style={{ color: 'var(--label-color)' }}>{item.label}</span>
        </div>
      ))}
    </Space>
  </Card>
);

export default StatsBar;
