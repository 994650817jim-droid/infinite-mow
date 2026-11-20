/**
 * 原创战斗 BGM《乱世长歌》：WebAudio 程序化合成，无外部音频素材。
 * D 羽调式五声音阶（D F G A C），92 BPM，32 小节循环（约 83 秒）。
 * 配器：古筝拨弦琶音（带滑音）、竹笛主旋律（气声+颤音）、低音持续音、太鼓、梆子、锣；整体经卷积混响。
 * 首领战（intensity=1）：太鼓改为八分音符推进、加堂鼓与琵琶轮指，每 8 小节一记锣。
 */
import { type BossProfile, bossMotif, composeBossMelody, profileScale } from '../data/bossMusic';
import { BATTLE_THEMES, type BattleThemeKey, EpicBgm, bgmVersion } from './EpicBgm';
const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
/** 旋律音级：D4 F4 G4 A4 C5 D5 F5 G5 A5 */
const SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81];
type Phrase = Array<[number, number]>; // [音级(-1 休止), 八分音符时值]
const PHRASES: Record<string, Phrase> = {
  a: [[3, 2], [4, 1], [3, 1], [2, 2], [1, 2], [2, 3], [0, 1], [-1, 4]],
  b: [[0, 1], [1, 1], [2, 2], [3, 2], [5, 2], [4, 1], [3, 1], [4, 4], [-1, 2]],
  c: [[5, 3], [4, 1], [3, 2], [4, 2], [3, 1], [2, 1], [1, 2], [2, 4]],
  d: [[2, 2], [3, 2], [1, 2], [0, 6], [-1, 4]],
  e: [[5, 2], [6, 2], [5, 1], [4, 1], [3, 2], [4, 2], [5, 3], [3, 1], [-1, 2]],
  f: [[3, 1], [4, 1], [5, 2], [7, 2], [6, 1], [5, 1], [4, 2], [5, 4], [-1, 2]],
  g: [[6, 2], [5, 2], [4, 2], [3, 2], [2, 1], [3, 1], [1, 2], [0, 4]],
};
/** 每 2 小节一个乐句；null 为纯伴奏。A 段铺陈 → A' 主题 → B 段高起 → C 段收束。 */
const FORM: Array<string | null> = [null, null, 'a', 'b', 'a', 'c', 'b', 'd', 'e', 'f', 'e', 'g', 'c', 'f', 'e', 'd'];
/** 每小节根音（低音区 MIDI）与古筝琶音音型。 */
const ROOTS = [50, 50, 53, 48, 55, 55, 57, 50];
const ARP: Record<number, number[]> = { 50: [50, 57, 62, 65], 53: [53, 60, 65, 69], 48: [48, 55, 60, 62], 55: [55, 62, 67, 69], 57: [57, 62, 69, 72] };

/**
 * 界面主题《营火望乡》：主城、天下地图、选将选关等界面使用。72 BPM，32 小节约 107 秒循环。
 * 古琴风低音拨弦按四分音符缓缓琶音（偶带滑音）、竹笛长音吟唱、低音持续音更深的混响，
 * 偶尔风铃点缀；打击乐只有每两小节一记远鼓与段落处的轻锣。
 */
const MENU_PHRASES: Record<string, Phrase> = {
  m1: [[3, 4], [4, 2], [3, 2], [2, 4], [1, 4]],
  m2: [[2, 2], [3, 2], [5, 4], [4, 2], [3, 2], [-1, 4]],
  m3: [[5, 3], [6, 1], [5, 2], [4, 2], [3, 6], [-1, 2]],
  m4: [[1, 2], [2, 2], [3, 4], [2, 2], [1, 2], [0, 4]],
  m5: [[4, 2], [5, 2], [7, 4], [6, 2], [5, 2], [4, 4]],
};
const MENU_FORM: Array<string | null> = [null, null, 'm1', 'm2', 'm1', 'm4', null, 'm3', 'm5', 'm3', 'm2', 'm4', null, 'm1', 'm4', null];
const MENU_ROOTS = [50, 50, 55, 55, 53, 57, 48, 50];
export type MusicTheme = 'battle' | 'menu';
/**
 * 界面曲的「情绪」（2026-11-20 用户「检查界面bgm」）：同一首《营火望乡》的旋律，各界面换编制与速度——
 * home 主页 / 选将 / 选关（原样）· map 天下地图（大气：慢、号角与合唱铺底、大鼓）· camp 营寨 / 城池（暖：拨弦八分、小鼓、远处人声嘈嘈与营火噼啪）·
 * hall 招贤馆 / 名将堂（雅：古琴、箫、编钟，无鼓）· rest 战斗结算 / 战败退守（静：古琴 + 二胡，无鼓）。
 * 换情绪时淡出 0.45 秒、换编制、淡入 0.9 秒；同一情绪再进不重来（共用一个实例，切界面不断音）。
 */
