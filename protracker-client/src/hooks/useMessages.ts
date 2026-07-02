import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { messagesApi } from '../api/messagesApi';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: messagesApi.getConversations,
    enabled,
    refetchInterval: 10_000, // conversation list refresh
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
    refetchInterval: 5_000, // near-real-time feel
  });
}

export function useUnreadMessageCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: messagesApi.getUnreadCount,
    enabled: !!user,
    refetchInterval: 10_000,
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
