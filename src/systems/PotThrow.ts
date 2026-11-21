import Phaser from 'phaser';
import { DEPTH } from '../config';
import { sceneSfx } from './ContentSfx';
import { playSheet } from './SkillFxSheets';

/**
 * 火油罐投掷过程（2026-11-20 用户「火油罐没看到扔出的动画」）：玩家的火油罐战法、敌方火攻兵的火罐共用——
 *  出手（手边一小团火 + 抛掷声）→ 飞行（手绘陶罐沿抛物线、旋转、拖火星；地上一个随高度变小变淡的影子；约 0.4–0.7 秒，按距离定）→ 落地（陶罐碎裂序列帧 + 爆燃声，然后接现有的落地火 / 地火）。
 * 视觉层：不改任何伤害逻辑；同屏飞行中的罐子上限 POT.maxLive，超出的只在落点播碎裂（飞行省掉）。飞行时间走调用方给的战斗时钟，暂停时不飞。
 * 美术：fx_firepot（processed-v2/fx，美术会话从攻击图里裁出的手绘陶罐）、prop_break_fx 第 3 行（陶石碎裂）、fx_ground_fire（手绘地火，出手小火团 / 火星用 spark 小点）。
 */
export const POT = { minMs: 400, maxMs: 700, baseMs: 380, perPx: .8, apexFrac: .34, apexMin: 46, apexMax: 150, size: 40, hand: 28, turns: 2.2, maxLive: 8, trailGap: 42, sparkMax: 28, sparkLife: 340, breakRow: 2, breakFrames: 6, breakMs: 380, breakSize: 104, breakMax: 6 } as const;
/** 飞行时间：按距离 0.4–0.7 秒。 */
export const potFlightMs = (dist: number): number => Math.round(Math.max(POT.minMs, Math.min(POT.maxMs, POT.baseMs + dist * POT.perPx)));

export interface PotThrowOpts {
  x0: number; y0: number; x1: number; y1: number; now: () => number;
  /** 不给就按距离算；给了就用（调用方要和逻辑落地时刻对齐）。 */ ms?: number;
  /** 落地那一刻（陶罐碎裂 + 声音播完后）回调：接落地火。 */ onLand?: () => void;
  /** 出手声 / 落地声（默认都放；敌方预警期已有自己的声音时可关）。 */ sfxRelease?: boolean; sfxLand?: boolean;
}
interface Flight { o: PotThrowOpts; t0: number; ms: number; pot?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; lastTrail: number; apex: number }
interface Spark { img: Phaser.GameObjects.Image; born: number; vx: number; vy: number }
interface Brk { img: Phaser.GameObjects.Image; born: number }
interface St { flights: Flight[]; sparks: Spark[]; breaks: Brk[]; tick: (t: number, d: number) => void; live: number }
const states = new WeakMap<Phaser.Scene, St>();
export const potStats = { thrown: 0, landed: 0, visual: 0, culled: 0 };

function stateOf(scene: Phaser.Scene): St {
  let S = states.get(scene); if (S) return S;
  const st: St = { flights: [], sparks: [], breaks: [], live: 0, tick: () => undefined }; states.set(scene, st);
  st.tick = () => update(scene, st); scene.events.on('update', st.tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { scene.events.off('update', st.tick); for (const f of st.flights) { f.pot?.destroy(); f.shadow?.destroy(); } for (const s of st.sparks) s.img.destroy(); for (const b of st.breaks) b.img.destroy(); states.delete(scene); });
  return st;
}

/** 抛一个火油罐；返回飞行毫秒（逻辑落地要对齐时用）。 */
export function throwPot(scene: Phaser.Scene, o: PotThrowOpts): number {
  const S = stateOf(scene), dist = Math.hypot(o.x1 - o.x0, o.y1 - o.y0), ms = o.ms ?? potFlightMs(dist), t0 = o.now(); potStats.thrown++;
  const f: Flight = { o, t0, ms, lastTrail: t0, apex: Math.max(POT.apexMin, Math.min(POT.apexMax, dist * POT.apexFrac)) };
  // 出手：手边一小团火 + 抛掷声
  playSheet(scene, 'fx_ground_fire', o.x0, o.y0 - POT.hand, { size: 46, ms: 260, depth: DEPTH.fx, add: true, alpha: .8 }); if (o.sfxRelease !== false) sceneSfx(scene, 'mn_lob');
  if (S.live < POT.maxLive && scene.textures.exists('fx_firepot')) {
    S.live++; potStats.visual++;
    f.pot = scene.add.image(o.x0, o.y0 - POT.hand, 'fx_firepot').setDisplaySize(POT.size, POT.size).setDepth(DEPTH.projectile);
    f.shadow = scene.textures.exists('shadow') ? scene.add.image(o.x0, o.y0 + 4, 'shadow').setDisplaySize(30, 12).setAlpha(.34).setDepth(DEPTH.ground + 3) : undefined;
  } else potStats.culled++;
  S.flights.push(f); return ms;
}

