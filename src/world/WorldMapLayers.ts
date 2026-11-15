import Phaser from 'phaser';
import {RENDER_SCALE} from '../config';
import {CITIES, FACTIONS, HOME, MAP_H, MAP_W, cityOwner, type CityDef, type FactionId} from './WorldCities';
import {worldText} from './WorldUI';

/** 势力领地染色：每座城以势力色做柔和径向晕染，半分辨率画布，随地图缩放。 */
export function territoryTexture(scene: Phaser.Scene, era: 1 | 2 | 3, owned: readonly string[]): string {
  const key = `world_territory_${era}_${owned.join('.')}`;
  if (scene.textures.exists(key)) return key;
  const k = .5, c = document.createElement('canvas'); c.width = MAP_W * k; c.height = MAP_H * k;
  const g = c.getContext('2d')!;
  const blob = (x: number, y: number, r: number, color: number, alpha: number) => {
    const rgb = `${color >> 16 & 255},${color >> 8 & 255},${color & 255}`, grad = g.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`); grad.addColorStop(.65, `rgba(${rgb},${alpha * .55})`); grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad; g.fillRect((x - r) * k, (y - r) * k, r * 2 * k, r * 2 * k);
  };
  for (const city of CITIES) blob(city.x, city.y, city.tier === 'large' ? 150 : city.tier === 'medium' ? 112 : 84, FACTIONS[cityOwner(city.id, era, owned)].color, .46);
  blob(HOME.x, HOME.y, 96, FACTIONS.player.color, .4);
  scene.textures.addCanvas(key, c);
  return key;
}

/** 城池标记（屏幕坐标、固定大小）：档位决定尺寸与徽框，势力色为底，名字在下方；大、中城插势力军旗。 */
export interface CityMarker {city: CityDef; root: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Graphics; hit: Phaser.GameObjects.Arc; outer: number; top: number;}
const SIZE = {large: 15, medium: 11, small: 7} as const;
/** W5 标记美术（tools/prepare-world-markers.mjs 生成，数值取自 public/assets/world/markers/manifest.json）。 */
export const MARKER_FILES = {city_frame_large: 'assets/world/markers/city_frame_large.png', city_frame_medium: 'assets/world/markers/city_frame_medium.png', city_frame_small: 'assets/world/markers/city_frame_small.png', banner_cloth: 'assets/world/markers/banner_cloth.png', banner_pole: 'assets/world/markers/banner_pole.png'} as const;
const FRAME = {large: {w: 132, h: 144, cx: 66, cy: 77.6, outer: 64, inner: 45.5}, medium: {w: 104, h: 107, cx: 52, cy: 54.8, outer: 50.2, inner: 36.9}, small: {w: 78, h: 80, cx: 39, cy: 40.3, outer: 37.1, inner: 26.8}} as const;
const BANNER = {w: 87, h: 209, poleX: 12, cloth: {x0: 22, x1: 73, y0: 62, y1: 168}} as const;
/** 旗上姓氏（地方豪强不挂旗）。 */
export const BANNER_CHAR: Partial<Record<FactionId, string>> = {player: '义', yellow: '黄', dongzhuo: '董', yuanshao: '袁', caocao: '曹', yuanshu: '袁', gongsun: '公孙', taoqian: '陶', liubiao: '刘', sun: '孙', mateng: '马', liuzhang: '刘', zhanglu: '张'};
const BANNER_H = {large: 58, medium: 46, small: 0} as const;
export function cityMarker(scene: Phaser.Scene, city: CityDef, owner: FactionId): CityMarker {
  const r = SIZE[city.tier], color = FACTIONS[owner].color, root = scene.add.container(0, 0);
  const art = scene.textures.exists('city_frame_' + city.tier), parts: Phaser.GameObjects.GameObject[] = [];
  const ring = scene.add.graphics(); parts.push(ring);
  let outer = r, top = r;
  if (art) {
    // 徽框：外缘 = r + 5；中心圆孔填势力色
    const F = FRAME[city.tier], k = (r + 5) / F.outer; outer = r + 5; top = F.cy * k;
    const g = scene.add.graphics(); g.fillStyle(0x0d1a12, .5).fillCircle(1, 2, outer); g.fillStyle(color, 1).fillCircle(0, 0, F.inner * k + 1.2);
    if (owner === 'player') g.fillStyle(0xfff1c8, 1).fillTriangle(-3, -4, -3, 5, 5, 0);
    parts.push(g);
    const bh = BANNER_H[city.tier], ch = BANNER_CHAR[owner];
    if (bh && ch && scene.textures.exists('banner_cloth')) {
      // 军旗插在徽框右上，旗杆底端落在框右缘
      const bk = bh / BANNER.h, bx = outer * .72, by = outer * .3, ox = BANNER.poleX / BANNER.w;
      const pole = scene.add.image(bx, by, 'banner_pole').setOrigin(ox, 1).setScale(bk);
      const cloth = scene.add.image(bx, by, 'banner_cloth').setOrigin(ox, 1).setScale(bk).setTint(color);
      const C = BANNER.cloth, tx = bx + ((C.x0 + C.x1) / 2 - BANNER.poleX) * bk, ty = by - (BANNER.h - (C.y0 + (C.y1 - C.y0) * .42)) * bk;
      const size = Math.round((C.x1 - C.x0) * bk * (ch.length > 1 ? .5 : .74));
      const glyph = scene.add.text(tx, ty, ch.length > 1 ? ch.split('').join('\n') : ch, {fontFamily: '"Noto Serif SC","Songti SC","SimSun",serif', fontSize: size + 'px', color: '#fff6e0', align: 'center', resolution: 2 * RENDER_SCALE, lineSpacing: -2}).setOrigin(.5).setStroke('#1a120a', 2);
      parts.push(pole, cloth, glyph); root.setData('banner', ch);
    }
    parts.push(scene.add.image(0, 0, 'city_frame_' + city.tier).setOrigin(F.cx / F.w, F.cy / F.h).setScale(k));
  } else {
    // 素材未加载时的程序化标记
    const g = scene.add.graphics();
    g.fillStyle(0x0d1a12, .55).fillCircle(1, 2, r + 3);
    g.fillStyle(color, 1).fillCircle(0, 0, r);
    g.lineStyle(city.tier === 'small' ? 1.5 : 2, 0xf0d496, .95).strokeCircle(0, 0, r);
    if (city.tier !== 'small') g.lineStyle(1, 0x1a120a, .6).strokeCircle(0, 0, r - 3);
    if (city.tier === 'large') { g.fillStyle(0xf0d496, 1); for (const dx of [-8, -2.5, 3]) g.fillRect(dx, -r - 6, 5, 6); g.fillRect(-9, -r - 1.5, 17, 2.5); top = r + 6; }
    if (owner === 'player') g.fillStyle(0xfff1c8, 1).fillTriangle(-3, -4, -3, 5, 5, 0);
    parts.push(g);
  }
  const label = worldText(scene, 0, outer + 2, city.name, city.tier === 'large' ? 14 : city.tier === 'medium' ? 12 : 11, city.tier === 'small' ? '#efe6cc' : '#fff1cf')
    .setOrigin(.5, 0).setStroke('#142016', 3);
  const hit = scene.add.circle(0, 0, Math.max(outer + 6, 16), 0, .001).setInteractive({useHandCursor: true}).setName('city-' + city.id);
  root.add([...parts, label, hit]);
  return {city, root, label, ring, hit, outer, top};
}
export function paintSelection(m: CityMarker, on: boolean) {
  m.ring.clear(); if (on) m.ring.lineStyle(2.5, 0xffe9a8, 1).strokeCircle(0, 0, m.outer + 4).lineStyle(1, 0xffe9a8, .5).strokeCircle(0, 0, m.outer + 8);
}

/** 势力图例：本时代各势力及城池数。 */
export function factionLegend(scene: Phaser.Scene, x: number, y: number, era: 1 | 2 | 3, owned: readonly string[], width: number): Phaser.GameObjects.Container {
  const counts = new Map<FactionId, number>();
  for (const c of CITIES) { const o = cityOwner(c.id, era, owned); counts.set(o, (counts.get(o) ?? 0) + 1); }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const root = scene.add.container(x, y).setName('world-legend');
  const cols = width > 360 ? 3 : 2, rowH = 24, h = Math.ceil(rows.length / cols) * rowH + 16;
  root.add(scene.add.rectangle(0, 0, width, h, 0x0f1c15, .94).setOrigin(0).setStrokeStyle(1, 0xb79a5e, .7));
  rows.forEach(([id, n], i) => {
    const cx = 12 + (i % cols) * (width - 16) / cols, cy = 10 + Math.floor(i / cols) * rowH;
    root.add(scene.add.rectangle(cx, cy + 4, 12, 12, FACTIONS[id].color).setOrigin(0).setStrokeStyle(1, 0xf0d496, .8));
    root.add(worldText(scene, cx + 18, cy, `${FACTIONS[id].name} ${n}`, 13, FACTIONS[id].css));
  });
  return root;
}
export {RENDER_SCALE};

/** W4 告急：红色脉动外环 + “告急”小旗（在城名上方）。 */
export function markAlert(scene: Phaser.Scene, m: CityMarker): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setName('alert-' + m.city.id);
  const pulse = scene.add.circle(0, 0, m.outer + 6, 0, 0).setStrokeStyle(3, 0xe0442c, .95);
  const tag = worldText(scene, 0, -m.top - 9, '告急', 11, '#fff2e0').setOrigin(.5).setBackgroundColor('#b0261ae6').setPadding(4, 1);
  root.add([pulse, tag]); m.root.add(root);
  scene.tweens.add({targets: pulse, scale: 1.25, alpha: .25, duration: 700, yoyo: true, repeat: -1});
  return root;
}
