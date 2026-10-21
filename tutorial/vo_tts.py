"""Generate narration clips with MiniMax TTS. Key comes from env MINIMAX_API_KEY (never stored in the repo).
usage: python3 vo_tts.py vo_script.json vo/ [voice_id]"""
import json, os, sys, subprocess, urllib.request, wave, numpy as np
KEY = os.environ['MINIMAX_API_KEY']
script, outdir = json.load(open(sys.argv[1])), sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'Chinese_worker_male'
only = set(os.environ.get('ONLY', '').split(',')) - {''}
def tts(text, speed):
    body = {"model": "speech-2.8-hd", "text": text, "stream": False,
            "voice_setting": {"voice_id": voice, "speed": speed, "vol": 1, "pitch": 0},
            "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1}, "subtitle_enable": False}
    req = urllib.request.Request('https://api.minimax.cn/v1/t2a_v2', json.dumps(body).encode(),
                                 {'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    assert d['base_resp']['status_code'] == 0, d['base_resp']
    return bytes.fromhex(d['data']['audio']), d['extra_info']['audio_length'] / 1000
def squeeze(path, maxgap=0.2, edge=0.04):
    """trim lead/tail silence and shorten long pauses so lines fit their slots"""
    w = wave.open(path); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float); w.close()
    h = sr // 100; n = len(x) // h; rms = np.sqrt((x[:n * h].reshape(n, h) ** 2).mean(1)) / 32768
    loud = rms > 10 ** (-40 / 20); keep = np.ones(n, bool); i = 0
    first, last = np.argmax(loud), n - np.argmax(loud[::-1])
    keep[:max(0, first - int(edge * 100))] = False; keep[last + int(edge * 100):] = False
    while i < n:
        if not loud[i] and first < i < last:
            j = i
            while j < n and not loud[j]: j += 1
            g = int(maxgap * 100)
            if j - i > g: keep[i + g // 2: j - g // 2] = False
            i = j
        else: i += 1
    y = x[:n * h].reshape(n, h)[keep].ravel()
    with wave.open(path, 'wb') as o: o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(y.astype('<i2').tobytes())
    return len(y) / sr
for c in script:
    if only and c['id'] not in only: continue
    slot = c['end'] - c['at']; speed = c.get('speed', 1.2)
    mp3, dur = tts(c['text'], speed)
    p = os.path.join(outdir, c['id'] + '.mp3'); open(p, 'wb').write(mp3)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-ar', '48000', '-ac', '1', p[:-4] + '.wav'], check=True)
    dur = squeeze(p[:-4] + '.wav')
    print(c['id'], f'speed={speed} dur={dur:.2f} slot={slot:.2f}', 'OVER' if dur > slot else '')
