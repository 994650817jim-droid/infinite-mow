/**
 * 武将 / 兵种出手音效（2026-11-17 用户：「各种武将攻击音效也需要设计一下」）。全部 WebAudio 程序合成，无音频文件、无版权问题。
 *
 * 分工：这里只管「兵器挥出 / 射出」的一刻；命中、暴击、击杀、首领受击由打击感系统（Sfx.ts 的 hit* / killThud / bossHit）负责，不重复。
 * 每个出手音效 2–3 个变体随机挑一个，再叠 ±6% 随机音高（Sfx.play 的 pitchVar），避免割草时单调。
 * 混音：武将出手峰值约 0.05–0.09，与打击感同一档；兵种出手约为武将的一半，且受「兵种」分组上限约束。
 * 并发：每个键自带节流（throttleMs）与同键并发上限（max），另有分组上限（GROUP_MAX：武将 4、兵种 3），全部经 im_sfx_vol 音效音量。
 *
 * 键名：atk_<武器> 为可玩武将本命武器（一武器对应一位武将），troop_<兵种> 为兵卒与随行名将的通用出手。
 */
import type { SfxVoice } from './Sfx';

export type SfxGroup = 'hero' | 'troop';
export interface AttackSfxConfig { dur: number; throttleMs: number; max: number; priority: 0 | 1 | 2; pitchVar: number; group: SfxGroup }

const H = (dur: number, throttleMs: number, max = 2, priority: 0 | 1 | 2 = 1): AttackSfxConfig => ({ dur, throttleMs, max, priority, pitchVar: .06, group: 'hero' });
const T = (dur: number, throttleMs: number): AttackSfxConfig => ({ dur, throttleMs, max: 2, priority: 0, pitchVar: .06, group: 'troop' });

export const GROUP_MAX: Record<SfxGroup, number> = { hero: 4, troop: 3 };

export const ATTACK_SFX_CONFIG: Record<string, AttackSfxConfig> = {
  atk_spear: H(.16, 90), atk_charge: H(.6, 300, 1, 2), atk_roar: H(1, 500, 1, 2),
  atk_guandao: H(.36, 110), atk_guandao_heavy: H(.5, 200, 1, 2),
  atk_bow: H(.3, 110), atk_bow_heavy: H(.45, 160), atk_bow_impact: H(.3, 120),
  atk_flame: H(.32, 120), atk_flame_boom: H(.6, 160, 2, 2),
  atk_serpent: H(.26, 110),
  atk_lance: H(.2, 100),
  atk_knife: H(.2, 90),
  atk_fan: H(.36, 110), atk_moon: H(1.1, 600, 1, 2),
  atk_chain: H(.4, 140), atk_mine: H(.5, 90, 3),
  atk_zhenbei: H(.36, 110), atk_zhenbei_cry: H(1.1, 600, 1, 2),
  atk_twin: H(.28, 100),
  atk_crossbow: H(.14, 80, 3), atk_crossbow_volley: H(.3, 160),
  troop_blade: T(.12, 90), troop_spear: T(.12, 90), troop_halberd: T(.2, 120), troop_rider: T(.22, 140),
  troop_bow: T(.14, 90), troop_crossbow: T(.1, 90), troop_shield: T(.14, 120), troop_spell: T(.24, 160),
};

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** 兵器破风：带通噪声扫频，起音较缓（挥动感）。 */
const swish = (v: SfxVoice, t: number, dur: number, from: number, to: number, gain: number, q = 1.4): void => v.swell(t, dur, 'bandpass', from, to, gain, q, .35);
/** 弓弦：三角波快速下滑的「嘣」+ 极短拨弦噪声。 */
const twang = (v: SfxVoice, t: number, f: number, gain: number, dur = .2): void => { v.tone(t, dur, 'triangle', f, gain, f * .82); v.tone(t, dur * .6, 'sine', f * 2.02, gain * .35, f * 1.7); v.noise(t, .015, 'highpass', 3500, gain * .7); };
/** 箭啸：高频带通噪声由高到低。 */
const whistle = (v: SfxVoice, t: number, dur: number, gain: number, from = 5200, to = 2600): void => v.swell(t, dur, 'bandpass', from, to, gain, 6, .2);
/** 火焰「呼」：低中频带通噪声扫上去，叠一点高频噼啪。 */
const fire = (v: SfxVoice, t: number, dur: number, gain: number, from = 300, to = 1400): void => { v.swell(t, dur, 'bandpass', from, to, gain, .8, .3); for (let k = 0; k < 3; k++) v.noise(t + Math.random() * dur * .8, .015, 'highpass', 2800 + Math.random() * 2500, gain * .35); };
/** 锁链：一串不规则的短金属撞击。 */
const chain = (v: SfxVoice, t: number, n: number, gain: number, base = 2300): void => { let x = 0; for (let k = 0; k < n; k++) { v.metal(t + x, base * (.85 + Math.random() * .4), gain * (k === 0 ? 1 : .7), .07); v.noise(t + x, .02, 'bandpass', 4200, gain * 1.5, 4200, 2); x += .025 + Math.random() * .03; } };
/** 地面闷爆：低频正弦下坠 + 低通噪声。 */
const boom = (v: SfxVoice, t: number, gain: number, dur = .45, f = 90): void => { v.tone(t, dur, 'sine', f, gain, f * .4); v.noise(t, dur * .8, 'lowpass', 700, gain * .9, 120); };

