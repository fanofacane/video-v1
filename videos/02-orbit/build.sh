#!/usr/bin/env bash
# Episode 02 — ORBIT. Build from scratch.
# Needs: node + playwright (Chromium), python3 + numpy, ffmpeg.
# Output: output/orbit.mp4 (30s, 1920x1080, 30fps).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out output

# 1) score (numpy synthesis, ~3s) and picture (16 sub-frame motion blur, ~3 min on 4 cores)
(cd film && python3 score.py ../out/score.wav && node render.mjs video ../out/film.mp4 16)

# 2) join the 4 rendered segments, add the score, encode the release file
ffmpeg -y -v error -f concat -safe 0 -i out/film.mp4.txt -i out/score.wav -map 0:v -map 1:a \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1 -c:a aac -b:a 192k -ar 48000 -movflags +faststart output/orbit.mp4
echo "done -> output/orbit.mp4"
