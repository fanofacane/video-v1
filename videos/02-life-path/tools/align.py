"""Give every displayed character the time it is spoken.
The corrected script and the ASR output have the same number of Han characters (fixes are 1:1 substitutions),
so characters are matched in order. Punctuation inherits the previous character's time.
usage: python3 tools/align.py tools/asr_raw.json src/lines.json src/timeline.js"""
import json, re, sys
han = lambda c: bool(re.match(r'[一-鿿]', c))
asr = []
for s in json.load(open(sys.argv[1])):
    for a, b, w in s['words']:
        cs = [c for c in w if han(c)]
        for i, c in enumerate(cs): asr.append((c, a + (b - a) * i / len(cs), a + (b - a) * (i + 1) / len(cs)))
spec = json.load(open(sys.argv[2])); k = 0; out = []
for ln in spec['lines']:
    ts = []
    for c in ln['text']:
        if han(c):
            ts.append([round(asr[k][1], 3), round(asr[k][2], 3)])
            if asr[k][0] != c: print(f'fix: {asr[k][0]} -> {c} @ {asr[k][1]:.2f}s')
            k += 1
        else: ts.append(list(ts[-1]) if ts else [0, 0])
    out.append({**ln, 't': ts})
open(sys.argv[3], 'w').write('window.END = ' + json.dumps(spec['end']) + ';\nwindow.LINES = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print('lines', len(out), 'chars used', k, 'of', len(asr))
