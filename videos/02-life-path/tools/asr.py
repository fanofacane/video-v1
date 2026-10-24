import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[2], device='cpu', compute_type='int8')
import wave, numpy as np
w = wave.open(sys.argv[1]); audio = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768
segs, info = m.transcribe(audio, language='zh', word_timestamps=True, vad_filter=True,
                          initial_prompt='以下是普通话的句子，使用简体中文。')
out = []
for s in segs:
    out.append({'start': s.start, 'end': s.end, 'text': s.text, 'words': [[w.start, w.end, w.word] for w in s.words]})
    print(f'{s.start:6.2f}-{s.end:6.2f} {s.text}', flush=True)
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
