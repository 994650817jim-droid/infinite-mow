import Phaser from 'phaser';
import type { CharacterId } from '../data/characters';
import { DEPTH } from '../config';

/**
 * 主将步态（纯代码过渡层，不是新手绘帧）：现有行走图每方向只有 4 帧、头顶高度恒定、步幅很小，
 * 以前固定 9 帧/秒播放、没有起伏，移动时像整张图在地上平移。这里在不改素材的前提下补：
 * - 步频按实际移速换算（每循环“步长”按体型设定，帧率限制在 MIN_FPS–MAX_FPS）；
 * - 身体随步伐上下起伏（每循环两步）、落脚时轻微压扁、横向移动时微微前倾；
 * - 阴影随身体抬起缩小变淡；落脚扬尘；
 * - 起步 / 停步的幅度过渡与停步“站稳”压缩；
 * - 按武将体型（重 / 中 / 轻）微调节奏与幅度。
 * 只影响表现，不改位置、速度、碰撞与攻击判定。
 */
export interface GaitStyle {
  /** 一个行走循环（4 帧、两步）对应的移动距离（世界像素）。越大步频越慢。 */
  stride: number;
  /** 起伏高度（世界像素）。 */
  bob: number;
  /** 落脚压扁比例。 */
  squash: number;
  /** 横向前倾（弧度）。 */
  lean: number;
  /** 扬尘浓度 0–1。 */
  dust: number;
}

const HEAVY: GaitStyle = { stride: 70, bob: 2.6, squash: .05, lean: .045, dust: 1 };
const NORMAL: GaitStyle = { stride: 62, bob: 2.3, squash: .04, lean: .055, dust: .85 };
const LIGHT: GaitStyle = { stride: 56, bob: 2.0, squash: .03, lean: .045, dust: .6 };
/** 按武将体型分组：披甲猛将步子沉、文官与女将步子轻快。 */
export const GAIT_STYLES: Record<CharacterId, GaitStyle> = {
  guanyu: HEAVY, zhangfei: HEAVY, weiyan: HEAVY, huangzhong: HEAVY, lvbu: HEAVY, zhangliao: NORMAL, zhouyu: LIGHT, taishici: NORMAL, mengde: NORMAL, ganning: LIGHT, dianwei: HEAVY, sunquan: NORMAL, menghuo: HEAVY,
  zhaoyun: NORMAL, machao: NORMAL, liubei: NORMAL,
  zhuge: LIGHT, pangtong: LIGHT, huangyueying: LIGHT, sunshangxiang: LIGHT, diaochan: { ...LIGHT, bob: 1.7, squash: .025, dust: .45 },
} as Record<CharacterId, GaitStyle>;

export const GAIT_MIN_FPS = 6;
export const GAIT_MAX_FPS = 15;
const START_MS = 110, STOP_MS = 150, SETTLE_MS = 170, DUST_MS = 380, DUST_POOL = 8;

export interface GaitPose {
  /** 身体抬起（世界像素，向上为正）。 */
  lift: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  shadowW: number;
  shadowH: number;
  shadowAlpha: number;
}