export const ATTACK_SFX: Record<string, (v: SfxVoice, t: number, p: number) => number> = {
  // ---------------- 赵云 · 龙胆枪：快速突刺破风 + 枪尖轻金属鸣
  atk_spear: (v, t, p) => { const s = pick([[1500, 3600], [1700, 4000], [1300, 3300]]); swish(v, t, .1, s[0] * p, s[1] * p, .06, 2.2); v.metal(t + .05, pick([2600, 2900, 3150]) * p, .009, .11); return .16; },
  // ---------------- 马超 · 铁骑冲锋：马蹄连击（四声低鼓）+ 长枪破风 + 枪尖鸣
  atk_charge: (v, t, p) => { [0, .09, .2, .29].forEach((x, i) => v.drum(t + x, 120 * p, 55, i % 2 ? .1 : .14, .14)); swish(v, t + .3, .22, 900 * p, 3800 * p, .08, 1.6); v.metal(t + .42, 2500 * p, .012, .16); return .6; },
  // ---------------- 张飞 · 燕人咆哮 / 据水断桥：低沉人声吼 + 地面重击
  // 2026-11-18 用户：「那个喝声音太吓人了，都不要了」→ 去掉合成人声 vox，只留重击与气浪
  atk_roar: (v, t, p) => { boom(v, t + .05, .16, .7, 70); v.noise(t + .05, .5, 'bandpass', 900, .05, 400, 1); return 1; },
  // ---------------- 关羽 · 青龙偃月刀：沉重横扫的长破风 + 刀身嗡鸣
  atk_guandao: (v, t, p) => { const f = pick([[380, 1500], [420, 1700], [340, 1350]]); swish(v, t, .3, f[0] * p, f[1] * p, .09, 1); v.tone(t + .04, .3, 'sawtooth', 110 * p, .01, 104 * p, .08); v.metal(t + .12, 880 * p, .006, .24); return .36; },
  atk_guandao_heavy: (v, t, p) => { swish(v, t, .42, 260 * p, 1300 * p, .12, .9); v.tone(t + .05, .42, 'sawtooth', 82 * p, .016, 76 * p, .1); v.metal(t + .18, 660 * p, .012, .32); v.tone(t + .3, .2, 'sine', 70, .06, 40); return .5; },
  // ---------------- 黄忠 · 宝雕弓：弓弦「嘣」+ 箭啸；神射加重
  atk_bow: (v, t, p) => { twang(v, t, pick([196, 210, 184]) * p, .07); whistle(v, t + .03, .24, .04); return .3; },
  atk_bow_heavy: (v, t, p) => { twang(v, t, 150 * p, .1, .28); v.tone(t, .2, 'sine', 75 * p, .05, 50); whistle(v, t + .04, .36, .05, 4800, 2000); return .45; },
  atk_bow_impact: (v, t, p) => { v.tone(t, .22, 'sine', 110 * p, .09, 45); v.noise(t, .1, 'lowpass', 900 * p, .08, 200); v.noise(t, .03, 'bandpass', 1800, .05, 1800, 1.5); return .3; },
  // ---------------- 诸葛亮 · 火旗：点火「呼」；大招火焰轰鸣
  atk_flame: (v, t, p) => { fire(v, t, .28, .08, pick([260, 320, 380]) * p, 1500 * p); v.noise(t, .02, 'highpass', 3000, .03); return .32; },
  atk_flame_boom: (v, t, p) => { fire(v, t, .55, .12, 200 * p, 900 * p); boom(v, t, .1, .5, 80 * p); return .6; },
  // ---------------- 张飞 · 丈八蛇矛：沉重直刺
  atk_serpent: (v, t, p) => { swish(v, t, .18, 700 * p, 2400 * p, .085, 1.4); v.tone(t + .1, .14, 'sine', 120 * p, .05, 70); v.metal(t + .12, 1900 * p, .007, .12); return .26; },
  // ---------------- 马超 · 锦马长枪：较轻快的突刺
  atk_lance: (v, t, p) => { swish(v, t, .13, pick([1200, 1400]) * p, pick([3600, 4100]) * p, .065, 2); v.metal(t + .07, 2700 * p, .008, .1); return .2; },
  // ---------------- 孙尚香 · 飞刀：尖短「嗖」，常两三把连发
  atk_knife: (v, t, p) => { const n = pick([1, 2, 2, 3]); for (let k = 0; k < n; k++) { const x = k * .045; v.swell(t + x, .07, 'bandpass', 6000 * p, 3400 * p, .05, 5, .2); v.metal(t + x + .01, 3800 * p, .004, .05); } return .2; },
  // ---------------- 貂蝉 · 双花扇：丝扇轻扫 + 小铃；闭月舞带：旋转的扇风与铃
  atk_fan: (v, t, p) => { swish(v, t, .2, 1800 * p, 900 * p, .04, .9); swish(v, t + .1, .18, 1500 * p, 2400 * p, .025, .9); v.metal(t + .06, pick([2637, 2960, 3136]) * p, .01, .3); return .36; },
  atk_moon: (v, t, p) => { for (let k = 0; k < 4; k++) swish(v, t + k * .22, .3, 900 * p, 2200 * p, .035, .8); [2349, 2794, 3136, 3520].forEach((f, k) => v.metal(t + .1 + k * .2, f * p, .009, .5)); return 1.1; },
  // ---------------- 庞统 · 连环雷：锁链哗啦；火雷炸裂
  atk_chain: (v, t, p) => { chain(v, t, pick([5, 6, 7]), .016, 2300 * p); v.noise(t, .3, 'bandpass', 1600 * p, .025, 2400, 1.2); return .4; },
  atk_mine: (v, t, p) => { boom(v, t, .13, .45, 95 * p); v.noise(t, .12, 'bandpass', 1400 * p, .08, 500, 1); v.noise(t + .02, .2, 'highpass', 2600, .03); return .5; },
  // ---------------- 魏延 · 镇北刀：沉重劈砍；谁敢杀我：怒吼 + 地裂轰鸣
  atk_zhenbei: (v, t, p) => { swish(v, t, .22, 500 * p, 2000 * p, .09, 1.1); v.tone(t + .16, .18, 'sine', 95 * p, .08, 45); v.noise(t + .16, .06, 'lowpass', 1200, .05, 300); return .36; },
  atk_zhenbei_cry: (v, t, p) => { /* 去掉合成人声「喝」（2026-11-18 用户） */ boom(v, t + .3, .2, .7, 60); v.noise(t + .3, .6, 'bandpass', 500, .07, 160, .9); for (let k = 0; k < 4; k++) v.noise(t + .35 + k * .08, .05, 'highpass', 1800, .04); return 1.1; },
  // ---------------- 刘备 · 双股剑：两剑交错的清脆双响
  atk_twin: (v, t, p) => { swish(v, t, .12, 2200 * p, 4200 * p, .055, 2); swish(v, t + .07, .12, 2600 * p, 4600 * p, .05, 2); v.metal(t + .08, pick([3100, 3400]) * p, .012, .14); v.metal(t + .13, pick([3700, 4000]) * p, .009, .12); return .28; },
  // ---------------- 黄月英 · 连弩：机括「咔」+ 弦响 + 弩矢破空
  atk_crossbow: (v, t, p) => { v.noise(t, .012, 'bandpass', 2600 * p, .06, 2600, 3); v.tone(t + .006, .07, 'triangle', 420 * p, .035, 300); v.swell(t + .01, .08, 'bandpass', 5200 * p, 3000 * p, .03, 5, .2); return .14; },
  atk_crossbow_volley: (v, t, p) => { for (let k = 0; k < 3; k++) { const x = k * .05; v.noise(t + x, .012, 'bandpass', 2400 * p, .05, 2400, 3); v.tone(t + x, .06, 'triangle', 400 * p, .028, 290); } v.swell(t + .02, .2, 'bandpass', 5200 * p, 2600 * p, .035, 4, .25); return .3; },

  // ================= 兵种 / 随行名将（比武将轻，约一半响度）
  troop_blade: (v, t, p) => { swish(v, t, .09, 2300 * p, 900 * p, .035, 1.4); return .12; },
  troop_spear: (v, t, p) => { swish(v, t, .09, 1400 * p, 3200 * p, .032, 2); return .12; },
  troop_halberd: (v, t, p) => { swish(v, t, .17, 500 * p, 1700 * p, .045, 1); return .2; },
  troop_rider: (v, t, p) => { v.drum(t, 115 * p, 55, .06, .1); v.drum(t + .08, 115 * p, 55, .05, .1); swish(v, t + .08, .12, 1200 * p, 3200 * p, .03, 1.6); return .22; },
  troop_bow: (v, t, p) => { twang(v, t, 260 * p, .03, .12); return .14; },
  troop_crossbow: (v, t, p) => { v.noise(t, .01, 'bandpass', 2600 * p, .035, 2600, 3); v.tone(t, .05, 'triangle', 480 * p, .02, 340); return .1; },
  troop_shield: (v, t, p) => { v.tone(t, .1, 'sine', 150 * p, .05, 80); v.noise(t, .05, 'bandpass', 900 * p, .04, 600, 1.2); return .14; },
  troop_spell: (v, t, p) => { fire(v, t, .2, .03, 400 * p, 1200 * p); return .24; },
};

