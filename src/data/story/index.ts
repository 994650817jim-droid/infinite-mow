/** 各章剧本索引（第三章起按 story-plan.md 第五节逐章补）。 */
import type { StoryChapter } from './types';
import { HUANGJIN_STORY } from './huangjin';
import { HULAO_STORY } from './hulao';
export * from './types';
export const STORY_CHAPTERS: Record<string, StoryChapter> = { huangjin: HUANGJIN_STORY, hulao: HULAO_STORY };