export class WalkGait {
  style: GaitStyle = NORMAL;
  /** 行走相位（帧单位，floor % 4 即行走帧序号）。 */
  phase = 0;
  /** 当前步频（帧/秒）。 */
  fps = 0;
  /** 行走幅度 0–1（起步渐入、停步渐出）。 */
  amount = 0;
  /** 停步“站稳”压缩 0–1。 */
  settle = 0;
  moving = false;
  steps = 0;
  private dust: { img: Phaser.GameObjects.Image; age: number; vx: number }[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  setHero(id: CharacterId): void { this.style = GAIT_STYLES[id] ?? NORMAL; }

  /**
   * 每帧推进。speed：本帧实际移速（世界像素 / 秒，0 为停下）。
   * 返回 true 表示刚从停止进入移动（调用方可直接切到迈步帧）。
   */
  advance(dt: number, speed: number): boolean {
    const moving = speed > 1, started = moving && !this.moving;
    if (moving) {
      this.fps = Phaser.Math.Clamp(speed / this.style.stride * 4, GAIT_MIN_FPS, GAIT_MAX_FPS);
      // 起步直接从迈步帧（1）开始，不在站立帧上滑出去
      if (started) this.phase = 1;
      const before = Math.floor(this.phase);
      this.phase += dt * this.fps;
      // 帧 0 / 2 视作落脚：越过时计一步
      for (let f = before + 1; f <= Math.floor(this.phase); f++) if (f % 2 === 0) this.steps++;
      this.amount = Math.min(1, this.amount + dt * 1000 / START_MS);
    } else {
      if (this.moving) { this.settle = this.amount; this.phase = 0; }
      this.fps = 0;
      this.amount = Math.max(0, this.amount - dt * 1000 / STOP_MS);
    }
    this.settle = Math.max(0, this.settle - dt * 1000 / SETTLE_MS);
    this.moving = moving;
    return started;
  }

  /** 步伐姿态。mounted：骑马时只保留少量起伏，不前倾。 */
  pose(dir: 'down' | 'up' | 'left' | 'right', mounted: boolean): GaitPose {
    const s = this.style, a = this.amount * (mounted ? .35 : 1);
    // 每循环两步：帧 1 / 3（跨步中段）身体最高，帧 0 / 2（落脚）最低
    const wave = Math.abs(Math.sin(this.phase * Math.PI / 2));
    const lift = s.bob * wave * a;
    const contact = Math.pow(1 - wave, 3) * a;
    const squash = s.squash * contact + .035 * this.settle;
    const lean = mounted ? 0 : dir === 'right' ? s.lean * a : dir === 'left' ? -s.lean * a : 0;
    const air = s.bob > 0 ? lift / s.bob : 0;
    return {
      lift,
      scaleX: 1 + squash * .55,
      scaleY: 1 - squash,
      rotation: lean,
      shadowW: 48 * (1 - .14 * air),
      shadowH: 20 * (1 - .1 * air),
      shadowAlpha: .8 * (1 - .22 * air),
    };
  }

  /** 落脚扬尘：在脚后方生成一团淡土色烟，0.38 秒散开。 */
  puff(x: number, y: number, dirX: number): void {
    if (this.style.dust <= 0) return;
    if (!this.scene.textures.exists('walk-dust')) {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
      const r = g.createRadialGradient(16, 16, 2, 16, 16, 15); r.addColorStop(0, 'rgba(214,190,146,.85)'); r.addColorStop(.6, 'rgba(190,164,120,.45)'); r.addColorStop(1, 'rgba(180,150,110,0)');
      g.fillStyle = r; g.beginPath(); g.arc(16, 16, 16, 0, Math.PI * 2); g.fill(); this.scene.textures.addCanvas('walk-dust', c);
    }
    let slot = this.dust.find(d => d.age >= DUST_MS);
    if (!slot && this.dust.length < DUST_POOL) { slot = { img: this.scene.add.image(0, 0, 'walk-dust').setDepth(DEPTH.enemy - .85), age: DUST_MS, vx: 0 }; this.dust.push(slot); }
    if (!slot) return;
    slot.age = 0; slot.vx = -dirX * 14 + (Math.random() - .5) * 10;
    slot.img.setPosition(x - dirX * 8 + (Math.random() - .5) * 6, y).setVisible(true).setData('a0', .5 * this.style.dust);
  }

  /** 扬尘逐帧淡出（战斗时钟驱动，暂停时一起停）。 */
  updateDust(dt: number): void {
    for (const d of this.dust) {
      if (d.age >= DUST_MS) { if (d.img.visible) d.img.setVisible(false); continue; }
      d.age += dt * 1000; const t = Math.min(1, d.age / DUST_MS);
      d.img.x += d.vx * dt; d.img.y -= 6 * dt;
      d.img.setDisplaySize(14 + 16 * t, 7 + 7 * t).setAlpha((d.img.getData('a0') as number) * (1 - t) * (1 - t));
    }
  }

  get activeDust(): number { return this.dust.filter(d => d.age < DUST_MS).length; }

  destroy(): void { for (const d of this.dust) d.img.destroy(); this.dust = []; }
}
