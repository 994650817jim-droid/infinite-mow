/** 各章剧本索引（第三章起按 story-plan.md 第五节逐章补）。 */
import type { StoryChapter } from './types';
import { HUANGJIN_STORY } from './huangjin';
import { HULAO_STORY } from './hulao';
import { QUNXIONG_STORY } from './qunxiong';
import { GUANDU_STORY } from './guandu';
import { CHIBI_STORY } from './chibi';
import { JINGNAN_STORY } from './jingnan';
import { SHU_STORY } from './shu';
import { HANZHONG_STORY } from './hanzhong';
import { XIANGFAN_STORY } from './xiangfan';
import { YILING_STORY } from './yiling';
import { NANZHENG_STORY } from './nanzheng';
import { BEIFA_STORY } from './beifa';
export * from './types';
export const STORY_CHAPTERS: Record<string, StoryChapter> = { huangjin: HUANGJIN_STORY, hulao: HULAO_STORY, qunxiong: QUNXIONG_STORY, guandu: GUANDU_STORY, chibi: CHIBI_STORY, jingnan: JINGNAN_STORY,
  // 第七–十二章（2026-11-20 补齐）：章头 / 章末卷轴仍在各章场景里，这里是军情、首领台词、营中闲话
  shu: SHU_STORY, hanzhong: HANZHONG_STORY, xiangfan: XIANGFAN_STORY, yiling: YILING_STORY, nanzheng: NANZHENG_STORY, beifa: BEIFA_STORY };
