import Phaser from 'phaser';
import { FONT, GAME_HEIGHT as H, GAME_WIDTH as W, TITLE_FONT } from '../config';
import { IS_DESKTOP_APP } from '../platform/desktop';
import { markOpeningSeen } from '../systems/BattleSettings';
import { homeCommand } from '../ui/HomeCommand';

/**
 * 开场动画（2026-11-18 用户：「开场动画播完再进游戏界面」「你需要做好衔接和bgm和cg也要配上相应的字体符合游戏」）
 * - 四段水墨视频分开播（assets/epic-home/opening/seg1~4.mp4：原片 originals/opening-ink/dsh_opening_ink_seg*.mp4
 *   裁掉左上「AI生成」角标（从 160,90 裁 1120×630 再放大到 1280×720）、去音轨、30fps。重编码命令：
 *   ffmpeg -i dsh_opening_ink_segN.mp4 -an -vf "crop=1120:630:160:90,scale=1280:720:flags=lanczos,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 24 -movflags +faststart segN.mp4）。
 * - 时间轴固定：seg1 0–5.1 秒；seg2 4.3 秒起；seg3 8.6 秒起；seg4 12.9–20 秒。
 * - 衔接：水墨晕染转场，每次重叠 0.8 秒。遮罩是手绘墨迹扩散序列（assets/epic-home/opening/ink_bloom.png，ChatGPT 生成 8 帧，
 *   白底已转透明），不用代码画的形状：下一段从扩散的墨里显出来，墨缘（同一序列超前一帧、染成浓墨）先把上一段吞没。
 * - 字幕：游戏书法标题字（TITLE_FONT），墨色字 + 淡宣纸晕光，逐字像墨一样晕出（模糊 → 清晰），停约 2 秒再淡出。
 * - 最后一段：13.2 秒刀光劈下（配乐重击），14.5 秒上方留白处淡入主页同款水墨标识，朱印盖下、轻震屏。
 * - 配乐：assets/audio/opening_theme.ogg / .mp3（bgm 会话按此时间轴制作，音频 0 秒对齐视频 0 秒）；文件缺失时静音。跳过时音乐淡出，不硬切。
 * - 出声：桌面版（Electron）开了 autoplay-policy 开关，直接带声播；网页版浏览器在用户操作前不许出声，
 *   所以声音还锁着时先显示水墨「点击 · 入乱世」（宣纸底 + 书法字），点一下 / 任意键再开播（只在会播开场的那次启动出现）。
 * - 任意键 / 点击 / 手柄按键跳过；右下角水墨「跳过 ›」。播完或跳过都记「已播过」，再进主页（或 data.next）。
 */
export const OPENING_SEGS = [
  { url: 'assets/epic-home/opening/seg1.mp4', at: 0 },
  { url: 'assets/epic-home/opening/seg2.mp4', at: 4.3 },
  { url: 'assets/epic-home/opening/seg3.mp4', at: 8.6 },
  { url: 'assets/epic-home/opening/seg4.mp4', at: 12.9 },
] as const;
export const OPENING_TOTAL = 20;
const OVERLAP = .8, HIT = 13.2, TITLE_AT = 14.5;
const INK_KEY = 'opening_ink_bloom', INK_URL = 'assets/epic-home/opening/ink_bloom.png', INK_FRAMES = 8;
const MUSIC_KEY = 'opening_theme', MUSIC_URL = 'assets/audio/opening_theme.ogg', MUSIC_MP3 = 'assets/audio/opening_theme.mp3';
/** 字幕（史实：中平元年＝184 年黄巾起事；「苍天已死，黄天当立」为张角口号）。at = 开始晕出的时间（秒）。 */
export const OPENING_LINES: Array<{ at: number; until: number; main: string; sub?: string }> = [ // until = 最晚淡出完毕（下一次转场之前）
  { at: .7, until: 4.1, main: '中平元年　黄巾蜂起', sub: '苍天已死　黄天当立' },
  { at: 5.0, until: 8.4, main: '诸侯并起　天下大乱' },
  { at: 9.3, until: 12.7, main: '桃园结义　誓扶汉室' },
];
const SEAL = { x0: .886, y0: .672, x1: .996, y1: .904 }; // title_wordmark 里朱印所在区域（按原图比例）

