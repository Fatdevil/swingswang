import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface SwingGuideOverlayProps {
  cameraView: 'FO' | 'DTL';
}

export function SwingGuideOverlay({ cameraView }: SwingGuideOverlayProps) {
  if (cameraView === 'FO') {
    // Face On (FO) standing profile guide
    return (
      <Svg width="200" height="360" viewBox="0 0 200 360" style={styles.silhouette}>
        {/* Head */}
        <Circle cx="100" cy="50" r="22" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
        {/* Spine & Body */}
        <Line x1="100" y1="72" x2="100" y2="180" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Shoulders */}
        <Line x1="70" y1="85" x2="130" y2="85" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Hips */}
        <Line x1="75" y1="180" x2="125" y2="180" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Left Leg */}
        <Line x1="75" y1="180" x2="65" y2="300" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Right Leg */}
        <Line x1="125" y1="180" x2="135" y2="300" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Left Arm */}
        <Line x1="70" y1="85" x2="90" y2="170" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Right Arm */}
        <Line x1="130" y1="85" x2="110" y2="170" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Golf Club representation */}
        <Path d="M 100,170 L 150,280 M 145,280 L 155,285" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
      </Svg>
    );
  } else {
    // Down The Line (DTL) bent stance profile guide
    return (
      <Svg width="200" height="360" viewBox="0 0 200 360" style={styles.silhouette}>
        {/* Head */}
        <Circle cx="120" cy="70" r="22" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
        {/* Bent spine */}
        <Path d="M 120,92 Q 105,120 85,160" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
        {/* Hips to ankles (profile bent leg) */}
        <Path d="M 85,160 L 75,225 L 85,310" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
        {/* Hanging profile arms */}
        <Line x1="108" y1="105" x2="125" y2="190" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        {/* Club representation */}
        <Path d="M 125,190 L 175,270 M 170,270 L 180,275" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
      </Svg>
    );
  }
}

const styles = StyleSheet.create({
  silhouette: {
    position: 'absolute',
    top: '22%',
    left: '50%',
    marginLeft: -100,
    opacity: 0.8,
  },
});
