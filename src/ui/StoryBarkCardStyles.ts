/**
 * 首领台词侧边卡的三套设计稿（2026-11-19 用户：「我觉得台词卡还可以优化设计一下」；统筹要 3 套给用户挑，先不定稿）：
 * - A 电影感：立绘头肩破出卡顶，名字大号标题字 + 下方称号（「西凉骁将」），阵营朱印；台词压在撕边水墨笔刷带上；入场墨迹晕开。
 * - B 手卷：一卷横向手卷从外侧展开，立绘在月洞窗（敌）/ 扇窗（我）里，旧宣纸半透明，墨色文字。
 * - C 极简：一条黑漆细条，外端圆徽框里是圆形立绘，名字 + 称号，台词逐字打出；占地最小。
 * 手绘件在 public/assets/ui/barkcard/（ChatGPT 透明底出图，tools/build-barkcard-ui.mjs 切），阵营印用 assets/camp/seal.webp（空白朱印）+ 标题字。
 * 敌方按阵营上色（黄巾黄、董卓赤、袁紫、曹青、荆州青绿、吴橙赤、益州铜、南蛮苔绿），我方义军绿金。
 * 选哪套：localStorage im_barkcard_style = A / B / C（开发期试看用；不设时用原来的漆底卡）。
 */
import Phaser from 'phaser';
import { HEADING_FONT } from '../config';
import { SURRENDER_DEFS } from '../data/surrender';

export type BarkStyle = 'classic' | 'A' | 'B' | 'C';
export function barkStyle(): BarkStyle { try { const v = localStorage.getItem('im_barkcard_style'); return v === 'A' || v === 'B' || v === 'C' ? v : 'classic'; } catch { return 'classic'; } }

/** 手绘件贴图键 → 文件 */
export const BARK_UI: Record<string, string> = {
  barkui_brush: 'assets/ui/barkcard/brush.png', barkui_scroll: 'assets/ui/barkcard/scroll.png', barkui_bar: 'assets/ui/barkcard/bar.png',
  barkui_moon: 'assets/ui/barkcard/moon.png', barkui_fan: 'assets/ui/barkcard/fan.png', barkui_medal: 'assets/ui/barkcard/medal.png', barkui_seal: 'assets/camp/seal.webp',
};
export function loadBarkUi(scene: Phaser.Scene, done: () => void): void {
  const need = Object.entries(BARK_UI).filter(([k]) => !scene.textures.exists(k));
  const ink = !scene.textures.exists('barkui_inkbloom');
  if (!need.length && !ink) { done(); return; }
  for (const [k, f] of need) scene.load.image(k, f);
  if (ink) scene.load.spritesheet('barkui_inkbloom', 'assets/ui/barkcard/inkbloom.png', { frameWidth: 256, frameHeight: 256 });
  // 不能只等一次 COMPLETE：场景加载器可能正忙别的（立绘），那次 COMPLETE 来时手绘件还没到。轮询到全齐（最多 4 秒）
  scene.load.start();
  const t0 = performance.now(), keys = [...Object.keys(BARK_UI), 'barkui_inkbloom'];
  const poll = (): void => { if (keys.every(k => scene.textures.exists(k)) || performance.now() - t0 > 4000) { done(); return; } if (!scene.load.isLoading()) scene.load.start(); window.setTimeout(poll, 50); };
  poll();
}

