/**
 * 首领台词侧边立绘卡（2026-11-18 夜，统筹定「方案 2：不暂停」；2026-11-19 用户选定「电影感」样式，见 ui/StoryBarkCardStyles.ts，下面的漆底卡只在手绘件载不到时用）：首领登场 / 二阶段 / 倒下等剧情 bark 说话时，
 * 屏幕边上滑进一张半透明黑漆描金小卡（2026-11-19 起半透明，文字带阴影）——外侧是说话人的对白水墨立绘（ink_cast / ink_hero，取头肩），内侧是名字 + 台词（标题字）。
 * - 敌方从右边滑入、我方（可玩武将 / 主公）从左边；停 HOLD 毫秒后滑出；几句挨得近就排队一张一张出。
 * - 放在侧边空带：右边在军令面板下、护阵按钮上，左边在增益图标下；不挡首领血条（底部中间）、军令、舆图、主将（屏幕中间）。
 * - 用真实时钟（performance.now）推进，不受战斗暂停影响；不暂停战斗、不吃点击。
 * - 没有立绘时画一枚朱文名字章代替（与剧情卷轴一致）。
 */
import Phaser from 'phaser';
import { DEPTH, HEADING_FONT, GAME_WIDTH } from '../config';
import { LQ, lqPanel, lqDiamond } from './LacquerKit';
import { storyArtFile } from '../data/story/art';
import { loadBarkUi, barkUiReady, buildCinematic } from './StoryBarkCardStyles';

export interface BarkCardLine { side: 'left' | 'right'; name: string; text: string; portrait?: string; /** 说话人 id（设计稿 A / B / C 取阵营色与称号用） */ id?: string }
/** 卡片尺寸与时长（毫秒）；top 是卡片顶边的 y（游戏坐标：电脑布局 960 宽，显示时放大到 1280×720；右边夹在军令面板（底 ≈271）与护阵按钮（顶 ≈405）之间，左边在增益图标（底 ≈290）下）。 */
export const BARK_CARD = { w: 330, h: 100, face: 86, hold: 2700, slide: 260, gap: 140, top: { right: 284, left: 300 }, margin: 10 } as const;
const STATE_KEY = '__storyBarkCards';
/** 出过的卡（名字 + 台词）记一笔，最多 50 条（测试读：scene.data.get('__storyBarkCardLog')）。 */
export const BARK_CARD_LOG = '__storyBarkCardLog';
interface CardState { queue: BarkCardLine[]; busy: boolean }

/** 排进队列；空闲时立刻出。返回这张卡的名字（测试用：story-bark-card）。 */
export function showBarkCard(scene: Phaser.Scene, line: BarkCardLine): void {
  const st = (scene.data.get(STATE_KEY) as CardState | undefined) ?? { queue: [], busy: false };
  scene.data.set(STATE_KEY, st);
  st.queue.push(line);
  const log = (scene.data.get(BARK_CARD_LOG) as string[] | undefined) ?? []; log.push(line.name + line.text); if (log.length > 50) log.shift(); scene.data.set(BARK_CARD_LOG, log);
  if (!st.busy) next(scene, st);
}
/** 收掉所有卡（剧情卷轴开播 / 关卡结束时可调）。 */
export function clearBarkCards(scene: Phaser.Scene): void {
  const st = scene.data.get(STATE_KEY) as CardState | undefined; if (st) { st.queue.length = 0; st.busy = false; }
  for (const o of scene.children.list.filter(o => o.name === 'story-bark-card')) o.destroy();
}

function next(scene: Phaser.Scene, st: CardState): void {
  const line = st.queue.shift();
  if (!line || scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) { st.busy = false; return; }
  st.busy = true;
  const after = (): void => { window.setTimeout(() => next(scene, st), BARK_CARD.gap); };
  // 2026-11-19 用户选定「电影感」样式（ui/StoryBarkCardStyles.ts）；手绘件载不到时退回原来的漆底卡
  loadBarkUi(scene, () => withPortrait(scene, line.portrait, () => (barkUiReady(scene) ? buildStyled(scene, line, after) : build(scene, line, after))));
}

/** 立绘没载就先载（data/story/art.ts 登记的才载；StoryDirector 开局已预载本关说话人）；2.5 秒没好就先不带立绘出卡，不拖台词。 */
function withPortrait(scene: Phaser.Scene, key: string | undefined, go: () => void): void {
  if (!key || scene.textures.exists(key) || !storyArtFile(key)) { go(); return; }
  let fired = false; const fin = (): void => { if (!fired) { fired = true; go(); } };
  scene.load.image(key, storyArtFile(key)!); scene.load.once(Phaser.Loader.Events.COMPLETE, fin); scene.load.start();
  window.setTimeout(fin, 2500);
}

