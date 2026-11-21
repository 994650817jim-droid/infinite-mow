import Phaser from 'phaser';
import { FONT } from '../config';
import { STAR_EDGES, STAR_NODES, STAR_REGIONS, STAR_RULES, keystonesLit, lightBlock, litSet, regionLit, starPoints, type StarNode } from '../data/starMap';
import { ATTRIBUTE_IDS } from '../data/attributes';

/**
 * 星图 · 临时界面（程序占位）—— 只在开关 starMapOn() 打开时出现的开发用面板（星图第一期）。
 * 圆点、方块、菱形和连线都是程序画的，只为了能点星、能洗点、能看说明；正式界面（手绘底图、节点底座、点亮序列帧）是第二期的事，
 * 到时整个文件换掉。按 data/starMap.ts 的坐标（设计稿 nodes.json）等比缩进给定的矩形里：左边是图，右边一栏是说明。
 * 用在两处：战斗内属性面板的位置（C 键，GameScene.renderAttributePanel）和营寨武将谱的属性页（HeroCodexUI）。
 */
export interface StarPanelState {
  heroName: string; level: number;
  /** 这位武将的入口。 */
  gate: string;
  /** 已点亮的星（不含入口）。 */
  lit: readonly string[];
  /** 还能点几颗。 */
  free: number;
}
export interface StarPanelOpts {
  x: number; y: number; w: number; h: number;
  state: () => StarPanelState;
  /** 点亮一颗；返回是否成功（成功后面板自己重画）。 */
  onLight: (id: string) => boolean;
  /** 洗点按钮（不给就没有）：label 是按钮上的字，act 返回提示语。 */
  respec?: { label: () => string; act: () => string };
  /** 关闭按钮（不给就没有）。 */
  close?: { label: () => string; act: () => void };
}

const KIND_NAME: Record<StarNode['kind'], string> = { gate: '入口', small: '小星', notable: '要星', keystone: '主星' };
const XS = STAR_NODES.map(n => n.x), YS = STAR_NODES.map(n => n.y);
const BOUNDS = { x0: Math.min(...XS), x1: Math.max(...XS), y0: Math.min(...YS), y1: Math.max(...YS) };

