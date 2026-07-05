import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animates a number counting up from 0 to `value` when it first scrolls into view
// (easeOutCubic). Honors prefers-reduced-motion by rendering the final value immediately.
export function CountUp({ value, duration = 800, decimals = 0, suffix = '', prefix = '', className }: Props) {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const startedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setDisplay(value); return; }
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(value * eased);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);

    return () => { io.disconnect(); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span ref={ref} className={className}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}
