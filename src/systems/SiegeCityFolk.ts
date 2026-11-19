import Phaser from 'phaser';
import { IS_DESKTOP, actorDepth } from '../config';
import { worldText } from '../world/WorldUI';
import { FOLK_SHEETS } from '../town/TownLife';
import { CITY_FX, type CityLayout, type CityBuildingKind } from '../data/siegeCity';

/**
 * 攻城城内段 · 百姓（第三步，纯装饰，只在电脑版；用户 11-18「手机版展示停止适应」）。
 * 用营寨 / 城池场景已有的手绘居民行走图（town-city/folk，4×4：行 = 下 / 左 / 右 / 上）。不挡路、不能被打、不算敌我，只是图。
 *  - 入城：主将附近街上的百姓四散跑回民居（到门口淡出）；
 *  - 占下一处要点：附近民居里陆续出来几个人，站到要点圈外看着；
 *  - 市集归附：围过来的人多一些，到位后一齐作揖（身子一低一起），头上飘「百姓归附」。
 */
const SHEETS = FOLK_SHEETS.filter(s => s.civilian);
const DIRS = ['down', 'left', 'right', 'up'] as const;
type Dir = typeof DIRS[number];
const DOOR_KINDS: ReadonlySet<CityBuildingKind> = new Set(['house', 'house2', 'shop', 'granary', 'barracks', 'market', 'armory']);
const HEIGHT = 66, WALK = 92, RUN = 150;