export class StarMapDevPanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Text;
  private readonly info: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly respecBtn?: Phaser.GameObjects.Text;
  private readonly closeBtn?: Phaser.GameObjects.Text;
  private readonly pos = new Map<string, { x: number; y: number }>();
  private hover: string | null = null;
  private message = '';

  constructor(private readonly scene: Phaser.Scene, private readonly o: StarPanelOpts) {
    const { x, y, w, h } = o;
    this.root = scene.add.container(0, 0).setScrollFactor(0).setName('star-map-dev');
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => { (obj as unknown as { setScrollFactor: (n: number) => void }).setScrollFactor(0); this.root.add(obj); return obj; };
    const text = (tx: number, ty: number, v: string, size: number, color: string) => add(scene.add.text(tx, ty, v, { fontFamily: FONT, fontSize: size + 'px', color, resolution: 2 }));
    // 底：不透明，挡住下面原来的属性面板，也吃掉点击
    add(scene.add.rectangle(x, y, w, h, 0x0d0b09, 1).setOrigin(0).setStrokeStyle(1, 0x6b5a3a, 1).setInteractive()).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    // 版式：右边一栏说明（宽 side），其余放图
    const side = Math.min(250, Math.max(170, w * .3)), pad = 22, mapW = w - side - pad * 2, mapH = h - pad * 2 - 14;
    const scale = Math.min(mapW / (BOUNDS.x1 - BOUNDS.x0), mapH / (BOUNDS.y1 - BOUNDS.y0));
    const ox = x + pad + (mapW - (BOUNDS.x1 - BOUNDS.x0) * scale) / 2, oy = y + pad + 14 + (mapH - (BOUNDS.y1 - BOUNDS.y0) * scale) / 2;
    for (const n of STAR_NODES) this.pos.set(n.id, { x: ox + (n.x - BOUNDS.x0) * scale, y: oy + (n.y - BOUNDS.y0) * scale });
    this.g = add(scene.add.graphics());
    text(x + 8, y + 5, '临时界面（程序占位）· 星图第一期', 12, '#ff9c7a').setName('star-dev-tag');
    // 要星 / 主星的名字（小星不写）
    for (const n of STAR_NODES) if (n.kind === 'notable' || n.kind === 'keystone') {
      const p = this.pos.get(n.id)!;
      text(p.x, p.y + (n.kind === 'keystone' ? 12 : 9), n.name + (n.todo ? '·未' : ''), 10, n.todo ? '#8f8672' : '#e8d6a4').setOrigin(.5, 0).setName('star-label-' + n.id);
    }
    // 命中区（每颗一个，比画出来的大一圈）
    for (const n of STAR_NODES) {
      const p = this.pos.get(n.id)!, r = Math.max(9, 14 * scale + 4);
      const z = add(scene.add.zone(p.x, p.y, r * 2, r * 2).setInteractive({ useHandCursor: true }).setName('star-' + n.id));
      z.on('pointerover', () => { this.hover = n.id; this.render(); });
      z.on('pointerout', () => { if (this.hover === n.id) { this.hover = null; this.render(); } });
      z.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.hover = n.id; this.click(n.id); });
    }
    const sx = x + w - side - 6, sw = side - 8;
    this.head = text(sx, y + 26, '', 13, '#f3d48a').setWordWrapWidth(sw, true).setLineSpacing(3).setName('star-dev-head');
    this.info = text(sx, y + 150, '', 13, '#e9dcbc').setWordWrapWidth(sw, true).setLineSpacing(4).setName('star-dev-info');
    this.note = text(sx, y + h - 96, '', 12, '#9fd0a0').setWordWrapWidth(sw, true).setName('star-dev-note');
    const btn = (bx: number, by: number, name: string, act: () => void) => {
      const t = text(bx, by, '', 14, '#ffe9bd').setOrigin(0, .5).setPadding(10, 6).setBackgroundColor('#3a2a18').setName(name).setInteractive({ useHandCursor: true });
      t.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); act(); });
      return t;
    };
    if (o.respec) this.respecBtn = btn(sx, y + h - 58, 'star-dev-respec', () => { if (!this.o.state().lit.length) return; this.message = o.respec!.act(); this.render(); });
    if (o.close) this.closeBtn = btn(sx, y + h - 24, 'star-dev-close', () => o.close!.act());
    this.render();
  }

  destroy(): void { this.root.destroy(); }

  private click(id: string): void {
    const st = this.o.state(), node = STAR_NODES.find(n => n.id === id)!, block = lightBlock(st.lit, id, st.gate);
    if (block) this.message = block === '已点亮' ? '' : block;
    else if (st.free <= 0) this.message = '没有星可点了（每升 1 级 1 颗）';
    else this.message = this.o.onLight(id) ? `点亮「${node.name}」${node.todo ? '（效果未实现）' : ''}` : '点亮失败';
    this.render();
  }

  render(): void {
    if (!this.root.active) return;
    const st = this.o.state(), lit = litSet(st.lit, st.gate), g = this.g, pts = starPoints(st.lit, st.gate);
    g.clear();
    for (const [a, b] of STAR_EDGES) {
      const pa = this.pos.get(a)!, pb = this.pos.get(b)!, on = lit.has(a) && lit.has(b);
      g.lineStyle(on ? 2 : 1, on ? 0xf0d48a : 0x5a5142, on ? .95 : .7).lineBetween(pa.x, pa.y, pb.x, pb.y);
    }
    for (const n of STAR_NODES) {
      const p = this.pos.get(n.id)!, isLit = lit.has(n.id), can = !isLit && lightBlock(st.lit, n.id, st.gate) === null && st.free > 0;
      const color = n.region === 'bridge' ? 0xd8d2c0 : STAR_REGIONS[n.region].color, r = n.kind === 'keystone' ? 9 : n.kind === 'notable' ? 6.5 : n.kind === 'gate' ? 5.5 : 4;
      g.fillStyle(isLit ? color : 0x1a1612, 1).lineStyle(can ? 2 : 1.2, can ? 0xffffff : color, isLit || can ? 1 : .55);
      if (n.kind === 'keystone') { const d = [{ x: p.x, y: p.y - r }, { x: p.x + r, y: p.y }, { x: p.x, y: p.y + r }, { x: p.x - r, y: p.y }]; g.fillPoints(d, true).strokePoints(d, true); }
      else if (n.kind === 'gate') { g.fillRect(p.x - r, p.y - r, r * 2, r * 2).strokeRect(p.x - r, p.y - r, r * 2, r * 2); }
      else { g.fillCircle(p.x, p.y, r).strokeCircle(p.x, p.y, r); }
      if (n.id === st.gate) g.lineStyle(1.5, 0xfff0c0, 1).strokeCircle(p.x, p.y, r + 5); // 自己的入口
      if (n.todo) g.fillStyle(0x6f6a5f, 1).fillRect(p.x - 1.5, p.y - 1.5, 3, 3); // 效果未实现：中间一个灰点
      if (this.hover === n.id) g.lineStyle(1, 0xffffff, .9).strokeCircle(p.x, p.y, r + 8);
    }
    const perRegion = ATTRIBUTE_IDS.map(a => `${STAR_REGIONS[a].name}区 ${regionLit(st.lit, a, st.gate)}`).join(' · ');
    this.head.setText([
      `${st.heroName} Lv.${st.level}　入口：${STAR_REGIONS[STAR_NODES.find(n => n.id === st.gate)!.attr!].name}`,
      `可点 ${st.free} 颗 · 已点 ${st.lit.length} 颗`,
      `小星：力 ${pts.strength} / 敏 ${pts.agility} / 智 ${pts.intellect} / 统 ${pts.command}`,
      `已点亮 ${perRegion}`,
      `主星 ${keystonesLit(st.lit)} / ${STAR_RULES.keystoneMax}（本区满 ${STAR_RULES.keystoneNeed} 颗才能点）`,
    ].join('\n'));
    this.info.setY(this.head.y + this.head.height + 12);
    const n = this.hover ? STAR_NODES.find(k => k.id === this.hover) : null;
    if (n) {
      const isLit = lit.has(n.id), block = lightBlock(st.lit, n.id, st.gate);
      const where = n.region === 'bridge' ? `${STAR_REGIONS[n.between![0]].name}↔${STAR_REGIONS[n.between![1]].name}` : STAR_REGIONS[n.region].name;
      const status = n.id === st.gate ? '自己的入口：免费、自动点亮、不加属性' : isLit ? '已点亮' : block ?? (st.free > 0 ? '可点亮（点击）' : '没有星可点');
      this.info.setText(`【${KIND_NAME[n.kind]} · ${where}】${n.name}\n${n.id === st.gate ? '' : n.desc + '\n'}${n.todo ? '〔效果未实现：第一期只能点亮，没有效果〕\n' : ''}${status}`);
    } else this.info.setText('把鼠标移到星上看说明，点击点亮。\n方块 = 入口，小圆 = 小星（+1 属性），大圆 = 要星，菱形 = 主星；中间有灰点 / 名字带「未」= 效果未实现。');
    this.note.setText(this.message);
    this.respecBtn?.setText(this.o.respec!.label()).setAlpha(st.lit.length ? 1 : .45);
    this.closeBtn?.setText(this.o.close!.label());
  }
}
