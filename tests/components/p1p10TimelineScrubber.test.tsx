/**
 * p1p10TimelineScrubber.test.tsx
 * SwingSwang – Component Tests
 */

import React from 'react';
import { render } from '../setup/renderHelper';
import { P1P10TimelineScrubber } from '../../src/components/video/P1P10TimelineScrubber';
import { PPosition } from '../../src/features/events/p1p10/types';

describe('P1P10TimelineScrubber', () => {
  const mockEvents: Record<PPosition, any> = {
    P1: { position: 'P1', semantic: 'ADDRESS', status: 'DETECTED_EXACT', timestampMs: 300, qualityScore: 0.9 },
    P2: { position: 'P2', semantic: 'P2_PROXY', status: 'DETECTED_PROXY', timestampMs: 700, qualityScore: 0.5 },
    P3: { position: 'P3', semantic: 'LEAD_ARM_PARALLEL_BACKSWING', status: 'DETECTED_EXACT', timestampMs: 1000, qualityScore: 0.8 },
    P4: { position: 'P4', semantic: 'TOP_TRANSITION', status: 'DETECTED_EXACT', timestampMs: 1400, qualityScore: 0.85 },
    P5: { position: 'P5', semantic: 'LEAD_ARM_PARALLEL_DOWNSWING', status: 'DETECTED_EXACT', timestampMs: 1550, qualityScore: 0.8 },
    P6: { position: 'P6', semantic: 'P6_PROXY', status: 'DETECTED_PROXY', timestampMs: 1650, qualityScore: 0.5 },
    P7: { position: 'P7', semantic: 'IMPACT_PROXY', status: 'DETECTED_PROXY', timestampMs: 1720, qualityScore: 0.48 },
    P8: { position: 'P8', semantic: 'P8_PROXY', status: 'DETECTED_PROXY', timestampMs: 1800, qualityScore: 0.5 },
    P9: { position: 'P9', semantic: 'TRAIL_ARM_PARALLEL_THROUGH', status: 'DETECTED_EXACT', timestampMs: 2000, qualityScore: 0.75 },
    P10: { position: 'P10', semantic: 'FINISH', status: 'DETECTED_EXACT', timestampMs: 2600, qualityScore: 0.9 },
  };

  it('renders time labels and legend', () => {
    const onSeek = jest.fn();
    const { textContent } = render(
      <P1P10TimelineScrubber
        duration={3.0}
        currentTime={1.4}
        events={mockEvents}
        onSeek={onSeek}
      />
    );

    expect(textContent).toContain('1.40s');
    expect(textContent).toContain('3.00s');
    expect(textContent).toContain('Exakt kroppsposition');
    expect(textContent).toContain('* Ärlig rörelseproxy');
  });

  it('renders pins for exact and proxy positions', () => {
    const onSeek = jest.fn();
    const { textContent } = render(
      <P1P10TimelineScrubber
        duration={3.0}
        currentTime={1.4}
        events={mockEvents}
        onSeek={onSeek}
      />
    );

    // Exact positions (no asterisk)
    expect(textContent).toContain('P1');
    expect(textContent).toContain('P4');
    expect(textContent).toContain('P10');

    // Proxy positions have asterisk
    expect(textContent).toContain('P2*');
    expect(textContent).toContain('P6*');
    expect(textContent).toContain('P7*');
    expect(textContent).toContain('P8*');
  });

  it('handles abstained positions gracefully without crashing', () => {
    const onSeek = jest.fn();
    const eventsWithAbstain: Record<PPosition, any> = {
      ...mockEvents,
      P6: { position: 'P6' as PPosition, semantic: 'P6_PROXY', status: 'ABSTAIN' as const, timestampMs: null },
      P7: { position: 'P7' as PPosition, semantic: 'IMPACT_PROXY', status: 'ABSTAIN' as const, timestampMs: null },
    };

    const { textContent } = render(
      <P1P10TimelineScrubber
        duration={3.0}
        currentTime={0.5}
        events={eventsWithAbstain}
        onSeek={onSeek}
      />
    );

    expect(textContent).toContain('P1');
    expect(textContent).toContain('P4');
    expect(textContent).not.toContain('P6*');
    expect(textContent).not.toContain('P7*');
  });
});
