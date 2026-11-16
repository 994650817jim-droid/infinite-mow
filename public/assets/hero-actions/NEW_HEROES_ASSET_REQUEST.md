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

## 2026-11-16 正式图到位（新聊天「生成特效序列帧图集」）
- `hero-fx/fx_d.png`：6×4、256 帧、黑底叠加，四行依次为貂蝉闭月、黄忠重箭命中、张飞当阳声浪、刘备交叉斩。
- 武艺图标 12 个：回身飞刀、百婢、霓裳、美人计、百步、老骥伏枥、万人敌、大喝、锦马、铁骑、桃园、携民。
- 武器图标 6 个：weapon_sunknives / fans / baodiao / shemao / zhanjin / shuanggu。
- 战场贴图（`hero-fx/`）：sun_knife、diaochan_fan、huangzhong_arrow、charm_heart、charm_broken、zhangfei_spear。
- 执刀侍婢行走图：`hero-fx/sun_maid_walk.png`（4×4、96 帧）。
- 切图脚本：`tools/prepare-hero-icon-sheet.mjs`（KEY=strict 用于粉紫物件）、`reslice-magenta-sheet.mjs`。
- 原图在 `originals/`：fx_d、heroes_icons2、heroes_sprites、sun_maid_walk。
- 缺图时各处仍退回程序化特效。马超改为枪挑破阵后不再需要西凉骑兵图。

## 2026-11-16 孙尚香新画风（持飞刀，用户认可）
- 行走 / 动作：ChatGPT 原图 processed-v2/originals/artv2_sunshangxiang_walk.png、hero-actions-v2/originals/artv2_sunshangxiang_actions.png，按美术风格会话 tools/prepare-artv2.mjs（方案 C 放大版）出 processed-v2/sunshangxiang_walk_sheet.png（704×704）、hero-actions-v2/sunshangxiang.png（928×1624）。接入靠美术风格分支 ArtStyle.ts 的 ART_V2_FILES（两分支合并后加 sunshangxiang_walk_sheet / sunshangxiang_actions 两行）；v1 图保留。
- 主页立绘 / 选将头像：originals/sunshangxiang_epic.png（新），旧弓箭版改名 sunshangxiang_epic_v1.png；水墨立轴暂沿用旧图。
- 侍婢刀光：hero-fx/sun_maid_slash.png（3×2，每帧 256，黑底叠加），原图 originals/sunshangxiang_v2_maidslash.png。

## 2026-11-16 庞统「铁索连环」像素特效（方案 A，用户选定）
- hero-fx/pangtong_fx.png：6×4，每帧 256，黑底叠加。第 1 行烧红铁索热光、第 2 行沿铁索奔跑的火苗、第 3 行地火（拼铺成连舟地火）、第 4 行雷芯由暗红闪到白金（将爆示警）。原图 originals/pangtong_fx_raw.png（ChatGPT「生成游戏特效精灵表」）。缺图时武器退回程序化过渡；不画地面范围圈。

## 2026-11-16 黄忠神射像素特效（方案 C「老当益壮」，用户选定）
- hero-fx/huangzhong_fx.png：6×4，每帧 256，黑底叠加。第 1 行神射爆裂（替换程序光圈）、第 2 行进入神射金色光柱、第 3 行神射箭金色拖光、第 4 行「宝刀未老」红金火焰。原图 originals/huangzhong_fx_raw.png（ChatGPT「生成游戏特效精灵表」）。缺图时退回程序化过渡。
- upgrade-icons/jingxin.webp：技艺「静心」图标，暂时复制自 baibu.webp（旧「百步」，已从技艺表去掉，原图保留）。

## 2026-11-16 被动满层战吼像素特效（用户：「马超喊出台词需要像是真的喊出来一样」）
- hero-fx/warcry_fx.png：2 行 × 6 帧，每帧 256×512，黑底叠加。第 1 行脚下声浪冲击（压扁椭圆、尘土与金色气流），第 2 行身上迸发的金色气势。原图 originals/warcry_fx_raw.png（ChatGPT「生成游戏特效精灵表」）。马超、孙尚香共用。战吼音效为代码合成（Sfx 'warCry'），没有用外部音频文件。
