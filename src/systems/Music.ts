/**
 * 原创战斗 BGM《乱世长歌 · 黄巾之乱》：WebAudio 程序化合成。
 * 116 BPM、4/4、D 羽调式五声音阶，32 小节约 66 秒循环；
 * A/A'/B/C 四段，琵琶主旋律 + 古筝拨弦 + 战鼓 + 低音 + 号角。
 */
export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private playing = false;
  private intensity: 0 | 1 = 0;
  private volume = 0.4;
  private duck = 1;
  muted = false;

  private readonly bpm = 110;
  private readonly stepDur: number;
  private readonly chords = [
    [146.83, 174.61, 220.0], // Dm
    [116.54, 146.83, 174.61], // B♭
    [130.81, 164.81, 196.0], // C
    [146.83, 174.61, 220.0], // Dm
    [98.0, 116.54, 146.83], // Gm
    [116.54, 146.83, 174.61], // B♭
    [130.81, 164.81, 196.0], // C
    [146.83, 174.61, 220.0], // Dm
  ];

  private readonly D4 = 293.66;
  private readonly F4 = 349.23;
  private readonly G4 = 392.0;
  private readonly A4 = 440.0;
  private readonly C5 = 523.25;
  private readonly D5 = 587.33;

  /** 32 小节主旋律，每小节 8 个八分音符（0 为休止）。 */
  private readonly melody: number[][];

  constructor() {
    this.stepDur = 60 / this.bpm / 4;
    const P1 = [this.D4, this.F4, this.G4, this.A4, this.C5, this.A4, this.G4, this.F4];
    const P2 = [this.D4, this.F4, this.G4, this.A4, this.C5, this.D5, this.C5, this.A4];
    const P3 = [this.G4, this.A4, this.C5, this.D5, this.C5, this.A4, this.G4, this.F4];
    const P4 = [this.D4, this.F4, this.G4, this.F4, this.D4, this.F4, this.G4, this.A4];
    const P5 = [this.D5, this.C5, this.A4, this.C5, this.D5, this.C5, this.A4, this.G4];
    // A: 0-7，A': 8-15，B: 16-23，C: 24-31
    this.melody = [
      P1, P2, P1, P3, P2, P1, P3, P4,
      P1, P2, P3, P5, P2, P3, P5, P4,
      P4, P3, P2, P3, P1, P4, P2, P3,
      P1, P2, P3, P5, P1, P3, P5, P2,
    ];
    try {
      this.muted = localStorage.getItem('im_music') === '0';
      const raw = localStorage.getItem('im_bgm_vol');
      const saved = Number(raw);
      if (raw !== null && Number.isFinite(saved) && saved >= 0) this.volume = Math.min(1, saved / 100);
    } catch {
      /* ignore */
    }
  }

  start(): void {
    if (this.playing) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.55 * this.duck;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.master) this.master.gain.value = 0;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('im_music', this.muted ? '0' : '1');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.55 * this.duck;
    return this.muted;
  }

  setVolume(volume0to100: number): void {
    this.volume = Math.min(1, Math.max(0, volume0to100 / 100));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.55;
    try {
      localStorage.setItem('im_bgm_vol', String(Math.round(this.volume * 100)));
    } catch {
      /* ignore */
    }
  }

  getVolume(): number { return Math.round(this.volume * 100); }
  setDuck(factor: number): void {
    this.duck = Math.min(1, Math.max(0.3, factor));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.55 * this.duck;
  }

  setIntensity(value: 0 | 1): void { this.intensity = value; }
  get playingState(): boolean { return this.playing; }
  get mutedState(): boolean { return this.muted; }
  get currentStep(): number { return this.step; }

  private schedule(): void {
    if (!this.ctx || !this.playing) return;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      this.scheduleStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 512;
      this.nextTime += this.stepDur;
    }
  }

  private scheduleStep(step: number, t: number): void {
    const bar = Math.floor(step / 16) % 32;
    const pos = step % 16;
    const chord = this.chords[bar % 8];
    const section = bar < 8 ? 0 : bar < 16 ? 1 : bar < 24 ? 2 : 3;

    // V3 战鼓：旋律主导、鼓点稀疏（4/4 每小节 8 个八分音符位置）
    const fillBar = bar % 4 === 3;
    if (section === 0) {
      if (pos === 0 || pos === 8) this.drum(t, 56, 0.26, 0.34);
      if (pos === 12 && !fillBar) this.drum(t, 150, 0.12, 0.16); // 第 4 拍战鼓
    } else if (section === 1) {
      if (pos === 0 || pos === 8) this.drum(t, 56, 0.24, 0.32);
      if (pos === 12 && !fillBar) this.drum(t, 120, 0.1, 0.14);
    } else if (section === 2) {
      if (pos === 0 || pos === 8) this.drum(t, 56, 0.24, 0.32);
      if (pos === 12 && !fillBar) this.drum(t, 120, 0.1, 0.15);
      if (pos === 6) this.hat(t); // 第 2 拍后半，轻点一次
    } else {
      if (pos === 0) this.drum(t, 56, 0.3, 0.32);
      if (pos === 8) this.drum(t, 150, 0.14, 0.16);
    }

    // 低音
    if (pos === 0) this.tone(chord[0] / 2, t, 0.6, 'triangle', 0.3);
    if (pos === 8) this.tone(chord[0] / 2, t, 0.45, 'triangle', 0.22);

    // 古筝/琵琶分解和弦
    const arp = [0, 2, 1, 2, 0, 2, 1, 2];
    if (pos % 2 === 0) {
      const idx = pos / 2;
      this.pluck(chord[arp[idx] % 3] * 2, t + 0.005, 0.16, 0.055);
    }

    // 主旋律（琵琶）
    if (pos % 2 === 0) {
      const note = this.melody[bar][pos / 2];
      if (note) {
        this.pluck(note, t, 0.3, 0.17);
        if (section === 1) this.pluck(note / 2, t, 0.35, 0.05);
        if (this.intensity === 1 && section >= 2) this.pluck(note * 1.5, t + 0.02, 0.12, 0.035);
      }
    }

    // 号角：B 段与 Boss 层
    if (pos === 0 && (section === 2 || this.intensity === 1) && bar % 4 === 0) {
      this.tone(chord[0] / 2, t, 1.4, 'sawtooth', 0.06);
    }
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private drum(start: number, freq: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, start + dur);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private pluck(freq: number, start: number, dur: number, gain = 0.1): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.995, start + dur);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private hat(start: number): void {
    if (!this.ctx || !this.master) return;
    const bufSize = Math.floor(this.ctx.sampleRate * 0.03);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i += 1) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.035, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
    src.buffer = buffer;
    src.connect(g);
    g.connect(this.master);
    src.start(start);
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
