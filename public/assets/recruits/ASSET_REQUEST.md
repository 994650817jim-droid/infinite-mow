# 招贤馆与随行武将素材需求

> **2026-11-16 第 1 项已交付**：ChatGPT 新对话「生成武将头像」出了 1 张 2×2 洋红底拼图，原图在 `originals/dsh_recruit_faces.png`（不入库）。`tools/prepare-recruit-faces.mjs` 抠底、按象限切图后生成 `recruit_faces.png`（512×128，4 帧：枪 / 刀 / 弓 / 谋，每帧 128×128）；TalentHallScene 以 spritesheet `recruit_faces` 加载，史事名将与大众脸的方印里显示对应模板头像，外框按品质上色。第 2、3 项（谋士行走图、史事名将头像）未做。

现状（程序化过渡，见 `src/scenes/TalentHallScene.ts`、`src/systems/FollowerSquad.ts`）：
- 招贤馆里，可玩名将用现有头像（`assets/processed/<portrait>.png`）；史事名将与大众脸只有一块品质色方印，印里写模板字（枪 / 刀 / 弓 / 谋）。
- 战场上，史事名将和大众脸用蜀军兵种行走图（枪兵 / 刀盾兵 / 弓兵）。「谋」模板暂借弓兵图，头顶加品质色名牌。

素材到位后按下面的键名加载；缺图时自动退回现在的样子。

## 1. 模板头像（4 张，优先级高）
- 用途：招贤馆席位与麾下名册左侧的方印（显示 88–96px）。
- 风格：与现有武将头像（`assets/processed/*_portrait.png`）一致，像素厚涂 Q 版半身或全身，暖色描墨边，汉末服饰。
- 尺寸：每张 128×128，透明背景（也可用洋红 #FF00FF 底，按 tools/prepare-*.mjs 的流程抠底）。
- 键名与内容：
  - `recruit_face_spear`：持枪的年轻校尉，皮甲红巾；
  - `recruit_face_blade`：持环首刀的壮年都伯，札甲；
  - `recruit_face_bow`：背弓的射士，轻甲与箭囊；
  - `recruit_face_strategist`：羽扇纶巾的谋士，布袍。
- 大众脸会按品质在头像外框上色（白 / 绿 / 蓝），头像本身不带边框。

## 2. 谋士行走图（1 套，优先级中）
- 用途：「谋」模板随行在战场上的行走图，现在暂借弓兵图。
- 规格同 `shu_archer_walk_sheet`：96×96 每帧，4 方向（下 / 左 / 右 / 上）× 4 帧，帧名 `down_0`…`up_3`，透明背景，脚底对齐帧底以上约 14% 的位置。
- 键名：`shu_strategist_walk_sheet`。

## 3. 史事名将头像（38 张，优先级低，可分批）
- 名单见 `src/world/WorldIntel.ts` 的 `BOUNTY_GENERALS`（郭汜、张郃、许褚、太史慈……共 11 个势力 38 人）。
- 规格同第 1 项，128×128；键名 `general_<拼音>`，例如 `general_zhanghe`、`general_xuchu`。
- 先出曹操、袁绍、孙氏三家（约 12 人），其余以后再补。
