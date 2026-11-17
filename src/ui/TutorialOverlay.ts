import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT } from '../config';
import { setTutorialSeen, tutorialSeen } from '../world/WorldStore';

/** 屏幕坐标里的一块区域（界面元素的包围盒，或世界物件换算到屏幕后的位置）。 */
export interface ScreenRect { x: number; y: number; w: number; h: number }

const INK = 'btn_ink_secondary_normal';   // 手绘墨迹横条（与水墨按钮同一张）
const IVORY = '#f3e6c6', GOLD = '#f2c27a', STROKE = '#1a120b';

/**
 * 新手引导的界面层（只管画，不管流程；流程见 systems/Tutorial.ts）：
 *  - 一行提示：手绘墨迹横条打底，象牙白字 + 深色描边（同其他界面字体），可带按键图标（墨迹小块 + 字母）。
 *  - 指向：目标界面元素加柔光（WebGL 发光滤镜），旁边一枚金色指向箭头上下轻跳。
 *  - 右侧「跳过引导」。
 * 不画网页式矩形、不画像素、不画代码特效。
 */
export class TutorialOverlay {
  readonly root: Phaser.GameObjects.Container;
  private bar: Phaser.GameObjects.Image | null;
  private text: Phaser.GameObjects.Text;
  private keys: Phaser.GameObjects.GameObject[] = [];
  private skipBtn: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private glowOn: { obj: Phaser.GameObjects.GameObject & { postFX?: Phaser.GameObjects.Components.FX }; fx: Phaser.FX.Glow } | null = null;
  private y = GAME_HEIGHT - 82;
  /** 指向箭头的基准位置与方向（每帧按真实时间轻跳；升级 / 行营时游戏会暂停所有 Tween，所以不用 Tween）。 */
  private aim: { x: number; y: number; dx: number; dy: number } | null = null;

