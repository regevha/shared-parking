import React, { useEffect, useState } from 'react';
import { requestsApi } from '../api/requests';
import './AuditTrailModal.css';

interface AuditLog {
  id: number;
  request_id: string;
  user_name: string;
  action: string;
  details?: string;
  timestamp: string;
}

interface AuditTrailModalProps {
  requestId: string;
  onClose: () => void;
}

const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ requestId, onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     requestsApi.getAuditTrail(requestId)
       .then(setLogs)
       .catch(err => console.error("History failed:", err))
       .finally(() => setLoading(false));
  }, [requestId]);

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'submitted': return 'Request Submitted';
      case 'approved': return 'Approved Manually';
      case 'auto-assigned': return 'Auto-Approved';
      case 'rejected': return 'Request Rejected';
      case 'cancelled': return 'Request Cancelled';
      default: return action;
    }
  };

  return (
    <div className="audit-modal-overlay" onClick={onClose}>
      <div className="audit-modal-content" onClick={e => e.stopPropagation()}>
        <div className="audit-modal-header">
          <h3>Request History: {requestId}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="audit-modal-body">
          {loading ? (
            <div className="loading">Loading history...</div>
          ) : logs.length === 0 ? (
            <div className="no-history">No history found for this request.</div>
          ) : (
            <div className="timeline">
              {logs.map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="action-label">{getActionLabel(log.action)}</span>
                      <span className="timestamp">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="user-info">By: {log.user_name}</div>
                    {log.details && <div className="details">{log.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="audit-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default AuditTrailModal;
