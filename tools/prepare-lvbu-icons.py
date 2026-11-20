"""吕布图标（2026-11-19 P2，ChatGPT 洋红底 3×2）→ public/assets/upgrade-icons/：
  行 0：weapon_fangtian（本命武器，128）、branch_lb_renzhong / branch_lb_yuanmen（兵器专职，256）
  行 1：chitu / huaji（专属武艺，128）、wushuang（无双狂暴增益，128）
原图 public/assets/upgrade-icons/originals/lvbu_icons_gpt.png；去底同 prepare-branch-icons.py（key_out + unpink）。
用法：py -I tools/prepare-lvbu-icons.py
"""
import importlib.util
spec = importlib.util.spec_from_file_location('sa', 'tools/prepare-school-art.py'); sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
spec2 = importlib.util.spec_from_file_location('bi', 'tools/prepare-branch-icons.py'); bi = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(bi)
O = 'public/assets/upgrade-icons/originals/lvbu_icons_gpt.png'; D = 'public/assets/upgrade-icons/'
CELLS = [('weapon_fangtian', 128), ('branch_lb_renzhong', 256), ('branch_lb_yuanmen', 256), ('chitu', 128), ('huaji', 128), ('wushuang', 128)]
img = bi.unpink(sa.key_out(O, 120, 60))
for (name, size), box in zip(CELLS, sa.grid(img, 3, 2)):
    bi.square(img, box, size=size).save(D + name + '.webp', 'WEBP', quality=90); print(name, size)