/**
 * 响度校准（tools/render-sfx.mjs 实测峰值后定的倍数）：常用出手峰值约 -22 dBFS（略低于打击感的 -18～-23），
 * 重击 / 爆裂约 -17，招牌大招约 -8～-12（仍低于满层战吼），兵种约 -30。
 */
const LEVEL: Record<string, number> = {
  atk_spear: 2.5, atk_guandao: 2.55, atk_bow: .68, atk_flame: 1.8, atk_serpent: 1.43, atk_lance: 3, atk_knife: 3, atk_fan: 1.55,
  atk_chain: 2, atk_zhenbei: .94, atk_twin: 2.6, atk_crossbow: 1.48, atk_crossbow_volley: 1.8,
  atk_guandao_heavy: 2.15, atk_bow_heavy: 1, atk_bow_impact: 1.24, atk_mine: .85, atk_flame_boom: 1.35,
  atk_charge: 1.5, atk_roar: .44, atk_zhenbei_cry: .53, atk_moon: 3.7,
  troop_blade: 1.66, troop_spear: 2.05, troop_halberd: 1.75, troop_rider: .47, troop_bow: .55, troop_crossbow: 1.12, troop_shield: .5, troop_spell: 2.3,
};
for (const [k, raw] of Object.entries(ATTACK_SFX)) {
  const lv = LEVEL[k] ?? 1;
  if (lv !== 1) ATTACK_SFX[k] = (v, t, p) => { const g = v.ctx.createGain(); g.gain.value = lv; g.connect(v.out); return raw(v.withOut(g), t, p); };
}

