import { useState, useRef, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Send, Search, MessageSquare, ArrowLeft } from 'lucide-react';
import { useConversations, useContacts, useConversation, useSendMessage, useMarkConversationRead } from '../../hooks/useMessages';
import type { Conversation, MessageContact, Message } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';

interface Partner { userId: string; name: string; role: string; lastMessage?: string; lastMessageAt?: string; unreadCount: number; }

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - that.getTime()) / 86_400_000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
      role === 'Coach' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300')}>
      {role}
    </span>
  );
}

export function MessagesPage() {
  const { data: conversations = [] } = useConversations();
  const { data: contacts = [] } = useContacts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const markRead = useMarkConversationRead();
  const sendMessage = useSendMessage();
  const { data: messages = [] } = useConversation(selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Merge conversations with contacts that have no conversation yet.
  const partners = useMemo<Partner[]>(() => {
    const byId = new Map<string, Partner>();
    conversations.forEach((c: Conversation) => byId.set(c.otherUserId, {
      userId: c.otherUserId, name: c.otherUserName, role: c.otherUserRole,
      lastMessage: (c.lastMessageMine ? 'You: ' : '') + c.lastMessage, lastMessageAt: c.lastMessageAt, unreadCount: c.unreadCount,
    }));
    contacts.forEach((ct: MessageContact) => {
      if (!byId.has(ct.userId)) byId.set(ct.userId, { userId: ct.userId, name: ct.name, role: ct.role, unreadCount: 0 });
    });
    let list = Array.from(byId.values());
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    return list.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [conversations, contacts, search]);

  const selected = partners.find(p => p.userId === selectedId) ?? null;

  // Mark read when opening / when new messages arrive in the open conversation.
  useEffect(() => {
    if (selectedId && messages.some(m => !m.isMine && !m.isRead)) {
      markRead.mutate(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length]);

  // Auto-scroll to bottom on new messages / conversation switch.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, selectedId]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    setDraft('');
    sendMessage.mutate({ receiverId: selectedId, content: text });
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* LEFT: conversation list */}
      <div className={clsx('w-full sm:w-[320px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900',
        selectedId ? 'hidden sm:flex' : 'flex')}>
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {partners.length === 0 ? (
            <div className="p-6"><EmptyState icon={<MessageSquare size={28} />} title="No contacts" description="No one to message yet." size="sm" /></div>
          ) : partners.map(p => (
            <button key={p.userId} onClick={() => setSelectedId(p.userId)}
              className={clsx('w-full flex items-center gap-3 px-3 py-3 text-left border-b border-gray-50 dark:border-gray-800/50 transition-colors cursor-pointer',
                selectedId === p.userId ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60')}>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  {initials(p.name)}
                </div>
                {p.unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-gray-900" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={clsx('text-sm truncate', p.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200')}>{p.name}</p>
                  <RoleBadge role={p.role} />
                </div>
                <p className={clsx('text-xs truncate', p.unreadCount > 0 ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400')}>
                  {p.lastMessage ?? 'Start a conversation'}
                </p>
              </div>
              {p.unreadCount > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">{p.unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: active conversation */}
      <div className={clsx('flex-1 flex-col bg-gray-50 dark:bg-gray-950', selectedId ? 'flex' : 'hidden sm:flex')}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={<MessageSquare size={36} />} title="Select a conversation" description="Choose someone to start messaging." />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <button onClick={() => setSelectedId(null)} className="sm:hidden p-1 text-gray-500 cursor-pointer"><ArrowLeft size={18} /></button>
              <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                {initials(selected.name)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">{selected.name}</p>
                <div className="mt-1"><RoleBadge role={selected.role} /></div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-400">No messages yet. Say hello 👋</p>
                </div>
              ) : messages.map((m: Message, i: number) => {
                const prev = messages[i - 1];
                const showDay = !prev || dayLabel(prev.sentAt) !== dayLabel(m.sentAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] font-medium text-gray-400 bg-gray-200/60 dark:bg-gray-800/60 px-2.5 py-0.5 rounded-full">{dayLabel(m.sentAt)}</span>
                      </div>
                    )}
                    <div className={clsx('flex', m.isMine ? 'justify-end' : 'justify-start')}>
                      <div className={clsx('max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                        m.isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm')}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={clsx('text-[10px] mt-0.5 text-right', m.isMine ? 'text-indigo-200' : 'text-gray-400')}>
                          {new Date(m.sentAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={1}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none max-h-32 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending}
                  className="flex-shrink-0 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
