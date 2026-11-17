# UI 第 15 轮：升级三选一 —— 字体统一（默认）+ 水墨预览（?levelup=ink，未启用）

用户：「统一书法字体，但是水墨风我看看再决定」。只做电脑布局。

## 默认（已生效）：字体统一
- 标题「武将升级 · 选择本次强化」：TITLE_FONT、金 #efd399（与主页「乱世千军」、点将页、战斗支援同一套）。
- 去掉副标题「三择其一 · 点击卡片获得强化」及两侧细线（少字）；「武将 Lv.N」行改象牙白 + 描边。
- 卡名 HEADING_FONT 金色描边；正文 FONT 象牙白 #e8d8b2 描边；标签、「按 N 选择」HEADING_FONT；「换一批」HEADING_FONT、去掉色块底。
- 卡面底图、布局不变；文案见第 14 轮审校。

## 水墨预览（只在 URL 加 `?levelup=ink` 时出现，默认不启用，等用户定）
- 卡面：陈年宣纸（现有 ink_paper 美术）+ 四边淡墨晕染 + 干笔墨框；徽章位一团淡墨；悬停时墨色加深、透朱砂光。
- 文字：深墨色；标签统一朱砂底；标题下垫一笔浓墨（主页水墨按钮同款）。
- 只换表现，选卡逻辑不变；用户确认后改成默认即可（去掉开关）。

## 对比图
`after-compare-default-vs-ink.png`：左 现版（字体统一）、右 水墨预览，1280×720 并排。
单张：`after-levelup-default-1280x720.png`、`after-levelup-ink-1280x720.png`；改前 `before-levelup-default-1280x720.png`。

## 检查
- `tools/ui-round15-levelup.mjs`：两种样式都是标题书法字 + 卡名 / 标签 / 提示 / 换一批标题字 + 正文正文字、去掉副标题、点选后回到战斗 —— 7/7。
- art-ui-smoke 17/17（卡内文字不出框）、test-ui-polish、test-hero-codex 11/11 通过；test-gamepad 40/40（另一次「只用手柄打完一关」超时，上一轮改动前就时有时无）。
- `npx tsc --noEmit`、`npm run build` 通过。
