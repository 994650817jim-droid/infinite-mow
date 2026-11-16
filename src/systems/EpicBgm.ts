/**
 * BGM v2（2026-11-16 用户反馈「首领 BGM 要有史诗感」「黄巾军 BGM 不好听」）：仍是 WebAudio 程序合成，无外部音频文件。
 *
 * 相比 v1 的变化：
 * - 混音：大厅卷积混响（预延迟、尾音变暗）+ 鼓用的短房间混响 + 总线压缩，低频更厚、整体更“满”。
 * - 新乐器：战鼓（次低频 + 鼓身 + 皮面三层）、小堂鼓、钹、大锣（可做渐强“涌”）、铜管号角（滤波包络）、
 *   共振峰合唱（男声“啊 / 哦”长音铺底）、弦乐顿弓低音跑动、二胡（滑音 + 渐深揉弦）、改良唢呐、竹笛、琵琶轮指。
 * - 结构：段落推进。首领曲：前奏 4 小节 → 循环 32 小节（蓄势 8 → 主题 8 → 高潮前 8 → 高潮 6 → 转回 2）。
 *   各章战斗曲（BATTLE_THEMES）：前奏 4 小节 → 循环 28 小节（主题 8 → 主题加副奏 8 → 副歌 8 → 鼓段 4）。
 *   黄巾《黄天当立》、讨董《关东烽火》、群雄《群雄逐鹿》、官渡《官渡对垒》、赤壁《赤壁东风》；界面曲见 Music.ts。
 *
 * 版本切换：`?bgm=old` 回到 v1，`?bgm=new` 用 v2；也可写 localStorage `im_bgm_ver`。默认见 DEFAULT_BGM（现为 v2）。
 */
import { type BossProfile, bossMotif, composeBossMelody, profileScale } from '../data/bossMusic';

export type BgmVersion = 'old' | 'v2';
/** 2026-11-16 用户试听后选定新版（「bgm同意」）；?bgm=old 可切回旧版。 */
export const DEFAULT_BGM: BgmVersion = 'v2';

export function bgmVersion(): BgmVersion {
  try {
    const q = new URLSearchParams(window.location.search).get('bgm');
    if (q === 'old' || q === 'v1') return 'old';
    if (q === 'new' || q === 'v2') return 'v2';
    const s = localStorage.getItem('im_bgm_ver');
    if (s === 'old' || s === 'v2') return s;
  } catch { /* ignore */ }
  return DEFAULT_BGM;
}

