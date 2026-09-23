/**
 * P1P10EventDetector.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * High-level orchestrator for the P1–P10 golf swing detection engine:
 * validateInput -> canonicalize -> smoothWithMasks -> deriveFeatures ->
 * segmentPhases -> generateCandidates -> solveMonotonicPath -> SequenceResult.
 */

import {
  PoseFrame,
  CaptureContext,
  PPosition,
  POSITIONS,
  SwingEvent,
  SequenceResult,
  PipelineTrace,
  AbstentionReasonCode,
  SEMANTIC_NAMES,
} from './types';
import { processSignals, ProcessedSequence } from './signalProcessing';
import { segmentSwingPhases, SwingPhases } from './phases';
import { generateCandidatesForPosition, Candidate, isArmTrackStable } from './candidates';
import { solveMonotonicSequence } from './dpSolver';

export class P1P10EventDetector {
  readonly name = 'MediaPipe P1–P10 Normative Detector';
  readonly version = '1.0.0';

  detect(rawFrames: readonly PoseFrame[], context: CaptureContext): SequenceResult {
    // 1. Input validation & capture gates
    if (!rawFrames || rawFrames.length < 5) {
      return this.createAbstainedSequence(
        'CLIP_TRUNCATED_START',
        context,
        rawFrames?.length ?? 0,
      );
    }

    // 2. Preprocessing, canonicalization, Savitzky–Golay smoothing & PTS derivatives
    const processed = processSignals(rawFrames, context);
    if (processed.frames.length < 5) {
      return this.createAbstainedSequence(
        'CLIP_TRUNCATED_START',
        context,
        rawFrames.length,
      );
    }

    // 3. Phase segmentation & coarse bounds
    const phases = segmentSwingPhases(processed.frames, processed.s2D);
    if (!phases.hasTakeaway || !phases.hasTransition) {
      const primaryReason = (phases.reasonCodes[0] as AbstentionReasonCode) ?? 'NO_TRANSITION';
      return this.createAbstainedSequence(
        primaryReason,
        context,
        rawFrames.length,
        processed,
        phases,
      );
    }

    // 4. Generate candidates for all 10 positions
    const candidateCounts: Partial<Record<PPosition, number>> = {};
    const candidatesByPosition: Partial<Record<PPosition, Candidate[]>> = {};

    for (const pos of POSITIONS) {
      const cands = generateCandidatesForPosition(
        pos,
        processed.frames,
        phases,
        context,
        processed.s2D,
      );
      candidatesByPosition[pos] = cands;
      candidateCounts[pos] = cands.length;
    }

    // 5. Global Monotonic Dynamic Programming Solver
    const hasArmInstability = !isArmTrackStable(processed.frames, 0, processed.frames.length - 1);
    const events = solveMonotonicSequence(
      candidatesByPosition as Record<PPosition, Candidate[]>,
      context,
      { view: context.view },
      hasArmInstability,
    );

    // 6. Assemble ordered events list and trace
    const orderedEvents: SwingEvent[] = POSITIONS.map(p => events[p]);
    const abstentions: { position: PPosition; reasonCode: string }[] = [];

    for (const pos of POSITIONS) {
      if (events[pos].status === 'ABSTAIN') {
        abstentions.push({
          position: pos,
          reasonCode: events[pos].reasonCode ?? 'UNKNOWN',
        });
      }
    }

    const interpolatedCount = processed.gaps.filter(g => g.interpolated).length;

    const trace: PipelineTrace = {
      rawFramesCount: rawFrames.length,
      interpolatedGapsCount: interpolatedCount,
      filterParameters: {
        maxGapMs: 50,
        sgWindowMs: context.nominalFps >= 100 ? 75 : 83,
        sgOrder: 2,
        s2D: processed.s2D,
      },
      phases: {
        hasTakeaway: phases.hasTakeaway,
        hasTransition: phases.hasTransition,
        takeawayTimestampMs:
          phases.takeawayFrameIndex !== null
            ? processed.frames[phases.takeawayFrameIndex]?.timestampMs
            : undefined,
        transitionTimestampMs:
          phases.topFrameIndex !== null
            ? processed.frames[phases.topFrameIndex]?.timestampMs
            : undefined,
        reasonCodes: phases.reasonCodes,
      },
      view: context.view,
      handedness: context.handedness,
      gaps: processed.gaps.map(g => ({
        startMs: g.startMs,
        endMs: g.endMs,
        durationMs: g.durationMs,
        reason: g.reason,
      })),
      candidateCountsPerPosition: candidateCounts as Record<PPosition, number>,
      abstentions,
    };

    // A sequence is considered usable if at least P1, P4, and an impact/finish are detected
    const sequenceUsable =
      events.P1.status !== 'ABSTAIN' &&
      events.P4.status !== 'ABSTAIN' &&
      (events.P7.status !== 'ABSTAIN' || events.P10.status !== 'ABSTAIN');

    return {
      events,
      orderedEvents,
      sequenceUsable,
      trace,
    };
  }

  private createAbstainedSequence(
    reasonCode: AbstentionReasonCode,
    context: CaptureContext,
    rawCount: number,
    processed?: ProcessedSequence,
    phases?: SwingPhases,
  ): SequenceResult {
    const events: Partial<Record<PPosition, SwingEvent>> = {};
    for (const pos of POSITIONS) {
      events[pos] = {
        position: pos,
        semantic: SEMANTIC_NAMES[pos].exact,
        status: 'ABSTAIN',
        timestampMs: null,
        frameIndex: null,
        qualityScore: null,
        temporalUncertaintyMs: null,
        view: context.view,
        evidence: {},
        warnings: [],
        reasonCode,
      };
    }

    const trace: PipelineTrace = {
      rawFramesCount: rawCount,
      interpolatedGapsCount: 0,
      filterParameters: {
        maxGapMs: 50,
        sgWindowMs: context.nominalFps >= 100 ? 75 : 83,
        sgOrder: 2,
        s2D: processed?.s2D ?? 0.25,
      },
      phases: {
        hasTakeaway: phases?.hasTakeaway ?? false,
        hasTransition: phases?.hasTransition ?? false,
        reasonCodes: [reasonCode],
      },
      view: context.view,
      handedness: context.handedness,
      gaps: [],
      candidateCountsPerPosition: {
        P1: 0,
        P2: 0,
        P3: 0,
        P4: 0,
        P5: 0,
        P6: 0,
        P7: 0,
        P8: 0,
        P9: 0,
        P10: 0,
      },
      abstentions: POSITIONS.map(p => ({ position: p, reasonCode })),
    };

    return {
      events: events as Record<PPosition, SwingEvent>,
      orderedEvents: POSITIONS.map(p => events[p]!),
      sequenceUsable: false,
      trace,
    };
  }
}
