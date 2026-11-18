/**
 * 剧情美术（2026-11-18 第三、四章起）：卷轴播放前按需载入，没登记的键不载（缺图时插画退回通用横幅、人物退回名字章）。
 *  - 对白水墨立绘：武将用 ink_hero_<id>（assets/ink-scroll/），其他人物用 ink_cast_<id>（assets/ink-cast/，tools/build-ink-cast.mjs 生成，
 *    600×900 透明底，与 12 将立轴同比例；STORY_CAST.<id>.portrait 填 'ink_cast_<id>'）。
 *  - 章节 / 过场插画：STORY_ILLUSTRATIONS 登记贴图键 → 文件（横版，卷轴横幅取中间一段）。原图在 assets/story/originals/。
 */
export const STORY_ILLUSTRATIONS: Record<string, string> = {};

/** 贴图键 → 文件路径（不认识的键返回 undefined，不载）。 */
export function storyArtFile(key: string): string | undefined {
  if (key.startsWith('ink_hero_')) return 'assets/ink-scroll/' + key.slice(9) + '.webp';
  if (key.startsWith('ink_cast_')) return 'assets/ink-cast/' + key.slice(9) + '.webp';
  return STORY_ILLUSTRATIONS[key];
}
