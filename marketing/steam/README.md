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
