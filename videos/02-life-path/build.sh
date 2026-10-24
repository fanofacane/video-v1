#!/usr/bin/env bash
# Episode 02 — build from scratch.  usage: ./build.sh <source-video-with-the-narration.mp4>
# Needs: node + playwright (Chromium), python3 (+ faster-whisper only if tools/asr_raw.json is missing), ffmpeg, curl.
set -euo pipefail
cd "$(dirname "$0")"
SRC=${1:?pass the source video (its voice track is used)}
mkdir -p out output src/fonts

# 0) Noto Serif SC (15 MB each, so not kept in git)
B=https://fonts.gstatic.com/s/notoserifsc/v36/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7
for w in "400 SCqyWv" "600 RcrCWv" "900 QrrCWv"; do
  set -- $w; [ -f src/fonts/serif-$1.ttf ] || curl -sS -o src/fonts/serif-$1.ttf "$B$2.ttf"
done

# 1) per-character timings: speech recognition (cached in tools/asr_raw.json) + corrected script -> src/timeline.js
if [ ! -f tools/asr_raw.json ]; then
  ffmpeg -y -v error -i "$SRC" -vn -ac 1 -ar 16000 out/voice16k.wav
  python3 tools/asr.py out/voice16k.wav medium tools/asr_raw.json
fi
python3 tools/align.py tools/asr_raw.json src/lines.json src/timeline.js

# 2) picture
END=$(python3 -c "import json; print(json.load(open('src/lines.json'))['end'])")
node src/render.mjs video out/full.mp4 0 "$END" 4

# 3) the source's voice + music, faded out at the end, then mux
ffmpeg -y -v error -f concat -safe 0 -i out/full.mp4.txt -t "$END" -i "$SRC" -map 0:v -map 1:a -c:v copy \
  -af "afade=t=out:st=$(python3 -c "print($END-0.9)"):d=0.9,loudnorm=I=-14:TP=-1" -c:a aac -b:a 192k -ar 48000 -shortest \
  -movflags +faststart output/life_path.mp4
echo "done -> output/life_path.mp4"
