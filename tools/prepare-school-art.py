"""流派重做第 3 期美术整理（2026-11-19，ChatGPT 洋红底原图在 public/assets/schools/originals/）。
- 去底：按实际键色（四角中位色）反解不透明度；约束「还原色不比红更绿」（UNMIX 思路，避免半透明光边发绿），
  暖色特效再加「不偏洋红」（蓝 ≤ w×绿 或 蓝 ≤ 红×.9）。
- 取帧：原图不一定对齐网格 → 按不透明度的行 / 列空隙切出每一帧（先把不透明度模糊一下，散开的火星不会被切碎），按阅读顺序编号。
- 对齐：同一套特效所有帧用同一个正方形边长（按最大帧）、同一缩放；锚点 bottom（火墙、箭雨、骑兵、盾阵）或 center（阵法、冲击波、风带）。
用法：py -I tools/prepare-school-art.py   → public/assets/schools/*.png、public/assets/upgrade-icons/{napalm,gust}.webp
"""
import numpy as np
from PIL import Image, ImageFilter

O = 'public/assets/schools/originals/'
D = 'public/assets/schools/'
NOISE = 14  # 背景洋红的噪点 / 渐变容差（色阶）


def key_out(path, soft=150.0, lightTol=45):
    """离洋红多远就多不透明：dist = max(绿比键色高多少, 红比键色低多少, 蓝比键色低多少)；
    dist ≥ NOISE + soft 完全不透明（青铜、刀枪这些实心物保持原色，不会被反解得发绿），只有贴近洋红的光边 / 烟才半透明，
    半透明像素按该不透明度把洋红反解掉。"""
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    corners = np.concatenate([im[:24, :24].reshape(-1, 3), im[:24, -24:].reshape(-1, 3), im[-24:, :24].reshape(-1, 3), im[-24:, -24:].reshape(-1, 3)])
    K = np.median(corners, axis=0); P = im
    dist = np.maximum.reduce([P[..., 1] - K[1], K[0] - P[..., 0], K[2] - P[..., 2]])
    a = np.clip((dist - NOISE) / soft, 0, 1)
    # 浅色内容（白风、白金光）：红蓝几乎没降，只是绿升了 → 用最小不透明度（还原成白），不然会留粉色
    light = (P[..., 0] > K[0] - lightTol) & (P[..., 2] > K[2] - lightTol)
    amin = np.maximum.reduce([(P[..., 1] - K[1] - NOISE) / max(1.0, 255 - K[1]), (K[0] - P[..., 0]) / max(1.0, K[0]), (K[2] - P[..., 2]) / max(1.0, K[2])])
    a = np.where(light, np.clip(amin, 0, 1), a)
    a[a < .04] = 0
    safe = np.maximum(a, 1e-3)[..., None]
    C = np.clip(K + (P - K) / safe, 0, 255)
    # 低不透明度像素去洋红溢色：红、蓝都不高于「绿 + 两者平均的余量」
    lo = (a < .6)[..., None]
    m = np.minimum(C[..., 0], C[..., 2]); g = C[..., 1]
    spill = np.clip(m - np.maximum(g, (C[..., 0] + C[..., 2]) * .35), 0, None)[..., None] * .6
    C = np.where(lo, C - np.concatenate([spill, np.zeros_like(spill), spill], axis=2), C)
    # 半透明像素不许偏绿 / 青（用户不喜欢青绿色；去洋红后烟、蓝光边容易发青）：绿高于红的部分压到 1/4
    semi = a < .95
    g2 = np.where(semi & (C[..., 1] > C[..., 0]), C[..., 0] + (C[..., 1] - C[..., 0]) * .25, C[..., 1])
    C = np.dstack([C[..., 0], g2, C[..., 2]])
    return Image.fromarray(np.dstack([np.clip(C, 0, 255), a[..., None] * 255]).astype(np.uint8), 'RGBA')


def silver(img):
    """白风：除了暖色（落叶、金色风痕：红 > 绿 > 蓝且红比蓝高 40 以上）以外一律去色成暖白 / 银灰，洗掉去洋红后残留的紫、青。"""
    A = np.asarray(img).astype(np.float32); R, G, B = A[..., 0], A[..., 1], A[..., 2]
    warm = (R >= G) & (G >= B) & (R - B > 40)
    L = R * .3 + G * .59 + B * .11
    for c, k in zip(range(3), (1.0, .98, .93)):
        A[..., c] = np.where(warm, A[..., c], np.clip(L * k + 8, 0, 255))
    return Image.fromarray(A.astype(np.uint8), 'RGBA')


def segments(profile, gap):
    on = profile > 0
    segs, start, empty = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= gap:
                segs.append((start, i - empty + 1)); start = None; empty = 0
    if start is not None:
        segs.append((start, len(on)))
    return segs


def frames(img, blur=10, gap=14, minsize=30):
    alpha = img.getchannel('A').filter(ImageFilter.GaussianBlur(blur))
    A = np.asarray(alpha) > 30
    out = []
    for y0, y1 in segments(A.sum(1), gap):
        if y1 - y0 < minsize:
            continue
        band = A[y0:y1]
        for x0, x1 in segments(band.sum(0), gap):
            if x1 - x0 < minsize:
                continue
            # 收紧到真实不透明区域
            sub = np.asarray(img.getchannel('A'))[y0:y1, x0:x1] > 10
            ys, xs = np.nonzero(sub)
            if not len(xs):
                continue
            out.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1))
    return out


