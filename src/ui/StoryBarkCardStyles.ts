/**
 * 首领台词侧边卡「电影感」样式（2026-11-19 用户从三套设计稿里选了 A）：
 * - 立绘头肩破出卡顶（不加框），在外侧单独一栏，头肩胸口完整露出，只有最下沿渐隐（用户：「台词不要遮住立绘」）；
 * - 名字用大号标题字（阵营浅色 + 深色描边），下面一行称号（「西凉骁将」，取 data/surrender.ts，张角三兄弟等补在 EXTRA_TITLES）；
 * - 名字旁一枚阵营朱印（空白朱印手绘图 assets/camp/seal.webp + 标题字：黄 / 董 / 袁 / 曹 / 荆 / 吴 / 益 / 蛮 / 群，我方「义」）；
 * - 名字 / 称号 / 台词在内侧一栏，台词压在只铺这一栏的撕边水墨笔刷带上（半透明墨带 + 文字阴影），长句在栏里换行、带子跟着加高；
 *   笔刷带后面压一层同形状、按阵营上色的淡影（敌方阵营色，我方义军绿）；
 * - 入场时笔刷带后面晕开一团手绘墨迹（8 帧）。
 * 手绘件：public/assets/ui/barkcard/brush.png（ChatGPT 透明底出图）、inkbloom.png（UI 会话的墨迹扩散转透明底；2026-11-20 起卡片不再用），tools/build-barkcard-ui.mjs 生成。
 */
import Phaser from 'phaser';
import { HEADING_FONT } from '../config';
import { SURRENDER_DEFS } from '../data/surrender';

/** 手绘件贴图键 → 文件 */
export const BARK_UI: Record<string, string> = { barkui_brush: 'assets/ui/barkcard/brush.png', barkui_seal: 'assets/camp/seal.webp' };
/** 载入手绘件（不能只等一次 COMPLETE：场景加载器可能正忙别的立绘，那次 COMPLETE 来时手绘件还没到；轮询到全齐，最多 4 秒）。 */
export function loadBarkUi(scene: Phaser.Scene, done: () => void): void {
  const need = Object.entries(BARK_UI).filter(([k]) => !scene.textures.exists(k));
  if (!need.length) { done(); return; }
  for (const [k, f] of need) scene.load.image(k, f);
  scene.load.start();
  const t0 = performance.now(), keys = Object.keys(BARK_UI);
  const poll = (): void => { if (keys.every(k => scene.textures.exists(k)) || performance.now() - t0 > 4000) { done(); return; } if (!scene.load.isLoading()) scene.load.start(); window.setTimeout(poll, 50); };
  poll();
}
/** 手绘件都在（载不到时 StoryBarkCard 退回原来的漆底卡） */
export const barkUiReady = (scene: Phaser.Scene): boolean => Object.keys(BARK_UI).every(k => scene.textures.exists(k));

