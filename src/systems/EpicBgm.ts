/**
 * BGM v2（2026-11-16 用户反馈「首领 BGM 要有史诗感」「黄巾军 BGM 不好听」）：仍是 WebAudio 程序合成，无外部音频文件。
 *
 * 相比 v1 的变化：
 * - 混音：大厅卷积混响（预延迟、尾音变暗）+ 鼓用的短房间混响 + 总线压缩，低频更厚、整体更“满”。
 * - 新乐器：战鼓（次低频 + 鼓身 + 皮面三层）、小堂鼓、钹、大锣（可做渐强“涌”）、铜管号角（滤波包络）、
 *   共振峰合唱（男声“啊 / 哦”长音铺底）、弦乐顿弓低音跑动、二胡（滑音 + 渐深揉弦）、改良唢呐、竹笛、琵琶轮指。
 * - 结构：段落推进。首领曲：前奏 4 小节 → 循环 32 小节（蓄势 8 → 主题 8 → 高潮前 8 → 高潮 6 → 转回 2）。
 *   各章战斗曲（BATTLE_THEMES）：前奏 4 小节 → 循环 28 小节（主题 8 → 主题加副奏 8 → 副歌 8 → 鼓段 4）。
 *   黄巾《黄天当立》、讨董《关东烽火》、群雄《群雄逐鹿》、官渡《官渡对垒》、赤壁《赤壁东风》。
 *   界面曲《营火望乡》（旋律同旧版，换新音色）与胜利 / 败退短曲也在这里。
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
  if (sceneKey === 'ChibiGameScene' || sceneKey === 'JingnanGameScene') return 'chibi'; // 第六章暂借赤壁曲
  if (sceneKey === 'HanzhongGameScene') return 'guandu'; // 第八章暂借官渡曲
  if (sceneKey === 'YilingGameScene') return 'chibi'; // 第十章（火攻）暂借赤壁曲
  if (sceneKey === 'BeifaGameScene') return 'guandu'; // 第十二章暂借官渡曲
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

  // ============================================================ 界面曲《营火望乡》（新版音色）
  /**
   * 主城 / 营寨 / 天下地图 / 选将选关共用。旋律与和声沿用旧版（Music.ts 的 MENU_PHRASES / MENU_ROOTS），只换音色：
   * 古琴低音拨弦（偶带滑音）、竹笛（前半）与二胡（后半）吟唱、男声“哦”长音铺底、远处战鼓与轻锣、风铃，大厅混响更深。
   */
  menuStep(step: number, t: number, sd: number, mel: Array<[number, number] | null>, roots: number[], arp: Record<number, number[]>, mood: 'home' | 'map' | 'camp' | 'hall' | 'rest' = 'home'): void {
    const bar = Math.floor(step / 16) % 32, pos = step % 16, root = roots[bar % 8], notes = arp[root], bar16 = sd * 16;
    if (mood !== 'home') { this.menuMood(mood, bar, pos, t, sd, mel, root, notes, bar16); return; }
    if (pos === 0) {
      this.bassDrone(mtof(root - 12), t, bar16 * 1.15, .06);
      if (bar % 2 === 0) this.choir([notes[0], notes[1] + 12, notes[2] + 12].map(n => n - 12), t, bar16 * 2.02, .018, 'o');
      if (bar % 2 === 0) this.warDrum(t, .16);
      if (bar % 16 === 0) this.gong(t, .07);
    }
    if (pos % 4 === 0) { const i = pos / 4; this.qin(mtof(notes[i] - (i === 0 ? 12 : 0)), t, i === 0 ? .075 : .055, pos === 8 && bar % 4 === 3); }
    if (pos === 14 && bar % 4 === 1) for (let k = 0; k < 3; k++) this.bell(mtof(notes[(k + 1) % 4] + 24), t + k * .11, .008);
    const n = mel[(bar * 16 + pos) % mel.length];
    if (n) { if (bar < 16) this.dizi(mtof(n[0]), t, n[1] * sd * .97, .05); else this.erhu(mtof(n[0]), t, n[1] * sd, .055); }
  }
  /**
   * 结局曲（Music.ts 顶部说明）：unify = 《山河定》（D 宫调式，明亮庄严），否则《三分歌》（D 羽调式，苍凉、留白多）。
   * section：0 画卷（主题首次完整呈现）· 1 麒麟阁（加轻鼓点 + 钟）· 2 功臣（最饱满）· 3 收尾（旋律停，长和弦收住，之后只剩低音与偶尔一声钟）。
   * since：进入本段后第几小节（收尾段第 0 小节奏收束和弦）。
   */
  endingStep(step: number, t: number, sd: number, mel: Array<[number, number] | null>, unify: boolean, section: 0 | 1 | 2 | 3, since: number): void {
    const bar = Math.floor(step / 16) % 32, pos = step % 16, bar16 = sd * 16;
    const roots = unify ? [50, 57, 59, 52, 55, 57, 50, 50] : [50, 50, 53, 48, 55, 55, 57, 50];
    const root = roots[bar % 8], third = unify ? ([50, 55, 57].includes(root) ? 4 : 3) : ([53, 48, 55].includes(root) ? 4 : 3);
    const notes = [root, root + 7, root + 12, root + 12 + third];
    if (section === 3) {
      if (since === 0 && pos === 0) {
        // 收束：主音长和弦（编钟依次敲响 + 合唱 + 低音），旋律乐器最后一个长音
        const chord = unify ? [50, 57, 62, 66, 69] : [50, 57, 62, 65, 69];
        chord.forEach((m, i) => this.bell(mtof(m + 12), t + i * .14, unify ? .02 : .015));
        this.choir(chord.slice(0, 4).map(m => m - 12), t, bar16 * 2.6, unify ? .035 : .028, unify ? 'a' : 'o');
        this.bassDrone(mtof(38), t, bar16 * 2.8, .07);
        if (unify) this.dizi(mtof(74), t + sd * 2, bar16 * 1.6, .045); else this.erhu(mtof(62), t + sd * 2, bar16 * 1.6, .045);
        if (unify) this.gong(t, .07);
      } else if (since >= 3 && pos === 0 && bar % 4 === 0) {
        // 余韵：可以一直停在收尾屏——低音 + 一声远钟，四小节一次
        this.bassDrone(mtof(38), t, bar16 * 4.1, .035); this.bell(mtof(unify ? 74 : 69), t + sd * 4, .01);
      }
      return;
    }
    if (pos === 0) {
      this.bassDrone(mtof(root - 12), t, bar16 * 1.1, unify ? .055 : .045);
      if (unify && bar % 4 === 0) for (let k = 0; k < 2; k++) this.bell(mtof(notes[k + 2] + 12), t + k * sd * 2, .016); // 编钟
      if (!unify && bar % 8 === 0) this.bell(mtof(notes[1] + 12), t, .011);
    }
    // 古琴：天下一统四分琶音；三分天下只在一、三拍（留白）
    if (unify ? pos % 4 === 0 : (pos === 0 || pos === 8)) { const i = unify ? pos / 4 : pos / 4; this.qin(mtof(notes[i] - (i === 0 ? 12 : 0)), t, unify ? .05 : .055, !unify && pos === 8 && bar % 4 === 3); }
    // 麒麟阁起：轻的节律
    if (section >= 1) {
      if (unify) { if (pos === 0) this.warDrum(t, section >= 2 ? .12 : .09); if (pos === 8) this.warDrum(t, .05); if (pos === 0 && bar % 2 === 1) this.bell(mtof(notes[2] + 24), t, .008); }
      else if (pos === 0) this.smallDrum(t, .06);
    }
    // 功臣：最饱满
    if (section >= 2 && pos === 0) {
      if (unify && bar % 2 === 0) this.choir([notes[0], notes[1], notes[3]].map(m => m - 12), t, bar16 * 2.02, .028, 'a');
      if (!unify && bar % 4 === 0) this.choir([notes[0], notes[2]].map(m => m - 12), t, bar16 * 4.02, .02, 'o');
      if (unify && pos === 0) this.warDrum(t + sd * 4, .04);
    }
    const n = mel[(bar * 16 + pos) % mel.length];
    if (n) {
      if (unify) { this.dizi(mtof(n[0]), t, n[1] * sd * .97, .045); if (section >= 2) this.horn(mtof(n[0] - 12), t, n[1] * sd * .95, .026); }
      else { this.dizi(mtof(n[0] - 12), t, n[1] * sd * .97, .045); if (section >= 2) this.erhu(mtof(n[0]), t, n[1] * sd, .035); }
    }
  }
  /** 界面曲各情绪的编制（旋律同《营火望乡》）。 */
  private menuMood(mood: 'map' | 'camp' | 'hall' | 'rest', bar: number, pos: number, t: number, sd: number, mel: Array<[number, number] | null>, root: number, notes: number[], bar16: number): void {
    const n = mel[(bar * 16 + pos) % mel.length];
    if (mood === 'map') {
      // 天下地图：大气——低音更深、合唱「啊」两小节一铺、每小节大鼓、八小节一锣；上半曲竹笛、下半曲号角吹旋律
      if (pos === 0) {
        this.bassDrone(mtof(root - 12), t, bar16 * 1.2, .075);
        if (bar % 2 === 0) this.choir([notes[0], notes[1] + 12, notes[2] + 12].map(x => x - 12), t, bar16 * 2.02, .028, 'a');
        this.warDrum(t, .2); if (bar % 8 === 0) this.gong(t, .1);
      }
      if (pos === 8) this.warDrum(t, .09);
      if (pos % 8 === 0) { const i = pos / 8; this.qin(mtof(notes[i * 2] - (i === 0 ? 12 : 0)), t, .06, false); }
      if (n) { if (bar < 16) this.dizi(mtof(n[0]), t, n[1] * sd * .97, .05); else this.horn(mtof(n[0] - 12), t, n[1] * sd * .95, .045); }
      return;
    }
    if (mood === 'camp') {
      // 营寨 / 城池：暖——古琴拨弦八分、小鼓轻点二四拍、竹笛吹旋律；底下远处人声嘈嘈（带通噪声慢涌）与营火噼啪
      if (pos === 0) { this.bassDrone(mtof(root - 12), t, bar16 * 1.1, .045); this.noiseHit(t, bar16 * 1.05, 'bandpass', 420 + (bar % 3) * 80, .012, this.bus(.4), .7, bar16 * .45); }
      if (pos % 2 === 0) this.pluck(mtof(notes[(pos / 2) % 4] + (pos >= 8 ? 12 : 0)), t, pos % 4 === 0 ? .045 : .03);
      if (pos === 4 || pos === 12) this.smallDrum(t, .1);
      if (pos % 3 === 0 && Math.random() < .35) this.noiseHit(t + Math.random() * sd, .02, 'highpass', 2800 + Math.random() * 2000, .006 + Math.random() * .006, this.bus(.2));
      if (n) this.dizi(mtof(n[0]), t, n[1] * sd * .97, .045);
      return;
    }
    if (mood === 'hall') {
      // 招贤馆 / 名将堂：雅——古琴只在一、三拍，箫（竹笛低八度、轻）吹旋律，乐句处编钟两响，极轻的合唱「哦」；无鼓
      if (pos === 0) {
        this.bassDrone(mtof(root - 12), t, bar16 * 1.1, .035);
        if (bar % 2 === 0) for (let k = 0; k < 2; k++) this.bell(mtof(notes[k * 2] + 12), t + k * sd * 2, .014);
        if (bar % 4 === 0) this.choir([notes[0], notes[2] + 12].map(x => x - 12), t, bar16 * 4.02, .012, 'o');
      }
      if (pos === 0 || pos === 8) this.qin(mtof(notes[pos / 4] - (pos === 0 ? 12 : 0)), t, .07, pos === 8 && bar % 4 === 3);
      if (n) this.dizi(mtof(n[0] - 12), t, n[1] * sd * .97, .04);
      return;
    }
    // rest（战斗结算 / 战败退守）：静——古琴四分琶音、二胡吹旋律（轻），四小节一铺合唱；无鼓
    if (pos === 0) { this.bassDrone(mtof(root - 12), t, bar16 * 1.1, .04); if (bar % 4 === 0) this.choir([notes[0], notes[1] + 12].map(x => x - 12), t, bar16 * 4.02, .015, 'o'); }
    if (pos % 4 === 0) { const i = pos / 4; this.qin(mtof(notes[i] - (i === 0 ? 12 : 0)), t, i === 0 ? .06 : .045, false); }
    if (n) this.erhu(mtof(n[0]), t, n[1] * sd, .04);
  }
  /** 古琴：较低泛音、长余音，滑音从下方小二度进入。 */
  private qin(freq: number, t: number, v: number, slide: boolean): void {
    const out = this.bus(.6);
    for (const [mul, amp, d] of [[1, 1, 1.6], [2, .4, .8], [3, .18, .4]] as const) {
      const o = this.osc('sine', freq * mul * (slide ? .944 : 1), t, t + d + .05, this.env(out, t, v * amp, .005, 0, d, true));
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * mul, t + .12);
    }
    this.noiseHit(t, .015, 'bandpass', 2200, v * .3, out, 1.2);
  }

  // ============================================================ 胜利 / 败退短曲（约 4 秒，接在战斗曲之后）
  jingle(victory: boolean, t: number): number {
    if (victory) {
      this.gong(t, .26); this.cymbal(t, .16);
      [0, .3, .45, .6, 1.5].forEach((x, i) => this.warDrum(t + x, i === 4 ? 1 : .7));
      // 号角凯歌：D–A–D 上行后 D 大三和弦长音，合唱“啊”托底，竹笛高音颤奏
      [[62, 0, .28], [69, .3, .14], [74, .45, .14]].forEach(([m, x, d]) => this.horn(mtof(m), t + x, d, .07));
      for (const m of [62, 66, 69, 74]) this.horn(mtof(m), t + .6, 2.4, .045);
      this.choir([62, 66, 69, 74], t + .6, 2.8, .06, 'a');
      this.bassDrone(mtof(38), t + .6, 3, .1);
      for (let k = 0; k < 10; k++) this.dizi(mtof(k % 2 ? 90 : 88), t + .62 + k * .07, .08, .02);
      this.dizi(mtof(86), t + 1.32, 1.6, .03);
      this.gong(t + 1.5, .2); this.cymbal(t + 1.5, .12);
      return 4.2;
    }
    // 败退：两声沉鼓，号角下行，二胡哀声收于主音，低沉合唱与长锣
    this.warDrum(t, .9); this.warDrum(t + .9, .6); this.gong(t, .2);
    [[57, 0, .7], [53, .7, .7], [50, 1.4, 1.8]].forEach(([m, x, d]) => this.horn(mtof(m), t + x, d, .05));
    this.choir([38, 45, 50, 53], t + .3, 3.4, .05, 'o');
    this.bassDrone(mtof(38), t + .2, 3.8, .09);
    [[74, .4, .6], [72, 1, .5], [69, 1.5, .7], [65, 2.2, .6], [62, 2.8, 1.4]].forEach(([m, x, d]) => this.erhu(mtof(m), t + x, d, .045));
    return 4.4;
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

  // ============================================================ 开场动画曲（水墨开场 20 秒，时间轴固定）
  /**
   * 开场《黄巾烽起》：D 调五声（D F G A C → 高潮用 D E G A）。时间轴（秒，自 t0 起）：
   * 0–4.3 黄巾起义（沉鼓 + 埙 + 低音长音；3.0 起人群呐喊铺底）
   * 4.3–8.6 群雄攻关（战鼓逐拍加密、弦乐顿弓、铜管渐强、反向钹到 8.6）
   * 8.6–12.9 桃园三骑冲锋（马蹄鼓点、奔马顿弓、主旋律唢呐 + 号角 + 二胡亮出）
   * 12.9–13.2 刹停（只留反向钹与两下鼓点蓄力）
   * 13.2 刀光劈下（三层大鼓 + 大锣 + 镲 + 金属斩击 + 地裂 + 号角合唱重击）
   * 14.0–20 余音（古琴、竹笛收尾，合唱与大厅混响回荡）。总长以 20.5 秒渲染，渲染端从 18 秒起淡出。
   */
  openingTheme(t0 = 0): void {
    const B = .5375, S = B / 4, T = (b: number): number => t0 + b * B; // 111.6 BPM：8 拍 = 4.3 秒
    // ---- 一、黄巾起义 0–4.3
    this.bassDrone(mtof(38), t0, 4.8, .1);
    [[0, .9], [2.5, .55], [4, .7], [5.5, .5], [6, .75], [7, .45], [7.5, .6]].forEach(([b, v]) => this.warDrum(T(b), v));
    [[57, .5, 2.2], [60, 2.8, 1], [57, 3.8, 1.2], [55, 5.2, 1], [62, 6.4, 1.7]].forEach(([m, b, d]) => this.xun(mtof(m), T(b), d * B, .075));
    this.choir([50, 57, 62], t0 + 3, 2, .035, 'o');
    this.crowd(t0 + 3, 1.6, .05);
    // ---- 二、群雄攻关 4.3–8.6
    for (let b = 8; b < 16; b++) this.warDrum(T(b), .5 + (b - 8) * .06);
    for (let b = 14; b < 16; b += .5) this.warDrum(T(b + .25), .55 + (b - 14) * .1);
    for (let i = 0; i < 32; i++) this.ostinato(mtof(50 + OSTI[i % 16]), T(8) + i * S * 2, S * 1.6, .04 + i * .0022);
    for (let i = 0; i < 16; i++) this.smallDrum(T(12) + i * S, .2 + i * .035);
    this.hornChord(48, T(8), 4.4 * B, .03); this.hornChord(50, T(12), 4.2 * B, .05);
    this.choir([50, 57, 62, 69], T(12), 4.2 * B, .04, 'a');
    this.bassDrone(mtof(38), T(8), 8 * B, .1);
    [[62, 12, 1.5], [65, 13.5, 1], [69, 14.5, 1.5]].forEach(([m, b, d]) => this.voice('erhu', m, T(b), d * B, .04));
    this.cymbalSwell(T(13.7), 2.3 * B, .1);
    this.crowd(T(8), 4.2, .05);
    // ---- 三、桃园三骑冲锋 8.6–12.9
    this.gong(T(16), .3); this.cymbal(T(16), .18);
    for (let k = 16; k < 24; k++) { this.warDrum(T(k), k % 2 ? .75 : 1); this.warDrum(T(k + .5), .5); this.warDrum(T(k + .75), .6); this.smallDrum(T(k + .25), .35); }
    for (let i = 0; i < 32; i++) this.ostinato(mtof(50 + OSTI_GALLOP[i % 16]), T(16) + i * S * 2, S * 1.6, .1);
    this.bassDrone(mtof(38), T(16), 8 * B, .1);
    this.choir([50, 57, 62, 69], T(16), 8 * B, .06, 'a');
    [[69, 16, 1], [74, 17, 1.5], [72, 18.5, .5], [69, 19, 1], [67, 20, 1], [69, 21, 1], [74, 22, 2]].forEach(([m, b, d]) => {
      this.voice('suona', m, T(b), d * B, .075); this.voice('horn', m, T(b), d * B, .065); this.voice('erhu', m - 12, T(b), d * B, .06);
    });
    for (let b = 18; b < 24; b += 2) this.cymbal(T(b), .06);
    this.cymbal(T(20), .1);
    // ---- 刹停 12.9–13.2
    this.cymbalSwell(t0 + 12.45, .75, .15); this.gongSwell(t0 + 12.55, .65, .2);
    this.warDrum(t0 + 12.98, .6); this.warDrum(t0 + 13.1, .85);
    // ---- 四、刀光劈下 13.2
    const hit = t0 + 13.2;
    this.warDrum(hit, 1.3); this.warDrum(hit + .002, 1.2); this.warDrum(hit + .03, .9);
    this.gong(hit, .5, .004); this.cymbal(hit, .36); this.earth(hit, .4); this.thunder(hit, .14);
    this.slash(hit, .34);
    this.hornChord(50, hit, 2, .075); this.choir([38, 50, 57, 62, 69], hit, 2.4, .07, 'a');
    this.bassDrone(mtof(38), hit, 5.8, .09);
    // ---- 五、余音 14–20
    [[50, 14.0], [57, 14.65], [62, 15.3], [69, 15.95], [67, 16.8], [62, 17.6], [57, 18.3], [50, 18.9]].forEach(([m, x]) => this.guqin(mtof(m), t0 + x, m === 50 && x > 18 ? .09 : .075));
    [[69, 14.9, 1.4], [72, 16.3, .8], [74, 17.1, 2.2]].forEach(([m, x, d]) => this.dizi(mtof(m), t0 + x, d, .06));
    this.choir([50, 57, 62], t0 + 14.2, 5.4, .035, 'o');
    this.bell(mtof(74), t0 + 14.5, .022); this.bell(mtof(69), t0 + 17.9, .018);
    this.gong(t0 + 16.8, .12);
  }

  /** 埙：近正弦 + 微弱二次泛音，低通闷音，气声起音，缓慢颤音。 */
  private xun(freq: number, t: number, dur: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.8, .2), a = this.env(out, t, v, .22, dur - .3, .35);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(a);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), m = ctx.createGain(), lfo = ctx.createOscillator(), dep = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; m.gain.value = .12;
    o.frequency.setValueAtTime(freq * .96, t); o.frequency.exponentialRampToValueAtTime(freq, t + .15); o2.frequency.setValueAtTime(freq * 2, t);
    lfo.frequency.value = 4.2; dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(freq * .008, t + Math.min(.8, dur));
    lfo.connect(dep); dep.connect(o.frequency); o.connect(lp); o2.connect(m); m.connect(lp);
    for (const n of [o, o2, lfo]) { n.start(t); n.stop(t + dur + .4); }
    this.noiseHit(t, Math.max(.1, dur), 'bandpass', freq * 1.6, v * .5, lp, 1.8, .12);
  }

  /** 古琴：长余音的泛音列拨弦，起音带指甲声，音高略下滑。 */
  private guqin(freq: number, t: number, v: number): void {
    const out = this.bus(.8, .15);
    for (const [mul, amp, d] of [[1, 1, 2.8], [2, .5, 1.8], [3, .26, 1.1], [4, .13, .7], [5.02, .06, .4]] as const) {
      const o = this.osc('sine', freq * mul, t, t + d + .05, this.env(out, t, v * amp, .004, 0, d, true)); o.frequency.exponentialRampToValueAtTime(freq * mul * .995, t + d);
    }
    this.noiseHit(t, .03, 'bandpass', 1400, v * .5, out, 1.2);
  }

  /** 人群呐喊铺底：起伏的带通噪声（元音共振峰）+ 若干短促喊声。 */
  private crowd(t: number, dur: number, v: number): void {
    const out = this.bus(.6, .3);
    this.noiseHit(t, dur, 'bandpass', 700, v * .7, out, .8, dur * .55);
    this.noiseHit(t, dur, 'bandpass', 1250, v * .45, out, 1.1, dur * .6);
    const n = Math.round(dur * 5);
    for (let i = 0; i < n; i++) this.noiseHit(t + dur * .3 + (i / n) * dur * .8, .22 + Math.random() * .15, 'bandpass', 650 + Math.random() * 700, v * (.5 + Math.random() * .5), out, 1.6, .05);
  }

  /** 金属斩击：高频噪声快速下扫 + 非整数倍金属泛音短响。 */
  private slash(t: number, v: number): void {
    const ctx = this.ctx, out = this.bus(.45, .25), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'bandpass'; f.Q.value = 1.6; f.frequency.setValueAtTime(11000, t); f.frequency.exponentialRampToValueAtTime(2200, t + .32);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + .5);
    for (const [fr, a] of [[1900, 1], [2870, .7], [4310, .5], [6240, .3]] as const) this.osc('sine', fr, t, t + .75, this.env(out, t, v * a * .22, .002, 0, .7, true));
    this.noiseHit(t, .02, 'highpass', 6000, v * .6, out);
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
