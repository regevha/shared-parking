import React, { useState } from 'react';
import { Card, Tag, Button, Input, Avatar, Divider, Row, Col } from 'antd';
import { SendOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import './RequestDetail.css';

interface Message {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
}

const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pendingRequests, approvedRequests, userRequests } = useRequests();

  const allRequests = [...pendingRequests, ...approvedRequests, ...userRequests];
  const seen = new Set<string>();
  const dedupedRequests = allRequests.filter(r => seen.has(r.id) ? false : (seen.add(r.id), true));
  const request: ParkingRequest | undefined = dedupedRequests.find(r => r.id === id);

  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  if (!request) {
    return (
      <div className="request-detail">
        <h1>Request Details</h1>
        <Card>
          <p>Request <strong>{id}</strong> was not found.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'pending':
        return 'blue';
      case 'rejected':
        return 'red';
      case 'expired':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      senderName: 'You',
      text: newMessage.trim(),
      timestamp: new Date().toLocaleString(),
      isFromMe: true,
    };

    setSending(true);
    setTimeout(() => {
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      setSending(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="request-detail">
      <h1>Request Details</h1>

      {/* Request Info Card */}
      <Card
        title="Request Information"
        style={{ marginBottom: '24px' }}
        size="small"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Request ID</div>
              <div className="value"><strong>{request.id}</strong></div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Status</div>
              <div className="value">
                <Tag color={getStatusColor(request.status)}>
                  {getStatusLabel(request.status)}
                </Tag>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Requester</div>
              <div className="value">{request.requesterName}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Date</div>
              <div className="value">{dayjs(request.date).format('DD/MM/YYYY')}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Time Slot</div>
              <div className="value">{request.startTime} - {request.endTime}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Duration</div>
              <div className="value">{request.duration} hours</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Submitted</div>
              <div className="value">{dayjs(request.submittedAt).format('DD/MM/YYYY HH:mm')}</div>
            </div>
          </Col>
        </Row>

        {/* Approved Details */}
        {request.status === 'approved' && request.lotId && (
          <>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Assigned Lot</div>
                  <div className="value"><strong>{request.lotId}</strong></div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Floor</div>
                  <div className="value">{request.floor}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Lot Owner</div>
                  <div className="value">{request.lotOwner}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Approved At</div>
                  <div className="value">{request.approvedAt ? dayjs(request.approvedAt).format('DD/MM/YYYY HH:mm') : '—'}</div>
                </div>
              </Col>
            </Row>
          </>
        )}
      </Card>

      {/* Message Thread */}
      <Card
        title="Message Thread"
        style={{ marginBottom: '24px' }}
        bodyStyle={{ padding: '16px' }}
      >
        <div className="message-thread">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.isFromMe ? 'message-right' : 'message-left'}`}
            >
              <div className="message-content">
                <div className="message-header">
                  <Avatar
                    size="small"
                    icon={message.isFromMe ? <UserOutlined /> : <CrownOutlined />}
                    style={{ marginRight: '8px' }}
                  />
                  <span className="sender-name">{message.senderName}</span>
                  <span className="timestamp">{message.timestamp}</span>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="message-input-container">
          <Input.Group compact>
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onPressEnter={handleKeyPress}
              style={{ width: 'calc(100% - 80px)' }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              loading={sending}
              disabled={!newMessage.trim()}
              style={{ width: '80px' }}
            >
              Send
            </Button>
          </Input.Group>
        </div>
      </Card>
    </div>
  );
};

export default RequestDetail;
