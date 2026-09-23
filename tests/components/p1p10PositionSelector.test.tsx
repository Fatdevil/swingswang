/**
 * p1p10PositionSelector.test.tsx
 * SwingSwang – Component Tests
 */

import React from 'react';
import { render } from '../setup/renderHelper';
import { P1P10PositionSelector } from '../../src/components/video/P1P10PositionSelector';
import { P1P10InspectorCard } from '../../src/components/video/P1P10InspectorCard';
import { PPosition } from '../../src/features/events/p1p10/types';

describe('P1P10PositionSelector & P1P10InspectorCard', () => {
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

  describe('P1P10PositionSelector', () => {
    it('renders all 10 positions with Swedish titles and badges', () => {
      const onSelect = jest.fn();
      const { textContent } = render(
        <P1P10PositionSelector
          events={mockEvents}
          currentTime={1.4}
          onSelectPosition={onSelect}
        />
      );

      // Section header
      expect(textContent).toContain('P1–P10 SVINGPOSITIONER');

      // Swedish titles
      expect(textContent).toContain('Address');
      expect(textContent).toContain('Topp');
      expect(textContent).toContain('Bollträff');
      expect(textContent).toContain('Finish');

      // Badges
      expect(textContent).toContain('EXAKT');
      expect(textContent).toContain('⚡ PROXY');

      // Timestamps
      expect(textContent).toContain('0.30s');
      expect(textContent).toContain('1.40s');
      expect(textContent).toContain('1.72s');
      expect(textContent).toContain('2.60s');
    });

    it('renders abstained positions with AVSTOD badge', () => {
      const onSelect = jest.fn();
      const eventsWithAbstain: Record<PPosition, any> = {
        ...mockEvents,
        P7: { position: 'P7' as PPosition, semantic: 'IMPACT_PROXY', status: 'ABSTAIN' as const, timestampMs: null },
      };

      const { textContent } = render(
        <P1P10PositionSelector
          events={eventsWithAbstain}
          currentTime={0.5}
          onSelectPosition={onSelect}
        />
      );

      expect(textContent).toContain('AVSTOD');
      expect(textContent).toContain('Ej funnen');
    });
  });

  describe('P1P10InspectorCard', () => {
    it('renders exact position details with exact badge', () => {
      const { textContent } = render(
        <P1P10InspectorCard
          position="P4"
          event={mockEvents.P4}
        />
      );

      expect(textContent).toContain('P4');
      expect(textContent).toContain('Topp');
      expect(textContent).toContain('✓ EXAKT POSERING');
      expect(textContent).toContain('1.40s');
      expect(textContent).toContain('85%');
      expect(textContent).toContain('Toppen och vändningen');
    });

    it('renders honest proxy disclosure for proxy positions', () => {
      const { textContent } = render(
        <P1P10InspectorCard
          position="P7"
          event={mockEvents.P7}
        />
      );

      expect(textContent).toContain('P7');
      expect(textContent).toContain('Bollträff');
      expect(textContent).toContain('⚡ RÖRELSEPROXY');
      expect(textContent).toContain('1.72s');
      expect(textContent).toContain('48%');
      expect(textContent).toContain('MediaPipe 33-kroppsmodellen spårar inte klubbskaft eller bollkontakt');
    });

    it('renders abstention details when position is abstained', () => {
      const { textContent } = render(
        <P1P10InspectorCard
          position="P6"
          event={{ position: 'P6', semantic: 'P6_PROXY', status: 'ABSTAIN', timestampMs: null, reasonCode: 'NO_CLUB_SIGNAL' } as any}
        />
      );

      expect(textContent).toContain('P6');
      expect(textContent).toContain('AVSTOD');
      expect(textContent).toContain('Position ej bekräftad (NO_CLUB_SIGNAL)');
      expect(textContent).toContain('Algoritmen avstod från att fabricera en tidstämpel');
    });
  });
});
