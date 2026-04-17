import React from 'react';
import { Card } from 'antd';

interface InfoBannerProps {
  label: string;
  description: string;
  style?: React.CSSProperties;
}

const InfoBanner: React.FC<InfoBannerProps> = ({ label, description, style }) => (
  <Card
    size="small"
    style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)', ...style }}
  >
    <strong>{label}</strong> {description}
  </Card>
);

export default InfoBanner;
