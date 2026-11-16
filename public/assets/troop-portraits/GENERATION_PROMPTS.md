# 兵种立绘 / 头像素材需求（战地招募卡、招兵营、军团 HUD 共用）

> 状态：**待生成**（2026-11-15 提出）。素材到位前，战地招募卡用「行走帧半身裁切 + 兵种色圆章 + 兵器印记（刀/枪/弓…）」过渡（`src/ui/LegionUI.ts` `paintWaveCard`），这是程序化过渡，不是独立立绘。
> 新图只放本目录，**不覆盖** `public/assets/processed/` 下的行走帧和 `icon_shu_*` 原图。

## 1. 现状盘点

| 兵种 | 当前卡面用图 | 来源帧 | 问题 |
| --- | --- | --- | --- |
| 刀盾兵 swordsman | `shu_swordsman_walk_sheet` `down_0` | 96×96 行走帧，运行时被 ReadableTextures 重着色为绿白 | 与长枪/弓箭兵同一套绿白小兵，只差兵器；半身裁切后兵器基本看不到 |
| 长枪兵 spearman | `shu_spearman_walk_sheet` `down_0` | 同上 | 同上 |
| 弓箭兵 archer | `shu_archer_walk_sheet` `down_0` | 同上 | 同上，与刀盾兵几乎一样 |
| 连弩兵 crossbowman | `legion_crossbowman_walk` | 96×96 | 尚可，弩在胸前可辨 |
| 重盾兵 guardian | `legion_guardian_walk` | 96×96 | 辨识度较好（头盔 + 大盾），可暂缓 |
| 轻骑兵 rider | `legion_rider_walk` | 96×96，人物在帧内偏小 | 头像里马和人都很小，需要重画 |
| 精锐戟兵 halberdier | `legion_halberdier_walk` | 96×96，人物偏小 | 需要重画 |
| 军医 medic | `legion_medic_walk` | 96×96 | 尚可（药葫芦 + 药箱），可暂缓 |
| （未使用）`icon_shu_swordsman / spearman / archer` | 128×128 | 与行走帧同款红白小兵全身像 | 只是行走帧的放大，不能当立绘用 |

**建议重画优先级**：刀盾兵、长枪兵、弓箭兵（开局三兵种，玩家最常看到）> 轻骑兵、精锐戟兵 > 连弩兵、重盾兵、军医。

## 2. 规格（每个兵种 1 张）

- **用途**：战地招募卡的圆形徽章（手机显示直径约 104 设计像素，电脑约 104）、招兵营卡片、以后的兵种图鉴。
- **构图**：胸像 / 半身（头顶到腰），人物略侧 3/4 朝右，**兵器必须进画面并且一眼可辨**（刀 + 圆盾 / 长枪枪头 / 弓与箭囊 / 连弩 / 大盾 / 骑兵加马头 / 长戟 / 药箱与葫芦）。头部中心约在画面高 38% 处，四周留 6% 安全边，方便圆形裁切。
- **风格**：与现有像素小兵一致的蜀汉配色（绿袍、白银甲、红缨点缀），比行走帧更精细的高清像素风或手绘像素风；轮廓清晰，深色描边，**不带背景、不带文字、不带边框**。
- **尺寸 / 格式**：512×512 PNG，透明背景（RGBA）；导入时另出 256×256 WebP。
- **兵种区分**：每个兵种在头盔 / 头巾 / 披风上带一处兵种色点缀，和卡片底色呼应：刀盾 赭红 `#7a3b22`、长枪 靛蓝 `#2d4f6e`、弓箭 墨绿 `#2f5a42`、连弩 橄榄 `#3a5a2a`、重盾 土黄 `#6b4a22`、轻骑 紫 `#4d3a72`、戟兵 绛红 `#7a2f2f`、军医 青 `#2f6466`。
- **数量**：8 张（第一批先出刀盾、长枪、弓箭 3 张）。

## 3. 文件命名（放本目录）

