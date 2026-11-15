# 诸葛亮「烈焰战旗」武器美术

来源：ChatGPT 图像生成（用户 Chrome「生成武器素材图」对话，2026-11-15），上传诸葛亮动作图集作画风参照；用户确认后保存。
原图：`assets/source/flame-banner-raw/{banner-sigil,burst}.png`（1536×1024 透明，副本 `originals/`，构建时不发布）。
运行时由 `node tools/prepare-flame-banner-art.mjs` 生成：`zhuge_banner.png`（旗杆底端为握点，poleX 见 manifest）、`fire_sigil.png`（预警地纹）、`flame_burst.png`（6 × 256，底边对齐）。

- 战旗：深色漆木旗杆、金色火焰形枪头与红缨，朱红丝绸燕尾牙旗、金色滚边，金线绣火焰与八卦纹。
- 八卦火阵：俯视扁椭圆，金橙发光的八卦符与两圈火焰纹圆环，中间大部分透明，作爆炸预警。
- 爆炸 6 帧：八卦光纹亮起 → 火球鼓起 → 烈焰喷发 → 贴地火环 → 余烬 → 淡烟。

游戏内：GameScene.spawnFlagSwingFx / spawnFlameGatherFx / spawnFlameFx（缺图时退回旧程序特效）。