// ———— 阵营与称号 ————
interface Faction { seal: string; color: number; light: string; dark: string }
const F = (seal: string, color: number, light: string, dark: string): Faction => ({ seal, color, light, dark });
const FACTIONS: Record<string, Faction> = {
  huangjin: F('黄', 0xc9a227, '#f4d878', '#3a2a06'), dong: F('董', 0x9a2420, '#f3a08a', '#2e0a08'), yuan: F('袁', 0x6a4a9a, '#cdb4f0', '#1e1230'),
  wei: F('曹', 0x2f5a8a, '#a9c8ec', '#0c1a2a'), jing: F('荆', 0x2f7a72, '#9ee0d6', '#0a2422'), wu: F('吴', 0xb2501e, '#f6b07c', '#2e1206'),
  yi: F('益', 0x8a6a2a, '#e8cc8a', '#241a08'), man: F('蛮', 0x5a7a2a, '#c4e08a', '#18200a'), qun: F('群', 0x7a3a2a, '#e8a890', '#22100a'),
  ally: F('义', 0x2f6b4a, '#f3d48a', '#0a1e14'),
};
const MEMBERS: Record<string, string[]> = {
  huangjin: ['zhangjiao', 'zhangbao', 'zhangliang'], dong: ['dongzhuo', 'lubu', 'huaxiong', 'xurong', 'lijue', 'zhangxiu'],
  yuan: ['yuanshao', 'yuanshu', 'yanliang', 'wenchou', 'chunyuqiong', 'jiling'],
  wei: ['caocao', 'caochun', 'caoren', 'xuchu', 'zhangliao', 'dianwei', 'xiahouyuan', 'zhanghe', 'simayi', 'haozhao', 'pangde', 'chengyu', 'xunyou', 'jiaxu'],
  jing: ['caimao', 'liudu', 'zhaofan', 'hanxuan', 'liuxian', 'xingdaorong', 'yangling'], wu: ['sunquan', 'zhouyu', 'huanggai', 'lusu', 'lvmeng', 'luxun', 'sunhuan', 'zhuran'],
  yi: ['liuzhang', 'zhangren', 'yanghuai'], man: ['menghuo', 'wutugu', 'mangyachang'],
};
export function factionOf(id: string | undefined, ally: boolean): Faction {
  if (ally) return FACTIONS.ally;
  for (const [k, ids] of Object.entries(MEMBERS)) if (id && ids.includes(id)) return FACTIONS[k];
  return FACTIONS.qun;
}
const EXTRA_TITLES: Record<string, string> = { zhangliang: '人公将军', zhangbao: '地公将军', zhangjiao: '天公将军', lubu: '飞将', yangling: '长沙管军校尉', xingdaorong: '零陵上将', liuxian: '零陵少将军' };
export function titleOf(id: string | undefined): string { if (!id) return ''; return EXTRA_TITLES[id] ?? SURRENDER_DEFS.find(d => d.id === id)?.title ?? ''; }

// ———— 立绘裁成圆 / 扇形（画进一张小画布，缓存成贴图；不用遮罩）————
function faceTexture(scene: Phaser.Scene, key: string, shape: 'circle' | 'fan' | 'none', size: number): string | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const tk = `barkface_${key}_${shape}_${size}`; if (scene.textures.exists(tk)) return tk;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const W = shape === 'fan' ? Math.round(size * 1.45) : size, H = size, can = scene.textures.createCanvas(tk, W, H); if (!can) return undefined;
  const g = can.getContext();
  // 头肩：宽 64%、上 1%–37%
  const cx = src.width * .18, cy = src.height * .01, cw = src.width * .64, ch = src.height * .36;
  g.save();
  if (shape === 'circle') { g.beginPath(); g.arc(W / 2, H / 2, size / 2, 0, Math.PI * 2); g.clip(); }
  if (shape === 'fan') { const ox = W / 2, oy = H * 1.05, r1 = H * 1.02, r0 = H * .28, a0 = -Math.PI / 2 - .62, a1 = -Math.PI / 2 + .62; g.beginPath(); g.arc(ox, oy, r1, a0, a1); g.arc(ox, oy, r0, a1, a0, true); g.closePath(); g.clip(); }
  const k = Math.max(W / cw, H / ch), dw = cw * k, dh = ch * k;
  g.drawImage(src, cx, cy, cw, ch, (W - dw) / 2, 0, dw, dh);
  g.restore(); can.refresh(); return tk;
}

