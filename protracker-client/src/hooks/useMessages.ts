import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { messagesApi } from '../api/messagesApi';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: messagesApi.getConversations,
    enabled,
    // Live updates arrive over SignalR (ChatRealtimeProvider invalidates this key on ReceiveMessage).
  });
}

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: messagesApi.getContacts,
    enabled,
  });
}

export function useConversation(otherUserId: string | null) {
  return useQuery({
    queryKey: ['messages', 'conversation', otherUserId],
    queryFn: () => messagesApi.getConversation(otherUserId!),
    enabled: !!otherUserId,
    // Real-time: new messages are pushed via SignalR, which invalidates this key.
  });
}

export function useUnreadMessageCount() {
  const { user } = useAuth();
  // Parents have no messaging — don't poll the (403-ing) endpoint for them.
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: messagesApi.getUnreadCount,
    enabled: !!user && user.role !== 'Parent',
    // Updated in real time via SignalR; no interval needed.
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: string; content: string }) => messagesApi.send(receiverId, content),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['messages', 'conversation', v.receiverId] });
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) => messagesApi.markRead(otherUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    },
  });
}
