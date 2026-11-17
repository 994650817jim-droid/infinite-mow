#!/usr/bin/env bash
# 首领公共预警 / 攻击特效手绘版（用户 2026-11-16「整套换手绘」）：洋红底原图 → 反混合 → 按原 warn-fx 版式切帧。
# 原图：public/assets/warn-fx/originals/handpainted/<kind>.png（ChatGPT 出图，下载名 dsh_content_wfx_<kind>.png）
# 输出：public/assets/warn-fx/handpainted/<kind>.png，版式与 public/assets/warn-fx/<kind>.png 相同，可直接替换。
# 用法：bash tools/prepare-warn-fx-handpainted.sh
set -e
W=public/assets/warn-fx; O=$W/originals/handpainted; T=${TMPDIR:-/tmp}/wfx-hp; mkdir -p "$T" "$W/handpainted"
un() { node tools/unmix-magenta.mjs "$1" "$2" "$3" >/dev/null; }
for k in fire slam lubu; do un "$O/$k.png" "$T/$k.png" 0.7; node tools/prepare-warn-fx.mjs "$T/$k.png" "$W/handpainted/$k.png" 6 256 3 grid >/dev/null; done
un "$O/arrows.png" "$T/arrows.png" 0.8; node tools/prepare-warn-fx.mjs "$T/arrows.png" "$W/handpainted/arrows.png" 6 256 3 grid >/dev/null
un "$O/sweep.png" "$T/sweep.png" 0.85; node tools/prepare-warn-fx.mjs "$T/sweep.png" "$W/handpainted/sweep.png" 6 256x340 3 grid >/dev/null
# 天雷：乌云偏紫、符环紫金、雷光金白，三行分开反混合
ffmpeg -y -loglevel error -i "$O/lightning.png" -vf crop=1536:341:0:0 "$T/l1.png"
ffmpeg -y -loglevel error -i "$O/lightning.png" -vf crop=1536:341:0:341 "$T/l2.png"
ffmpeg -y -loglevel error -i "$O/lightning.png" -vf crop=1536:342:0:682 "$T/l3.png"
un "$T/l1.png" "$T/ul1.png" 1.3; un "$T/l2.png" "$T/ul2.png" 1.1; un "$T/l3.png" "$T/ul3.png" 0.85
ffmpeg -y -loglevel error -i "$T/ul1.png" -i "$T/ul2.png" -i "$T/ul3.png" -filter_complex vstack=3 "$T/lightning.png"
node tools/prepare-warn-fx.mjs "$T/lightning.png" "$W/handpainted/lightning.png" 6 256 3 grid >/dev/null
ffmpeg -y -loglevel error -i "$O/rift.png" -vf crop=1400:1024:62:0 "$T/rift_c.png"; ffmpeg -y -loglevel error -i "$O/charge.png" -vf crop=1440:1024:40:0 "$T/charge_c.png"  # 去掉左右留白，让长条贯穿整格
for k in rift charge; do un "$T/${k}_c.png" "$T/$k.png" 0.7; node tools/prepare-warn-fx.mjs "$T/$k.png" "$W/handpainted/$k.png" 1 1024x160 6 grid >/dev/null; done
ls -la "$W/handpainted"
