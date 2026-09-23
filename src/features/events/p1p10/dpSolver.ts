/**
 * dpSolver.ts
 * SwingSwang – MediaPipe P1–P10 Normative Specification v1.0
 *
 * Global event solver using Dynamic Programming (Viterbi / DAG shortest path)
 * with duration priors, monotonic time constraints, and missing-state abstention.
 */

import {
  PPosition,
  POSITIONS,
  SwingEvent,
  CaptureContext,
  SEMANTIC_NAMES,
  AbstentionReasonCode,
} from './types';
import { Candidate } from './candidates';

export interface SolverOptions {
  readonly view: 'FACE_ON' | 'DTL';
  readonly missingPenalty?: number;
  readonly lambdaDuration?: number;
}

interface DPNode {
  cost: number;
  bestPrevNode: DPNode | null;
  position: PPosition;
  candidate: Candidate | null; // null represents MISSING state
  timestampMs: number | null;
}

/**
 * Evaluates duration penalty phi(dt) based on soft/hard duration intervals.
 * dt is in seconds.
 */
function evaluateDurationPenalty(
  posFrom: PPosition,
  posTo: PPosition,
  dtSec: number,
): { valid: boolean; penalty: number } {
  // Hard gate: strictly monotonic in time
  if (dtSec <= 0.001) {
    return { valid: false, penalty: Infinity };
  }

  // Major phase transition boundaries:
  if (posFrom === 'P1' && posTo === 'P4') {
    // Normal: 0.45–1.60 s; Hard: 0.25–2.50 s
    if (dtSec < 0.25 || dtSec > 2.50) return { valid: false, penalty: Infinity };
    if (dtSec < 0.45) return { valid: true, penalty: Math.pow((0.45 - dtSec) / 0.20, 2) * 2.0 };
    if (dtSec > 1.60) return { valid: true, penalty: Math.pow((dtSec - 1.60) / 0.90, 2) * 2.0 };
    return { valid: true, penalty: 0 };
  }

  if (posFrom === 'P4' && posTo === 'P7') {
    // Normal: 0.18–0.45 s; Hard: 0.10–0.70 s
    if (dtSec < 0.10 || dtSec > 0.70) return { valid: false, penalty: Infinity };
    if (dtSec < 0.18) return { valid: true, penalty: Math.pow((0.18 - dtSec) / 0.08, 2) * 3.0 };
    if (dtSec > 0.45) return { valid: true, penalty: Math.pow((dtSec - 0.45) / 0.25, 2) * 3.0 };
    return { valid: true, penalty: 0 };
  }

  if (posFrom === 'P7' && posTo === 'P10') {
    // Normal: 0.35–1.80 s; Hard: 0.20–3.00 s
    if (dtSec < 0.20 || dtSec > 3.00) return { valid: false, penalty: Infinity };
    if (dtSec < 0.35) return { valid: true, penalty: Math.pow((0.35 - dtSec) / 0.15, 2) * 2.0 };
    if (dtSec > 1.80) return { valid: true, penalty: Math.pow((dtSec - 1.80) / 1.20, 2) * 2.0 };
    return { valid: true, penalty: 0 };
  }

  // Intermediate step penalties: expect ~0.03 s to ~0.50 s between adjacent positions
  if (dtSec < 0.01) {
    return { valid: false, penalty: Infinity };
  }
  if (dtSec > 1.50) {
    return { valid: true, penalty: (dtSec - 1.50) * 2.0 };
  }
  return { valid: true, penalty: 0 };
}

/**
 * Solves the global monotonic sequence P1 < P2 < ... < P10
 * using Dynamic Programming.
 */