// ———— 阵营与称号 ————
interface Faction { seal: string; color: number; light: string; dark: string }
const F = (seal: string, color: number, light: string, dark: string): Faction => ({ seal, color, light, dark });
const FACTIONS: Record<string, Faction> = {
  huangjin: F('黄', 0xc9a227, '#f4d878', '#3a2a06'), dong: F('董', 0x9a2420, '#f3a08a', '#2e0a08'), yuan: F('袁', 0x6a4a9a, '#cdb4f0', '#1e1230'),
  wei: F('曹', 0x2f5a8a, '#a9c8ec', '#0c1a2a'), jing: F('荆', 0x2f7a72, '#9ee0d6', '#0a2422'), wu: F('吴', 0xb2501e, '#f6b07c', '#2e1206'),
  yi: F('益', 0x8a6a2a, '#e8cc8a', '#241a08'), man: F('蛮', 0x5a7a2a, '#c4e08a', '#18200a'), qun: F('群', 0x7a3a2a, '#e8a890', '#22100a'),
  ally: F('义', 0x2f8a56, '#f3d48a', '#0a1e14'),
};
const MEMBERS: Record<string, string[]> = {
  huangjin: ['zhangjiao', 'zhangbao', 'zhangliang'], dong: ['dongzhuo', 'lubu', 'huaxiong', 'xurong', 'lijue', 'guosi', 'zhangxiu'],
  yuan: ['yuanshao', 'yuanshu', 'yanliang', 'wenchou', 'chunyuqiong', 'jiling'],
  wei: ['caocao', 'caochun', 'caoren', 'xuchu', 'zhangliao', 'dianwei', 'xiahouyuan', 'zhanghe', 'simayi', 'haozhao', 'pangde', 'chengyu', 'xunyou', 'jiaxu'],
  jing: ['caimao', 'liudu', 'zhaofan', 'hanxuan', 'liuxian', 'xingdaorong', 'yangling'], wu: ['sunquan', 'zhouyu', 'huanggai', 'lusu', 'lvmeng', 'luxun', 'sunhuan', 'zhuran'],
  yi: ['liuzhang', 'zhangren', 'yanghuai'], man: ['menghuo', 'zhurong', 'wutugu', 'mangyachang'],
};
export function factionOf(id: string | undefined, ally: boolean): Faction {
  if (ally) return FACTIONS.ally;
  for (const [k, ids] of Object.entries(MEMBERS)) if (id && ids.includes(id)) return FACTIONS[k];
  return FACTIONS.qun;
}
const EXTRA_TITLES: Record<string, string> = { zhangliang: '人公将军', zhangbao: '地公将军', zhangjiao: '天公将军', lubu: '飞将', yangling: '长沙管军校尉', xingdaorong: '零陵上将', liuxian: '零陵少将军', guosi: '西凉悍将', zhurong: '火神之后' };
export function titleOf(id: string | undefined): string { if (!id) return ''; return EXTRA_TITLES[id] ?? SURRENDER_DEFS.find(d => d.id === id)?.title ?? ''; }

/** 头肩胸：从立绘取宽 64%、上 1%–40% 一块，画进小画布缓存成贴图（不用遮罩）；最下 22% 渐隐，像墨色化开 */
export function faceTexture(scene: Phaser.Scene, key: string, size: number): string | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const tk = `barkface_${key}_${size}`; if (scene.textures.exists(tk)) return tk;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement, can = scene.textures.createCanvas(tk, size, size); if (!can) return undefined;
  const g = can.getContext(), cx = src.width * .18, cy = src.height * .01, cw = src.width * .64, ch = src.height * .39, k = Math.max(size / cw, size / ch), dw = cw * k, dh = ch * k;
  g.drawImage(src, cx, cy, cw, ch, (size - dw) / 2, 0, dw, dh);
  // destination-in 会清掉填充区以外的像素：渐变要铺满整张（上 78% 全不透明、最下 22% 渐隐）
  const fade = g.createLinearGradient(0, 0, 0, size); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.78, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = fade; g.fillRect(0, 0, size, size);
  // 2026-11-20：左右两侧也渐隐（立绘画面常常裁到两边，硬边很显眼）
  const side = g.createLinearGradient(0, 0, size, 0); side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(.14, 'rgba(0,0,0,1)'); side.addColorStop(.86, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over';
  can.refresh(); return tk;
}

/** 中文全角标点：中文后面的半角 ! ? , : ; 换成全角（2026-11-20 剧情对话卡打磨）。 */
export function cnPunct(v: string): string { return v.replace(/([一-鿿」』）])([!?,:;])/g, (_m, c: string, p: string) => c + ({ '!': '！', '?': '？', ',': '，', ':': '：', ';': '；' } as Record<string, string>)[p]); }
/** 台词逐字打出的速度（字 / 秒）与读完后再停的时长（毫秒）。 */
export const BARK_TYPE = { cps: 26, readMs: 1700 } as const;

