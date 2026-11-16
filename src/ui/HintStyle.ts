import type Phaser from 'phaser';

/**
 * 技能 / 预警提示整体方案样品开关（2026-11-16 用户：「技能释放提示范围没有优化好，可以用其他特效代替，或者更好方案，设计一下」）。
 * 地址栏 ?mock=a / b / c 切换三套样品，给用户挑；不带参数时保持现状。只改画面，不改任何判定和数值。
 *  a「动作 + 命中特效」：去掉一切地面范围提示（我方阵纹、火阵、月环、敌方地裂），敌人出招只靠身上闪光，落下时只扬一点尘土。
 *  b「地面痕迹」：释放 / 落下瞬间在地上留一道像素刀痕、焦痕或裂纹，约 0.3 秒淡掉；不再有持续的圈和阵纹。
 *  c「只保留关键的」：我方和敌方普通招式全部不提示，只有首领大招落点留一条细虚线外沿（不填色）。
 */
export type HintMock = '' | 'a' | 'b' | 'c';
export const HINT_MOCK: HintMock = (() => {
  try { const v = new URLSearchParams(globalThis.location?.search ?? '').get('mock'); return v === 'a' || v === 'b' || v === 'c' ? v : ''; } catch { return ''; }
})();

/** 我方技能的「范围样」特效（八卦火阵、月环、镇军盘、火门、护阵石环、断桥区）是否还画。 */
export const SHOW_OWN_RANGE_FX = HINT_MOCK === '';

const OUTLINE = 0x1a1310, SCORCH = 0x3a2116, EMBER = 0xf2c27a, GASH = 0x2b2230, DUSTC = 0xd9c39c;
const jit = (seed: number, i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
const px = (v: number): number => Math.round(v); // 像素对齐，配合新画风的硬边

/**
 * 方案 b：地上一闪而过的痕迹。kind：blade 刀痕（几道平行斜划）、fire 焦痕（焦黑斑 + 暖色余烬点）、crack 裂纹（放射折线）。
 * 只用 1~2 像素线与小方块，0.3 秒淡掉后销毁；深色 #1a1310 描边 + 暖高光 #f2c27a，与营火写实像素风一致。
 */
export function groundScar(scene: Phaser.Scene, x: number, y: number, r: number, kind: 'blade' | 'fire' | 'crack', angle = 0, life = 320): void {
  const g = scene.add.graphics().setDepth(18.9).setName('hint-scar'), seed = Math.round(x * .37 + y * .61 + r);
  if (kind === 'blade') {
    const c = Math.cos(angle), s = Math.sin(angle), n = 3;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 9, len = r * (.75 + .25 * jit(seed, i)), cx = x - s * off, cy = y + c * off * .82;
      const ax = px(cx - c * len / 2), ay = px(cy - s * len / 2 * .82), bx = px(cx + c * len / 2), by = px(cy + s * len / 2 * .82);
      g.lineStyle(3, OUTLINE, .55).lineBetween(ax, ay, bx, by);
      g.lineStyle(1, EMBER, .7).lineBetween(ax, ay - 1, bx, by - 1);
    }
  } else if (kind === 'fire') {
    for (let i = 0; i < 9; i++) { const a = jit(seed, i) * Math.PI * 2, d = r * .55 * jit(seed, i + 9), w = 6 + 10 * jit(seed, i + 18);
      g.fillStyle(SCORCH, .38).fillRect(px(x + Math.cos(a) * d - w / 2), px(y + Math.sin(a) * d * .5 - w / 4), px(w), px(w / 2)); }
    for (let i = 0; i < 14; i++) { const a = jit(seed, i + 30) * Math.PI * 2, d = r * (.3 + .6 * jit(seed, i + 40));
      g.fillStyle(i % 3 ? EMBER : 0xff8a3c, .8).fillRect(px(x + Math.cos(a) * d), px(y + Math.sin(a) * d * .5), 2, 2); }
  } else {
    for (let i = 0; i < 6; i++) {
      const t = (i + jit(seed, i) * .6) / 6 * Math.PI * 2; let lx = x, ly = y;
      for (let k = 1; k <= 3; k++) { const rr = r * k / 3 * (.6 + .3 * jit(seed, i + 7)), tt = t + (jit(seed, i * 5 + k) - .5) * .4, nx = px(x + Math.cos(tt) * rr), ny = px(y + Math.sin(tt) * rr * .55);
        g.lineStyle(2, GASH, .6).lineBetween(lx, ly, nx, ny); g.lineStyle(1, EMBER, .45).lineBetween(lx, ly + 1, nx, ny + 1); lx = nx; ly = ny; }
    }
  }
  scene.tweens.add({ targets: g, alpha: 0, delay: life * .35, duration: life * .65, onComplete: () => g.destroy() });
}

/** 方案 a：落下时贴地一小团尘土（几颗像素尘点向外散开），不画线。 */
export function impactDust(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  const seed = Math.round(x * .37 + y * .61 + r);
  for (let i = 0; i < 10; i++) { const a = jit(seed, i) * Math.PI * 2, d = r * (.25 + .5 * jit(seed, i + 9)), s = i % 3 ? 2 : 3;
    g.fillStyle(DUSTC, .5).fillRect(px(x + Math.cos(a) * d), px(y + Math.sin(a) * d * .5), s, s); }
}

/** 方案 c：首领大招落点的一条细虚线外沿（1.5 像素、暖白、无填色），随蓄力略加深。 */
export function keyOutline(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, progress = 0, now = 0): void {
  const seg = 20, p = Math.max(0, Math.min(1, progress)), spin = now / 1600;
  g.lineStyle(1.5, 0xf6e6c4, .35 + p * .35);
  for (let i = 0; i < seg; i += 1) { const a0 = spin + i * Math.PI * 2 / seg, a1 = a0 + Math.PI * 2 / seg * .55; g.beginPath(); g.arc(x, y, r, a0, a1); g.strokePath(); }
}
