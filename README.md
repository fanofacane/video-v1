# Claude Monet — *Impression*

A 30-second procedural motion piece introducing Claude Monet and Impressionism.
No footage or scanned paintings are used: every frame is painted live from
~8,000 brushstrokes that sample a hidden reference image, paint themselves in,
"boil" on twos, and carry broken color (violet shadows, warm lights).

| Time | Chapter | Scene |
|---|---|---|
| 0–8s | I · Impression | One stroke of orange becomes the sun of *Impression, soleil levant* (1872) |
| 8–13.6s | II · The Series | *Les Meules*: one haystack cycles dawn → noon → dusk → winter |
| 13.6–18.8s | III · The Garden | *Le Pont japonais*, Giverny |
| 18.8–24.2s | IV · The Water | *Nymphéas*: drifting lily pads, sky reflections |
| 24.2–30s | Title | Claude Monet, 1840–1926 |

The score (Debussy-style extended chords, piano arpeggios, brush whooshes on
every repaint) is synthesized in `audio.py` and timed to the cuts.

## Files
- `index.html` + `monet.js` — the renderer. Open `index.html` in a browser to watch it live (`?t=18` to jump).
- `render.mjs` — deterministic frame capture with Playwright, piped to ffmpeg.
- `audio.py` — score synthesis (numpy).
- `build.sh` — full build → `monet.mp4`.
- `fonts/` — Cormorant Garamond (SIL Open Font License).