export interface StyledCard { root: Phaser.GameObjects.Container; w: number; h: number; x0: number; y0: number; off: number; onTick?: (t: number) => void; /** 逐字打完需要的毫秒（卡片据此延长停留） */ typeMs: number }
interface In { side: 'left' | 'right'; name: string; text: string; portrait?: string; id?: string }
const txt = (s: Phaser.Scene, x: number, y: number, v: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text =>
  s.add.text(x, y, v, { fontFamily: HEADING_FONT, fontSize: size + 'px', color, resolution: 2, ...extra }).setScrollFactor(0);
/** 名字配色（2026-11-20）：我方金色、敌方朱红；阵营朱印照旧按势力。 */
const NAME_COLOR = { ally: { light: '#f3d48a', dark: '#2a1a06' }, enemy: { light: '#ff8f6e', dark: '#2a0806' } } as const;

/**
 * 电影感台词卡（游戏坐标，电脑布局 960 宽）：外侧立绘一栏、内侧文字一栏，台词不压立绘。
 * place 给了（电脑布局，2026-11-19 用户「剧情对话挪到左下角」）：不分敌我都放左下——左边 x = place.x、底边 = place.bottom，立绘在左栏、台词在右栏、从左滑入，宽收到 340；
 * 没给（手机）：敌方右、我方左（旧摆法）。阵营色 / 朱印 / 称号始终按说话人（side 是说话人的阵营）。
 * 2026-11-20 打磨（用户「剧情对话ui也可以改一下」）：立绘下垫漆金圆托（头肩仍破出圆托上沿）、名字我方金 / 敌方朱红、台词逐字打出（点卡片直接出全文）、
 * 后面还有句时右下角「下一句 ▸」；intro = 首领出场大卡（立绘、名字、称号都放大）。
 */
export function buildCinematic(s: Phaser.Scene, l: In, W: number, margin: number, place?: { x: number; bottom: number }, o: { intro?: boolean; more?: () => boolean } = {}): StyledCard {
  const ally = l.side === 'left', right = !place && !ally, f = factionOf(l.id, ally), nc = ally ? NAME_COLOR.ally : NAME_COLOR.enemy, big = !!o.intro;
  const w = big ? 440 : place ? 340 : 372, PW = big ? 164 : 124, gap = 10, colW = w - PW - gap, x0 = place ? place.x : right ? W - margin - w : margin;
  const cx0 = right ? 0 : PW + gap; // 文字栏左边
  const root = s.add.container(x0, 0).setScrollFactor(0);
  // 名字（大号标题字）+ 阵营朱印 + 称号
  const tx = cx0 + 12, tw = colW - 30, nameSize = big ? 40 : 28;
  const name = txt(s, tx, big ? -10 : 0, l.name, nameSize, nc.light, { stroke: nc.dark, strokeThickness: big ? 8 : 6 }).setName('story-bark-card-name');
  const sealSize = big ? 38 : 30, seal = s.add.image(tx + name.width + sealSize * .7, (big ? -10 : 0) + nameSize * .62, 'barkui_seal').setDisplaySize(sealSize, sealSize).setScrollFactor(0).setName('story-bark-card-seal');
  const sealT = txt(s, seal.x, seal.y + 1, f.seal, big ? 20 : 16, '#8a1a10').setOrigin(.5);
  const tt = txt(s, tx + 2, big ? 38 : 34, titleOf(l.id) || (ally ? '义军' : ''), big ? 16 : 13, '#eadcbd', { stroke: '#120a04', strokeThickness: 4 }).setName('story-bark-card-title');
  // 台词：在文字栏里换行；笔刷带只铺文字栏，高度跟着台词。先用全文量高度，再清空逐字打出
  const full = cnPunct(l.text), fs0 = big ? 17 : 15;
  const say = txt(s, tx + 4, 0, full, fs0, '#fff1d0', { wordWrap: { width: tw, useAdvancedWrap: true }, lineSpacing: 3 }).setShadow(0, 2, '#000000', 4, false, true).setName('story-bark-card-text');
  if (say.height > (big ? 80 : 66)) say.setFontSize(fs0 - 2);
  const sy = big ? 62 : 56, sh = Math.max(big ? 60 : 52, say.height + 24), h = sy + sh, y0 = place ? place.bottom - h : 290;
  root.setY(y0);
  say.setY(sy + (sh - say.height) / 2).setFixedSize(0, say.height).setData('full', full).setText('');
  // 2026-11-20 去掉入场墨迹晕开（用户「每次剧情对话会先浮现出一个黑框框然后快速消失」）：inkbloom.png 转图时丢了透明通道、八帧都是实心暗色方块，
  // 笔刷带后面先闪一块黑框再淡掉；图已重做成透明底，但末几帧仍铺满整块（≈94%），照样像一块暗框——卡片改成从全透明直接淡入。
  root.add(s.add.image(cx0 + colW / 2 + (right ? -4 : 4), sy + sh / 2 + 5, 'barkui_brush').setDisplaySize(colW + 6, sh + 6).setScrollFactor(0).setTintFill(f.color).setAlpha(.5).setFlipX(!right).setName('story-bark-card-faction'));
  root.add(s.add.image(cx0 + colW / 2, sy + sh / 2, 'barkui_brush').setDisplaySize(colW, sh).setScrollFactor(0).setAlpha(.86).setFlipX(!right));
  // 立绘：外侧一栏；下垫一枚漆金圆托（暗底 + 金圈），头肩破出圆托上沿
  const fsz = big ? 160 : 118, fk = l.portrait ? faceTexture(s, l.portrait, fsz) : undefined, fx = right ? w - PW / 2 - 6 : PW / 2 + 6, ry = big ? fsz * .62 : fsz * .6, rr = big ? 64 : 48;
  const ring = s.add.graphics().setScrollFactor(0).setName('story-bark-card-ring');
  ring.fillStyle(0x120b06, .62).fillCircle(fx, ry, rr).lineStyle(big ? 3 : 2.5, 0xc9a35e, .95).strokeCircle(fx, ry, rr).lineStyle(1, 0xf3d48a, .55).strokeCircle(fx, ry, rr - 4);
  root.add(ring);
  if (fk) root.add(s.add.image(fx, big ? -16 : -6, fk).setOrigin(.5, 0).setScrollFactor(0).setName('story-bark-card-portrait'));
  root.add([name, tt, seal, sealT, say]);
  // 后面还有句：右下角「下一句 ▸」（闪一闪）
  const nextHint = o.more ? txt(s, cx0 + colW - 10, h - 4, '下一句 ▸', 12, '#f3d48a', { stroke: '#120a04', strokeThickness: 3 }).setOrigin(1, 1).setName('story-bark-card-next') : null;
  if (nextHint) root.add(nextHint);
  // 点卡片（文字栏）直接出全文
  let shownAll = false;
  const hit = s.add.rectangle(cx0 + colW / 2, h / 2, colW, h, 0, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName('story-bark-card-hit');
  hit.on('pointerdown', () => { shownAll = true; say.setText(full); });
  root.add(hit);
  const typeMs = [...full].length / BARK_TYPE.cps * 1000;
  return { root, w, h, x0, y0, off: right ? 40 : -40, typeMs, onTick: t => {
    if (!shownAll && say.active) { const n = Math.min([...full].length, Math.floor(Math.max(0, t - 180) / 1000 * BARK_TYPE.cps)); const cur = [...full].slice(0, n).join(''); if (say.text !== cur) say.setText(cur); if (n >= [...full].length) shownAll = true; }
    if (nextHint?.active) nextHint.setVisible(!!o.more?.()).setAlpha(.55 + .45 * Math.abs(Math.sin(t / 380)));
  } };
}
