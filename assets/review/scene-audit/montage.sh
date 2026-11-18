#!/bin/sh
# 每个场景拼 2×2：开局 | 全景障碍图 / 战斗中 | 首领（没有的用黑图）
cd "$(dirname "$0")"
for s in $(ls *-start.png 2>/dev/null | sed 's/-start.png//'); do
  [ -f "montage/$s.jpg" ] && [ "$1" != "-f" ] && continue
  set -- "$s-start.png" "$s-map.png" "$s-fight.png" "$s-boss.png"
  in=""; for f in "$@"; do if [ -f "$f" ]; then in="$in -i $f"; else in="$in -f lavfi -i color=black:s=1280x720"; fi; done
  ffmpeg -loglevel error -y $in -filter_complex "[0]scale=640:360[a];[1]scale=640:360[b];[2]scale=640:360[c];[3]scale=640:360[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack" -q:v 4 "montage/$s.jpg"
done
