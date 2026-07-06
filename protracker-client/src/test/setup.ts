import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't implement matchMedia. Return matches:true only for the reduced-motion query so
// animation-heavy components (CountUp, etc.) render their final state deterministically in tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Recharts / some UI use ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
