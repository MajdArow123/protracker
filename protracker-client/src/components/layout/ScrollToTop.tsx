import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Resets scroll to the top on every route change — both the window and the app's
// main scroll container (which is what actually scrolls inside the layout).
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
