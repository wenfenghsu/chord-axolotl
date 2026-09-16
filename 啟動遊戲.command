#!/bin/bash
# 雙擊這個檔案就會開始。會在本機開一個小網頁伺服器（只有這台電腦看得到）。
cd "$(dirname "$0")" || exit 1
PORT=8765
# 如果 8765 被占用就換一個
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "和弦蠑螈 啟動中… http://localhost:$PORT"
echo "（練完把這個視窗關掉就停止）"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
sleep 1
open "http://localhost:$PORT/index.html"
trap "kill $SRV 2>/dev/null" EXIT
wait $SRV
