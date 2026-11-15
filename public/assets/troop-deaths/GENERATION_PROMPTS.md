# 我方士兵倒地帧

来源：ChatGPT 图像生成（用户 Chrome「绘制阵亡动作图」对话，2026-11-15），上传各兵种游戏内侧身像（tools/troop-reference-strip.mjs）作参照；用户确认后保存。
原图：`assets/source/troop-deaths-raw/{a,b}.png`（1254×1254，背景被画成不透明灰白棋盘格，副本 `originals/`）。
运行时由 `node tools/prepare-troop-deaths.mjs a b` 生成 `troop_deaths_{a,b}.png`（512×512，4 行 × 4 帧，128×128，底边对齐 114）：
从四边泛洪去掉棋盘格（按图边取两档灰），合并掉落兵器等碎块，a 组前三行红衣按 ReadableTextures 同一公式烘焙成绿衣。

- a：刀盾兵 / 长枪兵 / 弓箭兵 / 连弩兵；b：重盾兵 / 轻骑兵（连人带马）/ 精锐戟兵 / 军医。
- 每行：中招后仰 → 单膝跪地 → 侧倒 → 平躺（兵器落在身旁），朝右，游戏内朝左镜像。
- a 组长枪兵第 2 帧原图误画圆盾，已由 ChatGPT 单独重画（`assets/source/troop-deaths-raw/a-frame5.png`，用户确认保存），脚本按原帧人物高度替换（OVERRIDES）。

游戏内：src/systems/AllyCorpses.ts（尸体留 60 秒战斗时间后 1 秒淡出，最多 24 具）。
