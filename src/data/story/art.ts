/**
 * 剧情美术（2026-11-18 第三、四章起）：卷轴播放前按需载入，没登记的键不载（缺图时插画退回通用横幅、人物退回名字章）。
 *  - 对白水墨立绘：武将用 ink_hero_<id>（assets/ink-scroll/），其他人物用 ink_cast_<id>（assets/ink-cast/，tools/build-ink-cast.mjs 生成，
 *    600×900 透明底，与 12 将立轴同比例；STORY_CAST.<id>.portrait 填 'ink_cast_<id>'）。
 *  - 章节 / 过场插画：STORY_ILLUSTRATIONS 登记贴图键 → 文件（横版 1280 宽 WebP，卷轴横幅取 42% 处一段）。原图在 assets/story/originals/；
 *    人物偏高的图（土山、单骑）转 WebP 时裁掉底部 25%，让横幅窗口上移、不切头。
 */
export const STORY_ILLUSTRATIONS: Record<string, string> = Object.fromEntries([
  // 第三章 群雄割据（2026-11-18，Gemini Pro 以献马插画为画风参考）
  'changan_fall', 'xuzhou_bed', 'yuanmen', 'baimen', 'zhujiu',
  // 第四章 官渡之战
  'xueshu', 'tushan', 'xuyou', 'wuchao', 'danqi',
].map(k => ['story_' + k, `assets/story/${k}.webp`]));
// 第五、六章（2026-11-18 美术风格会话出图，分支 claude/art-style-bc6189 提交 e065491；文件名带 story_ 前缀；部分图会同名重出覆盖）
// 卷轴横幅用到的：longzhong / changban / dongfeng_4 / huarong_3 / jiangling_* / gongan / fanshi_1 / weiyan_1 / weiyan_2；其余是过场分镜（过场系统接管后用）
for (const k of ['longzhong', 'changban', 'jiangling_seized', 'jiangling_ceded', 'adou', 'gongan',
  ...[1, 2, 3, 4, 5].map(i => 'huarong_' + i), ...[1, 2, 3, 4, 5, 6, 7].map(i => 'dongfeng_' + i), ...[1, 2, 3, 4].map(i => 'fanshi_' + i), ...[1, 2, 3, 4].map(i => 'weiyan_' + i)])
  STORY_ILLUSTRATIONS['story_' + k] = `assets/story/story_${k}.webp`;

/** 贴图键 → 文件路径（不认识的键返回 undefined，不载）。 */
export function storyArtFile(key: string): string | undefined {
  if (key.startsWith('ink_hero_')) return 'assets/ink-scroll/' + key.slice(9) + '.webp';
  if (key.startsWith('ink_cast_')) return 'assets/ink-cast/' + key.slice(9) + '.webp';
  return STORY_ILLUSTRATIONS[key];
}