type Seg = { v: Phaser.GameObjects.Video; at: number; started: boolean; mask?: Phaser.GameObjects.Image; rim?: Phaser.GameObjects.Image; settled: boolean };

export class OpeningScene extends Phaser.Scene {
  private done = false; private next = 'MenuScene'; private segs: Seg[] = [];
  private t0 = 0; private clockStarted = false; private padArmed = false; private startedAt = 0;
  private titleShown = false; private hitDone = false; private lineShown: boolean[] = [];
  private title?: Phaser.GameObjects.Image; private seal?: Phaser.GameObjects.Image;
  private music?: Phaser.Sound.BaseSound;
  /** 网页版声音未解锁时的「点击 · 入乱世」入口；点了才开播。 */
  private gate?: Phaser.GameObjects.Container; private begun = false;
  constructor() { super('OpeningScene'); }

  preload(): void {
    if (!this.textures.exists(INK_KEY)) this.load.spritesheet(INK_KEY, INK_URL, { frameWidth: 512, frameHeight: 512 });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => { /* 配乐 / 墨迹图缺失：静音 / 普通淡入淡出兜底 */ });
  }

  create(data?: { next?: string }): void {
    this.done = false; this.begun = false; this.gate = undefined; this.clockStarted = false; this.padArmed = false; this.titleShown = false; this.hitDone = false;
    this.lineShown = OPENING_LINES.map(() => false); this.next = data?.next ?? 'MenuScene'; this.startedAt = performance.now();
    this.cameras.main.setBackgroundColor('#000000').fadeIn(400, 0, 0, 0);
    // 四段视频一起建好（各自缓冲），按时间轴依次播；后一段叠在上面
    this.segs = OPENING_SEGS.map((s, i) => {
      const v = this.add.video(W / 2, H / 2).setDepth(10 + i * 10).setVisible(false).setName('opening-seg-' + (i + 1));
      v.loadURL(s.url, true).setMute(true);
      if (v.video) { v.video.muted = true; v.video.defaultMuted = true; v.video.loop = false; v.video.playsInline = true; v.video.preload = 'auto'; v.video.setAttribute('playsinline', ''); }
      v.on('play', () => { if (v.width && v.height) v.setScale(Math.max(W / v.width, H / v.height)); });
      v.on('error', () => { if (i === 0) this.finish(); });
      const seg: Seg = { v, at: s.at, started: false, settled: i === 0 };
      // 各段先只预缓冲、停在第 0 帧：Phaser 的 loadURL 载入后会自己开播，不拦住的话第二段到 4.3 秒时已经快播完（实测整段黑屏），第一段也会在「点击进入」后面偷偷开播
      if (v.video) { const el = v.video; el.autoplay = false; const hold = () => { if (!seg.started) { el.pause(); el.currentTime = 0; } }; el.addEventListener('playing', hold); el.addEventListener('loadeddata', hold); }
      return seg;
    });
    // 网页版：声音还锁着（用户还没操作过页面）就先显示「点击 · 入乱世」；桌面版 / 已解锁（如设置里重看）直接开播
    let q: URLSearchParams | null = null; try { q = new URLSearchParams(location.search); } catch { /* ignore */ }
    if (!IS_DESKTOP_APP && this.sound.locked && q?.get('gate') !== '0') this.showGate(); else this.begin();

    // 水墨标识：去掉朱印部分先淡入，朱印另起一张（同一贴图的子帧）随后盖下
    if (this.textures.exists('title_wordmark')) {
      const tex = this.textures.get('title_wordmark'), src = tex.getSourceImage() as { width: number; height: number };
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const tw = Math.min(W * .46, 560), k = tw / src.width, cx = W / 2, cy = H * .2;
      this.title = this.add.image(cx, cy, 'title_wordmark').setScale(k).setAlpha(0).setDepth(100).setName('opening-title').setCrop(0, 0, src.width * SEAL.x0, src.height);
      if (!tex.has('opening_seal')) tex.add('opening_seal', 0, src.width * SEAL.x0, src.height * SEAL.y0, src.width * (SEAL.x1 - SEAL.x0), src.height * (SEAL.y1 - SEAL.y0));
      const sx = cx - tw / 2 + tw * (SEAL.x0 + SEAL.x1) / 2, sy = cy - src.height * k / 2 + src.height * k * (SEAL.y0 + SEAL.y1) / 2;
      this.seal = this.add.image(sx, sy, 'title_wordmark', 'opening_seal').setScale(k).setAlpha(0).setDepth(101).setName('opening-seal');
    }

    // 跳过：右下角水墨小钮 + 任意键 / 点击 / 手柄
    const skip = homeCommand(this, W - 92, H - 36, 128, 38, '跳过 ›', false, true, 15);
    for (const o of [skip.g, skip.caption, skip.hit]) (o as unknown as { setDepth: (d: number) => void }).setDepth(200);
    skip.hit.setName('opening-skip').on('pointerdown', () => { if (this.begun) this.finish(); });
    for (const o of [skip.g, skip.caption]) (o as unknown as { setAlpha: (a: number) => void }).setAlpha(0);
    this.skipParts = [skip.g, skip.caption];
    this.input.keyboard?.on('keydown', () => this.onInput());
    this.input.on('pointerdown', () => this.onInput());
    this.events.once('shutdown', () => {
      for (const s of this.segs) { const key = s.v.videoTexture?.key; s.v.stop(); if (key && this.textures.exists(key)) this.textures.remove(key); s.mask?.destroy(); }
      this.segs = []; this.music?.stop(); this.music?.destroy(); this.music = undefined;
    });
  }

  private skipParts: Phaser.GameObjects.GameObject[] = [];
  /** 点击 / 按键：入口时开播，播放中跳过。 */
  private onInput(): void { if (this.gate) this.enter(); else if (this.begun) this.finish(); }
  /** 水墨入口：宣纸底 + 书法「点击 · 入乱世」+ 朱印，提示字呼吸。 */
  private showGate(): void {
    const g = this.add.container(0, 0).setDepth(300).setName('opening-gate');
    if (this.textures.exists('ink_paper')) { const p = this.add.image(W / 2, H / 2, 'ink_paper'); p.setScale(Math.max(W / p.width, H / p.height)); g.add(p); }
    else g.add(this.add.rectangle(W / 2, H / 2, W, H, 0xe9dfc8));
    const t = this.add.text(W / 2, H * .46, '点击 · 入乱世', { fontFamily: TITLE_FONT, fontSize: '46px', color: '#1c1610', resolution: 2 }).setOrigin(.5).setLetterSpacing(10).setShadow(0, 0, '#f6eedb', 12, true, true).setName('opening-gate-title');
    g.add(t);
    if (this.textures.exists('title_wordmark')) { const tex = this.textures.get('title_wordmark'), src = tex.getSourceImage() as { width: number; height: number }; if (!tex.has('opening_seal')) tex.add('opening_seal', 0, src.width * SEAL.x0, src.height * SEAL.y0, src.width * (SEAL.x1 - SEAL.x0), src.height * (SEAL.y1 - SEAL.y0)); }
    if (this.textures.exists('title_wordmark')) g.add(this.add.image(t.x + t.width / 2 + 34, t.y + 8, 'title_wordmark', 'opening_seal').setScale(.42));
    const hint = this.add.text(W / 2, H * .46 + 54, '点击画面或按任意键', { fontFamily: FONT, fontSize: '14px', color: '#5a4a36', resolution: 2 }).setOrigin(.5);
    g.add(hint); this.tweens.add({ targets: hint, alpha: .35, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    g.setAlpha(0); this.tweens.add({ targets: g, alpha: 1, duration: 500 });
    this.gate = g;
  }
  /** 点了入口：入口淡出，开播（这次点击就是浏览器要的手势，声音随之解锁）。 */
  private enter(): void {
    const g = this.gate; if (!g) return; this.gate = undefined; g.disableInteractive?.();
    this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
    this.begin();
  }
  /** 开播：第一段 + 配乐 + 跳过钮；保险计时器从这里算。 */
  private begin(): void {
    if (this.begun) return; this.begun = true; this.startedAt = performance.now(); this.padArmed = false;
    const s0 = this.segs[0], first = s0.v; s0.started = true; first.setVisible(true);
    first.once('play', () => { if (!this.clockStarted) { this.clockStarted = true; this.t0 = performance.now(); } });
    first.play(false);
    // 保险：4 秒还没开始播（被拦截 / 解码失败）直接进主页；总时长兜底 26 秒
    this.time.delayedCall(4000, () => { if (!this.done && !this.clockStarted) this.finish(); });
    this.time.delayedCall(26000, () => this.finish());
    this.tweens.add({ targets: this.skipParts, alpha: .9, duration: 500, delay: 800 });
    // 配乐：按开场时钟对齐播放；声音若还锁着（极少：桌面外的特殊环境），解锁后从当前位置接上
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.startMusic()); else this.startMusic();
  }
  private startMusic(): void {
    let vol = .4; try { vol = Number(localStorage.getItem('im_bgm_vol') ?? 40) / 100; } catch { /* 存储不可用 */ }
    const play = () => { if (this.done || !this.sys.isActive()) return; this.music = this.sound.add(MUSIC_KEY, { volume: Phaser.Math.Clamp(vol, 0, 1) }); this.music.play({ seek: this.clock }); };
    if (this.cache.audio.exists(MUSIC_KEY)) { play(); return; }
    fetch(MUSIC_URL, { method: 'HEAD' }).then(r => {
      if (!r.ok || !/audio|ogg|octet-stream/.test(r.headers.get('content-type') ?? '') || this.done) return;
      this.load.audio(MUSIC_KEY, [MUSIC_URL, MUSIC_MP3]); this.load.once(Phaser.Loader.Events.COMPLETE, () => { if (this.cache.audio.exists(MUSIC_KEY)) play(); }); this.load.start();
    }).catch(() => { /* 离线 / 不存在：静音 */ });
  }
  /** 测试 / 预览用：把开场时钟拨到 t 秒（已开播的段同步跳到对应位置）。 */
  seekTo(t: number): void { if (!this.clockStarted) return; this.t0 = performance.now() - t * 1000; for (const s of this.segs) if (s.started && s.v.video) s.v.video.currentTime = Math.max(0, t - s.at); this.lineShown = OPENING_LINES.map(l => l.at < t - 3); }
  /** 开场时钟（秒）：从第一段真正开始播放算起。 */
  get clock(): number { return this.clockStarted ? (performance.now() - this.t0) / 1000 : 0; }

  update(): void {
    if (this.done) return;
    // 手柄：开场 0.6 秒后才认按键（避免启动时按着的键直接跳过）
    if (performance.now() - this.startedAt > 600) {
      let pressed = false;
      try { for (const p of navigator.getGamepads?.() ?? []) if (p?.buttons.some(b => b.pressed)) pressed = true; } catch { /* 不支持手柄 */ }
      if (pressed && this.padArmed) { this.padArmed = false; this.onInput(); if (this.done) return; }
      if (!pressed) this.padArmed = true;
    }
    if (!this.clockStarted) return;
    const t = this.clock;
    for (let i = 1; i < this.segs.length; i++) this.updateSeg(i, t);
    OPENING_LINES.forEach((l, i) => { if (!this.lineShown[i] && t >= l.at) { this.lineShown[i] = true; this.showLine(l); } });
    if (!this.hitDone && t >= HIT) { this.hitDone = true; this.cameras.main.shake(160, .004); }
    if (!this.titleShown && t >= TITLE_AT) this.showTitle();
    if (t >= OPENING_TOTAL) this.finish();
  }

  /** 第 i 段：到点开播，0.8 秒水墨晕染转场（遮罩 = 手绘墨迹扩散序列），转完撤掉遮罩、停掉上一段。 */
  private updateSeg(i: number, t: number): void {
    const s = this.segs[i], prev = this.segs[i - 1];
    if (!s.started && t >= s.at) {
      s.started = true; if (s.v.video) s.v.video.currentTime = Math.max(0, t - s.at); // 从对应位置开播（时钟被拨快时也对齐）
      s.v.setVisible(true).play(false);
      if (this.textures.exists(INK_KEY) && this.renderer.type === Phaser.WEBGL) {
        s.mask = this.make.image({ x: W / 2, y: H / 2, key: INK_KEY, frame: 0, add: false });
        s.v.setMask(s.mask.createBitmapMask());
        // 墨缘：同一序列超前一帧、浓墨色，压在上一段之上、本段之下——先把上一段吞进墨里
        s.rim = this.add.image(W / 2, H / 2, INK_KEY, 0).setTint(0x0b0806).setDepth(s.v.depth - 1).setName('opening-ink-rim-' + (i + 1));
      } else s.v.setAlpha(0);
    }
    if (!s.started || s.settled) return;
    const p = Phaser.Math.Clamp((t - s.at) / OVERLAP, 0, 1), ease = Phaser.Math.Easing.Sine.InOut(p);
    const cover = Math.max(W, H) * 1.5 / 512, scale = cover * (.55 + .45 * ease);
    const f = Math.min(INK_FRAMES - 1, Math.floor(ease * INK_FRAMES));
    if (s.mask) { s.mask.setFrame(f).setScale(scale); s.rim?.setFrame(Math.min(INK_FRAMES - 1, f + 1)).setScale(scale * 1.12).setAlpha(Math.min(1, p * 3) * (1 - Math.max(0, p - .85) / .15)); }
    else s.v.setAlpha(ease);
    if (p >= 1) {
      s.settled = true; s.v.clearMask(true); s.mask = undefined; s.rim?.destroy(); s.rim = undefined; s.v.setAlpha(1);
      prev.v.stop(); prev.v.setVisible(false);
    }
  }

  /** 字幕：书法标题字，墨色 + 淡宣纸晕光；逐字晕出（模糊 → 清晰、略收缩），停约 2 秒，淡出。 */
  private showLine(l: { at: number; until: number; main: string; sub?: string }): void {
    const y = H * .17, parts: Phaser.GameObjects.Text[] = [];
    const row = (text: string, yy: number, size: number, color: string, gap: number) => {
      const chars = [...text], step = size + gap, x0 = W / 2 - (chars.length - 1) * step / 2;
      chars.forEach((ch, k) => {
        if (ch === '　' || ch === ' ') return;
        const t = this.add.text(x0 + k * step, yy, ch, { fontFamily: TITLE_FONT, fontSize: size + 'px', color, resolution: 2 })
          .setOrigin(.5).setDepth(120).setAlpha(0).setScale(1.18).setStroke('#f3ead6', 2).setShadow(0, 0, '#f6eedb', 14, true, true).setName('opening-line-char');
        const fx = (t as unknown as { preFX?: Phaser.GameObjects.Components.FX }).preFX;
        const blur = fx?.addBlur(1, 2, 2, 2.4);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 700, delay: k * 85, ease: 'Sine.easeOut' });
        if (blur) this.tweens.add({ targets: blur, strength: 0, duration: 760, delay: k * 85, ease: 'Sine.easeOut' });
        parts.push(t);
      });
    };
    row(l.main, y, 38, '#1a1410', 8);
    if (l.sub) row(l.sub, y + 50, 22, '#3a2a1c', 6);
    const reveal = [...l.main].length * 85 + 700;
    const hold = Math.min(reveal + 2000, (l.until - .55 - l.at) * 1000); // 停约 2 秒，但一定在下一次转场前淡完
    this.tweens.add({ targets: parts, alpha: 0, duration: 550, delay: Math.max(reveal + 600, hold), onComplete: () => parts.forEach(p => p.destroy()) });
  }

  /** 上方留白处：标识淡入（略微下沉），1.1 秒后朱印盖下（放大 → 落定，轻微一震）。 */
  showTitle(): void {
    if (this.titleShown || !this.title) return; this.titleShown = true;
    const y = this.title.y;
    this.title.setY(y - 8);
    this.tweens.add({ targets: this.title, alpha: 1, y, duration: 1100, ease: 'Sine.easeOut' });
    if (this.seal) {
      const s = this.seal, k = s.scaleX;
      s.setScale(k * 2.2);
      this.tweens.add({ targets: s, alpha: 1, scale: k, duration: 260, delay: 1150, ease: 'Back.easeOut', onComplete: () => this.cameras.main.shake(120, .003) });
    }
  }

  finish(): void {
    if (this.done) return; this.done = true;
    markOpeningSeen();
    // 配乐淡出，不硬切
    if (this.music?.isPlaying) this.tweens.add({ targets: this.music, volume: 0, duration: 600 });
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.next));
  }
}
