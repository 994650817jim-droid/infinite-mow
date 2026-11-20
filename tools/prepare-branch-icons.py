"""兵器专职分支卡面图标（wave-progression-redesign.md §4.7）：ChatGPT 洋红底 4×3 两张 → public/assets/upgrade-icons/branch_<分支 id>.webp（256×256）。
原图放 public/assets/upgrade-icons/originals/branch_icons_{1,2}_gpt.png；去底用 tools/prepare-school-art.py 的 key_out，再把洋红溢色（光晕里的紫边）压掉。
用法：py -I tools/prepare-branch-icons.py
"""
import importlib.util, numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('sa', 'tools/prepare-school-art.py'); sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
O = 'public/assets/upgrade-icons/originals/'; D = 'public/assets/upgrade-icons/'
SHEETS = {
    'branch_icons_1_gpt.png': ['zy_longdan', 'zy_bainiao', 'gy_qinglong', 'gy_danqi', 'zf_duanqiao', 'zf_nuhou', 'lb_rende', 'lb_sanying', 'zg_liaoyuan', 'zg_bazhen', 'hz_chuanyang', 'hz_huoshi'],
    'branch_icons_2_gpt.png': ['mc_tieqi', 'mc_weishui', 'wy_ziwu', 'wy_hanzhong', 'pt_lianying', 'pt_lianhuan', 'hy_liannu', 'hy_muniu', 'ss_wanren', 'ss_benxi', 'dc_biyue', 'dc_meirenji'],
}


def unpink(img):
    """光晕里残留的洋红：min(红, 蓝) 比绿高很多的像素按程度降不透明度、把蓝拉回去（同 prepare-route-art）。"""
    a = np.asarray(img).astype(np.float32); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    tint = np.clip(np.minimum(R, B) - G - 40, 0, None); k = np.clip(1 - tint / 60, 0, 1)
    a[..., 3] = A * k; a[..., 2] = np.where(tint > 0, np.minimum(B, G + (R - G) * .5 + 10), B); return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def square(img, box, size=256, pad=.06):
    x0, y0, x1, y1 = box; fr = img.crop((x0, y0, x1, y1)); w, h = fr.size; side = int(max(w, h) * (1 + pad * 2))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0)); out.alpha_composite(fr, ((side - w) // 2, (side - h) // 2)); return out.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    import os
    for f, names in SHEETS.items():
        if not os.path.exists(O + f): print('skip (missing)', f); continue
        img = unpink(sa.key_out(O + f, 120, 60))
        for n, b in zip(names, sa.grid(img, 4, 3)):
            square(img, b).save(D + 'branch_' + n + '.webp', 'WEBP', quality=90); print('branch_' + n)
