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