export interface StyledCard { root: Phaser.GameObjects.Container; w: number; h: number; x0: number; y0: number; off: number; onTick?: (t: number) => void }
interface In { side: 'left' | 'right'; name: string; text: string; portrait?: string; id?: string }
const txt = (s: Phaser.Scene, x: number, y: number, v: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text =>
  s.add.text(x, y, v, { fontFamily: HEADING_FONT, fontSize: size + 'px', color, resolution: 2, ...extra }).setScrollFactor(0);

/** 阵营朱印：空白朱印手绘图 + 一个标题字 */
function factionSeal(s: Phaser.Scene, x: number, y: number, size: number, f: Faction): Phaser.GameObjects.GameObject[] {
  const img = s.add.image(x, y, 'barkui_seal').setDisplaySize(size, size).setScrollFactor(0).setTint(f.color === 0x2f6b4a ? 0xffffff : 0xffffff);
  const t = txt(s, x, y + 1, f.seal, Math.round(size * .55), '#8a1a10').setOrigin(.5);
  return [img, t];
}

/** A 电影感 */
export function buildA(s: Phaser.Scene, l: In, W: number, margin: number): StyledCard {
  const right = l.side === 'right', w = 350, h = 112, x0 = right ? W - margin - w : margin, y0 = 292, ally = !right, f = factionOf(l.id, ally);
  const root = s.add.container(x0, y0).setScrollFactor(0);
  // 墨迹晕开（入场时在笔刷带后面放一遍，手绘 8 帧）
  const bloom = s.textures.exists('barkui_inkbloom') ? s.add.sprite(w / 2, 70, 'barkui_inkbloom', 0).setDisplaySize(300, 150).setScrollFactor(0).setAlpha(.7).setName('story-bark-card-ink') : null;
  if (bloom) root.add(bloom);
  const brush = s.add.image(w / 2, 72, 'barkui_brush').setDisplaySize(w, 60).setScrollFactor(0).setAlpha(.86).setFlipX(!right);
  // 立绘：头肩破出卡顶（不加框），下半身没进笔刷带里
  const fk = l.portrait ? faceTexture(s, l.portrait, 'none', 116) : undefined;
  const fx = right ? w - 64 : 64;
  const face = fk ? s.add.image(fx, -8, fk).setOrigin(.5, 0).setScrollFactor(0).setName('story-bark-card-portrait') : null;
  if (face) root.add(face);
  root.add(brush);
  const tx = right ? 14 : 132, tw = w - 150;
  const name = txt(s, tx, 4, l.name, 28, f.light, { stroke: f.dark, strokeThickness: 6 }).setName('story-bark-card-name');
  const title = titleOf(l.id), tt = txt(s, tx + 2, 38, title ? title : (ally ? '义军' : ''), 13, '#eadcbd', { stroke: '#120a04', strokeThickness: 4 });
  const seal = factionSeal(s, tx + name.width + 22, 22, 30, f);
  const say = txt(s, tx, 60, l.text, 15, '#fff1d0', { wordWrap: { width: tw, useAdvancedWrap: true }, lineSpacing: 1 }).setShadow(0, 2, '#000000', 4, false, true).setName('story-bark-card-text');
  if (say.height > 44) say.setFontSize(13);
  root.add([name, tt, ...seal, say]); // 叠放顺序：墨迹 → 立绘 → 笔刷带（盖住立绘胸口以下）→ 字
  return { root, w, h, x0, y0, off: right ? 40 : -40, onTick: t => { if (bloom?.active) { const k = Math.min(1, t / 380); bloom.setFrame(Math.min(7, Math.floor(k * 8))).setAlpha(.7 * (t < 380 ? 1 : Math.max(0, 1 - (t - 380) / 300))); } } };
}

/** B 手卷 */
export function buildB(s: Phaser.Scene, l: In, W: number, margin: number): StyledCard {
  const right = l.side === 'right', w = 350, h = 104, x0 = right ? W - margin - w : margin, y0 = 286, ally = !right, f = factionOf(l.id, ally);
  const root = s.add.container(x0, y0).setScrollFactor(0);
  const sw = w - 36, sh = sw / 3.7, sx = right ? 0 : 36;
  const scroll = s.add.image(sx, (h - sh) / 2 + 4, 'barkui_scroll').setOrigin(0, 0).setDisplaySize(sw, sh).setScrollFactor(0).setAlpha(.84);
  const src = s.textures.get('barkui_scroll').getSourceImage() as { width: number; height: number };
  root.add(scroll);
  // 窗：敌方月洞窗、我方扇窗；立绘裁成同形状放窗后
  const shape = ally ? 'fan' : 'circle', win = ally ? 'barkui_fan' : 'barkui_moon', ws = 98, wx = right ? w - ws / 2 - 4 : ws / 2 + 4, wy = h / 2 + 2;
  const fk = l.portrait ? faceTexture(s, l.portrait, shape, shape === 'fan' ? 74 : 80) : undefined;
  if (fk) root.add(s.add.image(wx, wy + (ally ? 6 : 0), fk).setScrollFactor(0).setName('story-bark-card-portrait'));
  root.add(s.add.image(wx, wy, win).setDisplaySize(ally ? ws * 1.4 : ws, ally ? ws * .96 : ws).setScrollFactor(0));
  const tx = right ? 40 : 150, tw = w - 196;
  const name = txt(s, tx, 24, l.name, 21, '#2a160a').setName('story-bark-card-name');
  const title = titleOf(l.id) || (ally ? '义军' : '');
  const tt = txt(s, tx + name.width + 8, 31, title, 12, '#6a4a2a');
  const seal = factionSeal(s, right ? sx + sw - 46 : sx + sw - 30, 30, 22, f);
  const say = txt(s, tx, 52, l.text, 14, '#24140a', { wordWrap: { width: tw, useAdvancedWrap: true }, lineSpacing: 1 }).setName('story-bark-card-text');
  if (say.height > 40) say.setFontSize(12);
  root.add([name, tt, ...seal, say]);
  // 展开：从外侧（窗那头）往里卷开——手卷图按宽度裁出来
  const crop = (k: number): void => { const cw = src.width * k; scroll.setCrop(right ? src.width - cw : 0, 0, cw, src.height); };
  crop(.08);
  const texts = [name, tt, say, ...seal];
  return { root, w, h, x0, y0, off: right ? 24 : -24, onTick: t => { const k = Math.min(1, t / 420); crop(.08 + .92 * (1 - Math.pow(1 - k, 3))); for (const o of texts) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(Math.max(0, (t - 300) / 200)); } };
}

/** C 极简 */
export function buildC(s: Phaser.Scene, l: In, W: number, margin: number): StyledCard {
  const right = l.side === 'right', w = 330, h = 64, x0 = right ? W - margin - w : margin, y0 = 318, ally = !right, f = factionOf(l.id, ally);
  const root = s.add.container(x0, y0).setScrollFactor(0);
  const bw = w - 26, bh = bw / 9.8, bx = right ? 0 : 26, by = (h - bh) / 2 + 6;
  root.add(s.add.image(bx, by, 'barkui_bar').setOrigin(0, 0).setDisplaySize(bw, bh).setScrollFactor(0).setAlpha(.8));
  const ms = 64, mx = right ? w - ms / 2 : ms / 2, my = by + bh / 2;
  const fk = l.portrait ? faceTexture(s, l.portrait, 'circle', 46) : undefined;
  if (fk) root.add(s.add.image(mx, my, fk).setScrollFactor(0).setName('story-bark-card-portrait'));
  root.add(s.add.image(mx, my, 'barkui_medal').setDisplaySize(ms, ms).setScrollFactor(0).setTint(f.color === FACTIONS.ally.color ? 0xffffff : 0xffffff));
  const tx = right ? 22 : 66;
  const name = txt(s, tx, by - 22, l.name, 16, f.light, { stroke: '#0c0804', strokeThickness: 4 }).setName('story-bark-card-name');
  const title = titleOf(l.id) || (ally ? '义军' : '');
  const tag = txt(s, tx + name.width + 6, by - 17, title ? '· ' + title : '', 11, '#eadcbd', { stroke: '#0c0804', strokeThickness: 3 });
  const pip = s.add.image(tx - 9, by - 13, 'barkui_seal').setDisplaySize(12, 12).setScrollFactor(0); // 阵营小印
  const pipT = txt(s, tx - 9, by - 12, f.seal, 8, '#8a1a10').setOrigin(.5);
  const say = txt(s, tx, by + 3, '', 12, '#fff1d0', { wordWrap: { width: bw - 70, useAdvancedWrap: true }, lineSpacing: -2 }).setShadow(0, 1, '#000000', 3, false, true).setName('story-bark-card-text');
  root.add([pip, pipT, name, tag, say]);
  const full = l.text;
  return { root, w, h, x0, y0, off: right ? 30 : -30, onTick: t => { const n = Math.min(full.length, Math.max(0, Math.floor((t - 200) / 45))); if (say.text.length !== n) say.setText(full.slice(0, n)); } };
}
