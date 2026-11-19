import type { Enemy } from '../entities/Enemy';
import { setStoryFlag, storyFlag } from './Story';

/**
 * 第五章 5-1「七进七出」彩蛋（统筹 story-ch05.md 第五节，用户定为「击杀 77 名虎豹骑」）：
 * 赵云在队（主公或随行）时，本关击杀虎豹骑（敌方骑兵，kind = cavalry）累计 QIJIN.need 骑 → 横幅「七进七出」+ 赵云大字台词，写旗标 qijin_qichu。
 * 不给数值。随行赵云的击杀分不出来，按全队击杀算（剧本允许）。每关只触发一次；旗标已写过的存档不再弹横幅。
 */
export const QIJIN = { need: 77 } as const;
export interface QijinHost {
  team: () => readonly string[];
  banner: (title: string, caption: string) => void;
  bark: () => void;
  /** 赵云是主公时脚下龙鳞流光一次（没有就不放） */
  flourish?: () => void;
}
export class QijinTracker {
  kills = 0; done = false;
  constructor(private readonly h: QijinHost) { this.done = !!storyFlag('qijin_qichu'); }
  onKill(e: Enemy): void {
    if (this.done || e.kind !== 'cavalry' || !this.h.team().includes('zhaoyun')) return;
    if (++this.kills < QIJIN.need) return;
    this.done = true; setStoryFlag('qijin_qichu');
    this.h.banner('七进七出', '怀抱阿斗 · 单骑救主'); this.h.bark(); this.h.flourish?.();
  }
}