export type MenuMood = 'home' | 'map' | 'camp' | 'hall' | 'rest';
export const MENU_MOODS: readonly MenuMood[] = ['home', 'map', 'camp', 'hall', 'rest'];
const MOOD_BPM: Record<MenuMood, number> = { home: 72, map: 64, camp: 80, hall: 60, rest: 66 };
/** 各情绪响度对齐（tools/test-audio.mjs 实测 12 秒 RMS 后定）：编制轻的抬一点，和主页相差 ≤ 2 dB。 */
const MOOD_GAIN: Record<MenuMood, number> = { home: 1, map: .9, camp: 1.4, hall: 1.55, rest: 1.35 };

export class Music {
  private ctx: BaseAudioContext | null = null;
  /** BGM v2（EpicBgm.ts）：战斗曲、首领曲、界面曲与胜负短曲。 */
  readonly v2: boolean;
  private epic: EpicBgm | null = null;
  private master: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private playing = false;
  private intensity: 0 | 1 = 0;
  private volume = 0.4;
  private duck = 1;
  /** 战斗里打开面板 / 暂停（舆图、升级、行营）时把音乐压到一半（setPaused）。 */
  private pauseMul = 1;
  /** 界面曲情绪（只对 menu 生效）。 */
  mood: MenuMood = 'home';
  private moodTimer: number | null = null;
  muted = false;
  private bpm: number;
  private stepDur: number; // 十六分音符
  private battleTheme: BattleThemeKey = 'huangjin';
  /** 预先展开的旋律：每个十六分步上的 [MIDI, 持续步数] 或 null。 */
  private readonly melodyAt: Array<[number, number] | null> = new Array(32 * 16).fill(null);
  /** 首领专属主题（data/bossMusic.ts）：出场锣鼓后切入，首领离场（intensity 回 0）即回到战斗曲。 */
  private boss: { p: BossProfile; scale: number[]; melody: Array<[number, number] | null>; stepDur: number; step: number; startAt: number } | null = null;

  constructor(readonly theme: MusicTheme = 'battle', version = bgmVersion()) {
    this.v2 = version === 'v2';
    this.bpm = theme === 'menu' ? 72 : this.v2 ? BATTLE_THEMES.huangjin.bpm : 92;
    this.stepDur = 60 / this.bpm / 4;
    const form = theme === 'menu' ? MENU_FORM : FORM, phrases = theme === 'menu' ? MENU_PHRASES : PHRASES;
    form.forEach((name, slot) => {
      if (!name) return;
      let pos = slot * 32;
      for (const [deg, len] of phrases[name]) { if (deg >= 0) this.melodyAt[pos] = [SCALE[deg], len * 2]; pos += len * 2; }
    });
    this.reloadPrefs();
  }

  /** 重新读取音乐开关与音量（设置面板或战斗内修改后，界面音乐同步）。 */
  reloadPrefs(): void {
    try {
      this.muted = localStorage.getItem('im_music') === '0';
      const raw = localStorage.getItem('im_bgm_vol');
      const saved = Number(raw);
      if (raw !== null && Number.isFinite(saved) && saved >= 0) this.volume = Math.min(1, saved / 100);
    } catch {
      /* ignore */
    }
  }

