/**
 * 近两天新内容的音效（2026-11-19 统筹会话转用户批准：「最近两天加的内容大多没声音，配上合适的音效」）。
 * 与 HeroSfx 同一套做法：WebAudio 程序合成，无音频文件、无付费服务、无版权问题；**不用合成人声**（用户之前嫌「喝」声吓人删掉了）。
 *
 * 覆盖：武将出招起手（12 人）、首领主题特效起手 / 命中（8 组）、诸葛亮（星火焦土、借东风、八阵图）、典韦（双戟旋风 / 掷戟 / 恶来死战）、
 * 新杂兵（投石、强弩、扑跳、纵火罐、火船爆燃、地火窜起）、滚石 / 滚木、长坂断桥、营帐起火、营寨旅商购买 / 军医、城池环境声、
 * 合击 / 觉醒提示、据点占领 / 插旗、2-3 吕布跃下城头。
 *
 * 并发：每个键自带节流（throttleMs）与同键上限（max）；战斗特效另归 fx 组（同时最多 GROUP_MAX.fx 个，低优先级先丢），
 * 环境声归 amb 组（同时只放 1 个）。全部经 im_sfx_vol 音效音量与静音。
 * 响度：LEVEL 按 tools/render-sfx.mjs 实测峰值校准（常用的约 -20 dBFS，招牌 / 大事件约 -12～-15，环境声约 -30）。
 */
import type { SfxVoice } from './Sfx';
import type { AttackSfxConfig } from './HeroSfx';

type Cfg = AttackSfxConfig;
/** fx 组：战斗特效；priority 2 的不受分组上限约束（大事件、提示音）。 */
const F = (dur: number, throttleMs: number, max = 2, priority: 0 | 1 | 2 = 1, pitchVar = .05): Cfg => ({ dur, throttleMs, max, priority, pitchVar, group: 'fx' });
const A = (dur: number): Cfg => ({ dur, throttleMs: 1500, max: 1, priority: 0, pitchVar: .08, group: 'amb' });

export const CONTENT_SFX_CONFIG: Record<string, Cfg> = {
  // 武将出招起手（招牌技 / 被动触发）；被动版另叠 cast_sigil
  cast_guanyu: F(.7, 500, 1, 2), cast_zhangfei: F(.7, 500, 1, 2), cast_zhaoyun: F(.6, 500, 1, 2), cast_zhuge: F(.8, 500, 1, 2),
  cast_huangzhong: F(.6, 500, 1, 2), cast_machao: F(.6, 500, 1, 2), cast_weiyan: F(.7, 500, 1, 2), cast_liubei: F(.8, 500, 1, 2),
  cast_pangtong: F(.7, 500, 1, 2), cast_huangyueying: F(.6, 500, 1, 2), cast_sunshangxiang: F(.6, 500, 1, 2), cast_diaochan: F(.8, 500, 1, 2), cast_lvbu: F(.7, 500, 1, 2), cast_zhangliao: F(.7, 500, 1, 2), cast_zhouyu: F(.8, 500, 1, 2),
  cast_sigil: F(.9, 600, 1, 2, .02),
  // 首领主题：起手（蓄力 / 法阵）与命中
  bcast_blood: F(.7, 350, 1), bcast_yellow: F(.8, 350, 1), bcast_dust: F(.7, 350, 1), bcast_quake: F(.8, 350, 1),
  bcast_wall: F(.7, 350, 1), bcast_lance: F(.6, 350, 1), bcast_ink: F(.8, 350, 1), bcast_wei: F(.7, 350, 1),
  bhit_blood: F(.45, 120), bhit_yellow: F(.6, 120), bhit_dust: F(.55, 120), bhit_quake: F(.7, 140),
  bhit_wall: F(.5, 120), bhit_lance: F(.4, 110), bhit_ink: F(.6, 120), bhit_wei: F(.55, 120),
  bburst: F(1, 800, 1, 2),
  // 诸葛亮
  zg_ignite: F(.8, 400, 1, 1), zg_crackle: F(.25, 260, 1, 0, .1), zg_wind: F(1, 500, 1, 1), zg_bazhen: F(.9, 500, 1, 1), zg_bazhen_tick: F(.3, 300, 1, 0, .04),
  // 典韦
  dw_whirl: F(.7, 600, 1, 2), dw_throw: F(.35, 300, 1, 1), dw_rage: F(1.2, 2000, 1, 2),
  // 新杂兵
  mn_lob: F(.3, 160, 2, 0, .08), mn_stone: F(.4, 120, 2, 1, .08), mn_xbow: F(.14, 90, 2, 0, .08), mn_leap: F(.35, 160, 2, 0, .08),
  mn_land: F(.4, 140, 2, 1, .08), mn_firepot: F(.6, 160, 2, 1, .06), fire_ignite: F(.5, 300, 1, 0, .1), ship_boom: F(1, 200, 2, 2, .05),
  // 滚石 / 滚木
  roll_boulder: F(1.4, 400, 2, 1, .06), roll_log: F(1.2, 400, 2, 1, .06),
  // 场景大事件
  bridge_break: F(1.8, 1000, 1, 2, 0), tent_fire: F(1, 300, 2, 1, .06),
  // 营寨 / 城池（UI 与环境声）
  shop_buy: F(.5, 120, 2, 2, .03), medic_heal: F(.9, 200, 1, 2, .02),
  amb_bird: A(.6), amb_hammer: A(.7), amb_cart: A(1.2), amb_bell: A(2.2), amb_wind: A(2),
  // 合击 / 觉醒提示、据点、插旗
  toast_combo: F(.8, 400, 1, 2, 0), toast_awaken: F(1.4, 600, 1, 2, 0),
  cap_done: F(1.2, 400, 1, 2, 0), flag_raise: F(1.8, 800, 1, 2, 0),
  // 2-3 吕布跃下城头
  lubu_leap: F(.9, 1000, 1, 2, 0), lubu_land: F(1.2, 1000, 1, 2, 0),
};

