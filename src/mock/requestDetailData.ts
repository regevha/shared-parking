export interface Message {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
}

export interface RequestDetailData {
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

export const mockRequestDetail: RequestDetailData = {
  id: 'REQ-001',
  requesterName: 'Alice Johnson',
  date: '2026-03-25',
  startTime: '09:00',
  endTime: '11:00',
  duration: 2,
  status: 'approved',
  submittedAt: '2026-03-23 14:30',
  approvedAt: '2026-03-23 16:45',
  lotId: 'F2-003',
  floor: 'F2 - Level 1',
  lotOwner: 'David Chen',
  messages: [
    {
      id: 'msg-1',
      sender: 'alice',
      senderName: 'Alice Johnson',
      text: 'Hi David, I submitted a request for parking on March 25th from 9-11 AM. Could you please approve it?',
      timestamp: '2026-03-23 14:35',
      isFromMe: false,
    },
    {
      id: 'msg-2',
      sender: 'david',
      senderName: 'David Chen',
      text: 'Hello Alice! I see your request. I have availability in my F2-003 spot. Let me check if there are any conflicts.',
      timestamp: '2026-03-23 15:20',
      isFromMe: true,
    },
    {
      id: 'msg-3',
      sender: 'alice',
      senderName: 'Alice Johnson',
      text: 'Thank you! I really appreciate it. I have a meeting downtown and this would be very helpful.',
      timestamp: '2026-03-23 15:45',
      isFromMe: false,
    },
    {
      id: 'msg-4',
      sender: 'david',
      senderName: 'David Chen',
      text: 'All set! I\'ve approved your request for F2-003. You can park there from 9-11 AM on the 25th.',
      timestamp: '2026-03-23 16:45',
      isFromMe: true,
    },
  ],
};