function build(scene: Phaser.Scene, line: BarkCardLine, done: () => void): void {
  if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) { done(); return; }
  const C = BARK_CARD, right = line.side === 'right', x0 = right ? GAME_WIDTH - C.margin - C.w : C.margin, y0 = C.top[line.side];
  const off = right ? C.w + C.margin + 20 : -(C.w + C.margin + 20);
  const root = scene.add.container(x0 + off, y0).setScrollFactor(0).setDepth(DEPTH.overlay - 8).setName('story-bark-card');
  root.setData('side', line.side).setData('name', line.name).setData('text', line.text);
  const g = scene.add.graphics().setScrollFactor(0);
  // 半透明漆底（2026-11-19 用户：「对话框想半透明」）：外圈约 38%、里面约 57%，边缘渐淡；描金边与菱饰照旧不透明
  g.fillStyle(LQ.lacquer, .38).fillRoundedRect(0, 0, C.w, C.h, 10).fillStyle(LQ.lacquer, .3).fillRoundedRect(6, 6, C.w - 12, C.h - 12, 8);
  lqPanel(g, 0, 0, C.w, C.h, { shadow: false, alpha: 0, glow: false });
  // 立绘框：外侧（右卡在右、左卡在左）
  const fx = right ? C.w - C.face - 8 : 8, fy = (C.h - C.face) / 2;
  g.fillStyle(0x0d0906, .55).fillRect(fx, fy, C.face, C.face);
  root.add(g);
  const key = line.portrait && scene.textures.exists(line.portrait) ? line.portrait : undefined;
  if (key) {
    // 头肩：取宽 64%、上 2%–38% 的一块，等比缩进方框（立绘 600×900 时约 384×324）
    const src = scene.textures.get(key).getSourceImage() as { width: number; height: number };
    const cx = src.width * .18, cy = src.height * .02, cw = src.width * .64, ch = src.height * .36, k = Math.max(C.face / cw, C.face / ch);
    const vw = C.face / k, vh = C.face / k, sx = cx + (cw - vw) / 2, sy = cy;
    const face = scene.add.image(fx - sx * k, fy - sy * k, key).setOrigin(0, 0).setScale(k).setCrop(sx, sy, vw, vh).setScrollFactor(0).setName('story-bark-card-portrait');
    root.add(face); root.setData('portrait', key);
  } else {
    // 名字章（朱文方印）
    const seal = scene.add.graphics().setScrollFactor(0);
    seal.fillStyle(LQ.cinnabar, .92).fillRoundedRect(fx + 14, fy + 14, C.face - 28, C.face - 28, 6).lineStyle(2, 0xf3d48a, .7).strokeRoundedRect(fx + 18, fy + 18, C.face - 36, C.face - 36, 4);
    const t = scene.add.text(fx + C.face / 2, fy + C.face / 2, [...line.name].slice(0, 2).join('\n'), { fontFamily: HEADING_FONT, fontSize: '20px', color: '#fff1d0', align: 'center', resolution: 2 }).setOrigin(.5).setScrollFactor(0);
    root.add([seal, t]);
  }
  const frame = scene.add.graphics().setScrollFactor(0);
  frame.lineStyle(2, LQ.gold, .95).strokeRect(fx, fy, C.face, C.face).lineStyle(1, LQ.goldHi, .5).strokeRect(fx + 3, fy + 3, C.face - 6, C.face - 6);
  lqDiamond(frame, fx, fy, 4); lqDiamond(frame, fx + C.face, fy, 4); lqDiamond(frame, fx, fy + C.face, 4); lqDiamond(frame, fx + C.face, fy + C.face, 4);
  root.add(frame);
  // 名字 + 台词（标题字），在立绘内侧
  const tx = right ? 16 : C.face + 22, tw = C.w - C.face - 40;
  const name = scene.add.text(tx, 12, line.name, { fontFamily: HEADING_FONT, fontSize: '17px', color: LQ.title, resolution: 2 }).setShadow(0, 2, '#000000', 5, false, true).setScrollFactor(0).setName('story-bark-card-name');
  const say = scene.add.text(tx, 36, line.text, { fontFamily: HEADING_FONT, fontSize: '15px', color: LQ.cream, resolution: 2, lineSpacing: 2, wordWrap: { width: tw, useAdvancedWrap: true } }).setShadow(0, 2, '#000000', 5, false, true).setScrollFactor(0).setName('story-bark-card-text');
  if (say.height > C.h - 42) say.setFontSize(13);
  root.add([name, say]);
  animate(scene, root, x0, off, undefined, done);
}

/** 电影感台词卡（ui/StoryBarkCardStyles.ts） */
function buildStyled(scene: Phaser.Scene, line: BarkCardLine, done: () => void): void {
  if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) { done(); return; }
  const card = buildCinematic(scene, line, GAME_WIDTH, BARK_CARD.margin);
  const root = card.root.setDepth(DEPTH.overlay - 8).setName('story-bark-card');
  root.setData('side', line.side).setData('name', line.name).setData('text', line.text).setData('style', 'cinematic');
  if (line.portrait && scene.textures.exists(line.portrait)) root.setData('portrait', line.portrait);
  animate(scene, root, card.x0, card.off, card.onTick, done);
}

/** 滑入 → 停 → 滑出（真实时钟，不受战斗暂停影响）；onTick 做入场动画（墨迹晕开）。 */
function animate(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x0: number, off: number, onTick: ((t: number) => void) | undefined, done: () => void): void {
  const C = BARK_CARD, t0 = performance.now(), total = C.slide * 2 + C.hold;
  const ease = (k: number): number => 1 - Math.pow(1 - k, 3);
  root.setX(x0 + off).setAlpha(0);
  const tick = (): void => {
    if (!root.active) { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); done(); return; }
    const t = performance.now() - t0;
    const k = t < C.slide ? ease(t / C.slide) : t < C.slide + C.hold ? 1 : 1 - ease(Math.min(1, (t - C.slide - C.hold) / C.slide));
    root.setX(x0 + off * (1 - k)).setAlpha(Math.min(1, k * 1.4));
    onTick?.(t);
    if (t >= total) { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); root.destroy(); done(); }
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once('shutdown', () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick));
}
