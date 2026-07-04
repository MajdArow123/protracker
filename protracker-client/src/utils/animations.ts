import type { Variants } from 'framer-motion';

// Shared list stagger: children fade + slide in from slightly below, 50ms apart.
// (ease values are strings, never arrays.)
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};