  constructor(private scene: Phaser.Scene, onSkip: () => void) {
    const s = scene;
    this.root = s.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 80).setName('tutorial-overlay');
    this.bar = s.textures.exists(INK) ? s.add.image(GAME_WIDTH / 2, this.y, INK).setScrollFactor(0).setAlpha(.92).setName('tutorial-bar') : null;
    this.text = s.add.text(GAME_WIDTH / 2, this.y, '', { fontFamily: FONT, fontSize: '17px', color: IVORY, stroke: STROKE, strokeThickness: 4, resolution: 2 }).setOrigin(.5).setScrollFactor(0).setName('tutorial-text');
    this.skipBtn = s.add.text(0, 0, '跳过引导', { fontFamily: HEADING_FONT, fontSize: '14px', color: '#d9c7a3', stroke: STROKE, strokeThickness: 3, resolution: 2 }).setOrigin(0, .5).setScrollFactor(0).setAlpha(.85)
      .setInteractive({ useHandCursor: true }).setName('tutorial-skip').on('pointerover', () => this.skipBtn.setColor(GOLD)).on('pointerout', () => this.skipBtn.setColor('#d9c7a3')).on('pointerdown', () => onSkip());
    this.arrow = s.add.text(0, 0, '➤', { fontFamily: FONT, fontSize: '30px', color: GOLD, stroke: STROKE, strokeThickness: 5 }).setOrigin(.5).setScrollFactor(0).setVisible(false).setName('tutorial-arrow');
    this.root.add([...(this.bar ? [this.bar] : []), this.text, this.skipBtn, this.arrow]);
    this.root.setVisible(false);
  }

  /** 显示一行提示（keys：按键图标，如 ['W','A','S','D']）；at：'battle' 底部 / 'camp' 营地底部偏上 / 'top' 顶部。 */
  show(line: string, keys: string[] = [], at: 'battle' | 'camp' | 'popup' = 'battle'): void {
    // 战场：底部；行营：顶部居中（标题与「下一关」之间的空处）；弹窗（升级 / 支援）：卡片下沿之下
    this.y = at === 'camp' ? 60 : at === 'popup' ? GAME_HEIGHT - 22 : GAME_HEIGHT - 82;
    for (const k of this.keys) k.destroy(); this.keys = [];
    this.text.setText(line);
    const capW = 30, gap = 6, capsW = keys.length ? keys.length * (capW + gap) + 8 : 0, total = this.text.width + capsW;
    let x = GAME_WIDTH / 2 - total / 2;
    for (const k of keys) {
      const w = Math.max(capW, k.length * 13 + 14), cx = x + w / 2;
      const cap = this.scene.textures.exists(INK) ? this.scene.add.image(cx, this.y, INK).setDisplaySize(w + 10, 30).setScrollFactor(0).setTint(0x4a3420) : null;
      const t = this.scene.add.text(cx, this.y, k, { fontFamily: HEADING_FONT, fontSize: '15px', color: GOLD, stroke: STROKE, strokeThickness: 3, resolution: 2 }).setOrigin(.5).setScrollFactor(0).setName('tutorial-key');
      if (cap) this.keys.push(cap); this.keys.push(t); x += w + gap;
    }
    if (keys.length) x += 8;
    this.text.setPosition(x + this.text.width / 2, this.y);
    const barW = Math.max(320, total + 120);
    this.bar?.setPosition(GAME_WIDTH / 2, this.y).setDisplaySize(barW, 50);
    this.skipBtn.setPosition(GAME_WIDTH / 2 + barW / 2 + 6, this.y);
    this.root.add(this.keys);
    this.root.setVisible(true).setAlpha(1);
  }
  get arrowState() { return { vis: this.arrow.visible, x: Math.round(this.arrow.x), y: Math.round(this.arrow.y), aim: this.aim }; }
  get line(): string { return this.root.visible ? this.text.text : ''; }

  /** 指向一块屏幕区域（箭头在旁边上下轻跳）；glow：给该界面元素加柔光。传 null 收起。 */
  point(rect: ScreenRect | null, glow?: Phaser.GameObjects.GameObject | null, from?: 'below'): void {
    this.clearGlow();
    if (!rect) { this.aim = null; this.arrow.setVisible(false); return; }
    // 靠右边缘的目标（护阵等）：箭头在左侧向右指；靠顶部：在下方向上指；其余在上方向下指
    const side = !from && rect.x + rect.w > GAME_WIDTH - 170, below = from === 'below' || (!side && rect.y < 120);
    const ax = side ? rect.x - 24 : rect.x + rect.w / 2, ay = side ? rect.y + rect.h / 2 : below ? rect.y + rect.h + (from ? 12 : 26) : rect.y - 26;
    this.arrow.setPosition(ax, ay).setRotation(side ? 0 : below ? -Math.PI / 2 : Math.PI / 2).setVisible(true);
    this.aim = { x: ax, y: ay, dx: side ? -1 : 0, dy: side ? 0 : below ? 1 : -1 };
    const g = glow as (Phaser.GameObjects.GameObject & { postFX?: Phaser.GameObjects.Components.FX }) | null | undefined;
    if (g?.postFX && this.scene.game.renderer.type === Phaser.WEBGL) { const fx = g.postFX.addGlow(0xf6d27a, 5, 0, false, .1, 14); this.glowOn = { obj: g, fx }; }
  }
  private clearGlow(): void { if (this.glowOn) { try { this.glowOn.obj.postFX?.remove(this.glowOn.fx); } catch { /* 目标已销毁 */ } this.glowOn = null; } }
  /** 每帧调用：箭头按真实时间来回轻跳。 */
  animate(): void { if (!this.aim) return; const k = (Math.sin(performance.now() / 210) + 1) * 4; this.arrow.setPosition(this.aim.x + this.aim.dx * k, this.aim.y + this.aim.dy * k); }
  /** 只挪箭头（世界物件跟随，不重设柔光）。 */
  follow(rect: ScreenRect): void { if (!this.aim) { this.point(rect); return; } const r = rect; this.aim.x = r.x + r.w / 2; this.aim.y = r.y - 26; this.arrow.setRotation(Math.PI / 2).setVisible(true); this.aim.dx = 0; this.aim.dy = -1; }
  hide(): void { this.point(null); this.root.setVisible(false); }
  destroy(): void { this.clearGlow(); this.root.destroy(); }
}

/** 设置面板里的「重看新手引导」小链接（MenuScene 军中设置里一行调用）：清掉存档里的引导标记，下次进 1-1 重新教学。 */
export function tutorialReplayLink(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, '重看新手引导', { fontFamily: FONT, fontSize: '13px', color: '#d9c7a3', stroke: STROKE, strokeThickness: 3, resolution: 2 }).setOrigin(1, .5).setName('settings-tutorial-replay')
    .setInteractive({ useHandCursor: true });
  const sync = () => t.setText(tutorialSeen() ? '重看新手引导' : '下次 1-1 重看引导 ✓').setColor(tutorialSeen() ? '#d9c7a3' : GOLD);
  sync();
  t.on('pointerover', () => t.setAlpha(.8)).on('pointerout', () => t.setAlpha(1)).on('pointerdown', () => { setTutorialSeen(false); sync(); });
  return t;
}
