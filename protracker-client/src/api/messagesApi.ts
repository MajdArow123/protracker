import api from './axiosInstance';
import type { Message, Conversation, MessageContact } from '../types';

export const messagesApi = {
  getConversations: () =>
    api.get<Conversation[]>('/api/messages/conversations').then(r => r.data),
  getContacts: () =>
    api.get<MessageContact[]>('/api/messages/contacts').then(r => r.data),
  getConversation: (otherUserId: string) =>
    api.get<Message[]>(`/api/messages/conversation/${otherUserId}`).then(r => r.data),
  send: (receiverId: string, content: string) =>
    api.post<Message>('/api/messages', { receiverId, content }).then(r => r.data),
  markRead: (otherUserId: string) =>
    api.patch(`/api/messages/conversation/${otherUserId}/read`),
  getUnreadCount: () =>
    api.get<{ unreadCount: number }>('/api/messages/unread-count').then(r => r.data.unreadCount),
};
