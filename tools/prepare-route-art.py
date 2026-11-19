"""天下地图 v2（征途路线图）美术整理：ChatGPT 洋红底原图 public/assets/world/route/originals/ → public/assets/world/route/*.png。
去底用 tools/prepare-school-art.py 的 key_out（离洋红越远越不透明，实心物不发绿）。
- route_nodes_gpt.png（4×3）：主线圆章 可打 / 告捷 / 未开、首领圆章；敌城 / 我城 / 告急城 / 营寨；军情令旗 / 挑战令旗 / 下一战大旗 / 乱世金印
- route_paths_gpt.png：已走的路 / 未走的路 / 支线小路（各一条横长笔触，拉直成水平带，游戏里用 Rope 沿曲线弯）+ 脚印 ×3 / 小旗 ×2 / 笔头 / 朱砂溅点
- route_fog_gpt.png：大云海、竖云墙、4 朵单云、3 帧墨散
用法：py -I tools/prepare-route-art.py
"""
import importlib.util, numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('sa', 'tools/prepare-school-art.py'); sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
O = 'public/assets/world/route/originals/'; D = 'public/assets/world/route/'


def save(img, box, name, pad=4):
    x0, y0, x1, y1 = box; fr = img.crop((max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad)); fr.save(D + name + '.png', optimize=True); return fr.size


def nodes():
    img = sa.key_out(O + 'route_nodes_gpt.png', 90, 80)
    names = ['medal_open', 'medal_cleared', 'medal_locked', 'medal_boss', 'city_enemy', 'city_own', 'city_alert', 'camp', 'pennant_intel', 'pennant_challenge', 'banner_next', 'seal_hard']
    for n, b in zip(names, sa.grid(img, 4, 3)): print(n, save(img, b, n))


def straighten(strip):
    """横长笔触拉直：每一列按不透明度重心上下平移到同一高度。"""
    a = np.asarray(strip).astype(np.float32); A = a[..., 3]; h, w = A.shape; ys = np.arange(h)[:, None]
    cy = (A * ys).sum(0) / np.maximum(A.sum(0), 1e-3); band = int(np.percentile([(A[:, x] > 30).sum() for x in range(w) if A[:, x].max() > 30], 90)) + 8
    out = np.zeros((band, w, 4), np.float32)
    for x in range(w):
        if A[:, x].max() < 10: continue
        c = int(round(cy[x])); top = c - band // 2
        for y in range(band):
            sy = top + y
            if 0 <= sy < h: out[y, x] = a[sy, x]
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


# 原图不规则：手量的范围（原图坐标），再在范围内收紧
PATH_BOXES = {'road_done': (10, 230, 1076, 410), 'road_todo': (30, 545, 1060, 640), 'road_branch': (20, 780, 1060, 860),
              'foot_1': (35, 1050, 150, 1160), 'foot_2': (185, 1050, 300, 1160), 'foot_3': (330, 1050, 440, 1160), 'flag_1': (495, 1015, 630, 1190), 'flag_2': (635, 1015, 770, 1190), 'brush': (755, 1000, 915, 1190), 'splat': (930, 1035, 1060, 1160)}
FOG_BOXES = {'cloud_sea': (15, 30, 1115, 485), 'cloud_wall': (1095, 5, 1530, 495), 'cloud_a': (15, 510, 515, 700), 'cloud_b': (530, 510, 905, 700), 'cloud_c': (910, 545, 1215, 670), 'cloud_d': (1250, 580, 1520, 650),
             'disperse_0': (15, 730, 495, 990), 'disperse_1': (535, 750, 1000, 990), 'disperse_2': (1060, 760, 1520, 950)}


def unpink(img):
    """云雾、路线：去掉洋红溢色（min(红,蓝) 比绿高的像素按程度降不透明度、往暖灰拉）。节点图不用（紫红战旗会被误杀）。"""
    a = np.asarray(img).astype(np.float32); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    tint = np.clip(np.minimum(R, B) - G, 0, None); k = np.clip(1 - tint / 45, 0, 1)
    a[..., 3] = A * k; a[..., 2] = np.minimum(np.minimum(B, G + (R - G) * .5 + 10), G - 6); return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def cut(img, boxes):
    for n, b in boxes.items():
        t = sa.tighten(img, [b])[0] if hasattr(sa, 'tighten') else b
        fr = img.crop(t)
        if n.startswith('road_'): fr = straighten(fr)
        fr.save(D + n + '.png', optimize=True); print(n, fr.size)


def paths(): cut(unpink(sa.key_out(O + 'route_paths_gpt.png', 120)), PATH_BOXES)


def fog(): cut(unpink(sa.key_out(O + 'route_fog_gpt.png', 150)), FOG_BOXES)


if __name__ == '__main__':
    nodes(); paths(); fog()


def base():
    """简化底图：现有宏大舆图（grand/overview + 3×3 分块）压低饱和、轻柔化、铺一层宣纸色，地理坐标完全不变。"""
    from PIL import ImageFilter, ImageEnhance
    G = 'public/assets/world/grand/'
    def calm(im, blur):
        im = im.convert('RGB').filter(ImageFilter.GaussianBlur(blur)); im = ImageEnhance.Color(im).enhance(.55); im = ImageEnhance.Contrast(im).enhance(.92)
        return Image.blend(im, Image.new('RGB', im.size, (236, 224, 194)), .2)
    calm(Image.open(G + 'overview.webp'), 1.0).save(D + 'base_overview.webp', quality=84); print('base_overview')
    for r in range(3):
        for c in range(3): calm(Image.open(G + f'tile_{r}_{c}.webp'), 2.2).save(D + f'base_tile_{r}_{c}.webp', quality=82)
    print('base tiles')


if __name__ == '__main__' and 'base' in __import__('sys').argv: base()
