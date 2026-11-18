import type { CutsceneScript } from './types';
import { LUBU_KILLS_DONGZHUO } from './lubuKillsDongzhuo';

/** 已登记的过场（id → 脚本）。新增过场：写脚本文件、在这里加一行。 */
export const CUTSCENES: Readonly<Record<string, CutsceneScript>> = {
  [LUBU_KILLS_DONGZHUO.id]: LUBU_KILLS_DONGZHUO,
};
/** 开发预览（?dev=1&cutscene=<id>）：开哪一关、到哪一步自动播。 */
export const CUTSCENE_PREVIEW: Readonly<Record<string, { chapter: string; westStage?: 1 | 2 | 3 }>> = {
  lubu_kills_dongzhuo: { chapter: 'hulao', westStage: 3 },
};
export type { CutsceneScript, CutStep, Pos } from './types';
