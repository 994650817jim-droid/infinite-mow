"""舆图手绘图标：把 ChatGPT 出的两张透明底图标表（public/assets/ui/originals/map_icons_{terrain,markers}_gpt.webp）切开、缩小，
打成一张图集 public/assets/ui/map_icons.png + Phaser 图集 JSON（map_icons.json，帧名见下）。
用法：py -I tools/build-map-icons.py
"""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'ui')
SHEETS = [
    ('originals/map_icons_terrain_gpt.webp', 4, 3, ['mountains', 'hill', 'forest', 'tree', 'river', 'bridge', 'wall', 'gate', 'city', 'village', 'fields', 'tent']),
    ('originals/map_icons_markers_gpt.webp', 4, 4, ['camp', 'banner', 'enemy', 'ally', 'seal', 'elite', 'flag', 'point', 'supply', 'arrowhead', 'compass', 'scale', 'cartouche', 'legendbox', 'brusharrow', 'corner']),
]
SCALE = .5          # 原图每格约 380 像素，地图上显示 20–70 像素（电脑布局再 ×2）：缩一半够清楚
BIG = {'cartouche': .7, 'legendbox': .7}  # 题签 / 图例框会被拉大，留多一点像素
PAD = 3

pieces = []
for path, cols, rows, names in SHEETS:
    im = Image.open(os.path.join(ROOT, path)).convert('RGBA'); W, H = im.size; cw, ch = W / cols, H / rows
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        cell = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        a = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0); bb = a.getbbox()
        piece = cell.crop(bb)
        k = BIG.get(name, SCALE); piece = piece.resize((max(1, round(piece.width * k)), max(1, round(piece.height * k))), Image.LANCZOS)
        pieces.append((name, piece))

# 简单的行打包（宽 1024）
SW = 1024; x = y = rowh = 0; placed = []
for name, p in sorted(pieces, key=lambda t: -t[1].height):
    if x + p.width + PAD > SW: x = 0; y += rowh + PAD; rowh = 0
    placed.append((name, p, x, y)); x += p.width + PAD; rowh = max(rowh, p.height)
SH = y + rowh
sheet = Image.new('RGBA', (SW, SH), (0, 0, 0, 0)); frames = {}
for name, p, px, py in placed:
    sheet.alpha_composite(p, (px, py))
    frames[name] = {'frame': {'x': px, 'y': py, 'w': p.width, 'h': p.height}, 'rotated': False, 'trimmed': False,
                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': p.width, 'h': p.height}, 'sourceSize': {'w': p.width, 'h': p.height}}
sheet.save(os.path.join(ROOT, 'map_icons.png'), optimize=True)
with open(os.path.join(ROOT, 'map_icons.json'), 'w', encoding='utf-8') as f:
    json.dump({'frames': frames, 'meta': {'image': 'map_icons.png', 'size': {'w': SW, 'h': SH}, 'scale': '1'}}, f, ensure_ascii=False, indent=0)
print('sheet', SW, SH, {n: (p.width, p.height) for n, p, _, _ in placed})
