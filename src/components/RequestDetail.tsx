import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Input, Avatar, Divider, Row, Col, Spin, notification } from 'antd';
import { SendOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useRequests, ParkingRequest } from '../contexts/RequestsContext';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi, Message } from '../api/messages';
import { getRequestStatusColor, getRequestStatusLabel } from '../utils/statusUtils';
import './RequestDetail.css';

const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pendingRequests, approvedRequests, userRequests } = useRequests();
  const { user } = useAuth();

  const allRequests = [...pendingRequests, ...approvedRequests, ...userRequests];
  const seen = new Set<string>();
  const dedupedRequests = allRequests.filter(r => seen.has(r.id) ? false : (seen.add(r.id), true));
  const request: ParkingRequest | undefined = dedupedRequests.find(r => r.id === id);

  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadingMessages(true);
    messagesApi.getForRequest(id)
      .then(setMessages)
      .catch((err: any) => {
        notification.error({ message: 'Failed to load messages', description: err.message });
      })
      .finally(() => setLoadingMessages(false));
  }, [id]);

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


  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !id) return;

    setSending(true);
    try {
      const msg = await messagesApi.send(id, text);
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    } catch (err: any) {
      notification.error({ message: 'Failed to send message', description: err.message });
    } finally {
      setSending(false);
    }
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
                <Tag color={getRequestStatusColor(request.status)}>
                  {getRequestStatusLabel(request.status)}
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
          {request.updatedAt && (
            <Col xs={24} sm={12} md={6}>
              <div className="info-item">
                <div className="label">Last Updated</div>
                <div className="value">{dayjs(request.updatedAt).format('DD/MM/YYYY HH:mm')}</div>
              </div>
            </Col>
          )}
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
        <Spin spinning={loadingMessages}>
          <div className="message-thread">
            {messages.map((message) => {
              const isFromMe = message.senderId === user?.id;
              return (
                <div
                  key={message.id}
                  className={`message ${isFromMe ? 'message-right' : 'message-left'}`}
                >
                  <div className="message-content">
                    <div className="message-header">
                      <Avatar
                        size="small"
                        icon={isFromMe ? <UserOutlined /> : <CrownOutlined />}
                        style={{ marginRight: '8px' }}
                      />
                      <span className="sender-name">{message.senderName}</span>
                      <span className="timestamp">{dayjs(message.sentAt).format('DD/MM/YYYY HH:mm')}</span>
                    </div>
                    <div className="message-text">{message.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Spin>

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