// ———— 小工具 ————
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
/** 破风：带通噪声扫频。 */
const whoosh = (v: SfxVoice, t: number, dur: number, f0: number, f1: number, g: number, q = 1.2): void => v.swell(t, dur, 'bandpass', f0, f1, g, q, .35);
/** 低频闷响（落地 / 爆裂的身体）。 */
const thud = (v: SfxVoice, t: number, f: number, g: number, dur = .25): void => { v.tone(t, dur, 'sine', f, g, f * .45); v.noise(t, dur * .6, 'lowpass', 500, g * .6, 160); };
/** 噼啪：若干颗随机时刻的高通短噪声。 */
const crackle = (v: SfxVoice, t: number, n: number, span: number, g: number): void => { for (let i = 0; i < n; i++) v.noise(t + Math.random() * span, .015 + Math.random() * .02, 'highpass', 2400 + Math.random() * 2600, g * (.5 + Math.random() * .5)); };
/** 火焰「呼」：低通噪声由暗到亮。 */
const flare = (v: SfxVoice, t: number, dur: number, g: number, f0 = 300, f1 = 1500): void => v.swell(t, dur, 'lowpass', f0, f1, g, .7, .25);
/** 铃 / 钟：非整数倍泛音（金属感）。 */
const bell = (v: SfxVoice, t: number, f: number, g: number, dur = .8): void => { for (const [r, a] of [[1, 1], [2.76, .45], [5.4, .2]] as const) v.tone(t, dur / (r > 1 ? r * .6 : 1), 'sine', f * r, g * a); };
/** 闪光「叮」：高音短正弦 + 二倍。 */
const glint = (v: SfxVoice, t: number, f: number, g: number): void => { v.tone(t, .18, 'sine', f, g); v.tone(t, .12, 'sine', f * 2.01, g * .4); };
/** 低沉轰鸣（滚动 / 地震）：低通噪声长音 + 次低频。 */
const rumble = (v: SfxVoice, t: number, dur: number, g: number, f = 220): void => { v.swell(t, dur, 'lowpass', f, f * .7, g, .8, .2); v.tone(t, dur, 'sine', 46, g * .7, 38, .08); };
/** 木头碎裂。 */
const crack = (v: SfxVoice, t: number, g: number): void => { v.noise(t, .05, 'bandpass', 1800, g, 900, 2); v.noise(t + .02, .12, 'bandpass', 700, g * .7, 300, 1.2); v.tone(t, .08, 'triangle', 220, g * .5, 120); };
/** 水花。 */
const splash = (v: SfxVoice, t: number, g: number, dur = .6): void => { v.swell(t, dur, 'highpass', 1500, 4500, g, .7, .08); v.noise(t, dur * .5, 'bandpass', 700, g * .5, 300, .8); };
/** 鼓点。 */
const drum = (v: SfxVoice, t: number, g: number, f = 120): void => v.drum(t, f, f * .45, g, .22);
/** 五声音阶上行几音（提示音）：宫商角徵羽。 */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

