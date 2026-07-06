/**
 * SkeletonOverlay.tsx
 * SwingSwang
 *
 * SVG skeleton overlay drawn on top of the video player.
 */

import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { PoseFrame } from '../../types/pose';
import { LandmarkID, isLandmarkVisible } from '../../types/landmarks';
import { SKELETON_CONNECTIONS, JOINT_RADIUS, BONE_LINE_WIDTH, landmarkSideColor } from '../../constants/skeleton';
import { normalizedToAspectFitDisplay } from '../../utils/coordinates';
import { COLORS } from '../../constants/theme';

interface SkeletonOverlayProps {
  poseFrame: PoseFrame | null;
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  showLabels?: boolean;
}

export function SkeletonOverlay({
  poseFrame,
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
  showLabels = false,
}: SkeletonOverlayProps) {
  if (!poseFrame || displayWidth === 0 || displayHeight === 0) {
    return null;
  }

  /** Convert normalized coords to display coords. */
  const toDisplay = (nx: number, ny: number) =>
    normalizedToAspectFitDisplay(nx, ny, videoWidth, videoHeight, displayWidth, displayHeight);

  /** Get display position for a landmark ID. */
  const landmarkPos = (id: LandmarkID) => {
    const lm = poseFrame.landmarks.get(id);
    if (!lm || !isLandmarkVisible(lm)) return null;
    return { ...toDisplay(lm.x, lm.y), confidence: lm.confidence };
  };

  /** Confidence-based opacity. */
  const confOpacity = (confidence: number) =>
    Math.max(0.3, Math.min(1.0, confidence));

  return (
    <Svg
      width={displayWidth}
      height={displayHeight}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {/* Bones */}
      {SKELETON_CONNECTIONS.map((bone, index) => {
        const from = landmarkPos(bone.from);
        const to = landmarkPos(bone.to);
        if (!from || !to) return null;

        const avgConf = (from.confidence + to.confidence) / 2;

        return (
          <Line
            key={`bone-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={COLORS.skeletonBone}
            strokeWidth={BONE_LINE_WIDTH}
            strokeLinecap="round"
            opacity={confOpacity(avgConf)}
          />
        );
      })}

      {/* Joints */}
      {Array.from(poseFrame.landmarks.entries()).map(([id, lm]) => {
        if (!isLandmarkVisible(lm)) return null;
        const pos = toDisplay(lm.x, lm.y);
        const color = landmarkSideColor(id);

        return (
          <Circle
            key={`joint-${id}`}
            cx={pos.x}
            cy={pos.y}
            r={JOINT_RADIUS}
            fill={color}
            opacity={confOpacity(lm.confidence)}
          />
        );
      })}
    </Svg>
  );
}
