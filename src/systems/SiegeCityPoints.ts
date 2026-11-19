import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { worldText } from '../world/WorldUI';
import { FACTIONS } from '../world/WorldCities';
import type { CityPointKind } from '../data/siegeCity';

/**
 * 攻城城内段 · 要点占领圈（第二步，用户 11-18「占领的圈那里需要优化一下」）。全部手绘图，不画程序图形：
 *  - 地面：一圈旧青石板环（capture.png 0 号格，压扁成透视椭圆），像街上的一处石台；
 *  - 进度：水墨笔圈（1 号格）——底圈淡米白；进度按义军绿顺时针「描」出来（笔圈图 + 扇形遮罩，遮罩本身不显示）；
 *    守军反扑时笔圈换金色、按守住的秒数描；敌兵在圈内 / 小队长在时笔圈转朱红、圈下一行写原因；
 *  - 名牌：「粮仓 · 占领 45%」「粮仓 · 顶住反扑 12 秒」「粮仓 · 已占」；
 *  - 占下：要点旁升起我方占领旗（city.png 6 号格，旗面染义军绿，旗杆石座不染）；失守时旗倒下；
 *  - 远了（离主将 > FAR）：圈淡下去、名牌收起，建筑上方只留一枚漆金徽章（2 号格）+ 字（粮 / 武 / 兵 / 楼 / 市），街上不乱；
 *  - 在屏外且没占：屏幕边缘一支朱漆令箭（3 号格）指过去，箭尾跟一枚小徽章。
 * 图：siege-v2/capture.png（即梦 Seedream 5.5 出图，2×2 每格 256）：0 石板环 1 水墨笔圈 2 漆金徽章 3 令箭箭镞（朝右）。
 */
export const CAPTURE_ART = { key: 'siege_capture', file: 'assets/siege-v2/capture.png', cell: 256 } as const;
const OUR = FACTIONS.player.color, HELD = 0xe8c060, FOE = 0xd8503a, IDLE = 0xf2e6c8;
const GLYPH: Record<CityPointKind, string> = { granary: '粮', armory: '武', barracks: '兵', tower: '楼', market: '市' };
/** 石板环在格内的中心（图里不在正中）与环外径（像素）。 */
const STONE = { cx: 137, cy: 145, r: 117 }, INK_R = 118;
/** 远近：离主将超过 FAR 就收起名牌，只留徽章。 */
const FAR = 620;
/** 屏外令箭的放置框（离屏幕四边的距离）：避开左上状态栏、顶部计时 / 横幅、右侧小地图 / 军令面板 / 按钮列。 */
const ARROW_BOX = { left: 64, right: 300, top: 150, bottom: 80 } as const, HUD_LEFT = { w: 300, h: 250 } as const;
/** 占领旗：city.png 6 号格，旗面在格内的矩形（染色只染这一块）。 */
const FLAG = { frame: 6, cloth: { x: 176, y: 22, w: 64, h: 240 } } as const;

export interface PointViewState { state: 'open' | 'held' | 'secured'; prog: number; foes: number; leader: boolean; label: string; reason: string }
interface PointDef { x: number; y: number; radius: number; name: string; kind: CityPointKind; b: { x: number; y: number; size: number } }

export class CapturePointView {
  private ground?: Phaser.GameObjects.Image; private base?: Phaser.GameObjects.Image; private fill?: Phaser.GameObjects.Image;
  private maskG: Phaser.GameObjects.Graphics; private label: Phaser.GameObjects.Text; private reason: Phaser.GameObjects.Text;
  private badge?: Phaser.GameObjects.Image; private glyph: Phaser.GameObjects.Text;
  private arrow?: Phaser.GameObjects.Image; private arrowBadge?: Phaser.GameObjects.Image; private arrowGlyph: Phaser.GameObjects.Text;
  private flag: Phaser.GameObjects.Image[] = [];
  private lastProg = -1;
  /** 测试读：当前显示状态。 */
  readonly view = { far: false, arrow: false, tint: IDLE, flag: false, reason: '' };

