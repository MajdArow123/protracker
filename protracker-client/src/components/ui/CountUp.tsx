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

// Animates a number counting toward `value` once it scrolls into view (easeOutCubic),
// re-animating from the currently shown number whenever `value` changes — the shown
// number must always converge on the real one, even when data arrives after mount.
// Honors prefers-reduced-motion by rendering the final value immediately.
export function CountUp({ value, duration = 800, decimals = 0, suffix = '', prefix = '', className }: Props) {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (prefersReducedMotion()) { setDisplay(value); return; }
    const el = ref.current;
    if (!el) return;

    // Latch scoped to THIS effect run (not the component): a component-lifetime ref
    // here froze the display at its pre-update value forever once data refreshed.
    let started = false;
    let raf: number | undefined;

    const run = () => {
      if (started) return;
      started = true;
      const from = displayRef.current;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(from + (value - from) * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);

    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);

  return <span ref={ref} className={className}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}
