"""P2 武将图标通用切图（同 prepare-lvbu-icons.py）：ChatGPT 洋红底 COLS×ROWS → public/assets/upgrade-icons/<名字>.webp。
去底：tools/prepare-school-art.py 的 key_out + prepare-branch-icons.py 的 unpink；每格按内容裁边、等比居中。
用法：py -I tools/prepare-hero-icons.py <原图> <列> <行> <名字:边长> ...（按阅读顺序；名字写 skip 跳过）
  例：py -I tools/prepare-hero-icons.py public/assets/upgrade-icons/originals/zhangliao_icons_gpt.png 3 2 weapon_pozhen:128 branch_zl_shiwan:256 branch_zl_xiaoyao:256 xiandeng:128 weiming:128 skip:0
"""
import importlib.util, sys
spec = importlib.util.spec_from_file_location('sa', 'tools/prepare-school-art.py'); sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
spec2 = importlib.util.spec_from_file_location('bi', 'tools/prepare-branch-icons.py'); bi = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(bi)
src, cols, rows, *cells = sys.argv[1:]
img = bi.unpink(sa.key_out(src, 120, 60))
for cell, box in zip(cells, sa.grid(img, int(cols), int(rows))):
    name, size = cell.split(':')
    if name == 'skip': continue
    bi.square(img, box, size=int(size)).save('public/assets/upgrade-icons/' + name + '.webp', 'WEBP', quality=90); print(name, size)
