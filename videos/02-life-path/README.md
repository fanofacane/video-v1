# 02 · 人与人的路（制作中）

纯文字视频：语音和逐字稿来自参考视频二，呈现方式参考视频一（黑底、主句打字、周围句子逐渐铺满成文字墙）。
每个字在被念到的那一刻出现，时间来自语音识别（`tools/asr.py`）+ 校对后的逐字稿（`src/lines.json`）。

| 路径 | 内容 |
|---|---|
| `src/lines.json` | 校对后的逐字稿 + 每句在画面中的位置、字号、高亮词 |
| `tools/asr.py` / `tools/asr_raw.json` | faster-whisper 识别结果（逐字时间） |
| `tools/align.py` | 把逐字稿对齐到语音时间，生成 `src/timeline.js` |
| `src/index.html` `src/film.js` | 画面 |
| `src/render.mjs` | 逐帧渲染 |