function update(scene: Phaser.Scene, S: St): void {
  const wall = scene.time.now;
  for (let i = S.flights.length - 1; i >= 0; i--) {
    const f = S.flights[i], o = f.o, now = o.now(), k = Math.max(0, (now - f.t0) / f.ms);
    if (k >= 1) { land(scene, S, f); S.flights.splice(i, 1); continue; }
    if (!f.pot) continue;
    const gx = o.x0 + (o.x1 - o.x0) * k, gy = o.y0 + (o.y1 - o.y0) * k, h = Math.sin(k * Math.PI) * f.apex, hand = (1 - k) * POT.hand, py = gy - hand - h;
    f.pot.setPosition(gx, py).setRotation(k * POT.turns * Math.PI * 2);
    if (f.shadow) { const q = 1 - Math.min(1, h / (POT.apexMax * 1.4)) * .55; f.shadow.setPosition(gx, gy + 4).setDisplaySize(30 * q, 12 * q).setAlpha(.34 * q); }
    if (now - f.lastTrail >= POT.trailGap) { f.lastTrail = now; spark(scene, S, gx, py, wall); }
  }
  for (let i = S.sparks.length - 1; i >= 0; i--) {
    const s = S.sparks[i], a = (wall - s.born) / POT.sparkLife; if (a >= 1) { s.img.destroy(); S.sparks.splice(i, 1); continue; }
    s.img.setPosition(s.img.x + s.vx * .016, s.img.y + s.vy * .016).setAlpha(.9 * (1 - a)).setScale(1.2 * (1 - a * .7) + .2);
  }
  for (let i = S.breaks.length - 1; i >= 0; i--) {
    const b = S.breaks[i], a = (wall - b.born) / POT.breakMs; if (a >= 1) { b.img.destroy(); S.breaks.splice(i, 1); continue; }
    b.img.setFrame(POT.breakRow * POT.breakFrames + Math.min(POT.breakFrames - 1, Math.floor(a * POT.breakFrames))).setAlpha(a < .7 ? 1 : (1 - a) / .3);
  }
}
function spark(scene: Phaser.Scene, S: St, x: number, y: number, wall: number): void {
  if (!scene.textures.exists('spark')) return;
  let s: Spark; if (S.sparks.length >= POT.sparkMax) { s = S.sparks.shift()!; s.img.destroy(); }
  const img = scene.add.image(x, y, 'spark').setTint([0xffe08a, 0xff9a3c, 0xe04a1c][Math.floor(Math.random() * 3)]).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
  s = { img, born: wall, vx: (Math.random() - .5) * 40, vy: 20 + Math.random() * 40 }; S.sparks.push(s);
}
function land(scene: Phaser.Scene, S: St, f: Flight): void {
  const o = f.o; potStats.landed++;
  if (f.pot) { f.pot.destroy(); f.shadow?.destroy(); S.live = Math.max(0, S.live - 1); }
  // 落地：陶罐碎裂（prop_break_fx 陶石行）+ 爆燃声，随后接调用方的落地火
  if (scene.textures.exists('prop_break_fx') && S.breaks.length < POT.breakMax) S.breaks.push({ img: scene.add.image(o.x1, o.y1 - 8, 'prop_break_fx', POT.breakRow * POT.breakFrames).setDisplaySize(POT.breakSize, POT.breakSize).setDepth(DEPTH.fx), born: scene.time.now });
  if (o.sfxLand !== false) sceneSfx(scene, 'mn_firepot');
  o.onLand?.();
}
