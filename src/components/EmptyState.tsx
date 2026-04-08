import React from 'react';
import { Button } from 'antd';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 48, color: 'var(--label-color)', marginBottom: 16, opacity: 0.6 }}>
      {icon}
    </div>
    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
      {title}
    </div>
    {description && (
      <div style={{ fontSize: 14, color: 'var(--label-color)', marginBottom: 16, maxWidth: 360 }}>
        {description}
      </div>
    )}
    {actionLabel && onAction && (
      <Button type="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