```
originals/<kind>_portrait_original.png   ← 生成原图，原样保存
<kind>_portrait.png                      ← 512×512 透明 PNG（已裁好边）
<kind>_portrait.webp                     ← 256×256
manifest.json                            ← { kind, file, headY, source, date }
```

`<kind>` 取 `swordsman / spearman / archer / crossbowman / guardian / rider / halberdier / medic`。

## 4. 生成提示词（中英对照，逐个替换【兵种描述】）

> Pixel-art bust portrait of a Three Kingdoms Shu-Han 【兵种描述】, three-quarter view facing right, head to waist, weapon clearly visible, green robe with polished silver lamellar armor, red tassel accents, 【兵种色】 accent on helmet or scarf, crisp dark outline, rich shading, transparent background, no text, no frame, centered with 6% padding, 512x512.

| kind | 【兵种描述】 |
| --- | --- |
| swordsman | sword-and-shield infantryman holding a dao saber and a round wooden shield |
| spearman | spearman gripping a long spear with red tassel, spearhead visible above shoulder |
| archer | archer drawing a recurve bow, quiver of arrows on the back |
| crossbowman | repeating-crossbow soldier holding a zhuge repeating crossbow at chest |
| guardian | heavy shield soldier with full helmet and a tall tower shield |
| rider | light cavalryman on horseback, horse head visible at lower left, short spear |
| halberdier | elite ji-halberd soldier with plumed helmet and crescent-blade halberd |
| medic | field medic with herb gourd and medicine satchel, cloth headband |

## 4b. 第一批 · 开局三兵种（2026-11-15 用户确认先出这 3 张，可整段转交 ChatGPT）

> 请为三国题材像素风割草手游生成 3 张兵种胸像立绘，三张必须同一画风、同一光源（左上）、同一取景比例，方便并排放在选兵卡片的圆形头像里。
> 通用要求：蜀汉义军士兵，绿袍 + 白银札甲 + 红缨点缀；3/4 侧身朝右；头顶到腰部的半身构图，头部中心约在画面高度 38% 处，四周留 6% 空白；兵器必须完整进画面、一眼能认出；高清像素风，深色描边，层次分明；**透明背景**，不要文字、边框、阴影地面；每张 1024×1024 或 512×512 PNG。
>
> 1. **刀盾兵**（兵种色：赭红 #7a3b22，用在头巾或护肩）：右手握环首刀斜举，左臂挎圆木盾（盾面有铜钉），神情坚毅，像守在前线的护卫。
> 2. **长枪兵**（兵种色：靛蓝 #2d4f6e，用在头巾或枪缨下的布条）：双手持长枪，枪身斜贯画面，红缨枪头露在肩膀上方，身体略前倾，像准备突刺。
> 3. **弓箭兵**（兵种色：墨绿 #2f5a42，用在头巾或护臂）：左手持反曲弓，右手从背后箭囊抽箭，箭羽清晰，眼神望向远方。
>
> 三张请分别导出，文件名：`swordsman_portrait_original.png`、`spearman_portrait_original.png`、`archer_portrait_original.png`。

**收到图后**：把 3 个文件放进 `public/assets/troop-portraits/originals/`，开发服务器运行时执行 `node tools/prepare-troop-portraits.mjs`。脚本会自动去底、裁边、生成 512 PNG 和 256 WebP，并写入 `manifest.json`；游戏会自动改用立绘，缺的兵种继续用半身裁切过渡。

## 5. 接入方案（素材到位后由 DSH 实施）

1. BootScene 按 `troop_portrait_<kind>` 键加载本目录 PNG（缺图跳过）。
2. `LegionUI.paintWaveCard`：若 `troop_portrait_<kind>` 存在则用它（圆形遮罩，按 manifest 的 `headY` 对齐），否则继续用现在的行走帧半身裁切过渡。
3. 招兵营（`CampRestUI` / `CityRecruitScene`）同样优先用立绘。
4. 实测手机 390×844、电脑 1280×720 截图对比后再交审。
