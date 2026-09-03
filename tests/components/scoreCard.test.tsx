/**
 * scoreCard.test.tsx
 * SwingSwang
 *
 * Component tests for ScoreCard.
 */

import React from 'react';
import { render } from '../setup/renderHelper';
import { ScoreCard } from '../../src/components/home/ScoreCard';

describe('ScoreCard', () => {
  it('renders average score from history', () => {
    const { textContent } = render(
      <ScoreCard history={[7, 8, 9]} onClearHistory={jest.fn()} />
    );
    expect(textContent).toContain('8.0/10');
  });

  it('renders dash when no history', () => {
    const { textContent } = render(
      <ScoreCard history={[]} onClearHistory={jest.fn()} />
    );
    expect(textContent).toContain('-/10');
  });

  it('shows correct swing count plural', () => {
    const { textContent } = render(
      <ScoreCard history={[5, 6]} onClearHistory={jest.fn()} />
    );
    expect(textContent).toContain('2 swings');
  });

  it('shows singular "swing" for count of 1', () => {
    const { textContent } = render(
      <ScoreCard history={[7.5]} onClearHistory={jest.fn()} />
    );
    expect(textContent).toContain('1 swing');
  });

  it('renders AVG SCORE label', () => {
    const { textContent } = render(
      <ScoreCard history={[]} onClearHistory={jest.fn()} />
    );
    expect(textContent).toContain('AVG SCORE');
  });
});
