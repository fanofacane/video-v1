#!/usr/bin/env bash
# Episode 01 — build everything from scratch.
# Needs: node + playwright (Chromium), python3 + numpy, ffmpeg, curl.
# Output: output/type_in_motion.mp4 (30s film) and output/jianying_making_of.mp4 (34.1s published cut).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out output

# 0) Noto Sans SC for the editing-app UI (10 MB each, so not kept in git)
NSC=https://fonts.gstatic.com/s/notosanssc/v41/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG
for w in "400 9_FnYw" "500 -3FnYw" "700 zjCnYw"; do
  set -- $w; [ -f intro/fonts/nsc-$1.ttf ] || curl -sS -o intro/fonts/nsc-$1.ttf "$NSC$2.ttf"
done

# 1) the 30s film: score + 16-subframe motion-blur render
(cd film && python3 score.py ../out/score.wav && node render.mjs video ../out/film.mp4 16)
ffmpeg -y -v error -f concat -safe 0 -i out/film.mp4.txt -i out/score.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-14:TP=-1 -c:a aac -b:a 192k -ar 48000 -movflags +faststart output/type_in_motion.mp4

# 2) frames the editing-app intro shows: player-size frames, full-res first 160, 1 thumbnail per second
F=output/type_in_motion.mp4
mkdir -p intro/fs intro/fh intro/th
ffmpeg -y -v error -i $F -vf scale=832:468 -q:v 3 intro/fs/%04d.jpg
ffmpeg -y -v error -i $F -frames:v 160 -q:v 2 intro/fh/%04d.jpg
ffmpeg -y -v error -ss 0.5 -i $F -vf fps=1,scale=192:108 -frames:v 30 -q:v 3 intro/th/%02d.jpg
ffmpeg -y -v error -i $F -vn -ac 2 -ar 48000 -c:a pcm_s16le out/film.wav

# 3) the intro (288 frames) and its sound, then hand off to the film at frame 165
(cd intro && node render.mjs intro ../out/intro.mp4 && python3 foley.py ../out/film.wav ../out/full.wav)
ffmpeg -y -v error -i out/intro.mp4 -i $F -i out/full.wav \
  -filter_complex "[1:v]trim=start_frame=165,setpts=PTS-STARTPTS[f];[0:v][f]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -map 2:a -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  output/jianying_making_of.mp4
echo "done -> output/"