  private level(): number { return this.muted ? 0 : this.volume * 0.55 * this.duck * this.pauseMul * (this.theme === 'menu' ? MOOD_GAIN[this.mood] : 1); }
  /** 暂停 / 打开面板：音乐压到一半（0.25 秒渐变）；关掉恢复。 */
  setPaused(on: boolean): void { const m = on ? .5 : 1; if (m === this.pauseMul) return; this.pauseMul = m; this.applyGain(this.level(), .25); }
  get pausedDuck(): boolean { return this.pauseMul < 1; }
  /** 换界面曲情绪：没在播时直接换；在播时淡出 → 换编制、从乐段开头起 → 淡入。同一情绪不动。 */
  setMood(mood: MenuMood, immediate = false): void {
    if (this.theme !== 'menu' || mood === this.mood && this.moodTimer === null) return;
    const apply = (): void => { this.mood = mood; this.bpm = MOOD_BPM[mood]; this.stepDur = 60 / this.bpm / 4; this.step = 0; };
    if (this.moodTimer !== null) { window.clearTimeout(this.moodTimer); this.moodTimer = null; }
    if (immediate || !this.playing || !this.ctx) { apply(); return; }
    this.applyGain(0, .45 / 3);
    this.moodTimer = window.setTimeout(() => { this.moodTimer = null; apply(); if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + .05); this.applyGain(this.level(), .9 / 3); }, 480);
  }
  /** 统一设置主音量：先取消排队中的渐变，避免直接赋值被忽略。 */
  private applyGain(value: number, smooth = 0): void { if (!this.master || !this.ctx) return; const p = this.master.gain, now = this.ctx.currentTime; p.cancelScheduledValues(now); if (smooth > 0) { p.setValueAtTime(p.value, now); p.setTargetAtTime(value, now, smooth); } else p.setValueAtTime(value, now); }

  start(): void {
    if (this.playing) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.buildGraph(new Ctor());
    }
    void (this.ctx as AudioContext).resume();
    if (this.fadeTimer !== null) { window.clearTimeout(this.fadeTimer); this.fadeTimer = null; }
    // 界面曲淡入 0.9 秒；战斗曲淡入 0.6 秒（音效审计：原来战斗曲直接满音量，第一拍就是战鼓，开局有点冲）。
    this.applyGain(0); this.applyGain(this.level(), this.theme === 'menu' ? .9 : .6);
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx!.currentTime + 0.12;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  private buildGraph(ctx: BaseAudioContext): void {
    {
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = this.level(); this.master.connect(ctx.destination);
      // 卷积混响：程序生成 2.4 秒衰减噪声脉冲，给拨弦和笛声空间感。
      const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.4), ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
      const conv = ctx.createConvolver(); conv.buffer = ir;
      this.wet = ctx.createGain(); this.wet.gain.value = this.theme === 'menu' ? .46 : .32; this.wet.connect(conv); conv.connect(this.master);
      this.dry = ctx.createGain(); this.dry.gain.value = .85; this.dry.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const n = this.noise.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
      if (this.v2) { this.epic = new EpicBgm(ctx, this.master); this.epic.setBattleTheme(this.battleTheme); }
    }
  }

  /**
   * 离线渲染（试听样品 / 测试用）：在 OfflineAudioContext 上从头排好 seconds 秒，
   * bossAt 秒时首领出场（null 不出场）。音量固定 0.4，不读静音设置。
   */
  async renderOffline(seconds: number, bossProfile: BossProfile | null, bossAt = 0, sampleRate = 44100, endWith: boolean | null = null): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    this.muted = false; this.volume = .4; this.duck = 1;
    this.buildGraph(ctx);
    this.playing = true; this.step = 0; this.nextTime = .05;
    let bossSet = bossProfile === null;
    while (this.nextTime < seconds) {
      if (!bossSet && this.nextTime >= bossAt) { bossSet = true; this.intensity = 1; this.setBoss(bossProfile, this.nextTime); }
      if (endWith !== null && this.nextTime >= 6) { this.timer = null; this.endBattle(endWith, this.nextTime); break; }
      this.scheduleUntil(Math.min(seconds, this.nextTime + .5));
    }
    this.playing = false;
    return ctx.startRendering();
  }

  /**
   * 战斗结束：新版在战斗曲之后接约 4 秒的胜利 / 败退短曲（返回 true，调用方不再播旧的胜负音效）；
   * 旧版或静音时与 stop() 相同（返回 false）。
   */
  endBattle(victory: boolean, at?: number): boolean {
    if (!this.epic || !this.ctx || !this.playing || this.muted || this.volume <= 0) { this.stop(); return false; }
    this.playing = false;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    this.boss = null; this.intensity = 0;
    this.epic.jingle(victory, (at ?? this.ctx.currentTime) + .05);
    return true;
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    this.applyGain(0);
  }

  private fadeTimer: number | null = null;
  /** 淡出后停止（界面曲进入战斗时使用）。 */
  fadeStop(ms = 700): void {
    if (!this.playing) return;
    this.applyGain(0, ms / 3000);
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => { this.fadeTimer = null; this.stop(); }, ms);
  }
  /** 淡出途中又回到界面：取消停止并淡回原音量。 */
  cancelFade(): void { if (this.fadeTimer === null) return; window.clearTimeout(this.fadeTimer); this.fadeTimer = null; this.applyGain(this.level(), .3); }
  /** 浏览器要求用户手势后才能出声：在手势回调里调用以恢复音频。 */
  unlock(): void { if (this.ctx instanceof AudioContext) void this.ctx.resume(); }

  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem('im_music', this.muted ? '0' : '1'); } catch { /* ignore */ }
    this.applyGain(this.level());
    return this.muted;
  }

  setVolume(volume0to100: number, persist = true): void {
    this.volume = Math.min(1, Math.max(0, volume0to100 / 100));
    this.applyGain(this.level(), .05);
    if (persist) try { localStorage.setItem('im_bgm_vol', String(Math.round(this.volume * 100))); } catch { /* ignore */ }
  }

  getVolume(): number { return Math.round(this.volume * 100); }
  setDuck(factor: number): void {
    this.duck = Math.min(1, Math.max(0.3, factor));
    this.applyGain(this.level(), .08);
  }
  setIntensity(value: 0 | 1): void { this.intensity = value; }
  /** 各章战斗曲（仅 v2；旧版只有一首）。应在 start() 前调用。 */
  setBattleTheme(key: BattleThemeKey): void {
    if (!this.v2) return;
    this.battleTheme = key; this.bpm = BATTLE_THEMES[key].bpm; this.stepDur = 60 / this.bpm / 4;
    this.epic?.setBattleTheme(key);
  }
  get battleThemeKey(): BattleThemeKey | null { return this.v2 ? this.battleTheme : null; }
  get playingState(): boolean { return this.playing; }
  get mutedState(): boolean { return this.muted; }
  get currentStep(): number { return this.step; }

  private schedule(): void {
    if (!this.ctx || !this.playing) return;
    this.scheduleUntil(this.ctx.currentTime + 0.35);
  }

  private scheduleUntil(horizon: number): void {
    while (this.nextTime < horizon) {
      const b = this.intensity === 1 ? this.boss : null;
      if (b) {
        if (this.nextTime >= b.startAt) {
          if (this.epic) { this.epic.bossStep(b.p, b.step, this.nextTime, b.stepDur); b.step++; }
          else { this.scheduleBossStep(b, b.step, this.nextTime); b.step = (b.step + 1) % 256; }
        }
        this.nextTime += b.stepDur;
        continue;
      }
      if (this.epic && this.theme === 'menu') { this.epic.menuStep(this.step, this.nextTime, this.stepDur, this.melodyAt, MENU_ROOTS, ARP, this.mood); this.step++; }
      else if (this.epic) { this.epic.battleStep(this.step, this.nextTime, this.stepDur, this.intensity === 1); this.step++; }
      else { this.scheduleStep(this.step, this.nextTime); this.step = (this.step + 1) % 512; }
      this.nextTime += this.stepDur;
    }
  }

  /** 首领出场：奏出场锣鼓（约 2.4 秒），之后切入该首领主题。传 null 清除。 */
  setBoss(p: BossProfile | null, at?: number): void {
    if (!p) { this.boss = null; return; }
    const stepDur = 60 / p.bpm / 4, now = at ?? this.ctx?.currentTime ?? 0;
    this.boss = { p, scale: profileScale(p), melody: composeBossMelody(p), stepDur, step: 0, startAt: now + 2.45 };
    if (this.ctx && this.playing) { if (this.epic) this.epic.bossStinger(p, now + .05); else this.stinger(p, now + .05); }
  }
  get bossName(): string | null { return this.boss?.p.name ?? null; }

  /** 出场段：重锣 → 太鼓由疏到密的滚奏 → 主奏乐器三音动机 → 收锣。 */
  private stinger(p: BossProfile, t: number): void {
    this.gong(t, .22);
    if (p.fx.includes('thunder')) this.thunder(t + .1, .22);
    if (p.fx.includes('earth')) this.earth(t, .2);
    let x = .25; for (let i = 0; i < 14; i++) { this.taiko(t + x, .18 + i * .025); x += Math.max(.05, .17 - i * .009); }
    const motif = bossMotif(p), lt = t + 1.55;
    motif.forEach((m, i) => this.lead(p, midi(m), lt + i * .22, i === 2 ? .7 : .2, i === 2 ? .085 : .07));
    this.taiko(t + 2.2, .6); this.gong(t + 2.2, .2);
    if (p.fx.includes('horn')) this.horn(midi(p.tonic - 12), t + 2.0, 1.6, .06);
    if (p.fx.includes('bells')) for (let k = 0; k < 3; k++) this.bell(midi(motif[k] + 12), lt + k * .22, .02);
  }

  private scheduleBossStep(b: NonNullable<Music['boss']>, step: number, t: number): void {
    const p = b.p, bar = Math.floor(step / 16) % 16, pos = step % 16, sd = b.stepDur, deg = p.bass[bar % 8];
    const root = p.tonic - 12 + p.mode[deg % p.mode.length] + (deg >= p.mode.length ? 12 : 0);
    if (pos === 0) { this.drone(midi(root - 12), t, sd * 16 * 1.1, .065); if (bar % 4 === 0) this.drone(midi(root - 5), t, sd * 32, .028); }
    // 伴奏拨弦：快曲十六分、慢曲八分
    const fast = p.bpm >= 110, arp = [root, root + 7, root + 12, root + 12 + p.mode[2]];
    if (pos % (fast ? 1 : 2) === 0) { const i = [0, 1, 2, 3, 2, 1, 2, 3][(fast ? pos : pos / 2) % 8]; this.pluck(midi(arp[i]), t, fast ? .036 : .05, pos === 0 && bar % 2 === 1); }
    const note = b.melody[(bar * 16 + pos) % b.melody.length];
    if (note) this.lead(p, midi(b.scale[note[0]]), t, note[1] * sd, .062);
    this.bossDrums(p.drums, bar, pos, t);
    for (const fx of p.fx) {
      if (fx === 'gong' && pos === 0 && bar % 4 === 0) this.gong(t, .13);
      if (fx === 'thunder' && pos === 0 && bar % 8 === 4) this.thunder(t, .16);
      if (fx === 'bells' && pos === 0 && bar % 2 === 0) this.bell(midi(b.scale[bar % 4 === 0 ? 5 : 3] + 12), t, .018);
      if (fx === 'horn' && pos === 0 && bar % 8 === 0) this.horn(midi(root), t, sd * 12, .05);
      if (fx === 'earth' && pos === 0 && bar % 4 === 2) this.earth(t, .14);
      if (fx === 'fire' && Math.random() < .22) this.noiseBurst(t + Math.random() * sd, .02 + Math.random() * .03, 'highpass', 2500 + Math.random() * 3000, .025, this.dryGain());
    }
  }

  private bossDrums(kind: BossProfile['drums'], bar: number, pos: number, t: number): void {
    switch (kind) {
      case 'march': if (pos % 4 === 0) this.taiko(t, pos === 0 ? .5 : .28); if (pos === 6 || pos === 14) this.tanggu(t, .16); if (pos === 0 && bar % 8 === 0) this.gong(t, .14); break;
      case 'gallop': if ([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(pos)) this.taiko(t, pos % 8 === 0 ? .5 : pos % 4 === 0 ? .3 : .18); if (pos % 8 === 4) this.tanggu(t, .14); break;
      case 'ritual': if (pos === 0 || pos === 6 || pos === 8) this.taiko(t, pos === 0 ? .45 : .26); if (pos % 2 === 1) this.clapper(t); break;
      case 'heavy': if (pos === 0 || pos === 8 || pos === 10) this.taiko(t, pos === 0 ? .62 : .38); if (pos === 4 || pos === 12) this.tanggu(t, .2); if (pos === 0 && bar % 4 === 0) this.gong(t, .12); break;
      case 'ceremony': if (pos === 0 || pos === 8) this.taiko(t, pos === 0 ? .36 : .2); if (pos === 12) this.clapper(t); break;
      case 'tense': if (pos % 2 === 0) this.clapper(t); if (pos === 0 || pos === 7 || pos === 10) this.taiko(t, pos === 0 ? .42 : .26); if (pos === 14 && bar % 2 === 1) this.tanggu(t, .14); break;
    }
  }

  /** 主奏：琵琶（轮指）、唢呐、竹笛、古琴。 */
  private lead(p: BossProfile, freq: number, t: number, dur: number, gain: number): void {
    if (p.lead === 'pipa') { const n = Math.max(1, Math.min(8, Math.round(dur / (this.boss?.stepDur ?? .1) * 2))); for (let k = 0; k < n; k++) this.pluck(freq, t + k * dur / n, k === 0 ? gain * 1.15 : gain * .6, false, true); }
    else if (p.lead === 'suona') this.suona(freq, t, dur * .95, gain * .8);
    else if (p.lead === 'flute') this.flute(freq, t, dur * .9, gain);
    else this.pluck(freq / 2, t, gain * 1.3, true);
  }

  private dryGain(): GainNode { const g = this.ctx!.createGain(); this.out(g, .3); return g; }

  /** 唢呐：锯齿波经带通（鼻音感）+ 颤音，起音带滑。 */
  private suona(freq: number, start: number, dur: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = Math.min(3200, freq * 2.2); f.Q.value = 1.6; f2.type = 'lowpass'; f2.frequency.value = 4200;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * .97, start); o.frequency.exponentialRampToValueAtTime(freq, start + .05);
    lfo.frequency.value = 6.2; depth.gain.setValueAtTime(0, start); depth.gain.linearRampToValueAtTime(freq * .012, start + Math.min(.3, dur * .5));
    lfo.connect(depth); depth.connect(o.frequency);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .03); g.gain.setValueAtTime(gain * .85, start + Math.max(.05, dur - .08)); g.gain.linearRampToValueAtTime(0, start + Math.max(.1, dur));
    o.connect(f); f.connect(f2); f2.connect(g); this.out(g, .45);
    o.start(start); lfo.start(start); o.stop(start + dur + .05); lfo.stop(start + dur + .05);
  }
  /** 号角：低音锯齿波渐强渐弱，低通。 */
  private horn(freq: number, start: number, dur: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), f = ctx.createBiquadFilter(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(300, start); f.frequency.linearRampToValueAtTime(900, start + dur * .4); f.frequency.linearRampToValueAtTime(400, start + dur);
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = freq; o2.frequency.value = freq * 1.5; g2.gain.value = .35;
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + dur * .35); g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); this.out(g, .5);
    o.start(start); o2.start(start); o.stop(start + dur + .05); o2.stop(start + dur + .05);
  }
  /** 编钟：低泛音更重、余音更长的金属钟声。 */
  private bell(freq: number, start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(); this.out(g, .85);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .004); g.gain.exponentialRampToValueAtTime(.0001, start + 2.6);
    for (const [r, a] of [[.5, 1], [1, .8], [2.4, .4], [4.1, .2]] as const) { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq * r; e.gain.value = a; o.connect(e); e.connect(g); o.start(start); o.stop(start + 2.7); }
  }
  /** 雷声：低通噪声长滚。 */
  private thunder(start: number, gain: number): void {
    if (!this.noise) return;
    const ctx = this.ctx!, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(900, start); f.frequency.exponentialRampToValueAtTime(140, start + 2.4);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .06); g.gain.setValueAtTime(gain * .6, start + .4); g.gain.exponentialRampToValueAtTime(.0001, start + 2.8);
    src.connect(f); f.connect(g); this.out(g, .6); src.start(start); src.stop(start + 2.9);
  }
  /** 地鸣：极低频正弦下坠 + 低通噪声。 */
  private earth(start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), o = ctx.createOscillator(); this.out(g, .4);
    o.type = 'sine'; o.frequency.setValueAtTime(58, start); o.frequency.exponentialRampToValueAtTime(32, start + 1.4);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .08); g.gain.exponentialRampToValueAtTime(.0001, start + 1.6);
    o.connect(g); o.start(start); o.stop(start + 1.7);
    this.noiseBurst(start, 1.2, 'lowpass', 220, gain * .5, g);
  }

  private scheduleStep(step: number, t: number): void {
    if (this.theme === 'menu') { this.scheduleMenuStep(step, t); return; }
    const bar = Math.floor(step / 16) % 32, pos = step % 16, root = ROOTS[bar % 8], boss = this.intensity === 1;
    const sectionB = bar >= 16 && bar < 24;
    // 低音持续音：每小节一次，长起长收。
    if (pos === 0) {
      this.drone(midi(root - 12), t, this.stepDur * 16 * 1.15, boss ? .07 : .055);
      if (bar % 4 === 0) this.drone(midi(root - 5), t, this.stepDur * 16 * 2, .03);
    }
    // 古筝琶音：八分音符，偶尔带上滑音；B 段与首领战加密为十六分。
    const dense = boss || sectionB;
    if (pos % (dense ? 1 : 2) === 0) {
      const notes = ARP[root], i = dense ? [0, 1, 2, 3, 2, 1, 2, 3][pos % 8] : [0, 1, 2, 3, 2, 1, 2, 1][(pos / 2) % 8];
      this.pluck(midi(notes[i] + (dense && pos % 4 === 3 ? 12 : 0)), t, dense ? .045 : .06, pos === 0 && bar % 2 === 1);
    }
    // 主旋律：常态竹笛，首领战改为琵琶轮指。
    const note = this.melodyAt[(bar * 16 + pos) % this.melodyAt.length];
    if (note) {
      const [m, len] = note, dur = len * this.stepDur;
      if (boss) for (let k = 0; k < len * 2; k++) this.pluck(midi(m), t + k * this.stepDur / 2, k === 0 ? .075 : .04, false, true);
      else this.flute(midi(m), t, dur * .95, .06);
    }
    // 太鼓与小打击乐。
    if (boss) {
      if (pos % 2 === 0) this.taiko(t, pos % 8 === 0 ? .55 : .3);
      if (pos % 4 === 2) this.tanggu(t, .18);
      if (pos === 0 && bar % 8 === 0) this.gong(t, .16);
    } else {
      if (pos === 0 || pos === 8) this.taiko(t, pos === 0 ? .32 : .2);
      if (pos === 14 && bar % 2 === 1) this.taiko(t, .14);
      if (pos === 12) this.clapper(t);
      if (pos === 0 && bar % 16 === 0) this.gong(t, .1);
    }
  }

  private scheduleMenuStep(step: number, t: number): void {
    const bar = Math.floor(step / 16) % 32, pos = step % 16, root = MENU_ROOTS[bar % 8], beat = this.stepDur * 4;
    if (pos === 0) {
      this.drone(midi(root - 12), t, this.stepDur * 16 * 1.2, .05);
      if (bar % 2 === 0) this.drone(midi(root - 5), t, this.stepDur * 32, .022);
      if (bar % 2 === 0) this.taiko(t, .12);
      if (bar % 16 === 0) this.gong(t, .06);
    }
    // 古琴风：每拍一音，四拍一轮自低向高，偶尔从下方滑入。
    if (pos % 4 === 0) {
      const notes = ARP[root], i = [0, 1, 2, 3][pos / 4];
      this.pluck(midi(notes[i] - (i === 0 ? 12 : 0)), t, i === 0 ? .07 : .05, pos === 8 && bar % 4 === 3);
    }
    // 风铃：极少量高音金属点缀。
    if (pos === 14 && bar % 4 === 1) for (let k = 0; k < 3; k++) this.chime(midi(SCALE[5 + k] + 12), t + k * .11, .012);
    const note = this.melodyAt[(bar * 16 + pos) % this.melodyAt.length];
    if (note) this.flute(midi(note[0]), t, note[1] * this.stepDur * .97, .05);
    void beat;
  }

  private chime(freq: number, start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(); this.out(g, .9);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .005); g.gain.exponentialRampToValueAtTime(.0001, start + 1.6);
    for (const r of [1, 2.76, 5.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r; o.connect(g); o.start(start); o.stop(start + 1.7); }
  }

  private out(gain: GainNode, wet = .5): void { gain.connect(this.dry!); if (wet > 0) { const w = this.ctx!.createGain(); w.gain.value = wet; gain.connect(w); w.connect(this.wet!); } }

  /** 古筝/琵琶拨弦：三个泛音不同衰减 + 极短拨片噪声；slide 为从下方小二度滑入。 */
  private pluck(freq: number, start: number, gain: number, slide = false, bright = false): void {
    const ctx = this.ctx!, g = ctx.createGain(); g.gain.value = 1; this.out(g, .55);
    const partials: Array<[number, number, number]> = bright ? [[1, 1, .45], [2, .5, .22], [3, .3, .1], [4, .15, .06]] : [[1, 1, 1.3], [2, .45, .6], [3, .22, .28]];
    for (const [mul, amp, decay] of partials) {
      const o = ctx.createOscillator(), e = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mul * (slide ? 0.944 : 1), start);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * mul, start + .07);
      e.gain.setValueAtTime(0, start); e.gain.linearRampToValueAtTime(gain * amp, start + .004); e.gain.exponentialRampToValueAtTime(.0001, start + decay);
      o.connect(e); e.connect(g); o.start(start); o.stop(start + decay + .02);
    }
    this.noiseBurst(start, .012, 'highpass', 3000, gain * .5, g);
  }

  /** 竹笛：正弦+少量三角波，渐强起音，延迟颤音，气声带通噪声。 */
  private flute(freq: number, start: number, dur: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(); this.out(g, .7);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .07); g.gain.setValueAtTime(gain, start + Math.max(.08, dur - .12)); g.gain.linearRampToValueAtTime(0, start + dur);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), mix = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = freq; o2.frequency.value = freq * 2; mix.gain.value = .12;
    lfo.frequency.value = 5.4; depth.gain.setValueAtTime(0, start); depth.gain.linearRampToValueAtTime(freq * .006, start + Math.min(.35, dur * .6));
    lfo.connect(depth); depth.connect(o.frequency); depth.connect(o2.frequency);
    o.connect(g); o2.connect(mix); mix.connect(g);
    for (const n of [o, o2, lfo]) { n.start(start); n.stop(start + dur + .05); }
    this.noiseBurst(start, dur, 'bandpass', freq * 2, gain * .18, g, true);
  }

  private drone(freq: number, start: number, dur: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), f = ctx.createBiquadFilter(), o = ctx.createOscillator(), o2 = ctx.createOscillator();
    f.type = 'lowpass'; f.frequency.value = 380; o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 1.003;
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .5); g.gain.setValueAtTime(gain, start + dur - .6); g.gain.linearRampToValueAtTime(0, start + dur);
    o.connect(f); o2.connect(f); f.connect(g); this.out(g, .3); o.start(start); o2.start(start); o.stop(start + dur + .05); o2.stop(start + dur + .05);
  }

  /** 太鼓：音高快速下坠的低频 + 皮面噪声。 */
  private taiko(start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), o = ctx.createOscillator(); this.out(g, .35);
    o.type = 'sine'; o.frequency.setValueAtTime(110, start); o.frequency.exponentialRampToValueAtTime(46, start + .22);
    g.gain.setValueAtTime(gain, start); g.gain.exponentialRampToValueAtTime(.0001, start + .42); o.connect(g); o.start(start); o.stop(start + .45);
    this.noiseBurst(start, .06, 'lowpass', 900, gain * .5, g);
  }
  private tanggu(start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), o = ctx.createOscillator(); this.out(g, .3);
    o.type = 'triangle'; o.frequency.setValueAtTime(240, start); o.frequency.exponentialRampToValueAtTime(150, start + .1);
    g.gain.setValueAtTime(gain, start); g.gain.exponentialRampToValueAtTime(.0001, start + .16); o.connect(g); o.start(start); o.stop(start + .18);
    this.noiseBurst(start, .03, 'bandpass', 1800, gain * .5, g);
  }
  /** 梆子：木质短促敲击。 */
  private clapper(start: number): void {
    const ctx = this.ctx!, g = ctx.createGain(), o = ctx.createOscillator(); this.out(g, .4);
    o.type = 'sine'; o.frequency.value = 1650; g.gain.setValueAtTime(.06, start); g.gain.exponentialRampToValueAtTime(.0001, start + .05);
    o.connect(g); o.start(start); o.stop(start + .06);
  }
  /** 锣：一组非整数倍泛音 + 长衰减。 */
  private gong(start: number, gain: number): void {
    const ctx = this.ctx!, g = ctx.createGain(); this.out(g, .8);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + .02); g.gain.exponentialRampToValueAtTime(.0001, start + 3.2);
    for (const [ratio, amp] of [[1, 1], [1.48, .6], [2.13, .45], [2.76, .3], [3.9, .18]] as const) {
      const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110 * ratio, start); o.frequency.exponentialRampToValueAtTime(110 * ratio * .985, start + 3);
      e.gain.value = amp * .5; o.connect(e); e.connect(g); o.start(start); o.stop(start + 3.3);
    }
    this.noiseBurst(start, .2, 'bandpass', 2400, gain * .25, g);
  }

  private noiseBurst(start: number, dur: number, type: BiquadFilterType, freq: number, gain: number, dest: AudioNode, sustain = false): void {
    if (!this.noise) return;
    const ctx = this.ctx!, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = dur > .9; f.type = type; f.frequency.value = freq; f.Q.value = type === 'bandpass' ? 2.5 : .7;
    g.gain.setValueAtTime(gain, start);
    if (sustain) { g.gain.setValueAtTime(gain, start + Math.max(.01, dur - .08)); g.gain.linearRampToValueAtTime(0, start + dur); }
    else g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(start, Math.random() * .5); src.stop(start + dur + .02);
  }

  dispose(): void {
    this.stop();
    if (this.ctx instanceof AudioContext) void this.ctx.close();
    this.ctx = null; this.epic = null; this.master = null; this.dry = null; this.wet = null; this.noise = null;
  }
}

/** 界面背景音乐：全部界面共用一个实例，切换主城/地图/选关时不中断。 */
let menuInstance: Music | null = null;
export function menuMusic(): Music {
  if (!menuInstance) { menuInstance = new Music('menu'); if (import.meta.env.DEV) (window as unknown as { __menuMusic?: Music }).__menuMusic = menuInstance; }
  return menuInstance;
}
/** 在界面场景 create() 中调用：开始/续播界面曲；首次手势时解锁音频。 */
export function playMenuMusic(scene: { events: { once(event: string, fn: () => void): unknown } }, mood: MenuMood = 'home'): void {
  const m = menuMusic();
  m.reloadPrefs();
  m.setMood(mood, !m.playingState);
  if (!m.playingState) m.start();
  else { m.cancelFade(); m.setVolume(m.getVolume(), false); }
  const unlock = (): void => m.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  scene.events.once('shutdown', () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); });
}
/** 进入战斗：界面曲淡出（战斗曲由战斗场景自己的实例播放）。 */
export function stopMenuMusic(): void { menuInstance?.fadeStop(); }
