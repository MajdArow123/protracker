import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { CheckCircle2, X, CheckCheck } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useNotificationFeed, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification,
  useUnreadNotificationCount,
} from '../../hooks/useNotifications';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { notificationMeta, type NotificationFilter } from '../../components/notifications/notificationMeta';
import type { AppNotification } from '../../types';

const FILTERS: { key: NotificationFilter; labelKey: string; label: string }[] = [
  { key: 'all', labelKey: 'notifications.filterAll', label: 'All' },
  { key: 'unread', labelKey: 'notifications.filterUnread', label: 'Unread' },
  { key: 'messages', labelKey: 'notifications.filterMessages', label: 'Messages' },
  { key: 'tasks', labelKey: 'notifications.filterTasks', label: 'Tasks' },
  { key: 'injuries', labelKey: 'notifications.filterInjuries', label: 'Injuries' },
  { key: 'system', labelKey: 'notifications.filterSystem', label: 'System' },
];

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatRelativeTime, formatDateTime } = useLocaleFormat();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const unreadOnly = filter === 'unread';
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotificationFeed(unreadOnly);
  const { data: unread = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();

  const all = data?.pages.flatMap(p => p.items) ?? [];
  // 'all'/'unread' handled server-side; the category filters refine the loaded feed client-side.
  const items = ['all', 'unread'].includes(filter)
    ? all
    : all.filter(n => notificationMeta(n.type).category === filter);

  const onItemClick = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  const actions = unread > 0 ? (
    <button onClick={() => markAll.mutate()}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
      <CheckCheck size={15} /> {t('notifications.markAllRead', 'Mark all as read')}
    </button>
  ) : undefined;

  return (
    <PageWrapper title={t('notifications.title', 'Notifications')} actions={actions}>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={clsx('px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer',
              filter === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700')}>
            {t(f.labelKey, f.label)}{f.key === 'unread' && unread > 0 ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardListSkeleton count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={30} />}
          title={t('notifications.empty', "You're all caught up!")}
          description={t('notifications.emptyDesc', 'New notifications will appear here.')}
        />
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const { Icon, color } = notificationMeta(n.type);
            return (
              <div key={n.id}
                className={clsx('group flex items-start gap-3 rounded-2xl border p-4 transition-colors',
                  n.isRead
                    ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                    : 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20')}>
                {/* Unread dot */}
                <span className={clsx('mt-2 w-2 h-2 rounded-full flex-shrink-0', n.isRead ? 'bg-transparent' : 'bg-indigo-500')} />
                <div className={clsx('p-2 rounded-xl flex-shrink-0', color)}>
                  <Icon size={16} />
                </div>
                <button onClick={() => onItemClick(n)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <p className={clsx('text-sm', n.isRead ? 'font-medium text-gray-800 dark:text-gray-200' : 'font-bold text-gray-900 dark:text-white')}>{n.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1" title={formatDateTime(n.createdAt)}>{formatRelativeTime(n.createdAt)}</p>
                </button>
                <button onClick={() => remove.mutate(n.id)} aria-label={t('common.delete', 'Delete')}
                  className="p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 transition-all cursor-pointer flex-shrink-0">
                  <X size={15} />
                </button>
              </div>
            );
          })}

          {hasNextPage && !['messages', 'tasks', 'injuries', 'system'].includes(filter) && (
            <div className="pt-2 flex justify-center">
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-60">
                {isFetchingNextPage ? t('common.loading', 'Loading...') : t('notifications.loadMore', 'Load more')}
              </button>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
