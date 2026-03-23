import React, { useState } from 'react';
import { Card, Tag, Button, Input, Avatar, Divider, Row, Col } from 'antd';
import { SendOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { mockRequestDetail } from '../mock/requestDetailData';
import './RequestDetail.css';

interface Message {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
}

interface RequestDetailData {
  id: string;
  requesterName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  submittedAt: string;
  approvedAt?: string;
  lotId?: string;
  floor?: string;
  lotOwner?: string;
  messages: Message[];
}

const RequestDetail: React.FC = () => {
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(mockRequestDetail.messages);
  const [sending, setSending] = useState(false);

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
              <div className="value"><strong>{mockRequestDetail.id}</strong></div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Requester</div>
              <div className="value">{mockRequestDetail.requesterName}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Time Slot</div>
              <div className="value">{mockRequestDetail.startTime} - {mockRequestDetail.endTime}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Duration</div>
              <div className="value">{mockRequestDetail.duration} hours</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Status</div>
              <div className="value">
                <Tag color={getStatusColor(mockRequestDetail.status)}>
                  {getStatusLabel(mockRequestDetail.status)}
                </Tag>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Submitted</div>
              <div className="value">{mockRequestDetail.submittedAt}</div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div className="info-item">
              <div className="label">Date</div>
              <div className="value">{mockRequestDetail.date}</div>
            </div>
          </Col>
        </Row>

        {/* Approved Details */}
        {mockRequestDetail.status === 'approved' && mockRequestDetail.lotId && (
          <>
            <Divider />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Assigned Lot</div>
                  <div className="value"><strong>{mockRequestDetail.lotId}</strong></div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Floor</div>
                  <div className="value">{mockRequestDetail.floor}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Lot Owner</div>
                  <div className="value">{mockRequestDetail.lotOwner}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div className="info-item">
                  <div className="label">Approved At</div>
                  <div className="value">{mockRequestDetail.approvedAt}</div>
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
