# 行囊重设计美术（美术风格会话，2026-11-17）

清单来源：UI 会话 assets/review/ui-round11/PROPOSAL.md（效果图 mockup-bag-desktop.png）。画风：三国厚涂写实，深色漆木 / 旧铜 / 鎏金 / 宣纸 / 朱红，不是像素。
ChatGPT 聊天「绘制界面底板」/c/6afc422b…，原图在 originals/dsh_bag_*.png，切图参数在 originals/jobs/bag1~8.json：
`node tools/prepare-ui-sheet.mjs public/assets/bag/originals/jobs/bagN.json`

| 文件 | 尺寸 | 说明 |
|---|---|---|
| panel_bg.webp | 1920×1080 | 行囊大底：深色漆木 + 四角鎏金包角，不透明 |
| doll_paper.webp | 1200×880 | 装束图底：旧宣纸，左下淡山水、右侧淡军旗墨痕，中间干净，不透明 |
| tray_bg.webp | 1160×1100 | 行囊托盘：漆木托盘 + 金线 + 四角铜包角，内底平整（不画格子，格子用 slot_frame 摆）；可九宫格（边约 60px） |
| slot_frame / _hover / _selected.webp | 160×160 | 空格底（框内深色漆木，不透明）；三张同一缩放、居中对齐，可直接互换；_selected 外圈金光到画布边渐隐 |
| q_white / green / blue / purple / orange.webp | 160×160 | 品质边框，框内透明，与 slot_frame 同缩放对齐（叠在 slot_frame 上即可）；四角已含宝石 |
| sil_helm / armor / boots / token / mount / relic.webp | 128×128 | 空槽剪影，**浅色淡墨**（米白），给深色空格用；建议 alpha .35~.5 |
| sil_*_ink.webp | 128×128 | 同上的深墨版，放在宣纸等浅底上用 |
| slot_tag.webp | 48×120 | 竖排朱红小牌底（字由代码写） |
| lock_tag.webp | 48×48 | 小锁牌 |
| medal_frame / medal_frame_selected.webp | 120×120 | 圆形将印外框（环内透明放头像，内径约 72%）；选中版外圈金光 |
| tab / tab_selected.webp | 240×64 | 筛选页签底，两端圆角；九宫格左右各留约 32px |
| tab_icon_all / armor / helm / boots / token / relic.webp | 64×64 | 页签小图标（全部=行囊、甲胄、头盔、战靴、信物=玉佩、遗珍=宝匣），显示 32~40 像素 |
| tooltip_card.webp | 600×400 | 悬停卡 / 详情卡底，漆底金边四角花；九宫格边约 40px，顶部品质色带由代码叠 |
| gem_green / blue / purple / orange.webp | 32×32 | 单颗宝石（可选，品质框已含） |
