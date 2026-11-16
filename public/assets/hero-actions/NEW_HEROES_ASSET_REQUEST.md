# 新女将素材：孙尚香（吴）、貂蝉（群雄）

## 已到位（2026-11-15，ChatGPT「三国开发讨论」生成，用户授权）

| 用途 | 运行时文件 | 原图（洋红底） |
| --- | --- | --- |
| 立绘 512×512 | `public/assets/processed/<id>_portrait.png` | `originals/<id>_portrait.png` |
| 行走图 4×4、192 帧（768×768） | `public/assets/processed/<id>_walk_sheet.png` | `originals/<id>_walk.png` |
| 动作图 4×7、256 帧（1024×1792） | `public/assets/hero-actions/<id>.png` | `originals/<id>_actions.png` |

处理方式（`tools/` 不入库）：
- **行走图 / 动作图**：同 `export-hero-hd.mjs`，即 `reslice-magenta-sheet.mjs <原图> <输出> 4 4 192 184` 和 `4 7 256 228`。按连通区域切出人物，统一缩放，脚底对齐脚线；显示比例与锚点规范和九将高清化一致。
- **貂蝉**：衣裙本身是粉紫色，普通洋红抠图会把裙子抠成半透明。所以改用 `reslice-magenta-strict.mjs`：只把接近纯 #FF00FF 的像素当背景，只给与背景相邻的边缘像素去色溢。
- **立绘**：`prepare-heroine-portrait.mjs`，用严格抠图，人物外框缩到 480 内、居中、脚底贴 y=500。

已知小瑕疵：孙尚香动作图第 4 行（背面射箭）和第 7 行（倒地）的弓形略像弩。原尺寸看得出，战斗里人物约 80 像素高，不明显；需要时可单独重画这两行。

## 特效与图标（2026-11-15 第二批，ChatGPT「三国开发讨论」生成，用户授权）

| 内容 | 运行时文件 | 原图 |
| --- | --- | --- |
| 招牌技序列帧 fx_c（6×4、256 帧、黑底叠加） | `public/assets/hero-fx/fx_c.png` | `originals/fx_c.png` |
| 武学图标：开山、孤军深入、伏雷、连营 | `public/assets/upgrade-icons/{kaishan,gujun,fulei,lianying}.webp` | `originals/weiyan_pangtong_icons.png` |
| 武器图标：镇北环首刀、凤雏连环令 | `public/assets/upgrade-icons/weapon_{zhenbei,lianhuan}.webp` | 同上 |
| 庞统火雷与铁链贴图 | `public/assets/hero-fx/pangtong_{mine,chain}.png` | 同上 |

fx_c 四行依次为：
1. 孙尚香「环身连射」。
2. 貂蝉「倾城」。
3. 魏延「谁敢杀我」。
4. 魏延「劈地裂波」：朝右，运行时按方向旋转。

图标和道具由 `tools/prepare-weiyan-pangtong-icons.mjs` 切出。

缺图时，以上每一处都会自动退回原来的程序化特效。

## 仍是过渡方案

- **普通攻击**：孙尚香普攻沿用连弩弩箭。貂蝉普攻的花瓣爆发是程序化的，满层倾城用 fx_c 序列帧。
- 主页大幅立绘与水墨立轴：2026-11-15 已补齐，见下节。

## 孙尚香 / 貂蝉主页立绘与水墨立轴（第三批）

| 内容 | 运行时文件 | 原图 |
| --- | --- | --- |
| 主页立绘（写实厚涂，洋红底抠图） | `public/assets/epic-home/<id>.png` + `.webp`（600×900） | `originals/<id>_epic.png` |
| 水墨立轴（白底水墨淡彩） | `public/assets/ink-scroll/<id>.webp`（600×900） | `originals/<id>_ink.png` |

处理：`node tools/prepare-heroine-home-art.mjs sunshangxiang diaochan`。两人已加入 `HOME_ART_HEROES`。
- **魏延「谁敢杀我」的六道裂缝**：仍是程序化地裂纹，叠在怒吼冲击波序列帧下面。改成程序化，是为了避免 6 张叠加混合的裂波把画面冲成白色。

## 2026-11-16 专属武器重做（6 将，现为程序化过渡）

| 武将 | 武器 | 现状（程序化） | 正式图需求 |
| --- | --- | --- | --- |
| 孙尚香 | 弓腰姬飞刀 | 银刃红柄飞刀贴图；侍婢借用蜀军刀兵行走图染红 | 飞刀贴图 1 张；**执刀侍婢**行走图 4×4 + 挥刀动作图（新角色）；召唤刀光特效 1 行 |
| 貂蝉 | 双花扇 | 粉色团扇贴图；粉心、「乱」字标记；三道舞带弧 | 旋转飞扇 4 帧；魅惑标记（粉心、断锁链）；「闭月」舞带特效 1 行（倾城花瓣旋涡已有） |
| 黄忠 | 宝雕弓 | 金色重箭贴图、命中闪光、神射爆裂圈 | 重箭贴图；命中冲击特效 1 行 |
| 张飞 | 丈八蛇矛·当阳喝断 | 橙红弧形声浪；断桥区圆圈 | 声浪序列帧 1 行；断桥区地面贴图；动作图建议补「大喝」帧（现用咆哮招牌帧） |
| 马超 | 虎头湛金枪 | 枪尖金色光线；铁骑借用黄巾骑兵图染蓝 | 枪尖气流特效；**西凉骑兵**冲锋图（新）；冲阵烟尘特效 |
| 刘备 | 双股剑 | 一青一金「×」交叉斩 | 「×」剑光序列帧 1 行 |

另需 12 个武学图标：回身飞刀、百婢、霓裳、美人计、穿杨、老骥伏枥、万人敌、大喝、锦马、铁骑、桃园、携民。还需 6 个武器图标（现在借用连弩、长枪、战旗、偃月刀的图标）。要图需用户在 heroes 会话同意，并按 chrome-lock.md 排队。
