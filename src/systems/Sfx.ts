/** 轻量音效：WebAudio 合成；分类节流 + 并发上限 + 优先级 + 静音持久化。 */
export type SfxPriority = 0 | 1 | 2; // 0 低 / 1 中 / 2 高

interface SfxConfig {
  freq: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  throttleMs: number;
  max: number;
  priority: SfxPriority;
  pitchVar?: number;
  slideTo?: number;
}

const CONFIG: Record<string, SfxConfig> = {
  propBreak:{freq:170,dur:.12,type:'triangle',gain:.04,throttleMs:70,max:2,priority:0,slideTo:65},
  hitLight: { freq: 220, dur: 0.05, type: 'triangle', gain: 0.035, throttleMs: 60, max: 3, priority: 0, pitchVar: 0.05 },
  hitHeavy: { freq: 150, dur: 0.08, type: 'triangle', gain: 0.04, throttleMs: 80, max: 2, priority: 0, pitchVar: 0.05 },
  hitArrow: { freq: 520, dur: 0.04, type: 'square', gain: 0.03, throttleMs: 60, max: 3, priority: 0, pitchVar: 0.06 },
  hitFire: { freq: 110, dur: 0.09, type: 'sawtooth', gain: 0.035, throttleMs: 80, max: 2, priority: 0, pitchVar: 0.08 },
  enemyDie: { freq: 180, dur: 0.12, type: 'square', gain: 0.03, throttleMs: 100, max: 2, priority: 0, pitchVar: 0.05 },
  pickup: { freq: 880, dur: 0.05, type: 'sine', gain: 0.03, throttleMs: 120, max: 1, priority: 0, pitchVar: 0.04 },
  orbit: { freq: 420, dur: 0.05, type: 'square', gain: 0.025, throttleMs: 80, max: 3, priority: 1, pitchVar: 0.04 },
  crossbow: { freq: 660, dur: 0.05, type: 'triangle', gain: 0.03, throttleMs: 80, max: 3, priority: 1, pitchVar: 0.04 },
  flame: { freq: 90, dur: 0.18, type: 'sawtooth', gain: 0.04, throttleMs: 120, max: 2, priority: 1, pitchVar: 0.06 },
  enemyArrow: { freq: 480, dur: 0.05, type: 'triangle', gain: 0.025, throttleMs: 90, max: 2, priority: 1, pitchVar: 0.05 },
  chargeWarn: { freq: 140, dur: 0.3, type: 'sawtooth', gain: 0.04, throttleMs: 250, max: 2, priority: 1, pitchVar: 0.03, slideTo: 200 },
  bossVolley: { freq: 700, dur: 0.16, type: 'sine', gain: 0.06, throttleMs: 0, max: 2, priority: 2 },
  bossSummon: { freq: 90, dur: 0.28, type: 'sawtooth', gain: 0.07, throttleMs: 0, max: 2, priority: 2 },
  level: { freq: 660, dur: 0.12, type: 'sine', gain: 0.06, throttleMs: 0, max: 1, priority: 2 },
  win: { freq: 523, dur: 0.18, type: 'sine', gain: 0.06, throttleMs: 0, max: 1, priority: 2 },
  lose: { freq: 330, dur: 0.25, type: 'sine', gain: 0.06, throttleMs: 0, max: 1, priority: 2 },
  allySlash: { freq: 340, dur: 0.06, type: 'triangle', gain: 0.055, throttleMs: 70, max: 2, priority: 1, pitchVar: 0.06 },
  allySpear: { freq: 260, dur: 0.08, type: 'triangle', gain: 0.06, throttleMs: 80, max: 2, priority: 1, pitchVar: 0.05, slideTo: 180 },
  allyArrow: { freq: 700, dur: 0.04, type: 'triangle', gain: 0.045, throttleMs: 70, max: 2, priority: 1, pitchVar: 0.06 },
  flameSwing: { freq: 130, dur: 0.2, type: 'sawtooth', gain: 0.05, throttleMs: 120, max: 2, priority: 1 },
  flameBoom: { freq: 72, dur: 0.3, type: 'sawtooth', gain: 0.09, throttleMs: 0, max: 2, priority: 2 },
  thunder: { freq: 60, dur: 0.38, type: 'sawtooth', gain: 0.1, throttleMs: 0, max: 2, priority: 2, slideTo: 40 },
  bossDie: { freq: 220, dur: 0.4, type: 'sine', gain: 0.09, throttleMs: 0, max: 1, priority: 2 },
  uiClick: { freq: 620, dur: 0.04, type: 'square', gain: 0.035, throttleMs: 50, max: 1, priority: 1 },
  recruit: { freq: 0, dur: .5, type: 'sine', gain: 0, throttleMs: 120, max: 2, priority: 2 },
  purchase: { freq: 0, dur: .45, type: 'sine', gain: 0, throttleMs: 120, max: 2, priority: 2 },
  wallRise: { freq: 0, dur: .55, type: 'sine', gain: 0, throttleMs: 140, max: 2, priority: 2 },
  waveDrum: { freq: 0, dur: .9, type: 'sine', gain: 0, throttleMs: 400, max: 1, priority: 2 },
  gong: { freq: 0, dur: 2.6, type: 'sine', gain: 0, throttleMs: 600, max: 1, priority: 2 },
  playerHurt: { freq: 0, dur: .2, type: 'sine', gain: 0, throttleMs: 160, max: 1, priority: 2 },
  passiveFull: { freq: 0, dur: .4, type: 'sine', gain: 0, throttleMs: 1000, max: 1, priority: 2 },
  // 关羽拖刀斩：蓄满轻响 / 半月刀气 / 回旋刀气
  bladeReady: { freq: 0, dur: .35, type: 'sine', gain: 0, throttleMs: 300, max: 1, priority: 2 },
  bladeWave: { freq: 0, dur: .3, type: 'sine', gain: 0, throttleMs: 120, max: 2, priority: 1 },
  bladeSpin: { freq: 0, dur: .32, type: 'sine', gain: 0, throttleMs: 120, max: 2, priority: 1 },
};

