import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { STAR_FEEDBACK, STAR_HUD, STAR_ICON_FILE, starIconKey, starIconUrl } from '../data/starFx';

/**
 * 战斗界面左侧增益栏下面的「星图」图标排（第四期；只在开关 starMapOn() 打开、且点亮了要星 / 主星时出现）。
 * 列出已点亮的要星和主星（图标是星图页面同一套 public/assets/star-map/icon_*.png，按需加载），悬停显示名字和说明；
 * 一行 STAR_HUD.perRow 个、最多 STAR_HUD.rows 行，超出的折叠成最后一格「+N」。会动的排前面。
 * 反馈：触发式的星触发时图标放大再回落约 0.4 秒；状态式 / 限时式的成立时不透明、不成立时半透明；常驻的一直正常显示。
 * 外框和说明底板沿用增益栏的画法（细线框 + 深色底），不是特效。
 */
export interface StarBuffEntry { id: string; name: string; desc: string; kind: string; /** 状态式 / 限时式：现在成立吗；null = 常驻或触发式。 */ active: boolean | null }
interface Slot { root: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Graphics; image: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Rectangle; entry?: StarBuffEntry; more?: StarBuffEntry[]; key: string; flashUntil: number; wasActive: boolean }

export class StarBuffHud {
  readonly root: Phaser.GameObjects.Container;
  private readonly slots: Slot[] = [];
  private readonly tip: Phaser.GameObjects.Container; private readonly tipBg: Phaser.GameObjects.Graphics; private readonly tipTitle: Phaser.GameObjects.Text; private readonly tipText: Phaser.GameObjects.Text;
  private readonly requested = new Set<string>();
  private now = 0; private hover: Slot | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const H = STAR_HUD, step = H.size + H.gap;
    this.root = scene.add.container(22, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3).setName('battle-star-buffs').setVisible(false);
    const label = (x: number, y: number, v: string, size: number, color = '#e9d2a0') => scene.add.text(x, y, v, { fontFamily: FONT, fontSize: size + 'px', color, resolution: 2, stroke: '#17140d', strokeThickness: 2 }).setScrollFactor(0);
    this.root.add(label(0, 0, '星图', 11, '#c2b48f'));
    for (let i = 0; i < H.perRow * H.rows; i++) {
      const root = scene.add.container(i % H.perRow * step, 16 + Math.floor(i / H.perRow) * step), frame = scene.add.graphics();
      const image = scene.add.image(H.size / 2, H.size / 2, '__DEFAULT').setVisible(false), text = label(H.size / 2, H.size / 2, '', 10, '#e8d6a4').setOrigin(.5);
      // 命中框自身 scrollFactor = 0（同增益栏：否则镜头跟随后悬停落空）
      const hit = scene.add.rectangle(H.size / 2, H.size / 2, step, step, 0, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName('star-buff-' + i);
      const slot: Slot = { root, frame, image, text, hit, key: '', flashUntil: 0, wasActive: false };
      root.add([frame, image, text, hit]); this.root.add(root); this.slots.push(slot);
      hit.on('pointerover', () => { this.hover = slot; this.renderTip(); }).on('pointerout', () => { if (this.hover === slot) { this.hover = null; this.tip.setVisible(false); } })
        .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e?.stopPropagation(); this.hover = slot; this.renderTip(); });
    }
    this.tip = scene.add.container(0, 0).setVisible(false); this.tipBg = scene.add.graphics(); this.tipTitle = label(10, 8, '', 15); this.tipText = label(10, 32, '', 13, '#d4c7ad').setWordWrapWidth(228, true).setLineSpacing(3);
    this.tip.add([this.tipBg, this.tipTitle, this.tipText]); this.root.add(this.tip);
  }
  get alive(): boolean { return !!this.root.scene; }
  /** 图标排占的高度（含标题；没东西显示时 0）。 */
  height = 0;
  /** 让某颗星的图标亮一下（不在显示范围内的忽略）。 */
  flash(id: string): void { for (const s of this.slots) if (s.entry?.id === id) s.flashUntil = this.now + STAR_HUD.flashMs; }
  /** 每帧推进「亮一下」的放大回落（整排的重画跟着 HUD 每 0.1 秒一次，见 update）。 */
  tick(now: number): void {
    this.now = now; if (!this.root.visible) return;
    const H = STAR_HUD;
    for (const s of this.slots) { if (!s.flashUntil || !s.entry) continue; const p = now < s.flashUntil ? 1 - (s.flashUntil - now) / H.flashMs : -1, k = p >= 0 ? 1 + (H.flashScale - 1) * Math.sin(Math.PI * p) : 1; s.image.setDisplaySize(H.size * k, H.size * k); if (p >= 0) s.root.setAlpha(1); else s.flashUntil = 0; }
  }
  /** 测试 / 调试用：现在显示的每一格（编号、透明度、是不是正在亮）。 */
  snapshot(): Array<{ id: string; alpha: number; flashing: boolean; scale: number }> { return this.slots.filter(s => s.root.visible).map(s => ({ id: s.key, alpha: +s.root.alpha.toFixed(2), flashing: this.now < s.flashUntil, scale: +(s.image.displayWidth / STAR_HUD.size).toFixed(2) })); }

  private renderTip(): void {
    const s = this.hover, e = s?.entry; if (!s || !e) { this.tip.setVisible(false); return; }
    const state = e.active === null ? '' : e.active ? '\n▸ 生效中' : '\n▸ 条件未成立';
    this.tipTitle.setText(e.name); this.tipText.setText(s.more ? s.more.map(m => m.name).join('、') : '【' + e.kind + '】\n' + e.desc + state);
    const h = Math.max(56, this.tipText.height + 42);
    this.tipBg.clear().fillStyle(0x17140d, .94).fillRect(0, 0, 248, h).lineStyle(1, 0xb09056, .7).strokeRect(0, 0, 248, h);
    this.tip.setPosition(Math.min(s.root.x, 60), s.root.y + STAR_HUD.size + 6).setVisible(true);
  }

  update(entries: StarBuffEntry[], now: number, visible: boolean, y: number): void {
    this.now = now;
    if (!visible || !entries.length) { this.root.setVisible(false); this.tip.setVisible(false); this.hover = null; this.height = 0; return; }
    const H = STAR_HUD, max = H.perRow * H.rows;
    // 会动的（触发 / 限时 / 状态）排前面，其余按点亮先后
    const sorted = [...entries].sort((a, b) => Number(!(a.id in STAR_FEEDBACK)) - Number(!(b.id in STAR_FEEDBACK)));
    const over = sorted.length > max, show = sorted.slice(0, over ? max - 1 : max), rest = over ? sorted.slice(max - 1) : [];
    this.root.setVisible(true).setY(y); this.height = 16 + Math.ceil((show.length + (over ? 1 : 0)) / H.perRow) * (H.size + H.gap) + 4;
    let loading = false;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i], e: StarBuffEntry | undefined = show[i] ?? (over && i === max - 1 ? { id: 'more', name: '其余 ' + rest.length + ' 颗星', desc: '', kind: '', active: null } : undefined);
      s.root.setVisible(!!e); s.entry = e; s.more = e?.id === 'more' ? rest : undefined; if (!e) { s.key = ''; continue; }
      if (s.key !== e.id) { s.key = e.id; s.flashUntil = 0; s.wasActive = !!e.active; s.image.setVisible(false); s.text.setText(e.id === 'more' ? '+' + rest.length : e.name[0]); }
      else if (e.id === 'more') s.text.setText('+' + rest.length);
      if (e.id !== 'more' && !s.image.visible) {
        const key = starIconKey(e.id);
        if (this.scene.textures.exists(key)) { s.image.setTexture(key).setVisible(true); s.text.setText(''); }
        else if (STAR_ICON_FILE[e.id] && !this.requested.has(key)) { this.requested.add(key); this.scene.load.image(key, starIconUrl(e.id)); loading = true; }
      }
      // 限时式（疾影 / 奇谋）刚开始生效时也亮一下
      if (STAR_FEEDBACK[e.id] === 'timed' && e.active && !s.wasActive) s.flashUntil = now + H.flashMs;
      s.wasActive = !!e.active;
      const p = now < s.flashUntil ? 1 - (s.flashUntil - now) / H.flashMs : -1, k = p >= 0 ? 1 + (H.flashScale - 1) * Math.sin(Math.PI * p) : 1, on = e.active !== false || p >= 0;
      s.image.setDisplaySize(H.size * k, H.size * k); s.root.setAlpha(on ? 1 : H.idleAlpha);
      s.frame.clear().fillStyle(0x191711, .62).fillRect(0, 0, H.size, H.size).lineStyle(1, p >= 0 ? 0xfff2c8 : e.active ? 0xffd879 : 0x8a7a55, p >= 0 ? 1 : .75).strokeRect(.5, .5, H.size - 1, H.size - 1);
    }
    if (loading) this.scene.load.start();
    if (this.hover && (!this.hover.entry || !this.hover.root.visible)) { this.hover = null; this.tip.setVisible(false); }
  }
}
