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
};

const GLOBAL_MAX = 14;

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
