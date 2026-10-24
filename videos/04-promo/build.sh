#!/usr/bin/env bash
# Episode 04 — product promo cut from a raw screen recording. Build from scratch.
# Needs: node + playwright (Chromium), python3 + numpy, ffmpeg. Fonts: film/fonts (subset; re-run fonts.sh after copy changes).
# Output: output/promo.mp4 (28s, 1920x1080, 30fps).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/footage output
# 1) footage: drop the OBS window (first/last second) and crop away the browser tab bar, address bar and status bar
[ -f out/footage/01275.jpg ] || ffmpeg -y -v error -ss 1.0 -to 43.5 -i source/raw_1307.mp4 \
  -vf "fps=30,crop=1102:620:89:70,unsharp=5:5:0.6" -q:v 2 out/footage/%05d.jpg
# 2) score + picture (16 sub-frame motion blur)
(cd film && python3 score.py ../out/score.wav && node render.mjs video ../out/film.mp4 16)
# 3) mux
ffmpeg -y -v error -f concat -safe 0 -i out/film.mp4.txt -ss 2 -i out/score.wav -map 0:v -map 1:a \
  -c:v libx264 -crf 19 -preset slow -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1 -c:a aac -b:a 192k -ar 48000 -movflags +faststart output/promo.mp4
echo "done -> output/promo.mp4"
# 4) covers: 16:9 and 3:4 (screenshots in film/cover/ come from footage frames 00571 and 00976)
(cd film && node cover.mjs ../output)
echo "done -> output/cover_16x9.png, output/cover_3x4.png"
