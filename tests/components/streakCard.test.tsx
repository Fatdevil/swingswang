/**
 * streakCard.test.tsx
 * SwingSwang
 *
 * Component tests for StreakCard.
 */

import React from 'react';
import { render } from '../setup/renderHelper';
import { StreakCard } from '../../src/components/home/StreakCard';

describe('StreakCard', () => {
  it('renders streak count with plural "Days"', () => {
    const { textContent } = render(<StreakCard streakCount={5} />);
    expect(textContent).toContain('5 Days');
  });

  it('renders singular "Day" for count of 1', () => {
    const { textContent } = render(<StreakCard streakCount={1} />);
    expect(textContent).toContain('1 Day');
  });

  it('shows "Keep it going!" for active streak', () => {
    const { textContent } = render(<StreakCard streakCount={3} />);
    expect(textContent).toContain('Keep it going!');
  });

  it('shows "Log in tomorrow" for zero streak', () => {
    const { textContent } = render(<StreakCard streakCount={0} />);
    expect(textContent).toContain('Log in tomorrow');
  });

  it('renders DAILY STREAK label', () => {
    const { textContent } = render(<StreakCard streakCount={10} />);
    expect(textContent).toContain('DAILY STREAK');
  });
});
