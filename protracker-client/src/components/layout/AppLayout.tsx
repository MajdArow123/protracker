import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useUnreadMessageCount } from '../../hooks/useMessages';
import { useToast } from '../../context/ToastContext';

// Toasts when the unread-message count rises while the user isn't on the Messages page.
function useNewMessageToast() {
  const { data: unread = 0 } = useUnreadMessageCount();
  const { addToast } = useToast();
  const location = useLocation();
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && unread > prev.current && location.pathname !== '/messages') {
      addToast('New message received', 'info');
    }
    prev.current = unread;
  }, [unread, location.pathname, addToast]);
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useNewMessageToast();
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
