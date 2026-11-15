# 武将卡立轴素材（ink-scroll）

来源：ChatGPT 图像生成（用户 Chrome 内「生成游戏UI素材图」对话，2026-11-14），用户确认保存。原图在 `originals/`（不随构建发布）。
运行时文件由 `node tools/build-ink-scroll-assets.mjs` 生成。

| 文件 | 说明 |
| --- | --- |
| originals/scroll-frame.png | 立轴装裱外框，1024×1536 透明 PNG；画心空白宣纸 |
| originals/{zhaoyun,guanyu,huangzhong,zhuge}.png | 以 `epic-home/{id}.webp` 为参考重绘的水墨淡彩立绘，1024×1536 白底 |
| frame.webp | 外框裁切（x40–984, y0–1520）×0.75，画心挖空、保留惊燕垂带 |
| paper.webp | 画心宣纸 ×0.75（惊燕处用旁侧纸面补齐） |
| {id}.webp | 立绘：与边缘连通的近白背景转透明、底部 14% 渐隐，600×900 |

## 提示词要点
- 外框：中国传统立轴正面平视、左右对称；紫檀画轴与鎏金雕花轴头、丝质挂绳；靛青织锦绫边（祥云暗纹、金线包边）；赭褐织锦天头地头带回纹、两条惊燕；画心为空白陈年宣纸；透明背景，2:3。
- 立绘：参考上传的角色原图，保持相同盔甲/服饰/兵器/面部/姿态；宣纸水墨淡彩（工笔+写意，墨线浓淡干湿），各自主色点染（赵云石青银灰、关羽石绿赭石、黄忠赭石土黄、诸葛亮花青黛紫）；人物约占 85% 高度，膝下化入淡墨云雾；纯白背景，无文字印章，2:3。

## 2026-11-15 新增（张飞 / 马超 / 魏延 / 刘备）
先以 epic-home/zhaoyun.webp 为画风参考、各自像素立绘为造型参考生成写实厚涂主页立绘（epic-home/originals/<id>.png，透明底），再参照 originals/guanyu.png 的水墨风格重绘为 originals/<id>.png（白底 1024×1536）。处理：node tools/epic-home-assets.mjs <id...>；node tools/build-ink-scroll-assets.mjs <id...>。
