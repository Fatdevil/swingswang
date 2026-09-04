#!/usr/bin/env bash
set -euo pipefail

# ── Terminal colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

# ── Configuration ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/android/app/src/main/assets"
BASE_URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker"

# SHA-256 checksums — verified 2026-09-04 from version-locked URLs
LITE_SHA="59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
FULL_SHA="5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"
HEAVY_SHA="64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b"

VARIANT="${1:-all}"
# Accept --variant flag too
if [ "$VARIANT" = "--variant" ]; then
  VARIANT="${2:-all}"
fi

# ── Functions ─────────────────────────────────────────────────────────
compute_sha256() {
  local file="$1"
  if command -v shasum &>/dev/null; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum &>/dev/null; then
    sha256sum "$file" | awk '{print $1}'
  else
    echo -e "${RED}Error: Neither shasum nor sha256sum found.${NC}" >&2
    exit 1
  fi
}

download_and_verify() {
  local variant="$1"
  local url_path="$2"
  local filename="$3"
  local expected_sha="$4"

  local target="$ASSETS_DIR/$filename"
  local url="$BASE_URL/$url_path"

  echo -e "${YELLOW}[$variant] Processing...${NC}"

  # Idempotent: skip if file exists with correct checksum
  if [ -f "$target" ]; then
    local actual_sha
    actual_sha="$(compute_sha256 "$target")"
    if [ "$actual_sha" = "$expected_sha" ]; then
      echo -e "${GREEN}[$variant] Already present with valid checksum. Skipping.${NC}"
      return 0
    else
      echo -e "${YELLOW}[$variant] Checksum mismatch (have $actual_sha). Re-downloading...${NC}"
      rm -f "$target"
    fi
  fi

  # Download
  echo "[$variant] Downloading from $url ..."
  curl -L --fail --progress-bar -o "$target" "$url"

  # Verify
  local actual_sha
  actual_sha="$(compute_sha256 "$target")"
  if [ "$actual_sha" = "$expected_sha" ]; then
    echo -e "${GREEN}[$variant] Downloaded and verified. SHA-256 matches.${NC}"
  else
    echo -e "${RED}[$variant] CHECKSUM MISMATCH after download!${NC}"
    echo -e "${RED}  Expected: $expected_sha${NC}"
    echo -e "${RED}  Got:      $actual_sha${NC}"
    rm -f "$target"
    exit 1
  fi
}

# ── Main ──────────────────────────────────────────────────────────────
echo -e "${GREEN}=== MediaPipe Model Downloader ===${NC}"
echo "Assets dir: $ASSETS_DIR"
echo "Variant:    $VARIANT"

mkdir -p "$ASSETS_DIR"

case "$VARIANT" in
  lite)
    download_and_verify "lite" \
      "pose_landmarker_lite/float16/1/pose_landmarker_lite.task" \
      "pose_landmarker_lite.task" \
      "$LITE_SHA"
    ;;
  full)
    download_and_verify "full" \
      "pose_landmarker_full/float16/1/pose_landmarker_full.task" \
      "pose_landmarker_full.task" \
      "$FULL_SHA"
    ;;
  heavy)
    download_and_verify "heavy" \
      "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task" \
      "pose_landmarker_heavy.task" \
      "$HEAVY_SHA"
    ;;
  all)
    download_and_verify "lite" \
      "pose_landmarker_lite/float16/1/pose_landmarker_lite.task" \
      "pose_landmarker_lite.task" \
      "$LITE_SHA"
    download_and_verify "full" \
      "pose_landmarker_full/float16/1/pose_landmarker_full.task" \
      "pose_landmarker_full.task" \
      "$FULL_SHA"
    download_and_verify "heavy" \
      "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task" \
      "pose_landmarker_heavy.task" \
      "$HEAVY_SHA"
    ;;
  *)
    echo -e "${RED}Invalid variant: $VARIANT. Use: lite, full, heavy, or all.${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}=== Done ===${NC}"
