"""P3 第二批可玩武将（2026-11-20）：用现成的首领 / 随军 v2 图拼可玩武将的行走 4×4（176 格）与动作 4×7（232 格），不出新图。
首领 v2（4×8，每格 288）：行 0–3 行走 下 / 左 / 右 / 上；行 4 出招、行 5 横扫、行 6 施法（前 3 格）+ 受伤跪地（第 4 格）、行 7 倒地。
随军 v2（典韦）：行走 4×4 + 攻击 4×4（行 0 正面举戟、行 1 / 2 侧面、行 3 背面），没有受伤 / 倒地。
动作 4×7（data/heroActions.ts fullSet 的帧序）：行 0 待机、行 1–3 出招 下 / 右 / 上、行 4 招牌技、行 5 受伤 ×2 + 胜利 ×2、行 6 倒地；
缺的行留空，代码里那位武将只登记有的动作（heroActions.ts partialSet）。只做整格等比缩放，人物比例不动（引擎按实测人物高度对齐动作帧与行走帧）。
用法：py -I tools/boss-to-hero-sheets.py <id> boss <首领图>            （例：ganning boss public/assets/bosses-v2/side_ganning.png）
      py -I tools/boss-to-hero-sheets.py <id> ally <行走图> <攻击图>   （例：dianwei ally public/assets/allies-v2/dianwei_walk.png public/assets/allies-v2/dianwei_attack.png）
可选环境变量 DIE=0（倒地行不可用，如祝融第 8 行是背面）。
"""
import os
import sys
from PIL import Image

hid, kind, *srcs = sys.argv[1:]
W, A = 176, 232
die_ok = os.environ.get('DIE', '1') != '0'


def cells(path, cell, rows):
    im = Image.open(path).convert('RGBA')
    return [[im.crop((c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)) for c in range(4)] for r in range(rows)]


if kind == 'boss':
    g = cells(srcs[0], 288, 8)
    walk = g[0:4]
    idle = [g[0][0]] * 4
    atk_down, atk_right, atk_up = g[4], g[4], g[5]
    skill = [g[6][0], g[6][1], g[6][2], g[6][2]]
    row5 = [g[6][3], g[6][3], g[6][0], g[6][1]]  # 受伤（跪地）×2 + 胜利（举兵器）×2
    die = g[7] if die_ok else None
else:
    wg = cells(srcs[0], 288, 4)
    ag = cells(srcs[1], 288, 4)
    walk = wg
    idle = [wg[0][0]] * 4
    atk_down, atk_right, atk_up = ag[0], ag[1], ag[3]
    skill = ag[0]
    row5 = None
    die = None

walk_sheet = Image.new('RGBA', (4 * W, 4 * W), (0, 0, 0, 0))
for r in range(4):
    for c in range(4):
        walk_sheet.alpha_composite(walk[r][c].resize((W, W), Image.LANCZOS), (c * W, r * W))

act = Image.new('RGBA', (4 * A, 7 * A), (0, 0, 0, 0))
rows = [idle, atk_down, atk_right, atk_up, skill, row5, die]
for r, row in enumerate(rows):
    if row is None:
        continue
    for c in range(4):
        act.alpha_composite(row[c].resize((A, A), Image.LANCZOS), (c * A, r * A))

os.makedirs('public/assets/processed-v2', exist_ok=True)
os.makedirs('public/assets/hero-actions-v2', exist_ok=True)
walk_sheet.save(f'public/assets/processed-v2/{hid}_walk_sheet.png', optimize=True)
act.save(f'public/assets/hero-actions-v2/{hid}.png', optimize=True)
print(hid, 'walk', walk_sheet.size, 'actions', act.size, 'rows', [r is not None for r in rows])