const GLOBAL_MAX = 14;

/** 合成小工具：滤波噪声、带音高包络的振荡器、拨弦与金属泛音。 */
class Voice {
  constructor(readonly ctx: AudioContext, readonly out: AudioNode, readonly noiseBuf: AudioBuffer) {}
  noise(t: number, dur: number, type: BiquadFilterType, from: number, gain: number, to = from, q = 1): void {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = dur > .9; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t); if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * .4); s.stop(t + dur + .02);
  }
  tone(t: number, dur: number, type: OscillatorType, from: number, gain: number, to = from, attack = .004): void {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + .02);
  }
  pluck(t: number, freq: number, gain: number, dur = .5): void { this.tone(t, dur, 'sine', freq, gain); this.tone(t, dur * .5, 'sine', freq * 2, gain * .4); this.tone(t, dur * .25, 'sine', freq * 3, gain * .2); }
  metal(t: number, base: number, gain: number, dur: number): void { for (const [r, a] of [[1, 1], [1.48, .6], [2.13, .4], [2.76, .25]] as const) this.tone(t, dur, 'sine', base * r, gain * a, base * r * .99); }
  drum(t: number, from: number, to: number, gain: number, dur: number): void { this.tone(t, dur, 'sine', from, gain, to); this.noise(t, .05, 'lowpass', 1100, gain * .45); }
}
const D5 = 587.33, F5 = 698.46, A5 = 880, C6 = 1046.5, D6 = 1174.66;
/** 分层音效配方（返回时长秒）；未列出的沿用 CONFIG 单振荡器。 */
const RECIPES: Record<string, (v: Voice, t: number, p: number) => number> = {
  hitLight: (v, t, p) => { v.noise(t, .045, 'bandpass', 1900 * p, .06, 900, 1.2); v.tone(t, .06, 'sine', 190 * p, .05, 90); return .07; },
  hitHeavy: (v, t, p) => { v.noise(t, .08, 'lowpass', 1200 * p, .08, 300); v.tone(t, .11, 'sine', 140 * p, .07, 55); return .12; },
  hitArrow: (v, t, p) => { v.noise(t, .03, 'highpass', 3200 * p, .05); v.tone(t, .03, 'triangle', 1500 * p, .025, 900); return .04; },
  hitFire: (v, t, p) => { v.noise(t, .14, 'bandpass', 700 * p, .07, 1600, .8); v.noise(t + .03, .08, 'highpass', 2500, .03); return .17; },
  enemyDie: (v, t, p) => { v.noise(t, .12, 'lowpass', 900 * p, .06, 200); v.tone(t, .14, 'sine', 170 * p, .05, 60); return .15; },
  pickup: (v, t, p) => { v.metal(t, 1320 * p, .018, .18); v.tone(t + .04, .14, 'sine', 1760 * p, .02); return .2; },
  propBreak: (v, t, p) => { v.noise(t, .1, 'bandpass', 900 * p, .08, 400, 1.5); v.tone(t, .12, 'triangle', 170 * p, .04, 65); v.noise(t + .05, .07, 'highpass', 2200, .03); return .14; },
  crossbow: (v, t, p) => { v.tone(t, .07, 'triangle', 520 * p, .04, 360); v.noise(t, .02, 'highpass', 4000, .04); return .08; },
  allyArrow: (v, t, p) => { v.tone(t, .06, 'triangle', 640 * p, .035, 430); v.noise(t, .02, 'highpass', 4200, .03); return .07; },
  enemyArrow: (v, t, p) => { v.noise(t, .09, 'bandpass', 2600 * p, .035, 1200, 2); return .1; },
  allySlash: (v, t, p) => { v.noise(t, .09, 'bandpass', 2600 * p, .07, 800, 1.4); v.metal(t + .02, 2100 * p, .008, .08); return .11; },
  allySpear: (v, t, p) => { v.noise(t, .07, 'bandpass', 1800 * p, .06, 3200, 2); v.metal(t + .03, 2600 * p, .01, .09); return .1; },
  flameSwing: (v, t, p) => { v.noise(t, .22, 'bandpass', 380 * p, .07, 1400, .9); return .23; },
  flameBoom: (v, t, p) => { v.noise(t, .45, 'lowpass', 600 * p, .16, 120); v.tone(t, .4, 'sine', 80 * p, .12, 34); return .46; },
  thunder: (v, t, p) => { v.noise(t, .7, 'lowpass', 420 * p, .18, 90); v.tone(t, .5, 'sine', 62 * p, .12, 30); v.noise(t, .05, 'highpass', 3000, .06); return .72; },
  chargeWarn: (v, t, p) => { v.tone(t, .34, 'sawtooth', 140 * p, .035, 210, .05); v.tone(t, .34, 'sawtooth', 141.5 * p, .03, 212, .05); return .35; },
  bossSummon: (v, t) => { v.tone(t, .9, 'sawtooth', 98, .05, 104, .12); v.tone(t, .9, 'sawtooth', 147, .03, 156, .15); v.drum(t, 110, 45, .22, .5); return .95; },
  bossVolley: (v, t) => { v.metal(t, 700, .03, .3); v.noise(t, .15, 'highpass', 2500, .04); return .32; },
  bossDie: (v, t) => { v.metal(t, 110, .09, 2.4); v.drum(t, 100, 40, .25, .6); return 2.4; },
  level: (v, t) => { [D5, F5, A5, D6].forEach((f, i) => v.pluck(t + i * .07, f, .05, .45)); return .7; },
  win: (v, t) => { v.metal(t, 130, .06, 2); [D5, F5, A5, C6, D6].forEach((f, i) => v.pluck(t + .15 + i * .09, f, .05, .6)); return 2; },
  lose: (v, t) => { v.drum(t, 90, 40, .2, .7); [A5, F5, D5].forEach((f, i) => v.pluck(t + .2 + i * .22, f / 2, .05, .8)); return 1.1; },
  uiClick: (v, t) => { v.tone(t, .035, 'sine', 1150, .045, 900); v.noise(t, .015, 'highpass', 3500, .025); return .04; },
  recruit: (v, t) => { v.drum(t, 150, 70, .16, .25); v.drum(t + .13, 150, 70, .12, .2); v.metal(t + .1, 1180, .012, .3); return .5; },
  purchase: (v, t) => { v.metal(t, 1560, .018, .25); v.metal(t + .09, 2080, .016, .3); return .45; },
  wallRise: (v, t) => { v.noise(t, .55, 'lowpass', 260, .16, 120); v.tone(t, .45, 'sine', 70, .1, 38); v.noise(t + .08, .2, 'bandpass', 900, .05, 500, 1.2); return .56; },
  waveDrum: (v, t) => { v.drum(t, 115, 46, .26, .4); v.drum(t + .2, 115, 46, .22, .35); v.drum(t + .4, 120, 44, .32, .5); return .9; },
  gong: (v, t) => { v.metal(t, 98, .08, 2.6); v.noise(t, .25, 'bandpass', 2200, .04, 1400); return 2.6; },
  /** 被动满层：两声轻鼓 + 一点金属余音，不抢战斗音。 */
  bladeReady: (v, t) => { v.metal(t, 1760, .012, .32); v.tone(t + .03, .2, 'sine', 2640, .012, 2700); v.noise(t, .12, 'highpass', 5200, .015); return .35; },
  bladeWave: (v, t, p) => { v.noise(t, .26, 'bandpass', 900 * p, .09, 2600, 1.2); v.metal(t + .02, 1180 * p, .01, .18); return .3; },
  bladeSpin: (v, t, p) => { v.noise(t, .3, 'bandpass', 2400 * p, .06, 700, 2.4); v.metal(t + .04, 880 * p, .008, .2); return .32; },
  passiveFull: (v, t) => { v.drum(t, 140, 60, .12, .22); v.drum(t + .12, 150, 62, .15, .26); v.metal(t + .12, 1320, .008, .3); return .4; },
  playerHurt: (v, t, p) => { v.noise(t, .12, 'lowpass', 1400 * p, .09, 300); v.tone(t, .16, 'sine', 230 * p, .06, 110); return .17; },
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last: Record<string, number> = {};
  private active: Record<string, number> = {};
  private gestureUnlocked = false;
  private stats: Record<string, { triggered: number; played: number; dropped: number }> = {};
  private onVisibility = (): void => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (this.gestureUnlocked && !this.muted) void this.ctx.resume();
  };
  private onGesture = (): void => {
    this.gestureUnlocked = true;
    this.unlock();
  };
  muted = false;
  private volume = 0.9;

  constructor() {
    try {
      this.muted = localStorage.getItem('im_muted') === '1';
      const raw = localStorage.getItem('im_sfx_vol');
      const saved = Number(raw);
      if (raw !== null && Number.isFinite(saved) && saved >= 0) this.volume = Math.min(1, saved / 100);
    } catch {
      /* ignore */
    }
    try {
      document.addEventListener('visibilitychange', this.onVisibility);
      if (typeof window !== 'undefined') window.addEventListener('pointerdown', this.onGesture, { once: true });
      window.addEventListener('keydown', this.onGesture, { once: true });
    } catch {
      /* ignore */
    }
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 1.25;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('im_muted', this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  setMuted(value: boolean): void {
    this.muted = value;
  }

  setVolume(volume0to100: number): void {
    this.volume = Math.min(1, Math.max(0, volume0to100 / 100));
    if (this.master) this.master.gain.value = this.volume * 1.25;
    try {
      localStorage.setItem('im_sfx_vol', String(Math.round(this.volume * 100)));
    } catch {
      /* ignore */
    }
  }

  getVolume(): number { return Math.round(this.volume * 100); }

  getStats(): Record<string, { triggered: number; played: number; dropped: number }> {
    return this.stats;
  }

  attack(): void { this.play('crossbow'); }
  hit(): void { this.play('hitLight'); }
  level(): void {
    this.play('level');
    window.setTimeout(() => this.play('level'), 90);
  }
  boss(): void { this.play('bossSummon'); }
  win(): void { this.play('win'); }
  lose(): void { this.play('lose'); }

  play(kind: string): void {
    const cfg = CONFIG[kind];
    if (!cfg) return;
    const stat = (this.stats[kind] ??= { triggered: 0, played: 0, dropped: 0 });
    stat.triggered += 1;
    if (this.muted || !this.ctx || this.ctx.state !== 'running') {
      stat.dropped += 1;
      return;
    }
    const now = performance.now();
    if (cfg.throttleMs > 0 && now - (this.last[kind] || 0) < cfg.throttleMs) {
      stat.dropped += 1;
      return;
    }
    const activeTotal = Object.values(this.active).reduce((a, b) => a + b, 0);
    if ((this.active[kind] || 0) >= cfg.max || (cfg.priority < 2 && activeTotal >= GLOBAL_MAX)) {
      stat.dropped += 1;
      return;
    }
    this.last[kind] = now;
    this.active[kind] = (this.active[kind] || 0) + 1;
    stat.played += 1;
    const t = this.ctx.currentTime;
    const recipe = RECIPES[kind];
    if (recipe) {
      const pitchMul = 1 + (Math.random() * 2 - 1) * (cfg.pitchVar ?? 0);
      const dur = recipe(new Voice(this.ctx, this.master!, this.noiseBuffer()), t, pitchMul);
      window.setTimeout(() => { this.active[kind] = Math.max(0, (this.active[kind] || 1) - 1); }, dur * 1000 + 30);
      return;
    }
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const pitch = 1 + (Math.random() * 2 - 1) * (cfg.pitchVar ?? 0);
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq * pitch, t);
    if (cfg.slideTo) osc.frequency.exponentialRampToValueAtTime(cfg.slideTo, t + cfg.dur);
    g.gain.setValueAtTime(cfg.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.onended = () => {
      this.active[kind] = Math.max(0, (this.active[kind] || 1) - 1);
    };
    osc.start(t);
    osc.stop(t + cfg.dur + 0.01);
  }

  private noise: AudioBuffer | null = null;
  private noiseBuffer(): AudioBuffer {
    if (!this.noise) { const b = this.ctx!.createBuffer(1, this.ctx!.sampleRate, this.ctx!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; }
    return this.noise;
  }

  dispose(): void {
    try {
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('pointerdown', this.onGesture);
      window.removeEventListener('keydown', this.onGesture);
    } catch {
      /* ignore */
    }
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

/** 菜单、营帐等没有战斗音效实例时使用的共享 UI 音效（首次点击后解锁）。 */
let shared: Sfx | null = null;
export function uiSfx(): Sfx { return shared ??= new Sfx(); }
