import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CountUp } from '../components/ui/CountUp';

// With reduced-motion on (see test setup), CountUp renders its final value immediately.
describe('CountUp', () => {
  it('renders the final integer value', () => {
    render(<CountUp value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies prefix and suffix', () => {
    render(<CountUp value={19} prefix="$" suffix="/mo" />);
    expect(screen.getByText('$19/mo')).toBeInTheDocument();
  });

  it('honors decimal places', () => {
    render(<CountUp value={8.4} decimals={1} />);
    expect(screen.getByText('8.4')).toBeInTheDocument();
  });
});

// Animated path (reduced-motion off): drive rAF + performance.now manually and make
// IntersectionObserver fire synchronously on observe, so the easing loop is deterministic.
describe('CountUp animated path', () => {
  const realMatchMedia = window.matchMedia;
  const realIO = globalThis.IntersectionObserver;
  const realRaf = window.requestAnimationFrame;
  const realCancelRaf = window.cancelAnimationFrame;
  const realNow = performance.now;

  let rafQueue: Map<number, FrameRequestCallback>;
  let rafId: number;
  let clock: number;

  const flushFrames = (untilMs: number, stepMs = 100) => {
    while (clock < untilMs) {
      clock = Math.min(clock + stepMs, untilMs);
      const pending = [...rafQueue.values()];
      rafQueue.clear();
      act(() => pending.forEach((cb) => cb(clock)));
    }
  };

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    rafQueue = new Map();
    rafId = 0;
    clock = 0;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafQueue.set(++rafId, cb);
      return rafId;
    };
    window.cancelAnimationFrame = (id: number) => void rafQueue.delete(id);
    performance.now = () => clock;

    globalThis.IntersectionObserver = class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    globalThis.IntersectionObserver = realIO;
    window.requestAnimationFrame = realRaf;
    window.cancelAnimationFrame = realCancelRaf;
    performance.now = realNow;
  });

  // Regression (athlete-dashboard 0/0.0 freeze): a component-lifetime start latch made
  // CountUp ignore every value change after its first animation — cards froze at 0 when
  // query data arrived post-mount. The shown number must converge on the latest value.
  it('re-animates to the new value when `value` changes after the first animation', () => {
    const { rerender } = render(<CountUp value={0} />);
    flushFrames(900);
    expect(screen.getByText('0')).toBeInTheDocument();

    rerender(<CountUp value={24} />);
    flushFrames(1900);
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('updates a decimal value that arrives after mount', () => {
    const { rerender } = render(<CountUp value={0} decimals={1} />);
    flushFrames(900);
    rerender(<CountUp value={6.4} decimals={1} />);
    flushFrames(1900);
    expect(screen.getByText('6.4')).toBeInTheDocument();
  });

  // StrictMode double-mounts effects: the first mount's latch + rAF cancel left the
  // second mount permanently stuck at 0 in dev.
  it('still reaches the target under StrictMode double-mounted effects', () => {
    render(
      <StrictMode>
        <CountUp value={17} />
      </StrictMode>,
    );
    flushFrames(900);
    expect(screen.getByText('17')).toBeInTheDocument();
  });
});
