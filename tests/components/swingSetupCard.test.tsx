/**
 * swingSetupCard.test.tsx
 * SwingSwang
 *
 * Component tests for SwingSetupCard.
 */

import React from 'react';
import { render } from '../setup/renderHelper';
import { SwingSetupCard } from '../../src/components/home/SwingSetupCard';

const defaultConfig = {
  cameraView: 'FO' as const,
  handedness: 'RIGHT' as const,
  club: 'DRIVER' as const,
};

describe('SwingSetupCard', () => {
  it('renders all selector labels', () => {
    const { textContent } = render(
      <SwingSetupCard swingConfig={defaultConfig} onConfigChange={jest.fn()} />
    );
    expect(textContent).toContain('CAMERA VIEW');
    expect(textContent).toContain('GOLFER HANDEDNESS');
    expect(textContent).toContain('CLUB TYPE');
  });

  it('renders camera view options', () => {
    const { textContent } = render(
      <SwingSetupCard swingConfig={defaultConfig} onConfigChange={jest.fn()} />
    );
    expect(textContent).toContain('Face On (FO)');
    expect(textContent).toContain('Down the Line (DTL)');
  });

  it('renders handedness options', () => {
    const { textContent } = render(
      <SwingSetupCard swingConfig={defaultConfig} onConfigChange={jest.fn()} />
    );
    expect(textContent).toContain('Right-Handed');
    expect(textContent).toContain('Left-Handed');
  });

  it('renders all four club options', () => {
    const { textContent } = render(
      <SwingSetupCard swingConfig={defaultConfig} onConfigChange={jest.fn()} />
    );
    expect(textContent).toContain('Driver');
    expect(textContent).toContain('Iron');
    expect(textContent).toContain('Wedge');
    expect(textContent).toContain('Other');
  });
});
