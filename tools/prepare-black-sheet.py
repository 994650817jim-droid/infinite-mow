"""黑底手绘特效整张去底（同 build-hero-fx-rows.mjs 的反解：不透明度 = 最亮通道映射、颜色按不透明度还原，适合 ADD / 普通混合），
按 COLS×ROWS 等分后每格缩进 INSET 再等比放回 CELL，保持整张网格（BranchFinalFx 6×4、每格 256 直接读整张）。
可选 KEEP_ROWS 只保留前几行（ChatGPT 画布比例不合适时，多画一行空行再裁掉）。
用法：py -I tools/prepare-black-sheet.py <原图> <输出.png> [COLS=6] [ROWS=4] [CELL=256] [INSET=8] [KEEP_ROWS=]
  例：py -I tools/prepare-black-sheet.py public/assets/branch-fx/originals/lvbu_gpt.png public/assets/branch-fx/lvbu.png
"""
import sys
import numpy as np
from PIL import Image
src, out, *kv = sys.argv[1:]
opt = dict(a.split('=') for a in kv)
COLS, ROWS, CELL, INSET = int(opt.get('COLS', 6)), int(opt.get('ROWS', 4)), int(opt.get('CELL', 256)), int(opt.get('INSET', 8))
KEEP = int(opt['KEEP_ROWS']) if opt.get('KEEP_ROWS') else ROWS
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
m = im.max(axis=2)
a = np.clip((m - 16) * 255 / 239, 0, 255)
k = np.where(m > 0, 255 / np.maximum(m, 1), 0)[..., None]
rgb = np.clip(im * k, 0, 255)
rgba = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')
W, H = rgba.size; cw, ch = W / COLS, H / ROWS
sheet = Image.new('RGBA', (COLS * CELL, KEEP * CELL), (0, 0, 0, 0))
for r in range(KEEP):
    for c in range(COLS):
        box = (round(c * cw + INSET), round(r * ch + INSET), round((c + 1) * cw - INSET), round((r + 1) * ch - INSET))
        cell = rgba.crop(box); s = min(CELL / cell.width, CELL / cell.height)
        cell = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
        sheet.alpha_composite(cell, (c * CELL + (CELL - cell.width) // 2, r * CELL + (CELL - cell.height) // 2))
sheet.save(out); print(out, sheet.size)
