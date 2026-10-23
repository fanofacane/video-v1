#!/usr/bin/env bash
# Episode 03 — 文字PV (Japanese lyric video). Build from scratch.
# Needs: node + playwright (Chromium), python3 + numpy, ffmpeg. Fonts are in film/fonts (Mincho is a subset:
# if you add new characters to lyrics.js, re-run fonts.sh to fetch a new subset).
# Output: output/moji_pv.mp4 (30s, 1920x1080, 30fps, ~20 MB).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out output
(cd film && python3 score.py ../out/score.wav && node render.mjs video ../out/film.mp4 16)
ffmpeg -y -v error -f concat -safe 0 -i out/film.mp4.txt -i out/score.wav -map 0:v -map 1:a \
  -c:v libx264 -crf 26 -preset slow -tune grain -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1 -c:a aac -b:a 192k -ar 48000 -movflags +faststart output/moji_pv.mp4
echo "done -> output/moji_pv.mp4"
