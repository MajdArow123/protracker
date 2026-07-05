import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { startChatConnection, stopChatConnection, getChatConnection } from '../realtime/chatConnection';
import type { Message } from '../types';

interface ChatRealtimeValue {
  connected: boolean;
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
  typingUsers: Set<string>;      // users currently typing to me
  sendTyping: (otherUserId: string) => void;
  stopTyping: (otherUserId: string) => void;
}

const ChatRealtimeContext = createContext<ChatRealtimeValue | null>(null);

export function ChatRealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSent = useRef<Record<string, number>>({});

  // Parents have no messaging; everyone else gets a live connection while signed in.
  const enabled = !!user && user.role !== 'Parent';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const conn = getChatConnection();

    const onReceive = (msg: Message) => {
      // Refresh the affected conversation + the list + the unread badge.
      const otherId = msg.isMine ? msg.receiverId : msg.senderId;
      qc.invalidateQueries({ queryKey: ['messages', 'conversation', otherId] });
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
      // An incoming message clears any "typing" indicator from that sender.
      if (!msg.isMine) clearTyping(msg.senderId);
    };
    const onOnlineUsers = (ids: string[]) => setOnlineUsers(new Set(ids));
    const onPresence = (userId: string, online: boolean) =>
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    const onTyping = (fromUserId: string) => {
      setTypingUsers(prev => new Set(prev).add(fromUserId));
      clearTimeout(typingTimers.current[fromUserId]);
      // Auto-expire the indicator if no keystroke arrives for a few seconds.
      typingTimers.current[fromUserId] = setTimeout(() => clearTyping(fromUserId), 4000);
    };
    const onStopTyping = (fromUserId: string) => clearTyping(fromUserId);

    function clearTyping(userId: string) {
      clearTimeout(typingTimers.current[userId]);
      setTypingUsers(prev => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }

    conn.on('ReceiveMessage', onReceive);
    conn.on('OnlineUsers', onOnlineUsers);
    conn.on('PresenceChanged', onPresence);
    conn.on('Typing', onTyping);
    conn.on('StopTyping', onStopTyping);
    conn.onreconnected(() => setConnected(true));
    conn.onreconnecting(() => setConnected(false));
    conn.onclose(() => setConnected(false));

    startChatConnection().then(c => { if (!cancelled) setConnected(!!c); });

    return () => {
      cancelled = true;
      conn.off('ReceiveMessage', onReceive);
      conn.off('OnlineUsers', onOnlineUsers);
      conn.off('PresenceChanged', onPresence);
      conn.off('Typing', onTyping);
      conn.off('StopTyping', onStopTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id]);

  // Tear down entirely on logout.
  useEffect(() => {
    if (!user) {
      stopChatConnection();
      setConnected(false);
      setOnlineUsers(new Set());
      setTypingUsers(new Set());
    }
  }, [user]);

  const sendTyping = (otherUserId: string) => {
    const now = Date.now();
    // Throttle "Typing" pings to at most one every ~1.5s per conversation.
    if (now - (lastTypingSent.current[otherUserId] ?? 0) < 1500) return;
    lastTypingSent.current[otherUserId] = now;
    getChatConnection().invoke('Typing', otherUserId).catch(() => {});
  };
  const stopTyping = (otherUserId: string) => {
    lastTypingSent.current[otherUserId] = 0;
    getChatConnection().invoke('StopTyping', otherUserId).catch(() => {});
  };

  const value: ChatRealtimeValue = {
    connected,
    onlineUsers,
    isOnline: (id: string) => onlineUsers.has(id),
    typingUsers,
    sendTyping,
    stopTyping,
  };

  return <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>;
}

export function useChatRealtime(): ChatRealtimeValue {
  const ctx = useContext(ChatRealtimeContext);
  if (!ctx) {
    // Safe no-op fallback so components can call it even if the provider is absent.
    return {
      connected: false,
      onlineUsers: new Set(),
      isOnline: () => false,
      typingUsers: new Set(),
      sendTyping: () => {},
      stopTyping: () => {},
    };
  }
  return ctx;
}