/** 武器 → 出手键（用于试听页与随行名将）。 */
export const WEAPON_ATTACK_SFX: Record<string, string[]> = {
  spear_orbit: ['atk_spear'], guandao: ['atk_guandao', 'atk_guandao_heavy'], baodiao_bow: ['atk_bow', 'atk_bow_heavy', 'atk_bow_impact'],
  flame_banner: ['atk_flame', 'atk_flame_boom'], dangyang_roar: ['atk_serpent', 'atk_roar'], zhanjin_lance: ['atk_lance', 'atk_charge'],
  zhenbei_blade: ['atk_zhenbei', 'atk_zhenbei_cry'], shuanggu_swords: ['atk_twin'], lianhuan_mines: ['atk_chain', 'atk_mine'],
  crossbow: ['atk_crossbow', 'atk_crossbow_volley'], sun_knives: ['atk_knife'], diaochan_fans: ['atk_fan', 'atk_moon'],
};
/** 兵种 → 出手键（Legion 的 TroopKind；医兵不出手）。 */
export const TROOP_ATTACK_SFX: Record<string, string> = {
  swordsman: 'troop_blade', spearman: 'troop_spear', halberdier: 'troop_halberd', rider: 'troop_rider',
  archer: 'troop_bow', crossbowman: 'troop_crossbow', guardian: 'troop_shield',
};
/** 随行名将模板 → 出手键（没有本命武器时）。 */
export const FOLLOWER_ATTACK_SFX: Record<string, string> = { spear: 'troop_spear', blade: 'troop_blade', bow: 'troop_bow', strategist: 'troop_spell' };
