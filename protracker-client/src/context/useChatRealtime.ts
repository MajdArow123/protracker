import { createContext, useContext } from 'react';

export interface ChatRealtimeValue {
  connected: boolean;
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
  typingUsers: Set<string>;      // users currently typing to me
  sendTyping: (otherUserId: string) => void;
  stopTyping: (otherUserId: string) => void;
}

export const ChatRealtimeContext = createContext<ChatRealtimeValue | null>(null);

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
