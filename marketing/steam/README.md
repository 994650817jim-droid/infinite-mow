# Steam 商店页 / 库图片素材

只出素材，未上传 Steam。尺寸按 Steamworks 文档（2026-11-18 查）：
[store/assets](https://partner.steamgames.com/doc/store/assets)、
[assets/standard](https://partner.steamgames.com/doc/store/assets/standard)、
[assets/libraryassets](https://partner.steamgames.com/doc/store/assets/libraryassets)。

画面都是即梦 Seedream 5.5 出的水墨原图（`originals/jimeng_*.png`，下载原图无水印）。标题字没有让 AI 画，用的是主页已认可的水墨标识：`tools/logo-wordmark.mjs HALO=1` 排出 2048 版（`originals/wordmark_halo_2048.png`），与 `public/assets/ui/title_wordmark.webp` 同一稿。每种尺寸各用一张单独构图的原图；有标题的都另存一份 `*_notitle.png`。

| 文件 | Steam 位置 | 尺寸 | 原图 | 标题 |
|---|---|---|---|---|
| `header_capsule.png` | 商店 · 页头胶囊 Header Capsule（必需） | 920×430 | `jimeng_wide_1` 三骑并驾冲锋 | 左上天空 |
| `small_capsule.png` | 商店 · 小胶囊 Small Capsule（必需；Steam 自动缩出 120×45 / 184×69） | 462×174 | `jimeng_bg_4` 雾中远骑（让标题几乎占满、缩到 184×69 仍清楚） | 居中、几乎占满 |
| `main_capsule.png` | 商店 · 主胶囊 Main Capsule（必需） | 1232×706 | `jimeng_main_1` 关羽当先正面冲来 | 左上 |
| `vertical_capsule.png` | 商店 · 竖版胶囊 Vertical Capsule（必需；促销 / 季节页） | 748×896 | `jimeng_vertical_2` 关羽战马人立 | 顶部居中 |
| `page_background.png` | 商店 · 页面背景 Page Background（可选） | 1438×810 | `jimeng_bg_2` 雾中古战场，压暗约一半 | 无（背景要低调） |
| `library_capsule.png` | 库 · 库胶囊 Library Capsule（必需；自动缩出 300×450） | 600×900 | `jimeng_vertical_3` | 顶部居中 |
| `library_header.png` | 库 · 库页头 Library Header（必需；不传则用商店页头） | 920×430 | `jimeng_wide_3`（裁掉左侧带字的黄巾旗） | 左上天空 |
| `library_hero.png` | 库 · 库主视觉 Library Hero（必需；规定不得有文字） | 3840×1240 | `jimeng_wide_2`（原图 2268 宽放大），三兄弟的脸在中间 860×380 安全区内 | 无（规定） |
| `library_logo.png` | 库 · 库 Logo Library Logo（必需；透明 PNG，只有标题字） | 1280×720 | 水墨标识（带米色晕光，深色库主视觉上也清楚） | — |
| `preview_all.png` | 合集预览（不上传） | — | — | — |

## 规则备注
- 胶囊图只能有画面 + 游戏名（标题字），不放评语、奖项、宣传语。
- 库主视觉不能有任何文字；库 Logo 在 Steam 后台单独上传、位置在预览工具里选。
- 还需要但这次没做的：商店截图（≥1920×1080、16:9、只能是实机画面）、快捷方式图标 256×256、应用图标 184×184（`electron/icon.png` 已有，可直接缩）。

## 重新生成
```
node tools/steam-assets.mjs                 # 全部
node tools/steam-assets.mjs small_capsule   # 只出某几张（逗号分隔）
```
构图（原图、焦点、放大、标题位置与宽度）都在 `tools/steam-assets.mjs` 的 `ASSETS` 里。合成后把除 `library_logo.png` 外的图转成不透明 RGB 以减小体积：
`ffmpeg -i x.png -pix_fmt rgb24 -compression_level 9 x_rgb.png`。

# Steam 商店页素材（2026-11-18，main 0fcf284 电脑版）

只准备素材，不上传。胶囊图另由 walk-anim 会话绘制。

## 截图 `screenshots/`（1920×1080，正常游戏画面，无 DEV 面板 / 调试数字 / 测试存档标记）

| 文件 | 卖点 |
|---|---|
| 01-opening-ink-title.png | 开场水墨动画落在书法标识「三国 · 乱世千军」 |
| 02-horde-battle.png | 大规模割草：满屏黄巾军围攻赵云 |
| 03-dual-boss.png | 双首领：官渡 4-2 颜良 + 文丑 |
| 04-boss-lubu-phase2.png | 首领二阶段：吕布残血下马狂暴（魔神 · 无双乱舞） |
| 05-surrender.png | 招降弹窗：华雄败势已成，劝降 / 斩杀 / 再压一压 |
| 06-siege-gate-ram.png | 攻城：大城城门、箭楼、护城河吊桥、冲车 |
| 07-world-map-fog.png | 天下地图：战争迷雾、势力疆域、可攻城悬停信息 |
| 08-camp.png | 营寨经营：州府全景 |
| 09-build-overview.png | 构筑总览（行营将帅帐）：战法、流派、觉醒 |
| 10-story-scroll.png | 剧情卷轴：煮酒论英雄 |

`extras/` 是备选：开场书法字幕帧、吕布骑赤兔（一阶段）。合集预览：`screenshots-contact.jpg`。
注：瓮城在城门之后，这组截图里没有拍到。

## 宣传片 `trailer/trailer-1080p30.mp4`

42.4 秒，1920×1080，30fps，H.264 + AAC 192k。
开场水墨（约 5 秒）→ 割草 → 吕布（转二阶段）→ 双首领 → 招降 → 攻城 → 天下地图「陈留 归入版图」 → 营寨 → 水墨标题。
字幕用游戏标题书法字，一段一句：千军万马 · 一骑当千 / 名将如云 · 各怀绝技 / 劝降 · 斩杀 · 由你定夺 / 攻城拔寨 / 一城一池 · 尽归版图。
配乐：开场曲（public/assets/audio/opening_theme.mp3）开头 → 战斗 BGM《关东烽火》（游戏程序合成，离线渲染）→ 开场曲 13.2 秒刀光重击接标题。
抽帧预览：`trailer/trailer-frames.png`。

## 文案 `store-text.md`

中英文一句话简介、详细介绍、特色列表、标签建议、AI 生成内容披露草稿（提交前请开发者核对）。

## 重新生成

开 dev 服务器后：
- 截图：`BASE=http://127.0.0.1:<端口>/ node tools/marketing-shots.mjs`（输出原始编号，再按上表改名）
- 宣传片：`RAW=<临时目录> node tools/marketing-trailer-record.mjs` → `node tools/render-battle-bgm.mjs <RAW>/battle-bgm.wav hulao 42` → `RAW=<临时目录> node tools/marketing-trailer-edit.mjs`