type Recipe = (v: SfxVoice, t: number, p: number) => number;
export const CONTENT_SFX: Record<string, Recipe> = {
  // ================= 武将出招起手：短促「起势」——兵器亮相 / 气劲涌起，每人一种质感（无人声）
  cast_guanyu: (v, t, p) => { whoosh(v, t, .45, 300 * p, 1400 * p, .05, .9); v.tone(t + .05, .5, 'sawtooth', 98 * p, .018, 92 * p, .08); bell(v, t + .12, 330 * p, .02, .6); return .7; },
  cast_zhangfei: (v, t, p) => { drum(v, t, .09, 90 * p); drum(v, t + .14, .07, 80 * p); v.swell(t, .5, 'lowpass', 200, 900, .05, .8, .15); return .7; },
  cast_zhaoyun: (v, t, p) => { whoosh(v, t, .25, 1800 * p, 5200 * p, .04, 2.2); glint(v, t + .12, 1760 * p, .03); glint(v, t + .2, 2350 * p, .018); return .6; },
  cast_zhuge: (v, t, p) => { for (let i = 0; i < 4; i++) glint(v, t + i * .07, PENTA[i + 2] * 1.5 * p, .022); v.swell(t, .7, 'bandpass', 600, 1800, .02, 1.5, .3); return .8; },
  cast_huangzhong: (v, t, p) => { v.tone(t, .4, 'triangle', 150 * p, .05, 120 * p); v.noise(t, .02, 'bandpass', 3000, .03, 3000, 3); glint(v, t + .1, 1320 * p, .025); return .6; },
  cast_machao: (v, t, p) => { for (let i = 0; i < 3; i++) drum(v, t + i * .09, .05, 130 * p); whoosh(v, t + .18, .3, 1200 * p, 3400 * p, .04, 1.6); return .6; },
  cast_weiyan: (v, t, p) => { whoosh(v, t, .5, 220 * p, 900 * p, .06, .8); thud(v, t + .25, 70 * p, .07, .4); return .7; },
  cast_liubei: (v, t, p) => { bell(v, t, 440 * p, .03, .7); bell(v, t + .1, 659 * p, .025, .7); whoosh(v, t, .35, 1400 * p, 3000 * p, .025, 1.5); return .8; },
  cast_pangtong: (v, t, p) => { flare(v, t, .5, .05, 250, 1600); crackle(v, t + .1, 7, .45, .012); return .7; },
  cast_huangyueying: (v, t, p) => { for (let i = 0; i < 4; i++) v.noise(t + i * .045, .012, 'bandpass', (2600 + i * 300) * p, .035, 2600, 4); v.tone(t + .2, .25, 'triangle', 520 * p, .03, 780 * p); glint(v, t + .35, 1560 * p, .02); return .6; },
  cast_sunshangxiang: (v, t, p) => { for (let i = 0; i < 3; i++) glint(v, t + i * .06, (1980 + i * 240) * p, .02); whoosh(v, t, .2, 2600 * p, 6000 * p, .03, 2.5); return .6; },
  cast_diaochan: (v, t, p) => { v.swell(t, .7, 'bandpass', 900 * p, 2400 * p, .03, 1.2, .4); for (let i = 0; i < 3; i++) bell(v, t + .08 + i * .1, (1320 + i * 220) * p, .012, .5); return .8; },
  cast_zhouyu: (v, t, p) => { for (let i = 0; i < 3; i++) bell(v, t + i * .09, (523 + i * 131) * p, .02, .6); whoosh(v, t + .15, .6, 300 * p, 1600 * p, .05, .7); return .8; },
  cast_zhangliao: (v, t, p) => { for (let i = 0; i < 4; i++) drum(v, t + i * .07, .05, (120 + i * 8) * p); whoosh(v, t + .2, .4, 600 * p, 2200 * p, .05, 1.2); return .7; },
  cast_lvbu: (v, t, p) => { drum(v, t, .08, 90 * p); drum(v, t + .1, .07, 110 * p); whoosh(v, t + .12, .45, 300 * p, 1400 * p, .06, .9); thud(v, t + .3, 60 * p, .08, .4); return .7; },
  cast_sigil: (v, t, p) => { v.tone(t, .9, 'sine', 196 * p, .03, 196 * p, .15); v.tone(t, .9, 'sine', 294 * p, .02, 294 * p, .2); v.swell(t, .8, 'bandpass', 500, 1500, .015, 1.2, .5); return .9; },

  // ================= 首领主题：起手（蓄力光 / 脚下法阵）
  bcast_blood: (v, t, p) => { v.swell(t, .6, 'lowpass', 120, 700, .06, .9, .7); v.tone(t, .6, 'sawtooth', 62 * p, .025, 80 * p, .3); return .7; },
  bcast_yellow: (v, t, p) => { v.swell(t, .7, 'bandpass', 800, 2400, .03, 2, .6); crackle(v, t + .3, 6, .4, .025); bell(v, t + .55, 880 * p, .015, .4); return .8; },
  bcast_dust: (v, t, p) => { v.swell(t, .65, 'bandpass', 400, 1600, .05, .7, .6); v.noise(t + .4, .25, 'highpass', 3000, .02, 5000); return .7; },
  bcast_quake: (v, t, p) => { rumble(v, t, .8, .05, 160); thud(v, t + .6, 55 * p, .05, .3); return .8; },
  bcast_wall: (v, t, p) => { drum(v, t, .06, 110 * p); drum(v, t + .25, .06, 110 * p); v.metal(t + .45, 260 * p, .02, .3); return .7; },
  bcast_lance: (v, t, p) => { v.swell(t, .5, 'bandpass', 1200, 4200, .035, 2.2, .7); glint(v, t + .45, 2200 * p, .025); return .6; },
  bcast_ink: (v, t, p) => { v.swell(t, .8, 'lowpass', 200, 1000, .045, .6, .5); v.tone(t, .8, 'sine', 110 * p, .02, 98 * p, .3); v.swell(t + .2, .5, 'bandpass', 2000, 900, .012, 1.5, .4); return .8; },
  bcast_wei: (v, t, p) => { v.tone(t, .6, 'sawtooth', 110 * p, .022, 123 * p, .15); v.tone(t, .6, 'sawtooth', 165 * p, .015, 185 * p, .15); drum(v, t + .5, .06, 95 * p); return .7; },
  // 首领主题：命中（招式结算那一刻）
  bhit_blood: (v, t, p) => { whoosh(v, t, .2, 3000 * p, 700 * p, .06, 1.4); thud(v, t + .05, 90 * p, .05, .3); return .45; },
  bhit_yellow: (v, t, p) => { v.noise(t, .4, 'highpass', 2500, .05, 1200); crackle(v, t, 10, .35, .035); thud(v, t, 70 * p, .045, .35); return .6; },
  bhit_dust: (v, t, p) => { thud(v, t, 80 * p, .06, .35); v.swell(t, .5, 'bandpass', 600, 300, .05, .6, .1); return .55; },
  bhit_quake: (v, t, p) => { thud(v, t, 52 * p, .09, .6); rumble(v, t, .6, .04, 200); crackle(v, t + .05, 5, .3, .02); return .7; },
  bhit_wall: (v, t, p) => { v.metal(t, 200 * p, .03, .35); thud(v, t, 95 * p, .05, .3); return .5; },
  bhit_lance: (v, t, p) => { whoosh(v, t, .14, 2400 * p, 6000 * p, .045, 2.5); v.noise(t + .1, .05, 'bandpass', 1800, .04, 900, 2); thud(v, t + .1, 120 * p, .035, .2); return .4; },
  bhit_ink: (v, t, p) => { v.swell(t, .5, 'lowpass', 1400, 200, .06, .7, .05); v.tone(t, .45, 'sine', 140 * p, .03, 70 * p); return .6; },
  bhit_wei: (v, t, p) => { thud(v, t, 75 * p, .06, .4); v.metal(t + .02, 180 * p, .018, .3); whoosh(v, t, .2, 1800 * p, 500 * p, .035, 1.2); return .55; },
  bburst: (v, t, p) => { thud(v, t, 48 * p, .09, .9); v.swell(t, 1, 'lowpass', 150, 1100, .07, .7, .12); bell(v, t + .02, 147 * p, .03, 1); return 1; },

  // ================= 诸葛亮
  zg_ignite: (v, t, p) => { flare(v, t, .7, .06, 200, 1800); crackle(v, t + .15, 8, .6, .03); glint(v, t, 1568 * p, .015); return .8; },
  zg_crackle: (v, t) => { crackle(v, t, 4, .2, .022); v.noise(t, .2, 'lowpass', 500, .012, 300); return .25; },
  zg_wind: (v, t, p) => { v.swell(t, 1, 'bandpass', 300 * p, 1600 * p, .06, .7, .45); v.swell(t + .2, .7, 'bandpass', 1800 * p, 700 * p, .025, 1.2, .3); flare(v, t + .3, .6, .03, 300, 1200); return 1; },
  zg_bazhen: (v, t, p) => { for (let i = 0; i < 3; i++) bell(v, t + i * .1, PENTA[[0, 2, 4][i]] * .5 * p, .02, .8); v.tone(t, .9, 'sine', 131 * p, .025, 131 * p, .1); return .9; },
  zg_bazhen_tick: (v, t, p) => { v.tone(t, .25, 'sine', 392 * p, .018); v.noise(t, .05, 'bandpass', 1500, .01, 1500, 3); return .3; },

  // ================= 典韦
  dw_whirl: (v, t, p) => { for (let i = 0; i < 3; i++) whoosh(v, t + i * .17, .22, 500 * p, 1700 * p, .05, 1); thud(v, t + .5, 85 * p, .05, .3); return .7; },
  dw_throw: (v, t, p) => { whoosh(v, t, .3, 600 * p, 2400 * p, .05, 1.2); v.tone(t, .3, 'triangle', 300 * p, .012, 600 * p); return .35; },
  dw_rage: (v, t, p) => { drum(v, t, .08, 85 * p); drum(v, t + .18, .08, 85 * p); drum(v, t + .36, .09, 75 * p); v.swell(t, 1.2, 'lowpass', 150, 600, .05, .8, .3); return 1.2; },

  // ================= 新杂兵
  mn_lob: (v, t, p) => { whoosh(v, t, .28, 250 * p, 700 * p, .04, .9); return .3; },
  mn_stone: (v, t, p) => { thud(v, t, 95 * p, .06, .3); v.noise(t, .25, 'bandpass', 900, .03, 400, .9); crackle(v, t + .03, 3, .2, .02); return .4; },
  mn_xbow: (v, t, p) => { v.noise(t, .01, 'bandpass', 2400 * p, .04, 2400, 3); v.tone(t, .07, 'triangle', 420 * p, .025, 300); whoosh(v, t + .02, .1, 2000 * p, 4500 * p, .018, 2); return .14; },
  mn_leap: (v, t, p) => { whoosh(v, t, .32, 300 * p, 1100 * p, .04, .9); return .35; },
  mn_land: (v, t, p) => { thud(v, t, 80 * p, .065, .35); v.noise(t, .3, 'lowpass', 900, .03, 300); return .4; },
  mn_firepot: (v, t, p) => { v.noise(t, .05, 'bandpass', 2600, .04, 1500, 2); flare(v, t + .03, .55, .06, 250, 1600); thud(v, t, 85 * p, .04, .3); crackle(v, t + .1, 6, .4, .025); return .6; },
  fire_ignite: (v, t, p) => { flare(v, t, .45, .035, 300 * p, 1300 * p); crackle(v, t + .1, 3, .3, .015); return .5; },
  ship_boom: (v, t, p) => { thud(v, t, 55 * p, .1, .8); v.swell(t, .9, 'lowpass', 1800, 250, .07, .6, .03); crackle(v, t + .1, 12, .8, .03); splash(v, t + .2, .02, .5); return 1; },

  // ================= 滚石 / 滚木
  roll_boulder: (v, t, p) => { rumble(v, t, 1.4, .06, 180 * p); for (let i = 0; i < 6; i++) thud(v, t + .15 + i * .2, (70 + Math.random() * 25) * p, .025, .15); return 1.4; },
  roll_log: (v, t, p) => { rumble(v, t, 1.2, .04, 260 * p); for (let i = 0; i < 7; i++) v.tone(t + .1 + i * .15, .1, 'triangle', (150 + Math.random() * 40) * p, .02, 110); return 1.2; },

  // ================= 场景大事件
  bridge_break: (v, t, p) => { crack(v, t, .07); crack(v, t + .18, .06); crack(v, t + .32, .05); thud(v, t + .4, 60 * p, .08, .6); splash(v, t + .65, .05, .9); splash(v, t + .95, .03, .7); return 1.8; },
  tent_fire: (v, t, p) => { flare(v, t, .8, .06, 200, 1700); crackle(v, t + .1, 10, .8, .03); v.noise(t + .05, .3, 'bandpass', 400, .025, 200, .7); return 1; },

  // ================= 营寨 / 城池
  shop_buy: (v, t, p) => { for (const [d, f] of [[0, 2093], [.06, 2637], [.13, 3136]] as const) { v.tone(t + d, .2, 'sine', f * p, .025); v.tone(t + d, .1, 'sine', f * 1.5 * p, .01); } v.noise(t, .05, 'highpass', 5000, .015); return .5; },
  medic_heal: (v, t, p) => { for (let i = 0; i < 4; i++) v.tone(t + i * .09, .6, 'sine', PENTA[i + 1] * p, .02); v.swell(t, .8, 'bandpass', 1500, 3500, .012, 1, .5); return .9; },
  amb_bird: (v, t, p) => { const n = 2 + Math.floor(Math.random() * 3), f = pick([2600, 3100, 3500]) * p; for (let i = 0; i < n; i++) v.tone(t + i * .11, .08, 'sine', f * (1 + (i % 2) * .12), .012, f * (1.15 - (i % 2) * .2)); return .6; },
  amb_hammer: (v, t, p) => { for (let i = 0; i < 3; i++) { v.metal(t + i * .22, 520 * p, .01, .18); v.noise(t + i * .22, .02, 'bandpass', 2500, .012, 2500, 2); } return .7; },
  amb_cart: (v, t, p) => { rumble(v, t, 1.2, .015, 300 * p); for (let i = 0; i < 6; i++) v.noise(t + i * .18, .03, 'bandpass', 600, .01, 600, 2); return 1.2; },
  amb_bell: (v, t, p) => { bell(v, t, 220 * p, .02, 2.2); return 2.2; },
  amb_wind: (v, t, p) => { v.swell(t, 2, 'bandpass', 400 * p, 900 * p, .015, .6, .5); return 2; },

  // ================= 合击 / 觉醒、据点、插旗
  toast_combo: (v, t, p) => { drum(v, t, .06, 110); for (let i = 0; i < 3; i++) glint(v, t + .06 + i * .08, PENTA[i * 2] * 2 * p, .022); return .8; },
  toast_awaken: (v, t, p) => { drum(v, t, .08, 90); drum(v, t + .15, .08, 90); for (let i = 0; i < 5; i++) v.tone(t + .3 + i * .07, .6, 'sine', PENTA[i] * p, .02); bell(v, t + .65, 523 * p, .025, 1); return 1.4; },
  cap_done: (v, t, p) => { drum(v, t, .07, 100); drum(v, t + .2, .07, 100); for (let i = 0; i < 3; i++) v.tone(t + .4 + i * .1, .5, 'triangle', [392, 523, 659][i] * p, .025); return 1.2; },
  flag_raise: (v, t, p) => { v.swell(t, .6, 'bandpass', 600, 2000, .03, 1.2, .5); for (let i = 0; i < 4; i++) v.tone(t + .5 + i * .12, .7, 'triangle', [392, 523, 659, 784][i] * p, .028); bell(v, t + 1, 262 * p, .03, 1.2); drum(v, t + .5, .07, 95); return 1.8; },

  // ================= 2-3 吕布跃下城头
  lubu_leap: (v, t, p) => { for (let i = 0; i < 3; i++) drum(v, t + i * .1, .05, 140); whoosh(v, t + .25, .6, 200 * p, 1600 * p, .07, .8); return .9; },
  lubu_land: (v, t, p) => { thud(v, t, 45 * p, .12, 1); v.swell(t, 1.1, 'lowpass', 1200, 150, .06, .6, .03); crackle(v, t + .05, 8, .5, .025); return 1.2; },
};