const mtof = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// ---------------------------------------------------------------- 各章战斗曲（同一套音色，不同调性 / 速度 / 主奏 / 鼓型 / 旋律）
type Chord = { bass: number; pad: number[] };
/** 和弦以 D 小调为基准书写，各曲再整体移调（tr）。 */
const CH: Record<string, Chord> = {
  Dm: { bass: 38, pad: [50, 57, 62, 65] },
  Gm: { bass: 43, pad: [55, 58, 62, 67] },
  F: { bass: 41, pad: [53, 57, 60, 65] },
  Bb: { bass: 46, pad: [50, 53, 58, 62] },
  C: { bass: 48, pad: [52, 55, 60, 64] },
  A: { bass: 45, pad: [52, 57, 61, 64] },
  Am: { bass: 45, pad: [52, 57, 60, 64] },
};
type Line = Array<[number, number]>; // [MIDI(-1 休止), 八分音符时值]；每句 2 小节 = 16 个八分
type Voice = 'erhu' | 'dizi' | 'suona' | 'horn' | 'pipa';
type BattleDrums = 'march' | 'gallop' | 'heavy' | 'tense';
export type BattleThemeKey = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi';
interface BattleTheme {
  title: string; bpm: number; tr: number;
  intro: string[]; a: string[]; b: string[]; br: string[];
  melA: Line[]; melB: Line[];
  /** A 段主奏；A2 段在主奏之上加的副奏；B 段主奏 + 低八度托底。 */
  leadA: Voice; counterA2: Voice; leadB: Voice; supportB: Voice;
  drums: BattleDrums; fire?: boolean;
}
export const BATTLE_THEMES: Record<BattleThemeKey, BattleTheme> = {
  /** 第一章《黄天当立》：D 小调 100 BPM，二胡主奏，副歌二胡 + 号角齐奏。 */
  huangjin: {
    title: '黄天当立', bpm: 100, tr: 0,
    intro: ['Dm', 'Dm', 'Bb', 'A'], a: ['Dm', 'Dm', 'Gm', 'F', 'Dm', 'Bb', 'Gm', 'A'], b: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'Gm', 'A'], br: ['Dm', 'Dm', 'Bb', 'A'],
    melA: [
      [[69, 3], [67, 1], [69, 2], [72, 2], [74, 4], [72, 2], [69, 2]],
      [[67, 2], [69, 1], [67, 1], [65, 2], [62, 2], [65, 3], [67, 1], [69, 4]],
      [[69, 3], [67, 1], [69, 2], [72, 2], [74, 2], [77, 2], [74, 2], [72, 2]],
      [[72, 3], [69, 1], [67, 2], [65, 2], [64, 2], [65, 1], [64, 1], [62, 4]],
    ],
    melB: [
      [[77, 2], [77, 1], [79, 1], [81, 4], [79, 2], [77, 1], [76, 1], [72, 4]],
      [[74, 2], [76, 2], [77, 2], [81, 2], [81, 6], [79, 2]],
      [[77, 2], [77, 1], [79, 1], [81, 4], [84, 2], [81, 2], [79, 4]],
      [[77, 2], [76, 2], [74, 2], [72, 1], [74, 1], [76, 8]],
    ],
    leadA: 'erhu', counterA2: 'dizi', leadB: 'erhu', supportB: 'horn', drums: 'march',
  },
  /** 第二章《关东烽火》：E 小调 116 BPM，奔马鼓型；号角主奏，副歌二胡；下行四级进行。 */
  hulao: {
    title: '关东烽火', bpm: 116, tr: 2,
    intro: ['Dm', 'C', 'Bb', 'A'], a: ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'], b: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'A', 'A'], br: ['Dm', 'C', 'Bb', 'A'],
    melA: [
      [[62, 1], [62, 1], [69, 2], [69, 1], [67, 1], [69, 2], [72, 2], [70, 1], [69, 1], [67, 4]],
      [[65, 2], [67, 1], [69, 1], [70, 4], [69, 6], [-1, 2]],
      [[74, 1], [74, 1], [81, 2], [81, 1], [79, 1], [77, 2], [76, 2], [77, 1], [76, 1], [72, 4]],
      [[74, 2], [72, 1], [70, 1], [69, 2], [67, 2], [64, 2], [69, 6]],
    ],
    melB: [
      [[77, 3], [76, 1], [74, 2], [72, 2], [72, 2], [74, 1], [76, 1], [79, 4]],
      [[81, 3], [79, 1], [77, 2], [74, 2], [74, 2], [77, 2], [74, 4]],
      [[77, 3], [76, 1], [77, 2], [81, 2], [84, 2], [81, 1], [79, 1], [76, 4]],
      [[76, 2], [77, 1], [76, 1], [73, 4], [69, 8]],
    ],
    leadA: 'horn', counterA2: 'suona', leadB: 'erhu', supportB: 'horn', drums: 'gallop',
  },
  /** 第三章《群雄逐鹿》：A 小调 104 BPM，竹笛主奏、二胡副歌，行进鼓。 */
  qunxiong: {
    title: '群雄逐鹿', bpm: 104, tr: -5,
    intro: ['Dm', 'Bb', 'Gm', 'A'], a: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], b: ['Gm', 'Dm', 'Bb', 'F', 'Gm', 'Dm', 'A', 'A'], br: ['Dm', 'Bb', 'Gm', 'A'],
    melA: [
      [[74, 4], [72, 2], [69, 2], [70, 3], [69, 1], [65, 4]],
      [[65, 2], [67, 2], [69, 2], [72, 2], [67, 6], [-1, 2]],
      [[74, 4], [77, 2], [76, 2], [74, 3], [72, 1], [70, 4]],
      [[67, 2], [70, 2], [69, 2], [67, 2], [64, 4], [69, 4]],
    ],
    melB: [
      [[79, 4], [77, 2], [74, 2], [77, 3], [76, 1], [74, 4]],
      [[74, 2], [77, 2], [81, 2], [79, 2], [77, 6], [-1, 2]],
      [[79, 3], [81, 1], [82, 2], [81, 2], [77, 2], [74, 2], [81, 4]],
      [[76, 3], [74, 1], [73, 2], [76, 2], [69, 8]],
    ],
    leadA: 'dizi', counterA2: 'pipa', leadB: 'erhu', supportB: 'horn', drums: 'march',
  },
  /** 第四章《官渡对垒》：C 小调 96 BPM，重鼓；号角奏宽广主题，副歌唢呐高起。 */
  guandu: {
    title: '官渡对垒', bpm: 96, tr: -2,
    intro: ['Dm', 'Dm', 'Bb', 'A'], a: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], b: ['Dm', 'F', 'Gm', 'A', 'Bb', 'Gm', 'A', 'A'], br: ['Dm', 'Bb', 'Gm', 'A'],
    melA: [
      [[62, 4], [69, 4], [67, 2], [65, 2], [69, 4]],
      [[70, 4], [69, 2], [65, 2], [62, 6], [-1, 2]],
      [[67, 4], [70, 4], [74, 2], [72, 2], [70, 4]],
      [[69, 4], [73, 2], [76, 2], [69, 6], [-1, 2]],
    ],
    melB: [
      [[81, 3], [79, 1], [77, 2], [76, 2], [77, 4], [72, 4]],
      [[74, 2], [77, 2], [79, 4], [76, 6], [-1, 2]],
      [[77, 3], [79, 1], [81, 2], [82, 2], [79, 4], [74, 4]],
      [[76, 2], [77, 2], [76, 2], [73, 2], [69, 8]],
    ],
    leadA: 'horn', counterA2: 'erhu', leadB: 'suona', supportB: 'horn', drums: 'heavy',
  },
  /** 第五章《赤壁东风》：F 小调 108 BPM，竹笛如江风、二胡副歌，紧张鼓型 + 火星噼啪。 */
  chibi: {
    title: '赤壁东风', bpm: 108, tr: 3,
    intro: ['Dm', 'Am', 'Bb', 'A'], a: ['Dm', 'Am', 'Bb', 'F', 'Gm', 'Dm', 'A', 'A'], b: ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'A', 'A'], br: ['Dm', 'Am', 'Bb', 'A'],
    melA: [
      [[69, 2], [74, 2], [72, 1], [69, 1], [67, 2], [69, 4], [64, 4]],
      [[65, 2], [67, 1], [69, 1], [70, 2], [69, 2], [65, 6], [-1, 2]],
      [[67, 2], [70, 2], [74, 2], [72, 2], [74, 2], [77, 2], [74, 4]],
      [[73, 3], [76, 1], [74, 2], [73, 2], [69, 8]],
    ],
    melB: [
      [[77, 3], [74, 1], [77, 2], [79, 2], [79, 4], [76, 4]],
      [[76, 2], [77, 2], [76, 2], [72, 2], [74, 6], [-1, 2]],
      [[79, 3], [77, 1], [79, 2], [82, 2], [81, 2], [79, 2], [76, 4]],
      [[76, 2], [73, 2], [76, 2], [79, 2], [81, 8]],
    ],
    leadA: 'dizi', counterA2: 'pipa', leadB: 'erhu', supportB: 'horn', drums: 'tense', fire: true,
  },
};
/** 按战斗场景挑战斗曲：群雄 / 官渡 / 赤壁各一首；攻城用官渡；吕布挑战关与第二章同曲；其余按章节。 */
export function battleThemeFor(sceneKey: string, chapterId: string): BattleThemeKey {
  if (sceneKey === 'ChibiGameScene') return 'chibi';
  if (sceneKey === 'ThirdGameScene') return 'qunxiong';
  if (sceneKey === 'GuanduGameScene' || sceneKey === 'SiegeGameScene') return 'guandu';
  if (sceneKey === 'LubuGameScene' || chapterId === 'hulao') return 'hulao';
  return 'huangjin';
}
function expand(lines: Line[]): Array<[number, number] | null> {
  const out: Array<[number, number] | null> = new Array(lines.length * 32).fill(null);
  lines.forEach((ln, i) => { let pos = i * 32; for (const [m, len] of ln) { if (m >= 0) out[pos] = [m, len * 2]; pos += len * 2; } });
  return out;
}
/** 低音顿弓跑动音型（相对根音的半音，十六分）：经典“哒哒咚”推进；奔马曲用更密的八度跳。 */
const OSTI = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7];
const OSTI_GALLOP = [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 7, 12, 7, 12];

