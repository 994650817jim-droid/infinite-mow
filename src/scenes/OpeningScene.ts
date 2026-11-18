import Phaser from 'phaser';
import { GAME_HEIGHT as H, GAME_WIDTH as W } from '../config';
import { markOpeningSeen } from '../systems/BattleSettings';
import { homeCommand } from '../ui/HomeCommand';

/**
 * 开场动画（2026-11-18 用户「开场动画播完再进游戏界面」，水墨版成片用户已认可）：
 * - 全屏播 assets/epic-home/opening.mp4（1280×720 · 约 20.2 秒 · 无音轨），按比例铺满（cover），黑底。
 * - 最后一段（约 13.8 秒起）画面上方是宣纸留白：淡入主页同款水墨标题字（title_wordmark，用户认可过），随后朱印盖下。不让 AI 画字。
 * - 任意键 / 点击 / 手柄按键跳过；右下角水墨「跳过 ›」。播完或跳过都记「已播过」，再进主页（或 data.next）。
 * - 视频出错、播放不起来（如浏览器拦截）时直接进主页，不卡住。
 * 配乐：暂时静音（游戏 BGM 为程序生成；首次启动浏览器在用户操作前也不许出声）。
 */
export const OPENING_URL = 'assets/epic-home/opening.mp4';
const TITLE_AT = 13.8;            // 秒：最后一段宣纸留白开始
const SEAL = { x0: .886, y0: .672, x1: .996, y1: .904 }; // title_wordmark 里朱印所在区域（按原图比例）

export class OpeningScene extends Phaser.Scene {
  private done = false; private next = 'MenuScene'; private video?: Phaser.GameObjects.Video;
  private titleShown = false; private started = 0; private padArmed = false;
  private title?: Phaser.GameObjects.Image; private seal?: Phaser.GameObjects.Image;
  constructor() { super('OpeningScene'); }

  create(data?: { next?: string }): void {
    this.done = false; this.titleShown = false; this.padArmed = false; this.next = data?.next ?? 'MenuScene'; this.started = performance.now();
    this.cameras.main.setBackgroundColor('#000000').fadeIn(400, 0, 0, 0);
    const v = this.add.video(W / 2, H / 2).setName('opening-video').setVisible(false); this.video = v;
    v.loadURL(OPENING_URL, true).setMute(true);
    if (v.video) { v.video.muted = true; v.video.defaultMuted = true; v.video.loop = false; v.video.playsInline = true; v.video.setAttribute('playsinline', ''); v.video.setAttribute('webkit-playsinline', ''); }
    v.on('play', () => { if (v.width && v.height) { v.setScale(Math.max(W / v.width, H / v.height)); v.setVisible(true); } });
    v.on('complete', () => this.finish()).on('error', () => this.finish());
    v.play(false);
    // 保险：4 秒还没开始播（被拦截 / 解码失败）或总时长超过 26 秒，直接进主页
    this.time.delayedCall(4000, () => { if (!this.done && !(v.video && v.video.currentTime > 0)) this.finish(); });
    this.time.delayedCall(26000, () => this.finish());

    // 水墨标题字：去掉朱印部分先淡入，朱印另起一张（同一贴图的子帧）随后盖下
    if (this.textures.exists('title_wordmark')) {
      const tex = this.textures.get('title_wordmark'), src = tex.getSourceImage() as { width: number; height: number };
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const tw = Math.min(W * .46, 560), k = tw / src.width, cx = W / 2, cy = H * .2;
      this.title = this.add.image(cx, cy, 'title_wordmark').setScale(k).setAlpha(0).setName('opening-title').setCrop(0, 0, src.width * SEAL.x0, src.height);
      if (!tex.has('opening_seal')) tex.add('opening_seal', 0, src.width * SEAL.x0, src.height * SEAL.y0, src.width * (SEAL.x1 - SEAL.x0), src.height * (SEAL.y1 - SEAL.y0));
      const sx = cx - tw / 2 + tw * (SEAL.x0 + SEAL.x1) / 2, sy = cy - src.height * k / 2 + src.height * k * (SEAL.y0 + SEAL.y1) / 2;
      this.seal = this.add.image(sx, sy, 'title_wordmark', 'opening_seal').setScale(k).setAlpha(0).setName('opening-seal');
    }

    // 跳过：右下角水墨小钮 + 任意键 / 点击 / 手柄
    const skip = homeCommand(this, W - 92, H - 36, 128, 38, '跳过 ›', false, true, 15);
    skip.hit.setName('opening-skip').on('pointerdown', () => this.finish());
    for (const o of [skip.g, skip.caption]) (o as unknown as { setAlpha: (a: number) => void }).setAlpha(0);
    this.tweens.add({ targets: [skip.g, skip.caption], alpha: .9, duration: 500, delay: 800 });
    this.input.keyboard?.on('keydown', () => this.finish());
    this.input.on('pointerdown', () => this.finish());
    this.events.once('shutdown', () => { const key = this.video?.videoTexture?.key; this.video?.stop(); if (key && this.textures.exists(key)) this.textures.remove(key); this.video = undefined; });
  }

  update(): void {
    if (this.done) return;
    // 手柄：开场 0.6 秒后才认按键（避免启动时按着的键直接跳过）
    if (performance.now() - this.started > 600) {
      let pressed = false;
      try { for (const p of navigator.getGamepads?.() ?? []) if (p?.buttons.some(b => b.pressed)) pressed = true; } catch { /* 不支持手柄 */ }
      if (pressed && this.padArmed) { this.finish(); return; }
      if (!pressed) this.padArmed = true;
    }
    const t = this.video?.video?.currentTime ?? 0;
    if (!this.titleShown && t >= TITLE_AT) this.showTitle();
  }

  /** 宣纸留白处：标题字淡入（略微下沉），1.1 秒后朱印盖下（放大 → 落定，轻微一震）。 */
  showTitle(): void {
    if (this.titleShown || !this.title) return; this.titleShown = true;
    const y = this.title.y;
    this.title.setY(y - 8);
    this.tweens.add({ targets: this.title, alpha: 1, y, duration: 1100, ease: 'Sine.easeOut' });
    if (this.seal) {
      const s = this.seal, k = s.scaleX;
      s.setScale(k * 2.2);
      this.tweens.add({ targets: s, alpha: 1, scale: k, duration: 260, delay: 1150, ease: 'Back.easeOut',
        onComplete: () => this.cameras.main.shake(120, .003) });
    }
  }

  finish(): void {
    if (this.done) return; this.done = true;
    markOpeningSeen();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.next));
  }
}