// ———— 音效审计补齐（2026-11-19，用户「关于音效看看有什么需要优化提升的」；审计见共享笔记 audio-audit.md）————
Object.assign(CONTENT_SFX_CONFIG, {
  // 首领：转阶段 / 倒下（原来转阶段无声、倒下只借一声受击）
  bossPhase: F(1.4, 2000, 1, 2, 0), bossFall: F(2.4, 3000, 1, 2, 0),
  // 割草多杀分层：0.18 秒内 ≥4 杀 / ≥10 杀（GameScene.killEnemy 计数）
  killBurst: F(.45, 220, 1, 1, .05), killSweep: F(.8, 450, 1, 2, .04),
  // 新功能
  brazierBreak: F(.7, 160, 2, 1, .06), healPickup: F(.6, 200, 1, 2, .03), promote: F(1.6, 1500, 1, 2, 0),
  parleyYes: F(1.6, 1500, 1, 2, 0), parleyNo: F(1.2, 1500, 1, 2, 0), shop_sell: F(.6, 120, 2, 2, .03),
  mapOpen: F(.45, 200, 1, 2, .03), mapClose: F(.35, 200, 1, 2, .03), uiHover: F(.04, 70, 1, 0, .04),
  // 天下地图环境声（远号角 / 远鼓 / 旗声）
  amb_horn: A(1.8), amb_drum: A(1.2), amb_flag: A(.9),
});
Object.assign(CONTENT_SFX, <Record<string, Recipe>>{
  bossPhase: (v, t, p) => { bell(v, t, 110 * p, .05, 1.4); for (let i = 0; i < 4; i++) drum(v, t + .12 + i * .1, .07 + i * .01, 95); v.swell(t, 1.2, 'lowpass', 120, 900, .05, .8, .5); return 1.4; },
  bossFall: (v, t, p) => { thud(v, t, 42 * p, .12, 1.4); drum(v, t, .1, 70); drum(v, t + .28, .09, 65); bell(v, t + .05, 98 * p, .06, 2.3); v.swell(t, 2, 'lowpass', 900, 120, .05, .6, .02); return 2.4; },
  killBurst: (v, t, p) => { thud(v, t, 88 * p, .06, .3); v.noise(t, .08, 'bandpass', 1300 * p, .05, 500, 1.1); crackle(v, t + .02, 3, .12, .025); return .45; },
  killSweep: (v, t, p) => { thud(v, t, 60 * p, .09, .6); drum(v, t + .06, .07, 105); v.swell(t, .7, 'bandpass', 2400 * p, 500, .05, .9, .05); crackle(v, t + .03, 6, .3, .03); return .8; },
  brazierBreak: (v, t, p) => { v.metal(t, 380 * p, .022, .25); v.noise(t, .12, 'bandpass', 2200, .05, 900, 1.3); flare(v, t + .05, .55, .045, 250, 1500); crackle(v, t + .1, 5, .4, .02); return .7; },
  healPickup: (v, t, p) => { v.tone(t, .35, 'sine', 523 * p, .03); v.tone(t + .09, .45, 'sine', 784 * p, .03); v.swell(t, .3, 'bandpass', 900, 2200, .015, 1.5, .4); return .6; },
  promote: (v, t, p) => { for (let i = 0; i < 3; i++) drum(v, t + i * .16, .08, 100); for (let i = 0; i < 4; i++) v.tone(t + .5 + i * .1, .8, 'triangle', [392, 523, 659, 784][i] * p, .03); bell(v, t + .9, 1047 * p, .025, .7); return 1.6; },
  parleyYes: (v, t, p) => { for (const [d, f] of [[0, 262], [.06, 330], [.12, 392], [.2, 523]] as const) bell(v, t + d, f * p, .025, 1.3); return 1.6; },
  parleyNo: (v, t, p) => { drum(v, t, .1, 70); drum(v, t + .22, .1, 66); v.tone(t + .1, .9, 'sawtooth', 110 * p, .015, 104 * p, .1); v.tone(t + .1, .9, 'sawtooth', 117 * p, .013, 110 * p, .1); return 1.2; },
  shop_sell: (v, t, p) => { for (let i = 0; i < 5; i++) { const f = (1700 + Math.random() * 900) * p; v.tone(t + i * .055, .12, 'sine', f, .018); v.noise(t + i * .055, .015, 'highpass', 4000, .01); } v.noise(t + .28, .2, 'lowpass', 600, .02, 300); return .6; },
  mapOpen: (v, t, p) => { v.swell(t, .4, 'bandpass', 900 * p, 2600 * p, .035, .9, .5); v.noise(t + .3, .05, 'lowpass', 700, .025, 400); return .45; },
  mapClose: (v, t, p) => { v.swell(t, .3, 'bandpass', 2400 * p, 800 * p, .03, .9, .4); v.noise(t + .25, .05, 'lowpass', 600, .025, 300); return .35; },
  uiHover: (v, t, p) => { v.tone(t, .03, 'sine', 1500 * p, .008, 1300 * p); return .04; },
  amb_horn: (v, t, p) => { v.tone(t, 1.6, 'sawtooth', 147 * p, .006, 147 * p, .4); v.tone(t, 1.6, 'sine', 73 * p, .008, 73 * p, .4); return 1.8; },
  amb_drum: (v, t) => { for (let i = 0; i < 3; i++) drum(v, t + i * .35, .02, 80); return 1.2; },
  amb_flag: (v, t, p) => { for (let i = 0; i < 3; i++) v.swell(t + i * .22, .25, 'bandpass', 700 * p, 1400 * p, .01, .8, .3); return .9; },
});

