import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
