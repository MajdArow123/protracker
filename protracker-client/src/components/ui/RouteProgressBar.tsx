import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// GitHub-style thin loading bar at the very top of the page during route changes.
// Shows briefly (~500ms) then fades — pure CSS/Framer, no library.
export function RouteProgressBar() {
  const { pathname } = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={pathname}
          className="fixed top-0 inset-x-0 z-[70] h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ scaleX: { duration: 0.4, ease: 'easeOut' }, opacity: { duration: 0.2 } }}
        />
      )}
    </AnimatePresence>
  );
}
