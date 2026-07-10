import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Check } from 'lucide-react';
import { clsx } from 'clsx';
import {
  useUnreadNotificationCount, useNotificationFeed, useMarkNotificationRead, useMarkAllNotificationsRead,
} from '../../hooks/useNotifications';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { notificationMeta } from '../notifications/notificationMeta';
import type { AppNotification } from '../../types';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatRelativeTime } = useLocaleFormat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useUnreadNotificationCount();
  // Only fetch the list while the dropdown is open (keeps it fresh, avoids idle polling).
  const { data, isLoading } = useNotificationFeed(false, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = (data?.pages[0]?.items ?? []).slice(0, 5);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onItemClick = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        aria-label={t('nav.notifications', 'Notifications')}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 rtl:right-auto rtl:-left-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{t('nav.notifications', 'Notifications')}</p>
            {unread > 0 && (
              <button onClick={() => markAll.mutate()} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                {t('notifications.markAllRead', 'Mark all as read')}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg skeleton flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-0.5">
                    <div className="h-3 w-3/4 rounded skeleton" />
                    <div className="h-2.5 w-1/2 rounded skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center text-center">
              <div className="p-3 rounded-full bg-green-500/10 mb-2">
                <Check size={20} className="text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('notifications.empty', "You're all caught up!")}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('notifications.emptyDesc', 'New notifications will appear here.')}</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {items.map(n => {
                const { Icon, color } = notificationMeta(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => onItemClick(n)}
                    className={clsx(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-s-2',
                      n.isRead
                        ? 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60'
                        : 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
                    )}
                  >
                    <div className={clsx('p-1.5 rounded-lg flex-shrink-0', color)}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={clsx('text-sm truncate', n.isRead ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white')}>{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            className="w-full px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 cursor-pointer"
          >
            {t('notifications.viewAll', 'View all notifications')}
          </button>
        </div>
      )}
    </div>
  );
}