def grid(img, cols, rows):
    """原图对齐网格时：每格内收紧到不透明区域。"""
    A = np.asarray(img.getchannel('A')) > 30
    cw, ch = img.width / cols, img.height / rows; out = []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = int(c * cw), int(r * ch); sub = A[y0:int(y0 + ch), x0:int(x0 + cw)]; ys, xs = np.nonzero(sub)
            out.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1) if len(xs) else (x0, y0, x0 + 4, y0 + 4))
    return out


def sheet(img, boxes, cell, anchor, out, pad=.06):
    side = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
    side = int(side * (1 + 2 * pad))
    strip = Image.new('RGBA', (cell * len(boxes), cell))
    for k, (x0, y0, x1, y1) in enumerate(boxes):
        c = Image.new('RGBA', (side, side))
        fr = img.crop((x0, y0, x1, y1))
        px = (side - (x1 - x0)) // 2
        py = (side - (y1 - y0)) // 2 if anchor == 'center' else side - int(side * pad) - (y1 - y0)
        c.paste(fr, (px, py))
        strip.paste(c.resize((cell, cell), Image.LANCZOS), (k * cell, 0))
    strip.save(D + out, optimize=True)
    print(out, len(boxes), 'frames, side', side)


# 火烧连天 / 八门金锁原图不对齐网格：手量的每帧范围（原图 1448×1086 坐标），再在范围内收紧
MANUAL = {'schools_fx_fire_strat_gpt.png': [(0, 0, 362, 340), (362, 0, 724, 340), (724, 0, 1086, 340), (1086, 0, 1448, 340), (0, 350, 362, 630), (362, 350, 724, 630),
                                            (90, 640, 440, 830), (540, 640, 900, 830), (990, 630, 1410, 840), (30, 840, 470, 1086), (520, 840, 930, 1086), (990, 840, 1420, 1086)]}


def tighten(img, boxes):
    A = np.asarray(img.getchannel('A')) > 30; out = []
    for x0, y0, x1, y1 in boxes:
        ys, xs = np.nonzero(A[y0:y1, x0:x1]); out.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1) if len(xs) else (x0, y0, x1, y1))
    return out


def fx(src, names, anchors, warm):
    img = key_out(O + src)
    boxes = tighten(img, MANUAL[src]) if src in MANUAL else frames(img)
    if len(boxes) != 12:
        boxes = grid(img, 4, 3)  # 散开的箭雨会被切碎：原图本来就对齐网格，按格取
    print(src, len(boxes), 'boxes')
    assert len(boxes) == 12, boxes
    for i, (n, an) in enumerate(zip(names, anchors)):
        sheet(img, boxes[i * 6:i * 6 + 6], 256, an, 'awaken_%s.png' % n)


if __name__ == '__main__':
    fx('schools_fx_fire_strat_gpt.png', ['fire', 'stratagem'], ['bottom', 'center'], 0)
    fx('schools_fx_arch_cav_gpt.png', ['archery', 'cavalry'], ['bottom', 'bottom'], .9)
    fx('schools_fx_war_form_gpt.png', ['warrior', 'formation'], ['center', 'bottom'], .9)
    wind = silver(key_out(O + 'schools_wind_gpt.png'))
    wb = grid(wind, 3, 2)
    # 风带：同一宽度、垂直居中，输出 512×192 一帧的横长条（显示时横向拉长）
    side_w = max(b[2] - b[0] for b in wb); side_h = max(b[3] - b[1] for b in wb)
    W, H = 512, 192; sc = min(W / (side_w * 1.04), H / (side_h * 1.1))
    strip = Image.new('RGBA', (W * 6, H))
    for k, (x0, y0, x1, y1) in enumerate(wb):
        fr = wind.crop((x0, y0, x1, y1)); fr = fr.resize((max(1, int(fr.width * sc)), max(1, int(fr.height * sc))), Image.LANCZOS)
        # 横向：保持原图里的左右位置（风头在右、先出现左半）——以原格子为参照
        cell_w = wind.width / 3; cx0 = (k % 3) * cell_w
        x = int(((x0 - cx0) / cell_w) * W * .98); strip.paste(fr, (k * W + max(0, min(W - fr.width, x)), (H - fr.height) // 2), fr)
    strip.save(D + 'gust_band.png', optimize=True); print('gust_band.png')
    # 图标：4×2，每格抠出、裁边、方形留白、128
    icons = key_out(O + 'schools_icons_gpt.png', 90, 80)
    ib = frames(icons, blur=6, gap=10, minsize=80)
    print('icons', len(ib)); assert len(ib) == 8, ib
    names = ['seal_fire', 'seal_stratagem', 'seal_archery', 'seal_cavalry', 'seal_warrior', 'seal_formation', 'napalm', 'gust']
    for n, (x0, y0, x1, y1) in zip(names, ib):
        fr = icons.crop((x0, y0, x1, y1)); s = int(max(fr.size) * 1.04)
        c = Image.new('RGBA', (s, s)); c.paste(fr, ((s - fr.width) // 2, (s - fr.height) // 2))
        if n == 'gust':
            c = silver(c)
        if n.startswith('seal_'):
            c.resize((160, 160), Image.LANCZOS).save(D + n + '.png', optimize=True)
        else:
            c.resize((128, 128), Image.LANCZOS).save('public/assets/upgrade-icons/%s.webp' % n, quality=92)
    # 横幅：上下两条，抠出后按不透明区域裁边
    ban = key_out(O + 'schools_banner_gpt.png', 90)
    bb = frames(ban, blur=8, gap=20, minsize=80)
    print('banners', len(bb)); assert len(bb) == 2, bb
    for n, b in zip(['banner_combo', 'banner_awaken'], bb):
        fr = ban.crop(b); fr = fr.resize((1024, int(fr.height * 1024 / fr.width)), Image.LANCZOS); fr.save(D + n + '.png', optimize=True); print(n, fr.size)