  constructor(private readonly scene: Phaser.Scene, private readonly objs: Phaser.GameObjects.GameObject[], private readonly p: PointDef, private readonly cityKey: string) {
    const s = scene, has = s.textures.exists(CAPTURE_ART.key), r = p.radius, ky = .65, K = CAPTURE_ART.key, keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };
    if (has) {
      const sz = r * 2 * 1.12 * (128 / STONE.r);
      this.ground = keep(s.add.image(p.x, p.y, K, 0).setOrigin(STONE.cx / 256, STONE.cy / 256).setDisplaySize(sz, sz * ky).setDepth(DEPTH.ground + 3).setAlpha(.9));
      const iz = r * 2 * .9 * (128 / INK_R);
      this.base = keep(s.add.image(p.x, p.y, K, 1).setDisplaySize(iz, iz * ky).setDepth(DEPTH.ground + 3.1).setTint(IDLE).setAlpha(.32));
      this.fill = keep(s.add.image(p.x, p.y, K, 1).setDisplaySize(iz, iz * ky).setDepth(DEPTH.ground + 3.2).setTint(OUR).setAlpha(.95));
      this.badge = keep(s.add.image(p.b.x, p.b.y - p.b.size * .86, K, 2).setDisplaySize(46, 46).setDepth(actorDepth(p.b.y) + .05).setVisible(false));
      this.arrow = keep(s.add.image(0, 0, K, 3).setDisplaySize(60, 60).setScrollFactor(0).setDepth(DEPTH.hud - 7).setVisible(false));
      this.arrowBadge = keep(s.add.image(0, 0, K, 2).setDisplaySize(34, 34).setScrollFactor(0).setDepth(DEPTH.hud - 7).setVisible(false));
    }
    // 进度遮罩：扇形，按透视压扁；本身不进显示列表
    this.maskG = s.make.graphics({ x: p.x, y: p.y }, false).setScale(1, ky); objs.push(this.maskG);
    this.fill?.setMask(this.maskG.createGeometryMask());
    this.label = keep(worldText(s, p.x, p.y - r * ky - 24, '', 15, '#ffe1a0').setOrigin(.5).setDepth(36).setStroke('#1a120b', 4));
    this.reason = keep(worldText(s, p.x, p.y + r * ky + 16, '', 13, '#ffb39a').setOrigin(.5).setDepth(36).setStroke('#1a0a06', 4));
    this.glyph = keep(worldText(s, p.b.x, p.b.y - p.b.size * .86, GLYPH[p.kind], 20, '#ffe6a8').setOrigin(.5).setDepth(actorDepth(p.b.y) + .06).setStroke('#3a0d06', 3).setVisible(false));
    this.arrowGlyph = keep(worldText(s, 0, 0, GLYPH[p.kind], 15, '#ffe6a8').setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud - 6).setStroke('#3a0d06', 3).setVisible(false));
  }

  update(st: PointViewState, player: { x: number; y: number }, now: number, showArrow: boolean) {
    const p = this.p, s = this.scene, far = Math.hypot(player.x - p.x, player.y - p.y) > FAR, contested = st.state !== 'secured' && (st.foes > 0 || st.leader);
    const col = st.state === 'secured' ? OUR : contested ? FOE : st.state === 'held' ? HELD : OUR, pulse = contested ? .7 + .3 * Math.sin(now / 140) : 1;
    // 进度笔圈
    const prog = st.state === 'secured' ? 1 : Math.max(0, Math.min(1, st.prog));
    if (Math.abs(prog - this.lastProg) > .002) {
      this.lastProg = prog; const g = this.maskG.clear();
      if (prog > 0) { g.fillStyle(0xffffff, 1); g.slice(0, 0, p.radius * 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog, false); g.fillPath(); }
    }
    this.fill?.setTint(col).setAlpha((far ? .5 : .95) * pulse).setVisible(prog > 0);
    this.base?.setTint(contested ? FOE : IDLE).setAlpha(far ? .16 : contested ? .5 * pulse : .32);
    this.ground?.setAlpha(far ? .45 : .9).setTint(contested ? 0xffc8b8 : 0xffffff);
    // 名牌 / 原因（近处才显示）
    this.label.setText(st.label).setVisible(!far).setColor(st.state === 'secured' ? '#bff0cc' : contested ? '#ffc0a8' : '#ffe1a0');
    this.reason.setText(st.reason).setVisible(!far && !!st.reason);
    // 远处：建筑上方的漆金徽章（没占的才显示）
    const showBadge = far && st.state !== 'secured';
    this.badge?.setVisible(showBadge); this.glyph.setVisible(showBadge && !!this.badge);
    // 屏外令箭
    const v = s.cameras.main.worldView, m = 40, off = p.x < v.x - m || p.x > v.right + m || p.y < v.y - m || p.y > v.bottom + m, arrow = !!this.arrow && showArrow && off && st.state !== 'secured';
    this.arrow?.setVisible(arrow); this.arrowBadge?.setVisible(arrow); this.arrowGlyph.setVisible(arrow);
    if (arrow && this.arrow && this.arrowBadge) {
      // 箭头沿一个避开 HUD 的矩形放（上方是状态栏 / 计时 / 横幅，右边是按钮列）
      const a = Math.atan2(p.y - player.y, p.x - player.x), c = Math.cos(a), sn = Math.sin(a), E = ARROW_BOX, cx = (E.left + GAME_WIDTH - E.right) / 2, cy = (E.top + GAME_HEIGHT - E.bottom) / 2, ex = (GAME_WIDTH - E.left - E.right) / 2, ey = (GAME_HEIGHT - E.top - E.bottom) / 2;
      const t = Math.min(ex / Math.max(1e-3, Math.abs(c)), ey / Math.max(1e-3, Math.abs(sn))), x = cx + c * t, y = Math.max(cy + sn * t, cx + c * t < HUD_LEFT.w ? HUD_LEFT.h : 0), k = 1 + .06 * Math.sin(now / 200);
      this.arrow.setPosition(x, y).setRotation(a).setDisplaySize(60 * k, 60 * k); // 格是正方形、箭镞在格中间一条，按正方形缩
      this.arrowBadge.setPosition(x - c * 38, y - sn * 38); this.arrowGlyph.setPosition(x - c * 38, y - sn * 38);
    }
    Object.assign(this.view, { far, arrow, tint: col, reason: st.reason });
  }

  /** 当前显示中的屏外令箭（位置 + 平移），给 spreadArrows 用。 */
  arrowParts() {
    if (!this.arrow?.visible || !this.arrowBadge) return null; const ar = this.arrow, bd = this.arrowBadge, gl = this.arrowGlyph;
    return { x: ar.x, y: ar.y, move: (x: number, y: number) => { const dx = x - ar.x, dy = y - ar.y; ar.setPosition(x, y); bd.setPosition(bd.x + dx, bd.y + dy); gl.setPosition(gl.x + dx, gl.y + dy); } };
  }
  /** 占下：要点旁升起我方占领旗（旗面染义军绿）。 */
  raiseFlag() {
    this.lowerFlag(true); const s = this.scene, p = this.p, x = p.x + p.radius * .78, y = p.y - 6, h = 150, w = h;
    if (!s.textures.exists(this.cityKey)) return;
    const pole = s.add.image(x, y, this.cityKey, FLAG.frame).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(actorDepth(y));
    const cloth = s.add.image(x, y, this.cityKey, FLAG.frame).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(actorDepth(y) + .01).setTint(OUR);
    cloth.setCrop(FLAG.cloth.x, FLAG.cloth.y, FLAG.cloth.w, FLAG.cloth.h);
    this.flag = [pole, cloth]; this.objs.push(pole, cloth); this.view.flag = true;
    for (const f of this.flag) { const sy = f.scaleY; f.setScale(f.scaleX, 0); s.tweens.add({ targets: f, scaleY: sy, duration: 520, ease: 'Back.Out' }); }
  }
  /** 失守：旗倒下。 */
  lowerFlag(instant = false) {
    const fs = this.flag; this.flag = []; this.view.flag = false;
    for (const f of fs) { if (instant || !f.active) { f.destroy(); continue; } this.scene.tweens.add({ targets: f, angle: 80, alpha: 0, duration: 420, ease: 'Quad.In', onComplete: () => f.destroy() }); }
  }
  /** 城内段结束（进府衙）：收起屏外令箭与徽章。 */
  hideMarkers() { this.arrow?.setVisible(false); this.arrowBadge?.setVisible(false); this.arrowGlyph.setVisible(false); this.badge?.setVisible(false); this.glyph.setVisible(false); }
}

/** 屏外令箭互相压住时（两处要点在差不多的方向），沿屏幕边错开。每帧在各要点 update 之后调一次。 */
export function spreadArrows(views: CapturePointView[]) {
  const live = views.map(v => v.arrowParts()).filter((a): a is NonNullable<typeof a> => !!a);
  for (let i = 0; i < live.length; i++) for (let j = 0; j < i; j++) {
    const a = live[i], b = live[j]; if (Math.hypot(a.x - b.x, a.y - b.y) >= 52) continue;
    const vertical = a.x < GAME_WIDTH * .25 || a.x > GAME_WIDTH * .75, dx = vertical ? 0 : 56, dy = vertical ? 56 : 0;
    a.move(a.x + dx, a.y + dy); a.x += dx; a.y += dy;
  }
}
