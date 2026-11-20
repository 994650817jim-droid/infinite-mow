"""v2 动作图某一行左右镜像（ChatGPT 偶尔把「朝右攻击」画成朝左）：只改处理后的图，原图不动。
用法：py -I tools/flip-action-row.py public/assets/hero-actions-v2/zhangliao.png 2   （行号从 0 起；格 232）
"""
import sys
from PIL import Image, ImageOps
path, row = sys.argv[1], int(sys.argv[2]); C = int(sys.argv[3]) if len(sys.argv) > 3 else 232
im = Image.open(path).convert('RGBA')
for c in range(im.width // C):
    box = (c * C, row * C, (c + 1) * C, (row + 1) * C); im.paste(ImageOps.mirror(im.crop(box)), box)
im.save(path); print('flipped row', row, path)
