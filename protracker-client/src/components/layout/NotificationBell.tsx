import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, CheckSquare, CalendarDays, Check, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { useNotifications, type NotificationKind } from '../../hooks/useNotifications';
import { useUnreadMessageCount } from '../../hooks/useMessages';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  task: CheckSquare,
  injury: AlertTriangle,
  session: CalendarDays,
};

const SEV_STYLES = {
  high: 'text-red-500 bg-red-500/10',
  medium: 'text-amber-500 bg-amber-500/10',
  low: 'text-indigo-500 bg-indigo-500/10',
} as const;

export function NotificationBell() {
  const { items, count: derivedCount } = useNotifications();
  const { data: unreadMessages = 0 } = useUnreadMessageCount();
  const count = derivedCount + unreadMessages;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
            {count > 0 && <span className="text-xs font-semibold text-gray-500">{count}</span>}
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center text-center">
              <div className="p-3 rounded-full bg-green-500/10 mb-2">
                <Check size={20} className="text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All caught up</p>
              <p className="text-xs text-gray-400 mt-0.5">No notifications right now.</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {unreadMessages > 0 && (
                <button
                  onClick={() => { setOpen(false); navigate('/messages'); }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg flex-shrink-0 text-blue-500 bg-blue-500/10">
                    <MessageSquare size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{unreadMessages} unread message{unreadMessages > 1 ? 's' : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Tap to open your messages</p>
                  </div>
                </button>
              )}
              {items.map(item => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <button
                    key={item.id}
                    onClick={() => { setOpen(false); navigate(item.to); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
                  >
                    <div className={clsx('p-1.5 rounded-lg flex-shrink-0', SEV_STYLES[item.severity])}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
