#!/usr/bin/env bash
# Renders monet.mp4: frames (Playwright + Chromium) -> H.264, score (numpy) -> AAC.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
node render.mjs video out/monet_v.mp4 "${WORKERS:-4}"
python3 audio.py out/score.wav
ffmpeg -y -loglevel error -f concat -safe 0 -i out/monet_v.mp4.txt -i out/score.wav \
  -c:v libx264 -preset slow -crf 23 -tune grain -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -af loudnorm=I=-16:TP=-1.5:LRA=7 -c:a aac -b:a 192k -ar 48000 -shortest monet.mp4
rm -f out/monet_v.seg*.mp4 out/monet_v.mp4.txt
echo "done: monet.mp4"
