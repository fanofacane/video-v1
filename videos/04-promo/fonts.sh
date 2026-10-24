#!/usr/bin/env bash
# Fetch a Noto Sans SC subset (only the characters promo.js uses) from Google Fonts.
set -euo pipefail
cd "$(dirname "$0")/film/fonts"
CHARS=$(python3 -c "import urllib.parse;s=open('../promo.js',encoding='utf-8').read();print(urllib.parse.quote(''.join(sorted(set(c for c in s if ord(c)>127)|set('0123456789+·→?？@ .abcdefghijklmnopqrstuvwxyz/')))))")
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
for w in 500 900; do
  url=$(curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@$w&text=$CHARS" | grep -o 'https://[^)]*' | head -1)
  curl -sS -o nsc-$w.woff2 "$url"
done
ls -la
