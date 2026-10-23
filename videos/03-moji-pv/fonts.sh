#!/usr/bin/env bash
# Re-fetch the Shippori Mincho subset (only the characters the film uses) from Google Fonts.
set -euo pipefail
cd "$(dirname "$0")/film/fonts"
CHARS=$(python3 -c "import re,json,urllib.parse;d=json.loads(re.search(r'=\s*(\[.*\]);',open('../lyrics.js',encoding='utf-8').read(),re.S).group(1));s=''.join(l['text'] for l in d)+'愛してる我愛你嘘壊心？0123456789文字PV、。!?・…「」';print(urllib.parse.quote(''.join(sorted(set(s)))))")
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
for w in 500 800; do
  url=$(curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@$w&text=$CHARS" | grep -o 'https://[^)]*' | head -1)
  curl -sS -o mincho-$w.woff2 "$url"
done
ls -la
