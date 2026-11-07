import { api } from './client';

export interface Message {
  id: number;
  requestId: string | null;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  sentAt: string;
}

interface ApiMessage {
  id: number;
  request_id: string | null;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  text: string;
  sent_at: string;
}

function toMessage(raw: ApiMessage): Message {
  return {
    id: raw.id,
    requestId: raw.request_id,
    senderId: raw.sender_id,
    senderName: raw.sender_name,
    senderRole: raw.sender_role,
    text: raw.text,
    sentAt: raw.sent_at,
  };
}

export const messagesApi = {
  getForRequest: async (requestId: string): Promise<Message[]> => {
    const data = await api.get<ApiMessage[]>(`/api/requests/${requestId}/messages`);
    return data.map(toMessage);
  },

  send: async (requestId: string, text: string): Promise<Message> => {
    const data = await api.post<ApiMessage>(`/api/requests/${requestId}/messages`, { text });
    return toMessage(data);
  },
};
