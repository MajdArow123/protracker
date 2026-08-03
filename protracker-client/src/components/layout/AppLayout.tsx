import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { useUnreadMessageCount } from '../../hooks/useMessages';
import { useToast } from '../../context/useToast';
import { PushPrompt } from '../PushPrompt';

// Toasts when the unread-message count rises while the user isn't on the Messages page.
function useNewMessageToast() {
  const { t } = useTranslation();
  const { data: unread = 0 } = useUnreadMessageCount();
  const { addToast } = useToast();
  const location = useLocation();
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && unread > prev.current && location.pathname !== '/messages') {
      addToast(t('ui.newMessage', 'New message received'), 'info');
    }
    prev.current = unread;
  }, [unread, location.pathname, addToast, t]);
}

// Desktop sidebar collapse survives reload; mobile drawer state stays ephemeral.
const SIDEBAR_COLLAPSED_KEY = 'pt_sidebar_collapsed';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  const location = useLocation();
  useNewMessageToast();
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />
        <main className="flex-1 overflow-y-auto">
          {/* Consistent enter transition on every route change (keyed by pathname). */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
        {/* In-flow bottom tab bar on mobile — main (flex-1) shrinks to make room, so
            content is never hidden behind it. Hidden on md+ (sidebar takes over). */}
        <BottomNav />
      </div>
      <PushPrompt />
    </div>
  );
}
