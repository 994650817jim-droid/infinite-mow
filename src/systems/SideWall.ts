import Phaser from 'phaser';
import { actorDepth } from '../config';

/**
 * 侧墙套件（2026-11-19，美术会话 ChatGPT 出图，原图 assets/siege-v2/originals/sidewall_kit_gpt_v1.png，tools/crop-terrain-kit.mjs 裁切）：
 * 南北走向的城墙 / 营栅，按「俯视偏 3/4」画——看到墙顶走道 + 两排城垛 + 一侧露出的砖墙立面，不再用瓮城图 4 号格斜着叠（会错成锯齿）。
 * 键名（loadSideWallArt 载入）：
 *   sw_segT 标准墙段（上下镜像拼成 2 倍，上下无缝）· sw_hut 带瓦顶箭楼段 · sw_breach 垮塌缺口段 · sw_gate 侧门段（以上三个盖在标准段上，已去掉墙脚）
 *   sw_capN 北端墩台收口 · sw_capS 南端墙脚收口（砖墙立面）· sw_cornerW / sw_cornerE 转角角楼（墙从北来、往西 / 东去）
 *   sw_palU 营栅一节木桩（高 65、可无缝竖排）· sw_palWatch 带瞭望台的栅段 · sw_palGate 营门柱（旗）
 * 图里立面在右侧；flip = true 翻成立面在左侧（左侧墙用）。
 */
export const SIDEWALL_FILES: ReadonlyArray<{ key: string; file: string }> = ['segT', 'hut', 'breach', 'gate', 'capN', 'capS', 'cornerW', 'cornerE', 'palU', 'palWatch', 'palGate']
  .map(n => ({ key: 'sw_' + n, file: `assets/siege-v2/sidewall/${n}.png` }));

export function sideWallReady(scene: Phaser.Scene): boolean { return SIDEWALL_FILES.every(f => scene.textures.exists(f.key)); }
/** 把侧墙图加进加载队列（调用方自己负责 start / 等 complete）。 */
export function loadSideWallArt(scene: Phaser.Scene): boolean {
  let n = 0; for (const f of SIDEWALL_FILES) if (!scene.textures.exists(f.key)) { scene.load.image(f.key, f.file); n++; }
  return n > 0;
}
/** 没载入就现载，载完回调（场景已销毁则不回调）；已有图直接回调。 */
export function whenSideWallReady(scene: Phaser.Scene, cb: () => void): void {
  if (sideWallReady(scene)) { cb(); return; }
  loadSideWallArt(scene);
  scene.load.once('complete', () => { if (scene.sys.settings.status < Phaser.Scenes.SHUTDOWN) cb(); });
  if (!scene.load.isLoading()) scene.load.start();
}

export interface SideWallOpts {
  x: number; y0: number; y1: number; flip?: boolean;
  /** 显示比例（图是 384 格比例；城墙默认 .78 → 墙宽约 79）。 */
  scale?: number;
  /** 北端 / 南端收口：'cap' 用墩台 / 墙脚图；'none' 不收（被角楼 / 别的墙盖住）。默认北 none、南 cap。 */
  north?: 'cap' | 'none'; south?: 'cap' | 'none';
  /** 盖在标准段上的特殊段：at = 离北端的距离。 */
  accents?: Array<{ at: number; kind: 'hut' | 'breach' | 'gate' }>;
  name?: string; depthBias?: number;
}

/** 竖向铺一段侧墙（y0 北端 → y1 南端，x 为墙中线）。每块各自按脚底 y 取层级，主将走到墙北面时在墙后。返回所有图。 */
export function drawSideWall(scene: Phaser.Scene, o: SideWallOpts): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [], s = o.scale ?? .78, name = o.name ?? 'sidewall', bias = o.depthBias ?? 0, flip = !!o.flip;
  const tex = (k: string) => scene.textures.get(k).getSourceImage() as { width: number; height: number };
  const seg = tex('sw_segT'), W = seg.width * s, H = seg.height * s;
  const end = o.south === 'none' ? o.y1 : o.y1 - 6 * s;
  for (let y = o.y0; y < end - .5; y += H) {
    const hk = Math.min(H, end - y), ts = scene.add.tileSprite(o.x, y + hk / 2, W, hk, 'sw_segT').setTileScale(s).setFlipX(flip).setDepth(actorDepth(y + hk) + bias).setName(name);
    out.push(ts);
  }
  const put = (key: string, y: number, originY: number, extra = 0.001) => {
    const im = scene.add.image(o.x, y, key).setOrigin(.5, originY).setScale(flip ? -s : s, s).setDepth(actorDepth(y) + bias + extra).setName(name); out.push(im); return im;
  };
  for (const a of o.accents ?? []) { const k = 'sw_' + a.kind, h = tex(k).height * s; put(k, o.y0 + a.at + h / 2, .5, 0.0005).setDepth(actorDepth(o.y0 + a.at + h) + bias + .0005); }
  if (o.north === 'cap') put('sw_capN', o.y0 - 4 * s, 0, -.0005).setOrigin(.5, 0);
  if (o.south !== 'none') put('sw_capS', o.y1, 1);
  return out;
}

export interface SidePalisadeOpts { x: number; y0: number; y1: number; flip?: boolean; scale?: number; name?: string; depthBias?: number; watchAt?: number[] }

/** 竖向铺一排营栅木桩（y0 → y1）；watchAt 处换成带瞭望台的栅段。 */
export function drawSidePalisade(scene: Phaser.Scene, o: SidePalisadeOpts): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [], s = o.scale ?? .95, name = o.name ?? 'sidepalisade', bias = o.depthBias ?? 0;
  const u = scene.textures.get('sw_palU').getSourceImage() as { width: number; height: number }, W = u.width * s, step = u.height * s * 3;
  for (let y = o.y0; y < o.y1 - .5; y += step) {
    const hk = Math.min(step, o.y1 - y), ts = scene.add.tileSprite(o.x, y + hk / 2, W, hk, 'sw_palU').setTileScale(s).setFlipX(!!o.flip).setDepth(actorDepth(y + hk) + bias).setName(name);
    out.push(ts);
  }
  for (const wy of o.watchAt ?? []) {
    const im = scene.add.image(o.x, wy, 'sw_palWatch').setOrigin(.5, 1).setScale(s * 1.0).setDepth(actorDepth(wy) + bias + .001).setName(name); out.push(im);
  }
  return out;
}