export function solveMonotonicSequence(
  candidatesByPosition: Record<PPosition, Candidate[]>,
  context: CaptureContext,
  options: SolverOptions = { view: context.view },
  hasArmInstability?: boolean,
): Record<PPosition, SwingEvent> {
  const missingPenalty = options.missingPenalty ?? 2.5;
  const lambda = options.lambdaDuration ?? 1.0;

  // dpTable[k] contains an array of DPNodes for position POSITIONS[k]
  const dpTable: DPNode[][] = [];

  // 1. Initialize P1
  const p1Candidates = candidatesByPosition['P1'] ?? [];
  const p1Nodes: DPNode[] = [];

  for (const cand of p1Candidates) {
    const emitCost = -Math.log(Math.max(1e-4, cand.score));
    p1Nodes.push({
      cost: emitCost,
      bestPrevNode: null,
      position: 'P1',
      candidate: cand,
      timestampMs: cand.timestampMs,
    });
  }

  // P1 missing node
  p1Nodes.push({
    cost: missingPenalty * 1.5, // P1 is crucial, higher penalty to miss
    bestPrevNode: null,
    position: 'P1',
    candidate: null,
    timestampMs: null,
  });

  dpTable.push(p1Nodes);

  // 2. Iterate for positions P2 through P10
  for (let k = 1; k < POSITIONS.length; k++) {
    const pos = POSITIONS[k];
    const prevNodes = dpTable[k - 1];
    const currCandidates = candidatesByPosition[pos] ?? [];
    const currNodes: DPNode[] = [];

    // Evaluate each concrete candidate for position pos
    for (const cand of currCandidates) {
      const emitCost = -Math.log(Math.max(1e-4, cand.score));
      let minPrevCost = Infinity;
      let bestPrev: DPNode | null = null;

      for (const prev of prevNodes) {
        if (prev.cost === Infinity) continue;

        let transPenalty = 0;
        let valid = true;

        if (prev.timestampMs !== null) {
          const dtSec = (cand.timestampMs - prev.timestampMs) / 1000.0;
          const evalRes = evaluateDurationPenalty(prev.position, pos, dtSec);
          if (!evalRes.valid) {
            valid = false;
          } else {
            transPenalty = evalRes.penalty;
          }
        }

        if (valid) {
          const totalCost = prev.cost + lambda * transPenalty;
          if (totalCost < minPrevCost) {
            minPrevCost = totalCost;
            bestPrev = prev;
          }
        }
      }

      if (bestPrev !== null && minPrevCost < Infinity) {
        currNodes.push({
          cost: emitCost + minPrevCost,
          bestPrevNode: bestPrev,
          position: pos,
          candidate: cand,
          timestampMs: cand.timestampMs,
        });
      }
    }

    // Missing state for position pos
    let bestPrevForMissing: DPNode | null = null;
    let minPrevCostForMissing = Infinity;

    for (const prev of prevNodes) {
      if (prev.cost < minPrevCostForMissing) {
        minPrevCostForMissing = prev.cost;
        bestPrevForMissing = prev;
      }
    }

    currNodes.push({
      cost: minPrevCostForMissing + missingPenalty,
      bestPrevNode: bestPrevForMissing,
      position: pos,
      candidate: null,
      timestampMs: bestPrevForMissing ? bestPrevForMissing.timestampMs : null,
    });

    dpTable.push(currNodes);
  }

  // 3. Backtrack from P10
  const finalNodes = dpTable[dpTable.length - 1];
  let bestTerminalNode: DPNode = finalNodes[0];
  let minFinalCost = Infinity;

  for (const node of finalNodes) {
    if (node.cost < minFinalCost) {
      minFinalCost = node.cost;
      bestTerminalNode = node;
    }
  }

  const selectedPath: DPNode[] = [];
  let curr: DPNode | null = bestTerminalNode;
  while (curr !== null) {
    selectedPath.unshift(curr);
    curr = curr.bestPrevNode;
  }

  // 4. Construct SwingEvent dictionary
  const events: Partial<Record<PPosition, SwingEvent>> = {};

  for (let k = 0; k < POSITIONS.length; k++) {
    const pos = POSITIONS[k];
    const node = selectedPath[k];

    if (node && node.candidate) {
      const c = node.candidate;
      events[pos] = {
        position: pos,
        semantic: c.semantic,
        status: c.status,
        timestampMs: c.timestampMs,
        frameIndex: c.frameIndex,
        qualityScore: Math.round(c.score * 1000) / 1000,
        temporalUncertaintyMs:
          context.nominalFps >= 100
            ? 8.3
            : 16.7,
        view: context.view,
        evidence: c.evidence,
        warnings: c.warnings,
      };
    } else {
      // Abstain
      const reasonCode = determineAbstentionReason(pos, context, hasArmInstability);
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
  }

  return events as Record<PPosition, SwingEvent>;
}

function determineAbstentionReason(
  pos: PPosition,
  context: CaptureContext,
  hasArmInstability?: boolean,
): AbstentionReasonCode {
  if ((pos === 'P3' || pos === 'P5' || pos === 'P9') && hasArmInstability) {
    return 'WRIST_IDENTITY_UNSTABLE';
  }
  if (pos === 'P2' || pos === 'P6' || pos === 'P8') {
    return 'NO_CLUB_SIGNAL';
  }
  if (pos === 'P7') {
    return 'NO_BALL_CONTACT_SIGNAL';
  }
  if (pos === 'P1') {
    return 'NO_STABLE_ADDRESS';
  }
  if (pos === 'P4') {
    return 'NO_TRANSITION';
  }
  return 'LOW_SCORE';
}
