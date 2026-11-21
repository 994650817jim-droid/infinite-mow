"""军阵二期美术（formation-design.md §8；即梦 Seedream 5.5，用户经统筹批准）：
- 阵纹 3×2 黑底 → public/assets/formation/sigils.webp（每格 512，按亮度做透明；顺序 方圆 / 锋矢 / 鹤翼 / 雁行 / 长蛇 / 八阵 = data/formations.ts FORMATION_IDS）
  （由 tools/prepare-black-sheet.py 出：py -I tools/prepare-black-sheet.py <原图> sigils.png COLS=3 ROWS=2 CELL=512 INSET=12，再转 webp）
- 阵旗图标 3×2 品红底 → public/assets/formation/icons.webp（每格 256，顺序同上）
用法：py -I tools/prepare-formation-art.py
"""
import importlib.util, numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('sa', 'tools/prepare-school-art.py'); sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
O = 'public/assets/formation/originals/raw/'; D = 'public/assets/formation/'


def unpink(img):
    """光晕里残留的洋红：min(红, 蓝) 比绿高很多的像素按程度降不透明度、把蓝拉回去（同 prepare-branch-icons）。"""
    a = np.asarray(img).astype(np.float32); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    tint = np.clip(np.minimum(R, B) - G - 40, 0, None); k = np.clip(1 - tint / 60, 0, 1)
    a[..., 3] = A * k; a[..., 2] = np.where(tint > 0, np.minimum(B, G + (R - G) * .5 + 10), B); return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


img = unpink(sa.key_out(O + 'icons_jimeng.png', soft=45.0))  # 古铜暗部离洋红不远：soft 收紧，实心处全不透明，免得反解得发绿
boxes = sa.grid(img, 3, 2)
CELL = 256; side = int(max(max(b[2] - b[0], b[3] - b[1]) for b in boxes) * 1.06)
out = Image.new('RGBA', (CELL * 3, CELL * 2))
for k, (x0, y0, x1, y1) in enumerate(boxes):
    c = Image.new('RGBA', (side, side)); fr = img.crop((x0, y0, x1, y1)); c.paste(fr, ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
    out.paste(c.resize((CELL, CELL), Image.LANCZOS), ((k % 3) * CELL, (k // 3) * CELL))
# 不另存整张，只出下面的单个图标
print('icons', out.size, 'side', side)
# 单个图标（增益条 / 布阵页按贴图键取：formation_icon_<阵 id>）
for k, fid in enumerate(['circle', 'wedge', 'crane', 'geese', 'snake', 'bazhen']):
    out.crop(((k % 3) * CELL, (k // 3) * CELL, (k % 3 + 1) * CELL, (k // 3 + 1) * CELL)).resize((160, 160), Image.LANCZOS).save(D + f'icon_{fid}.webp', 'WEBP', quality=90, method=6)
print('icon_<id>.webp × 6')