// ---------------------------------------------------------------- 引擎
type Ctx = BaseAudioContext;

export class EpicBgm {
  private readonly input: GainNode;
  private readonly hall: GainNode;
  private readonly room: GainNode;
  private readonly noise: AudioBuffer;
  private erhuLast = 0;
  private melody: { key: string; steps: Array<[number, number] | null>; scale: number[] } | null = null;

  constructor(private readonly ctx: Ctx, out: AudioNode) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = .008; comp.release.value = .25;
    const post = ctx.createGain(); post.gain.value = 1; comp.connect(post); post.connect(out);
    // 输入先衰减约 10 dB：与旧版响度对齐，同时让压缩器只压峰值、保留段落渐强。
    this.input = ctx.createGain(); this.input.gain.value = .26; this.input.connect(comp);
    // 大厅：高通后进卷积，避免低频糊成一片
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
    const pre = ctx.createDelay(.2); pre.delayTime.value = .03;
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 3.6, 2.6, .86);
    this.hall = ctx.createGain(); this.hall.gain.value = .55;
    this.hall.connect(hp); hp.connect(pre); pre.connect(conv); conv.connect(this.input);
    const rconv = ctx.createConvolver(); rconv.buffer = impulse(ctx, 1.2, 2.2, .6);
    this.room = ctx.createGain(); this.room.gain.value = .5; this.room.connect(rconv); rconv.connect(this.input);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ============================================================ 战斗曲
  private theme: BattleTheme = BATTLE_THEMES.huangjin;
  private melA = expand(BATTLE_THEMES.huangjin.melA);
  private melB = expand(BATTLE_THEMES.huangjin.melB);
  setBattleTheme(key: BattleThemeKey): void { const th = BATTLE_THEMES[key]; this.theme = th; this.melA = expand(th.melA); this.melB = expand(th.melB); }

  private voice(kind: Voice, midi: number, t: number, dur: number, v: number): void {
    const f = mtof(midi);
    if (kind === 'erhu') this.erhu(f, t, dur, v);
    else if (kind === 'dizi') this.dizi(f, t, dur * .95, v * .85);
    else if (kind === 'suona') this.suona(f, t, dur * .95, v * .8);
    else if (kind === 'horn') this.horn(mtof(midi - 12), t, dur * .95, v * .9);
    else this.pipaTrem(f, t, dur, v * .7);
  }

  /** step：自开始起的十六分步（不回绕）；heavy：场上有追击首领等，打击乐加重。 */
  battleStep(step: number, t: number, sd: number, heavy: boolean): void {
    const th = this.theme, tr = th.tr, gb = Math.floor(step / 16), pos = step % 16;
    let sec: 'intro' | 'A' | 'A2' | 'B' | 'BR', bar: number;
    if (gb < 4) { sec = 'intro'; bar = gb; } else {
      const lb = (gb - 4) % 28;
      if (lb < 8) { sec = 'A'; bar = lb; } else if (lb < 16) { sec = 'A2'; bar = lb - 8; } else if (lb < 24) { sec = 'B'; bar = lb - 16; } else { sec = 'BR'; bar = lb - 24; }
    }
    const chName = sec === 'intro' ? th.intro[bar] : sec === 'B' ? th.b[bar] : sec === 'BR' ? th.br[bar] : th.a[bar];
    const ch = CH[chName], bass = ch.bass + tr, bar16 = sd * 16;
    const lvl = sec === 'intro' ? .55 + bar * .12 : sec === 'A' ? .8 : sec === 'A2' ? .9 : 1;

    // 低音长音 + 合唱铺底
    if (pos === 0) {
      this.bassDrone(mtof(bass), t, bar16 * 1.05, .085 * lvl);
      const vowel = sec === 'B' ? 'a' : 'o', cv = sec === 'B' ? .05 : sec === 'intro' ? .028 : sec === 'BR' ? .045 : .03;
      this.choir((sec === 'B' ? ch.pad.map(n => n + 12).slice(1) : ch.pad).map(n => n + tr), t, bar16 * 1.02, cv, vowel);
    }
    // 弦乐顿弓（前奏第 2 小节起）
    if (sec !== 'intro' || bar >= 2) {
      const r = (th.drums === 'gallop' ? OSTI_GALLOP : OSTI)[pos], acc = pos === 0 || pos === 8 ? 1 : pos % 4 === 0 ? .8 : .6;
      if (!(sec === 'BR' && bar === 3 && pos >= 8)) this.ostinato(mtof(bass + 12 + r), t, sd * .9, .05 * acc * lvl);
    }
    // 主旋律
    if (sec === 'A' || sec === 'A2') {
      const n = this.melA[bar * 16 + pos];
      if (n) {
        const m = n[0] + tr;
        this.voice(th.leadA, m, t, n[1] * sd, .07);
        if (sec === 'A2') this.voice(th.counterA2, th.counterA2 === 'pipa' || th.counterA2 === 'erhu' ? m : m + 12, t, n[1] * sd, .032);
        if (sec === 'A2' && n[1] >= 8 && th.counterA2 !== 'pipa') this.pipaTrem(mtof(m - 12), t, n[1] * sd, .028);
      }
    } else if (sec === 'B') {
      const n = this.melB[bar * 16 + pos];
      if (n) { const m = n[0] + tr; this.voice(th.leadB, m, t, n[1] * sd, .065); this.voice(th.supportB, m - 12, t, n[1] * sd, .034); }
      if ((pos === 0 || pos === 10) && bar % 2 === 1) this.hornChord(bass + 12, t, sd * 3, .035);
    } else if (sec === 'intro' && bar === 0 && pos === 0) {
      this.horn(mtof(50 + tr), t, bar16 * 1.6, .05); this.horn(mtof(57 + tr), t + sd * 2, bar16 * 1.4, .035);
    } else if (sec === 'BR' && pos % 8 === 0 && bar < 3) {
      this.hornChord(bass + 12, t, sd * (pos === 0 ? 6 : 3), .045);
    }
    if (th.fire && (sec === 'B' || sec === 'BR') && Math.random() < .15) this.noiseHit(t + Math.random() * sd, .02 + Math.random() * .03, 'highpass', 2500 + Math.random() * 3000, .03, this.bus(0, .2));

    // 打击乐
    const H = heavy ? 1.15 : 1;
    if (sec === 'intro') {
      if (pos === 0 || (bar >= 1 && pos === 8)) this.warDrum(t, .7 * lvl);
      if (bar >= 2 && (pos === 4 || pos === 12)) this.smallDrum(t, .35);
      if (bar === 3 && pos >= 8) this.smallDrum(t, .15 + (pos - 8) * .05);
      if (bar === 0 && pos === 0) this.gong(t, .22);
      if (bar === 3 && pos === 0) this.cymbalSwell(t, bar16, .12);
    } else if (sec === 'BR') {
      if ([0, 3, 6, 8, 10, 12, 14].includes(pos)) this.warDrum(t, (pos === 0 ? .95 : .62) * H);
      if (pos % 2 === 1 && bar % 2 === 1) this.smallDrum(t, .22);
      if (bar === 3 && pos >= 8) this.smallDrum(t, .2 + (pos - 8) * .06);
      if (pos === 0 && bar === 0) this.cymbal(t, .14);
      if (bar === 3 && pos === 0) this.gongSwell(t, bar16, .2);
    } else {
      const lite = sec === 'A';
      const big = th.drums === 'gallop' ? [0, 3, 6, 8, 11, 14] : th.drums === 'heavy' ? (lite ? [0, 8] : [0, 8, 10]) : th.drums === 'tense' ? (lite ? [0, 7, 10] : [0, 7, 10, 14]) : (lite ? [0, 6, 8] : [0, 6, 8, 10]);
      if (big.includes(pos)) this.warDrum(t, (pos === 0 ? .85 : th.drums === 'gallop' ? .45 : .55) * H);
      if (pos === 4 || pos === 12) this.smallDrum(t, .42 * H);
      if (!lite && pos % 2 === 1) this.smallDrum(t, .1 + (pos === 15 ? .1 : 0));
      if (lite && pos === 14 && bar % 2 === 1) this.smallDrum(t, .22);
      if (th.drums === 'tense' && lite && pos % 4 === 2) this.clapper(t);
      if (heavy && pos % 2 === 1) this.smallDrum(t, .12);
      if (pos === 0 && bar === 0) { this.cymbal(t, sec === 'B' ? .16 : .1); if (sec === 'B') this.gong(t, .2); }
      if (pos === 0 && bar === 4 && !lite) this.cymbal(t, .1);
      if (th.drums === 'heavy' && pos === 0 && bar % 4 === 0 && sec !== 'B') this.gong(t, .12);
      if (pos === 8 && bar === 7) this.cymbalSwell(t, sd * 8, .08);
    }
  }

  // ============================================================ 首领曲
  /** 首领出场：锣 + 钹 + 合唱齐呼 → 战鼓由疏到密 → 号角奏三音动机 → 重鼓与大锣收（约 2.4 秒）。 */
  bossStinger(p: BossProfile, t: number): void {
    const root = p.tonic - 24;
    this.gong(t, .3); this.cymbal(t, .16); this.warDrum(t, 1);
    this.choir(this.powerChord(p, 0).map(n => n + 12), t, 2.3, .07, 'a');
    this.bassDrone(mtof(root), t, 2.6, .09);
    let x = .35; for (let i = 0; i < 16; i++) { this.warDrum(t + x, .25 + i * .035); x += Math.max(.045, .16 - i * .008); }
    const motif = bossMotif(p), lt = t + 1.0;
    motif.forEach((m, i) => this.horn(mtof(m - 12), lt + i * .26, i === 2 ? 1.2 : .24, i === 2 ? .07 : .055));
    if (p.fx.includes('thunder')) this.thunder(t + .1, .22);
    if (p.fx.includes('earth')) this.earth(t, .22);
    if (p.fx.includes('bells')) motif.forEach((m, i) => this.bell(mtof(m + 12), lt + i * .26, .02));
    this.warDrum(t + 2.25, 1.1); this.gong(t + 2.25, .26); this.cymbal(t + 2.25, .14);
  }

  private bossMel(p: BossProfile): { steps: Array<[number, number] | null>; scale: number[] } {
    const key = p.name + p.title;
    if (!this.melody || this.melody.key !== key) this.melody = { key, steps: composeBossMelody(p), scale: profileScale(p) };
    return this.melody;
  }

  /** 根音（低音区 MIDI）+ 五度 + 八度，若调式内有三度则加上（小三度优先）。 */
  private powerChord(p: BossProfile, deg: number): number[] {
    const rel = p.mode[deg % p.mode.length] + (deg >= p.mode.length ? 12 : 0), root = p.tonic - 12 + rel;
    const set = new Set(p.mode.map(m => m % 12));
    const third = set.has((rel + 3) % 12) ? 3 : set.has((rel + 4) % 12) ? 4 : 0;
    const out = [root, root + 7, root + 12];
    if (third) out.push(root + 12 + third); else out.push(root + 19);
    return out;
  }

  /** step：首领曲开始后的十六分步（不回绕）。 */
  bossStep(p: BossProfile, step: number, t: number, sd: number): void {
    const gb = Math.floor(step / 16), pos = step % 16, bar16 = sd * 16;
    const intro = gb < 4, lb = intro ? -1 : (gb - 4) % 32;
    const sec: 'intro' | 'build' | 'A' | 'B' | 'peak' | 'turn' = intro ? 'intro' : lb < 8 ? 'build' : lb < 16 ? 'A' : lb < 24 ? 'B' : lb < 30 ? 'peak' : 'turn';
    const bar = intro ? gb : lb, deg = p.bass[bar % 8], chord = this.powerChord(p, deg), root = chord[0] - 12;
    const { steps: mel, scale } = this.bossMel(p);
    const fast = p.bpm >= 118;
    const lvl = sec === 'intro' ? .45 + gb * .12 : sec === 'build' ? .6 + (lb / 8) * .35 : sec === 'A' ? .95 : 1.05;

    // 低音 + 合唱
    if (pos === 0) {
      this.bassDrone(mtof(root), t, bar16 * 1.05, .1 * Math.min(1, lvl));
      const vowel = sec === 'intro' || sec === 'build' ? 'o' : 'a';
      const cv = sec === 'intro' ? .03 + gb * .006 : sec === 'build' ? .04 : sec === 'A' ? .045 : sec === 'B' ? .05 : .065;
      const notes = sec === 'peak' || sec === 'turn' ? [...chord.slice(1), chord[0] + 24] : chord;
      this.choir(notes, t, bar16 * 1.02, cv, vowel);
      if (sec === 'peak' && bar % 2 === 0) this.choir([chord[0] + 24, chord[1] + 24], t, bar16 * 2, .03, 'a');
    }
    // 弦乐顿弓：前奏第 3 小节起
    if (!intro || gb >= 2) {
      const pat = fast ? [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 7, 12, 7, 12] : OSTI;
      const every = intro ? 2 : 1;
      if (pos % every === 0) { const acc = pos % 8 === 0 ? 1 : pos % 4 === 0 ? .8 : .6; this.ostinato(mtof(root + 12 + pat[pos]), t, sd * .9, .055 * acc * Math.min(1.1, lvl)); }
    }
    // 旋律
    const note = (mb: number): [number, number] | null => mel[(mb * 16 + pos) % mel.length];
    if (sec === 'build' && (lb === 0 || lb === 4) && pos === 0) {
      this.horn(mtof(chord[0]), t, bar16 * 1.8, .05); this.horn(mtof(chord[1]), t + sd * 2, bar16 * 1.6, .035);
    } else if (sec === 'A') {
      const n = note(lb - 8); if (n) this.horn(mtof(scale[n[0]] - 12), t, n[1] * sd * .95, .06);
    } else if (sec === 'B') {
      const n = note(lb - 16 + 8); if (n) this.lead(p, mtof(scale[n[0]]), t, n[1] * sd, .065);
      if (pos === 0 || pos === 10) this.hornChord(chord[0], t, sd * (pos === 0 ? 4 : 3), .035);
    } else if (sec === 'peak') {
      const n = note(lb - 24);
      if (n) { this.horn(mtof(scale[n[0]] - 12), t, n[1] * sd * .95, .06); this.lead(p, mtof(scale[n[0]]), t, n[1] * sd, .055); }
      if (pos === 0) this.hornChord(chord[0], t, sd * 3, .03);
    } else if (sec === 'turn' && lb === 31 && pos === 8) {
      this.horn(mtof(chord[0]), t, sd * 8, .05); this.horn(mtof(chord[1]), t, sd * 8, .04);
    }

    this.bossDrums(p, sec, bar, pos, t, sd);

    // 首领标志音效
    for (const fx of p.fx) {
      if (fx === 'gong' && pos === 0 && !intro && bar % 4 === 0) this.gong(t, .16);
      if (fx === 'thunder' && pos === 0 && (lb === 8 || lb === 24)) this.thunder(t, .2);
      if (fx === 'bells' && pos === 0 && (sec === 'B' || sec === 'peak') && bar % 2 === 0) this.bell(mtof(scale[bar % 4 === 0 ? 5 : 3] + 12), t, .02);
      if (fx === 'earth' && pos === 0 && (lb === 16 || lb === 24)) this.earth(t, .18);
      if (fx === 'fire' && sec === 'peak' && Math.random() < .2) this.noiseHit(t + Math.random() * sd, .02 + Math.random() * .03, 'highpass', 2500 + Math.random() * 3000, .03, this.bus(0, .2));
      if (fx === 'horn' && pos === 8 && sec === 'A' && bar % 4 === 3) this.hornChord(chord[0], t, sd * 6, .03);
    }
  }

  private bossDrums(p: BossProfile, sec: string, bar: number, pos: number, t: number, sd: number): void {
    const bar16 = sd * 16;
    if (sec === 'intro') {
      if (pos === 0) this.warDrum(t, .55 + bar * .12);
      if (bar >= 2 && pos === 8) this.warDrum(t, .5);
      if (bar === 3 && pos >= 8) this.smallDrum(t, .15 + (pos - 8) * .06);
      if (bar === 0 && pos === 0) this.gongSwell(t, bar16 * .8, .16);
      if (bar === 3 && pos === 0) this.cymbalSwell(t, bar16, .13);
      return;
    }
    if (sec === 'build') {
      if (pos === 0 || pos === 8) this.warDrum(t, pos === 0 ? .8 : .55);
      if (bar >= 4 && (pos === 4 || pos === 12)) this.smallDrum(t, .35);
      if (bar >= 6 && pos % 2 === 0) this.smallDrum(t, .12 + (bar - 6) * .08);
      if (bar === 7 && pos >= 8) { this.warDrum(t, .35 + (pos - 8) * .07); }
      if (bar === 7 && pos === 0) this.cymbalSwell(t, bar16, .12);
      if (bar === 0 && pos === 0) this.gong(t, .18);
      return;
    }
    if (sec === 'turn') {
      if (pos % 2 === 0) this.warDrum(t, .55 + (bar - 30) * .15 + pos * .02);
      this.smallDrum(t, .1 + ((bar - 30) * 16 + pos) * .012);
      if (bar === 30 && pos === 0) this.gongSwell(t, bar16 * 2, .24);
      return;
    }
    const full = sec === 'B' || sec === 'peak';
    let big: number[], small: number[];
    switch (p.drums) {
      case 'gallop': big = [0, 3, 6, 8, 11, 14]; small = [4, 12]; break;
      case 'ritual': big = [0, 6, 8]; small = [3, 4, 11, 12]; break;
      case 'heavy': big = [0, 8, 10]; small = [4, 12]; break;
      case 'ceremony': big = [0, 8]; small = [12]; break;
      case 'tense': big = [0, 7, 10]; small = [4, 12, 14]; break;
      default: big = [0, 6, 8]; small = [4, 12];
    }
    if (big.includes(pos)) this.warDrum(t, pos === 0 ? 1 : .62);
    if (small.includes(pos)) this.smallDrum(t, .42);
    if (full && pos % 2 === 1) this.smallDrum(t, sec === 'peak' ? .16 : .1);
    if (sec === 'peak' && (pos === 14 || pos === 15) && bar % 2 === 1) this.warDrum(t, .5);
    if (p.drums === 'ritual' && pos % 2 === 1 && !full) this.clapper(t);
    if (pos === 0 && (bar % 4 === 0 || (sec === 'peak' && bar % 2 === 0))) this.cymbal(t, sec === 'A' ? .1 : .14);
    if (pos === 0 && full && bar % 4 === 0) this.gong(t, .2);
    if (sec === 'peak' && pos === 8) this.cymbal(t, .06);
  }

  private lead(p: BossProfile, freq: number, t: number, dur: number, gain: number): void {
    if (p.lead === 'pipa') this.pipaTrem(freq, t, dur, gain * .8);
    else if (p.lead === 'suona') this.suona(freq, t, dur * .95, gain * .9);
    else if (p.lead === 'flute') this.dizi(freq, t, dur * .95, gain * .9);
    else this.erhu(freq / 2, t, dur, gain * 1.1);
  }

  // ============================================================ 乐器
  /** 输出：干声 + 大厅 / 房间混响送量。 */
  private bus(hall: number, room = 0): GainNode {
    const ctx = this.ctx, g = ctx.createGain(); g.connect(this.input);
    if (hall > 0) { const s = ctx.createGain(); s.gain.value = hall; g.connect(s); s.connect(this.hall); }
    if (room > 0) { const s = ctx.createGain(); s.gain.value = room; g.connect(s); s.connect(this.room); }
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o;
  }

  private env(dest: AudioNode, t: number, peak: number, attack: number, hold: number, release: number, exp = false): GainNode {
    const g = this.ctx.createGain(); g.connect(dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    if (exp) g.gain.exponentialRampToValueAtTime(.0001, t + attack + release);
    else { g.gain.setValueAtTime(peak, t + Math.max(attack, hold)); g.gain.linearRampToValueAtTime(0, t + Math.max(attack, hold) + release); }
    return g;
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, gain: number, dest: AudioNode, q = .7, attack = .001): void {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + attack + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random() * 1.5); src.stop(t + attack + dur + .05);
  }

  /** 战鼓：次低频下坠 + 鼓身 + 皮面噪声 + 鼓槌声，送短房间混响。 */
  warDrum(t: number, v: number): void {
    const out = this.bus(.12, .6);
    const sub = this.env(out, t, v * .9, .003, 0, 1.0, true); const o = this.osc('sine', 78, t, t + 1.1, sub); o.frequency.exponentialRampToValueAtTime(42, t + .35);
    const body = this.env(out, t, v * .45, .002, 0, .28, true); const o2 = this.osc('triangle', 165, t, t + .32, body); o2.frequency.exponentialRampToValueAtTime(82, t + .09);
    this.noiseHit(t, .09, 'lowpass', 1500, v * .4, out);
    this.noiseHit(t, .018, 'bandpass', 2800, v * .18, out, 1.2);
  }
  /** 小堂鼓：较高的鼓身 + 带通噪声，作推进与滚奏。 */
  smallDrum(t: number, v: number): void {
    const out = this.bus(.1, .45);
    const b = this.env(out, t, v * .28, .002, 0, .16, true); const o = this.osc('triangle', 290, t, t + .2, b); o.frequency.exponentialRampToValueAtTime(185, t + .05);
    this.noiseHit(t, .11, 'bandpass', 1300, v * .3, out, 1);
    this.noiseHit(t, .04, 'highpass', 4500, v * .12, out);
  }
  private clapper(t: number): void { const out = this.bus(.2); const g = this.env(out, t, .05, .001, 0, .05, true); this.osc('sine', 1650, t, t + .07, g); }
  /** 钹：高通噪声长尾 + 带通“镲身”。 */
  cymbal(t: number, v: number): void {
    const out = this.bus(.45);
    this.noiseHit(t, 1.6, 'highpass', 5200, v * .5, out);
    this.noiseHit(t, .35, 'bandpass', 3200, v * .35, out, 1.4);
  }
  /** 反向钹：渐强到下一小节。 */
  cymbalSwell(t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.5), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'highpass'; f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * .97); g.gain.linearRampToValueAtTime(0, t + dur + .02);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + .05);
  }
  /** 大锣：一组非整数倍泛音（低音长、高音短，音高略下沉）+ 慢慢涌起的“嗡”声。 */
  gong(t: number, v: number, attack = .015): void {
    const out = this.bus(.75), base = 92;
    const parts: Array<[number, number, number]> = [[1, 1, 4.2], [1.47, .7, 3.6], [2.09, .55, 3], [2.68, .4, 2.5], [3.31, .3, 2], [4.17, .22, 1.6], [5.43, .15, 1.2], [6.9, .1, .9]];
    for (const [r, a, d] of parts) {
      const g = this.env(out, t, v * a * .35, attack, 0, d, true);
      const o = this.osc('sine', base * r, t, t + attack + d + .05, g, (Math.random() - .5) * 12); o.frequency.exponentialRampToValueAtTime(base * r * .975, t + d);
    }
    this.noiseHit(t + .05, 2.8, 'bandpass', 1100, v * .12, out, .9, .35);
    this.noiseHit(t, .12, 'bandpass', 2600, v * .2, out, 1.5);
  }
  /** 大锣渐强：在 dur 秒内由无到有，结尾一击。 */
  gongSwell(t: number, dur: number, v: number): void {
    const out = this.bus(.8), base = 92, end = t + dur;
    for (const [r, a] of [[1, 1], [1.47, .7], [2.09, .55], [2.68, .4], [3.31, .3]] as const) {
      const g = this.ctx.createGain(); g.connect(out);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * a * .3, end); g.gain.linearRampToValueAtTime(0, end + .08);
      this.osc('sine', base * r, t, end + .1, g, (Math.random() - .5) * 15);
    }
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, end); f.Q.value = .8;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * .25, end); g.gain.linearRampToValueAtTime(0, end + .06);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(end + .1);
  }

  /** 低音长音：锯齿 + 正弦经低通，缓起缓收。 */
  private bassDrone(freq: number, t: number, dur: number, v: number): void {
    const out = this.bus(.15), f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.connect(this.env(out, t, v, .25, dur - .35, .35));
    this.osc('sawtooth', freq, t, t + dur + .05, f); this.osc('sine', freq, t, t + dur + .05, f, 4); this.osc('sine', freq / 2, t, t + dur + .05, f);
  }
  /** 弦乐顿弓：两支略失谐锯齿波，滤波包络由亮到暗，短促有弹性。 */
  private ostinato(freq: number, t: number, dur: number, v: number): void {
    const out = this.bus(.28), f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(Math.min(4000, freq * 9), t); f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 2.5), t + .12);
    f.connect(this.env(out, t, v, .006, 0, Math.max(.1, dur * 1.2), true));
    this.osc('sawtooth', freq, t, t + dur * 1.3 + .1, f, -8); this.osc('sawtooth', freq, t, t + dur * 1.3 + .1, f, 8);
  }
  /** 铜管号角：失谐锯齿合奏 + 低八度正弦，滤波“吹开”后回落，延迟揉音。 */
  horn(freq: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.5), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.1;
    const open = Math.min(3200, freq * 7), rest = Math.min(2200, freq * 4);
    f.frequency.setValueAtTime(freq * 1.4, t); f.frequency.exponentialRampToValueAtTime(open, t + .1); f.frequency.exponentialRampToValueAtTime(rest, t + .35);
    f.frequency.setValueAtTime(rest, t + Math.max(.36, dur - .1)); f.frequency.exponentialRampToValueAtTime(freq * 1.6, t + dur + .2);
    f.connect(this.env(out, t, v, .07, dur - .07, .22));
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 5; dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(7, t + Math.min(.6, dur));
    lfo.connect(dep); lfo.start(t); lfo.stop(t + dur + .3);
    for (const d of [-9, 0, 9]) dep.connect(this.osc('sawtooth', freq, t, t + dur + .3, f, d).detune);
    const s = ctx.createGain(); s.gain.value = .5; s.connect(f); this.osc('sine', freq / 2, t, t + dur + .3, s);
  }
  private hornChord(rootMidi: number, t: number, dur: number, v: number): void {
    this.horn(mtof(rootMidi), t, dur, v); this.horn(mtof(rootMidi + 7), t, dur, v * .8); this.horn(mtof(rootMidi + 12), t, dur, v * .6);
  }
  /** 合唱：每个音三支失谐振荡器经三段共振峰（男声“啊 / 哦”），慢起慢收 + 揉音。 */
  choir(notes: number[], t: number, dur: number, v: number, vowel: 'a' | 'o'): void {
    const ctx = this.ctx, out = this.bus(.85);
    const F = vowel === 'a' ? [[730, 1, 6], [1090, .5, 8], [2440, .22, 10]] : [[500, 1, 6], [850, .45, 8], [2450, .18, 10]];
    const attack = Math.min(.9, dur * .35), rel = .7;
    const amp = this.env(out, t, v, attack, dur - attack - .1, rel);
    const mixes = F.map(([fr, a, q]) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; const g = ctx.createGain(); g.gain.value = a * 3; f.connect(g); g.connect(amp); return f; });
    const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 900; const bg = ctx.createGain(); bg.gain.value = .35; body.connect(bg); bg.connect(amp);
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 4.6; dep.gain.value = 9; lfo.connect(dep); lfo.start(t); lfo.stop(t + dur + rel + .1);
    for (const n of notes) {
      const fr = mtof(n);
      for (const d of [-11, 0, 11]) { const o = this.osc('sawtooth', fr, t, t + dur + rel + .1, body, d + (Math.random() - .5) * 4); dep.connect(o.detune); for (const m of mixes) o.connect(m); }
    }
  }
  /** 二胡：锯齿波 + 琴筒共鸣峰，与上一音之间滑音，揉弦渐深。 */
  erhu(freq: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.5);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 950; pk.gain.value = 7; pk.Q.value = 1.4;
    const pk2 = ctx.createBiquadFilter(); pk2.type = 'peaking'; pk2.frequency.value = 2700; pk2.gain.value = 4; pk2.Q.value = 2;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    hp.connect(pk); pk.connect(pk2); pk2.connect(lp); lp.connect(this.env(out, t, v, .07, dur - .1, .14));
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const from = this.erhuLast && Math.abs(Math.log2(this.erhuLast / freq)) < .6 ? this.erhuLast : freq * .97;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(freq, t + .07);
    this.erhuLast = freq;
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 5.8;
    dep.gain.setValueAtTime(0, t); dep.gain.setValueAtTime(0, t + Math.min(.18, dur * .4)); dep.gain.linearRampToValueAtTime(freq * .011, t + Math.min(.7, dur));
    lfo.connect(dep); dep.connect(o.frequency); o.connect(hp);
    for (const n of [o, lfo]) { n.start(t); n.stop(t + dur + .25); }
    this.noiseHit(t, Math.max(.05, dur - .05), 'bandpass', Math.min(6000, freq * 3), v * .08, hp, 3, .05);
  }
  /** 唢呐：带通鼻音 + 原声高频，起音由下方滑入，快揉音。 */
  private suona(freq: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.45), a = this.env(out, t, v, .03, dur - .08, .1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(3400, freq * 2.4); bp.Q.value = 1.3; bp.connect(a);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; const lg = ctx.createGain(); lg.gain.value = .35; lp.connect(lg); lg.connect(a);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * .94, t); o.frequency.exponentialRampToValueAtTime(freq, t + .06);
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 6.4; dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(freq * .014, t + Math.min(.35, dur * .6));
    lfo.connect(dep); dep.connect(o.frequency); o.connect(bp); o.connect(lp);
    for (const n of [o, lfo]) { n.start(t); n.stop(t + dur + .15); }
  }
  /** 竹笛：正弦 + 二倍三角，延迟颤音 + 气声。 */
  private dizi(freq: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.65), a = this.env(out, t, v, .06, dur - .1, .1);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), m = ctx.createGain(), lfo = ctx.createOscillator(), dep = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = freq; o2.frequency.value = freq * 2; m.gain.value = .14;
    lfo.frequency.value = 5.4; dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(freq * .007, t + Math.min(.4, dur * .6));
    lfo.connect(dep); dep.connect(o.frequency); dep.connect(o2.frequency); o.connect(a); o2.connect(m); m.connect(a);
    for (const n of [o, o2, lfo]) { n.start(t); n.stop(t + dur + .15); }
    this.noiseHit(t, Math.max(.05, dur), 'bandpass', freq * 2, v * .2, a, 2.5, .04);
  }
  /** 琵琶轮指：明亮拨弦以 32 分音符反复。 */
  private pipaTrem(freq: number, t: number, dur: number, v: number): void {
    const n = Math.max(2, Math.min(24, Math.round(dur / .06)));
    for (let k = 0; k < n; k++) this.pluck(freq, t + k * dur / n, k === 0 ? v * 1.3 : v * (.55 + .1 * Math.sin(k)));
  }
  private pluck(freq: number, t: number, v: number): void {
    const out = this.bus(.45);
    for (const [mul, amp, d] of [[1, 1, .5], [2, .5, .25], [3, .3, .12], [4, .15, .07]] as const) this.osc('sine', freq * mul, t, t + d + .03, this.env(out, t, v * amp, .003, 0, d, true));
    this.noiseHit(t, .012, 'highpass', 3000, v * .4, out);
  }
  private bell(freq: number, t: number, v: number): void {
    const out = this.bus(.85);
    for (const [r, a] of [[.5, 1], [1, .8], [2.4, .4], [4.1, .2]] as const) this.osc('sine', freq * r, t, t + 2.8, this.env(out, t, v * a, .004, 0, 2.6, true));
  }
  private thunder(t: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.6), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(130, t + 2.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .06); g.gain.setValueAtTime(v * .6, t + .4); g.gain.exponentialRampToValueAtTime(.0001, t + 2.8);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + 2.9);
  }
  private earth(t: number, v: number): void {
    const out = this.bus(.4), g = this.env(out, t, v, .08, 0, 1.5, true), o = this.osc('sine', 58, t, t + 1.7, g); o.frequency.exponentialRampToValueAtTime(32, t + 1.4);
    this.noiseHit(t, 1.2, 'lowpass', 220, v * .5, out);
  }
}

/** 卷积混响脉冲：立体声去相关噪声，指数衰减，尾部逐渐变暗（一阶低通系数随时间增大）。 */
function impulse(ctx: Ctx, seconds: number, power: number, darken: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len, a = .15 + darken * x * .8;
      lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
      d[i] = lp * Math.pow(1 - x, power) * (1 + (1 - x) * .5);
    }
    // 早期反射
    for (const [ms, g] of [[11, .5], [19, .35], [27, .3], [41, .22]] as const) { const k = Math.floor(ctx.sampleRate * (ms + c * 3) / 1000); if (k < len) d[k] += g * (c ? -1 : 1); }
  }
  return buf;
}
