# Swing Swang Measurement Confidence Model

This document specifies the six-factor confidence scoring model used to evaluate the reliability and trustworthiness of each biomechanical swing measurement.

## Model Overview

To prevent presenting inaccurate feedback to golfers, the analysis pipeline computes a **Confidence Score (0.0 to 1.0)** for every metric. This score dynamically determines if a measurement is trustworthy:

*   **Reliable (>= 0.7)**: Measurement is highly trustworthy and shown normally.
*   **Marginal (0.4 - 0.7)**: Shown with a caution icon; results may have minor inaccuracies.
*   **Not Reliable (< 0.4)**: Blocked or hidden; data quality is too poor to draw conclusions.

---

## The Six Factors

The composite confidence is computed from six independent observational factors:

### 1. Landmark Visibility (Weight: 25%)
Measures the availability of the required landmarks for a specific metric across the swing timeline.
*   **Formula**: \(\frac{1}{N} \sum_{i=1}^{N} \text{Availability}(\text{Landmark}_i)\)
*   **Availability**: Ratio of frames where the landmark was detected by the pose engine with confidence $> 0.3$.

### 2. Pose Confidence (Weight: 25%)
The mean raw confidence score returned by the pose estimator (ExecuTorch/YOLO) for all detected points across the timeline.
*   **Weight**: Ensures that even if points are technically "visible", low-contrast or blurred detections reduce the confidence score.

### 3. Temporal Coverage (Weight: 20%)
The ratio of reliable frames (average frame confidence $> 0.5$) to total video frames.
*   **Formula**: \(\frac{\text{Reliable Frames}}{\text{Total Video Frames}}\)
*   **Impact**: Dropping too many frames due to occlusion or motion blur reduces coverage.

### 4. Temporal Stability (Weight: 15%)
Inverse of landmark positional jitter. High jitter indicates tracking instability (camera shake or tracking drift).
*   **Calculation**: Measures the frame-to-frame coordinate variance of the golfer's nose (the most stable physical reference point).
*   **Threshold**: Jitter at or above `0.02` normalized coordinate units drops stability score to `0.5` or lower.

### 5. Normalizer Reliability (Weight: 10%)
Reflects the consistency of reference lengths used for normalization (e.g., shoulder width for displacement metrics, hip width for pelvis sway).
*   **Calculation**: Measured via the Coefficient of Variation (\(CV = \frac{\sigma}{\mu}\)) of the reference length across the swing.
*   **Impact**: High variation (\(CV > 0.5\)) indicates perspective changes (golfers turning away from plane) or tracking drift, reducing reliability.

### 6. Golfer Size in Frame (Weight: 5%)
Evaluates whether the golfer is close enough to the camera for high-accuracy keypoint tracking.
*   **Formula**: \(\text{Clamp}(\frac{\text{Golfer Height}}{\text{Frame Height} \times 0.3}, 0.0, 1.0)\)
*   **Threshold**: Golfer bounding box height must cover at least 30% of the video height to receive full score.

---

## Composite Confidence Formula

\[\text{Confidence}_{\text{composite}} = \sum ( \text{Factor}_i \times \text{Weight}_i )\]

The final score is clamped between `0.0` and `1.0`.

## Warnings Generation

Low scores on specific factors automatically generate user-facing warnings:

*   **Landmark Visibility < 0.5**: `"Required landmarks missing in X% of frames."`
*   **Pose Confidence < 0.5**: `"Average pose detection confidence is low (X%)."`
*   **Temporal Coverage < 0.6**: `"Valid pose data available for only X% of frames."`
*   **Temporal Stability < 0.4**: `"Landmark positions are unstable across frames (jitter detected)."`
*   **Normalizer Reliability < 0.5**: `"Normalization reference varies significantly across frames."`
*   **Golfer Size < 0.1**: `"The golfer appears very small in the frame. Move the camera closer."`
