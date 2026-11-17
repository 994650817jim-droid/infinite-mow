import type { StoryLine } from '../ui/StoryScroll';

/**
 * 第一章通关剧情「中山商旅 · 献马」（用户 2026-11-16 确认台词稿，马保持「驽马」）。
 * 典出《三国演义》第一回：中山大商张世平、苏双敬重义士，赠良马、金银、镔铁；演义里在起兵时，这里改到广宗破黄巾后、作为商队犒军。
 * 台词只称「将军」，主公是谁都通；主公是刘备时加一句呼应起兵时的资助。
 */
export function merchantHorseLines(lordName: string, isLiubei: boolean): StoryLine[] {
  return [
    { text: '广宗告捷，黄巾溃散。中山大商张世平、苏双贩马北归，商队行至营前，求见主将。' },
    { who: '张世平', text: '贼乱经年，商路断绝。将军破张角于广宗，我等商旅才得平安北还。' },
    { who: '苏双', text: '我二人以贩马为业，别无长物。商队里有一匹老实的驮马，虽算不得千里良驹，却驮得辎重、走得远路，愿献给将军代步。' },
    ...(isLiubei ? [{ who: '刘备', text: '昔日起兵，蒙二位资助马匹金铁；今日又承厚赠，备铭记于心。' }] : []),
    { who: lordName, text: '二位厚意，某代全军将士谢过。' },
    { who: '张世平', text: '乱世方起，将军前程远大。他日若得良驹，莫忘中山故人。' },
  ];
}
export const MERCHANT_HORSE_REWARD = '获得坐骑「驽马」· 白 · 移速 +2.6% · 马厩已开放（主页 / 行营休整时可换马）';

/** 剧情只播一次（与马是否已有分开记：老存档已有驽马的不补弹）。 */
const SEEN_KEY = 'im_story_merchant_horse_v1';
export function merchantStorySeen(): boolean { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; } }
export function markMerchantStorySeen(): void { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 无存储时不记 */ } }