export class SiegeCityFolk {
  private ready = false; private queue: Array<() => void> = []; private seq = 0;
  private readonly doors: Array<{ x: number; y: number }>;
  /** 测试读：出过多少人、作揖几次。 */
  readonly stats = { fled: 0, came: 0, bowed: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly objs: Phaser.GameObjects.GameObject[], city: CityLayout) {
    this.doors = [...city.buildings.filter(b => DOOR_KINDS.has(b.kind)).map(b => ({ x: b.x, y: b.y + 4 })), ...city.points.filter(p => p.kind !== 'tower').map(p => ({ x: p.b.x, y: p.b.y + 4 }))];
    if (!IS_DESKTOP) return;
    const need = SHEETS.filter(s => !scene.textures.exists(s.key));
    const done = () => { if (scene.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return; for (const s of SHEETS) this.frames(s.key); this.ready = true; for (const f of this.queue.splice(0)) f(); };
    if (!need.length) { done(); return; }
    for (const s of need) scene.load.image(s.key, s.url);
    scene.load.once('complete', done); if (!scene.load.isLoading()) scene.load.start();
  }
  /** 行走图切帧（同 TownFolk）。 */
  private frames(key: string) {
    if (!this.scene.textures.exists(key)) return; const t = this.scene.textures.get(key); if (t.has('down_0')) return;
    const cell = (t.getSourceImage() as { width: number }).width / 4;
    DIRS.forEach((d, row) => { for (let c = 0; c < 4; c++) t.add(`${d}_${c}`, 0, c * cell, row * cell, cell, cell); });
  }
  private later(f: () => void) { if (!IS_DESKTOP) return; if (this.ready) f(); else this.queue.push(f); }
  private person(x: number, y: number): Phaser.GameObjects.Image | null {
    const keys = SHEETS.filter(s => this.scene.textures.exists(s.key)); if (!keys.length) return null;
    const k = keys[this.seq++ % keys.length].key, im = this.scene.add.image(x, y, k, 'down_0').setOrigin(.5, .92);
    im.setScale(HEIGHT / im.frame.height).setDepth(actorDepth(y)).setName('siege-folk'); this.objs.push(im); return im;
  }
  /** 走过去（按方向换帧、深度跟着脚底），到了回调。 */
  private walk(im: Phaser.GameObjects.Image, x: number, y: number, speed: number, then?: () => void) {
    const dx = x - im.x, dy = y - im.y, d = Math.hypot(dx, dy), dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), t0 = this.scene.time.now;
    this.scene.tweens.add({ targets: im, x, y, duration: Math.max(200, d / speed * 1000), ease: 'Linear',
      onUpdate: () => { if (!im.active) return; im.setFrame(`${dir}_${Math.floor((this.scene.time.now - t0) / (speed > 100 ? 90 : 150)) % 4}`).setDepth(actorDepth(im.y)); },
      onComplete: () => { if (im.active) { im.setFrame(`${dir}_0`); then?.(); } } });
  }
  private nearestDoors(x: number, y: number, n: number) { return [...this.doors].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, n); }

  /** 入城：主将附近的百姓四散跑回民居。 */
  flee(player: { x: number; y: number }) {
    this.later(() => {
      const doors = this.nearestDoors(player.x, player.y - 200, 6);
      for (let i = 0; i < CITY_FX.folk.flee && doors.length; i++) {
        const d = doors[i % doors.length], im = this.person(d.x + (Math.random() - .5) * 120, d.y + 110 + Math.random() * 90); if (!im) return;
        this.stats.fled++;
        this.scene.time.delayedCall(Math.random() * 500, () => this.walk(im, d.x + (Math.random() - .5) * 30, d.y, RUN, () => this.scene.tweens.add({ targets: im, alpha: 0, duration: 260, onComplete: () => im.destroy() })));
      }
    });
  }
  /** 占下要点：附近民居里出来几个人，站到圈外；市集人多，到位后一齐作揖。 */
  secured(pt: { name: string; x: number; y: number; radius: number }, market: boolean) {
    this.later(() => {
      const n = market ? CITY_FX.folk.market : CITY_FX.folk.secured, doors = this.nearestDoors(pt.x, pt.y, 3); if (!doors.length) return;
      let arrived = 0;
      for (let i = 0; i < n; i++) {
        const d = doors[i % doors.length], a = Math.PI * (.12 + .76 * (n > 1 ? i / (n - 1) : .5)), tx = pt.x + Math.cos(a) * pt.radius * 1.32, ty = pt.y + Math.sin(a) * pt.radius * .65 * 1.45; // 圈外一圈（透视椭圆外）
        this.scene.time.delayedCall(250 + i * 280, () => {
          const im = this.person(d.x + (Math.random() - .5) * 24, d.y); if (!im) return;
          this.stats.came++; im.setAlpha(0); this.scene.tweens.add({ targets: im, alpha: 1, duration: 220 });
          this.walk(im, tx, ty, WALK, () => {
            // 面朝要点站着
            const fx = pt.x - im.x, fy = pt.y - im.y; im.setFrame(`${Math.abs(fx) > Math.abs(fy) ? (fx > 0 ? 'right' : 'left') : (fy > 0 ? 'down' : 'up')}_0`);
            if (market && ++arrived === n) this.bow(pt);
          });
        });
      }
    });
  }
  /** 市集：围过来的人一齐作揖，头上飘「百姓归附」。 */
  private bow(pt: { x: number; y: number; radius: number }) {
    this.stats.bowed++;
    const folk = this.objs.filter((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image && o.active && o.name === 'siege-folk' && Math.hypot(o.x - pt.x, o.y - pt.y) < pt.radius * 1.6);
    for (const im of folk) { const sy = im.scaleY; this.scene.tweens.add({ targets: im, scaleY: sy * .86, duration: 220, yoyo: true, repeat: 1, ease: 'Sine.InOut' }); }
    const t = worldText(this.scene, pt.x, pt.y - pt.radius - 40, '百姓归附', 18, '#ffe6a8').setOrigin(.5).setDepth(36).setStroke('#3a1a08', 4).setAlpha(0); this.objs.push(t);
    this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 30, duration: 700, ease: 'Sine.Out', hold: 1200, yoyo: true, onComplete: () => t.destroy() });
  }
}