/** 响度校准倍数（tools/render-sfx.mjs 实测后填；未列出的 = 1）。 */
const LEVEL: Record<string, number> = {
  // 音效审计补齐（2026-11-19）
  bossPhase: 1.60, bossFall: 1.29, killBurst: 1.10, killSweep: 0.94, brazierBreak: 1.70, healPickup: 1.95, promote: 1.76, parleyYes: 1.76, parleyNo: 1.20, shop_sell: 2.85, mapOpen: 3.05, mapClose: 2.92, uiHover: 1.80, amb_horn: 1.58, amb_drum: 0.92, amb_flag: 3.20,
  cast_guanyu: 2.57, cast_zhangfei: 1.20, cast_zhaoyun: 2.72, cast_zhuge: 3.13, cast_huangzhong: 2.04, cast_machao: 1.93,
  cast_weiyan: 1.68, cast_liubei: 2.02, cast_pangtong: 2.6, cast_huangyueying: 3.80, cast_sunshangxiang: 3.67, cast_diaochan: 3.43,
  cast_sigil: 1.60, bcast_blood: 1.57, bcast_yellow: 1.82, bcast_dust: 1.72, bcast_quake: 1.15, bcast_wall: 0.90,
  bcast_lance: 1.86, bcast_ink: 2.19, bhit_blood: 1.48, bhit_yellow: 0.91, bhit_dust: 1.46, bhit_wall: 1.19,
  bhit_lance: 2.24, bhit_ink: 1.91, bhit_wei: 1.45, bburst: 1.38, zg_ignite: 2.51, zg_crackle: 1.46,
  zg_wind: 2.92, zg_bazhen: 1.46, zg_bazhen_tick: 1.68, dw_whirl: 1.66, dw_throw: 2.79, dw_rage: 1.27,
  mn_lob: 2.82, mn_xbow: 1.58, mn_leap: 2.29, mn_land: 0.88, mn_firepot: 1.57, fire_ignite: 1.64,
  ship_boom: 1.26, roll_boulder: 2.09, roll_log: 2.43, bridge_break: 1.97, tent_fire: 3.05, shop_buy: 1.93,
  medic_heal: 2.82, amb_bird: 1.48, amb_hammer: 0.89, amb_cart: 1.58, amb_bell: 0.61, amb_wind: 2.85,
  toast_combo: 1.84, toast_awaken: 1.51, cap_done: 1.66, flag_raise: 1.72, lubu_leap: 1.97, lubu_land: 1.55,
};
for (const [k, raw] of Object.entries(CONTENT_SFX)) {
  const lv = LEVEL[k] ?? 1;
  if (lv !== 1) CONTENT_SFX[k] = (v, t, p) => { const g = v.ctx.createGain(); g.gain.value = lv; g.connect(v.out); return raw(v.withOut(g), t, p); };
}

/** 首领主题 → 起手 / 命中键（BossThemeFx 用）。 */
export const bossCastSfx = (theme: string): string => 'bcast_' + theme;
export const bossHitSfx = (theme: string): string => 'bhit_' + theme;
/** 场景上的 Sfx（没有就什么都不做）。 */
export function sceneSfx(scene: unknown, key: string): void { (scene as { sfx?: { play(k: string): void } } | null)?.sfx?.play(key); }

/** 城池 / 营寨环境声：每 3.5–7 秒随机一声（鸟、打铁、车轮、远钟、风），轻轻的；场景关闭自动停。 */
export function startCityAmbient(scene: { time: { addEvent(o: object): { remove(): void } }; events: { once(e: string, f: () => void): void } }, play: (k: string) => void, keys: readonly string[] = ['amb_bird', 'amb_bird', 'amb_hammer', 'amb_cart', 'amb_bell', 'amb_wind']): void {
  let ev: { remove(): void } | null = null;
  const next = (): void => { ev = scene.time.addEvent({ delay: 3500 + Math.random() * 3500, callback: () => { play(pick(keys)); next(); } }); };
  next(); scene.events.once('shutdown', () => ev?.remove());
}
