import Phaser from 'phaser';
import {CITIES, FACTIONS, HOME, MAP_H, MAP_W, cityOwner, type FactionId, type EraId} from './WorldCities';

/**
 * 势力范围（参考全面战争：三国 / 三国志的疆域图）：
 * 以每座城为中心做加权 Voronoi 划分（大城辖区更大），加低频噪声让疆界自然弯曲；
 * 海面（原画中大片蓝色水域）与远离城池的荒地不着色。
 * 同一势力内部画淡淡的郡界，不同势力之间画实色国界（内侧势力色、外侧描暗边）；玩家疆域更亮。
 * 输出一张半透明纹理（随地图缩放）+ 每块连片疆域的势力名放置点（地图坐标）。
 */
export interface TerritoryLabel {faction: FactionId; x: number; y: number; size: number;}
export interface Territory {key: string; labels: TerritoryLabel[];}

const STEP = 3; // 地图像素 / 网格
const REACH = {large: 250, medium: 190, small: 140} as const;
const WEIGHT = {large: 1.3, medium: 1.08, small: .9} as const;
const labelCache = new Map<string, TerritoryLabel[]>();
/** 2026-11-16 用户反馈「想更清楚看到我的派系范围」：我方疆域底色更实、疆界加金色柔光描边、疆域名改金字。用户 2026-11-16 批准，默认开启；?realm=v1 回到旧版。 */
export const REALM_V2 = (() => { try { return new URLSearchParams(location.search).get('realm') !== 'v1'; } catch { return true; } })();

/** 低频值噪声（确定性），让疆界不是直线。 */
function noise(x: number, y: number): number {
  const h = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return Phaser.Math.Linear(Phaser.Math.Linear(h(ix, iy), h(ix + 1, iy), u), Phaser.Math.Linear(h(ix, iy + 1), h(ix + 1, iy + 1), u), v) * 2 - 1;
}

/** 原画中的大片水域（海、大湖）：偏蓝像素的大连通块；细河不算。 */
function waterMask(scene: Phaser.Scene, gw: number, gh: number): Uint8Array {
  const mask = new Uint8Array(gw * gh);
  // 宏大版舆图的海是灰青色，按颜色认不出：改用随图发的水域图 world_water（由旧战略图算出，新图按它 1:1 重绘，白 = 水）
  const ref = scene.textures.exists('world_water') ? 'world_water' : 'strategy_art';
  if (!scene.textures.exists(ref)) return mask;
  const src = scene.textures.get(ref).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const g = c.getContext('2d', {willReadFrequently: true})!; g.drawImage(src, 0, 0, gw, gh);
  const px = g.getImageData(0, 0, gw, gh).data, blue = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]; blue[i] = ref === 'world_water' ? (r > 128 ? 1 : 0) : b > r + 25 && b > 95 && b >= gg - 12 ? 1 : 0; }
  // 只保留大连通块（> 1.2% 地图面积）
  const seen = new Uint8Array(gw * gh), stack: number[] = [], comp: number[] = [], min = gw * gh * .012;
  for (let i = 0; i < gw * gh; i++) {
    if (!blue[i] || seen[i]) continue;
    comp.length = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const j = stack.pop()!; comp.push(j); const x = j % gw, y = (j / gw) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < gw - 1 ? j + 1 : -1, y > 0 ? j - gw : -1, y < gh - 1 ? j + gw : -1]) if (k >= 0 && blue[k] && !seen[k]) { seen[k] = 1; stack.push(k); } }
    if (comp.length > min) for (const j of comp) mask[j] = 1;
  }
  return mask;
}

export function buildTerritory(scene: Phaser.Scene, era: EraId, owned: readonly string[]): Territory {
  const key = `world_realm_${era}_${owned.join('.')}`;
  if (scene.textures.exists(key) && labelCache.has(key)) return {key, labels: labelCache.get(key)!};
  // 只缓存当前局面一张（约 1024×683）：时代或领地变化时丢掉旧图
  for (const old of scene.textures.getTextureKeys()) if (old.startsWith('world_realm_')) scene.textures.remove(old);
  labelCache.clear();
  const gw = Math.ceil(MAP_W / STEP), gh = Math.ceil(MAP_H / STEP);
  const seeds = [...CITIES.map(c => ({x: c.x, y: c.y, w: WEIGHT[c.tier], reach: REACH[c.tier], f: cityOwner(c.id, era, owned)})),
    {x: HOME.x, y: HOME.y, w: 1, reach: 150, f: 'player' as FactionId}];
  const factionIds = Object.keys(FACTIONS) as FactionId[], fIndex = new Map(factionIds.map((f, i) => [f, i + 1]));
  const water = waterMask(scene, gw, gh);
  const cell = new Int16Array(gw * gh).fill(-1), fac = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x; if (water[i]) continue;
    const mx = x * STEP + STEP / 2, my = y * STEP + STEP / 2, wob = noise(mx / 70, my / 70) * 26 + noise(mx / 23, my / 23) * 8;
    let best = -1, bd = Infinity;
    for (let s = 0; s < seeds.length; s++) { const d = Math.hypot(mx - seeds[s].x, my - seeds[s].y); const wd = d / seeds[s].w + wob; if (wd < bd && d < seeds[s].reach + wob) { bd = wd; best = s; } }
    if (best >= 0) { cell[i] = best; fac[i] = fIndex.get(seeds[best].f)!; }
  }
  // 着色
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const g = c.getContext('2d')!, img = g.createImageData(gw, gh), d = img.data, pimg = g.createImageData(gw, gh), pd = pimg.data;
  const rgb = factionIds.map(f => [FACTIONS[f].color >> 16 & 255, FACTIONS[f].color >> 8 & 255, FACTIONS[f].color & 255]);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, f = fac[i]; if (!f) continue;
    const [r, gg, b] = rgb[f - 1], player = factionIds[f - 1] === 'player';
    let border = 0, inner = 0, province = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx, near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      if (fac[j] !== f) { if (near) border = fac[j] ? 2 : 1; else inner = 1; } else if (near && cell[j] !== cell[i]) province = true;
    }
    let a: number, k = 1;
    if (border === 2) { const o = i * 4; d[o] = 58; d[o + 1] = 47; d[o + 2] = 34; d[o + 3] = .62 * 255; if (player) { const p = i * 4; pd[p] = 255; pd[p + 1] = 222; pd[p + 2] = 130; pd[p + 3] = 255; } continue; } // 国界：墨线（2026-11-18「边界画成墨线」）
    else if (border === 1) { a = .7; k = .8; }        // 疆域外缘（荒地 / 海岸）
    else if (inner) { a = .82; k = 1.15; }            // 国界内侧亮色带
    else if (province) { a = .38; k = 1.25; }         // 郡界
    else a = player ? (REALM_V2 ? .46 : .34) : .26;   // 疆域底色（v2：我方更实）
    const o = i * 4; d[o] = Math.min(255, r * k); d[o + 1] = Math.min(255, gg * k); d[o + 2] = Math.min(255, b * k); d[o + 3] = a * 255;
    // 我方疆界另画一层金色描边（v2，见下方 playerKey）
    if (player && border) { const p = i * 4; pd[p] = 255; pd[p + 1] = 222; pd[p + 2] = 130; pd[p + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  // 我方疆界金边层：稍粗、带柔光，叠在疆域图上（ADD 混合），远看也能一眼认出自家地盘
  {const pc = document.createElement('canvas'); pc.width = gw; pc.height = gh; pc.getContext('2d')!.putImageData(pimg, 0, 0);
   const po = document.createElement('canvas'); po.width = gw * 2; po.height = gh * 2; const pg = po.getContext('2d')!;
   pg.imageSmoothingEnabled = true; pg.filter = 'blur(3px)'; pg.globalAlpha = .9; pg.drawImage(pc, 0, 0, po.width, po.height);
   pg.filter = 'blur(.8px)'; pg.globalAlpha = 1; pg.drawImage(pc, 0, 0, po.width, po.height);
   if (scene.textures.exists(key + '_player')) scene.textures.remove(key + '_player');
   scene.textures.addCanvas(key + '_player', po); scene.textures.get(key + '_player').setFilter(Phaser.Textures.FilterMode.LINEAR);}
  // 2 倍放大 + 轻微模糊：放大地图时疆界不出现台阶状锯齿
  const out = document.createElement('canvas'); out.width = gw * 2; out.height = gh * 2;
  const og = out.getContext('2d')!; og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high'; og.filter = 'blur(1.1px)'; og.drawImage(c, 0, 0, out.width, out.height);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, out);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  // 势力名：每块连片疆域（同势力连通）取质心，面积太小不标
  const seen = new Uint8Array(gw * gh), labels: TerritoryLabel[] = [], stack: number[] = [];
  for (let i = 0; i < gw * gh; i++) {
    if (!fac[i] || seen[i]) continue;
    const f = fac[i], comp: number[] = []; let n = 0, sx = 0, sy = 0; stack.push(i); seen[i] = 1;
    while (stack.length) { const j = stack.pop()!, x = j % gw, y = (j / gw) | 0; n++; sx += x; sy += y; comp.push(j);
      for (const k of [x > 0 ? j - 1 : -1, x < gw - 1 ? j + 1 : -1, y > 0 ? j - gw : -1, y < gh - 1 ? j + gw : -1]) if (k >= 0 && fac[k] === f && !seen[k]) { seen[k] = 1; stack.push(k); } }
    if (n < 2600) continue;
    const area = n * STEP * STEP, size = Phaser.Math.Clamp(Math.sqrt(area) * .14, 30, 64);
    // 放在疆域内、靠近质心、又避开城池标记与疆界的位置（大字不压城）
    const cx = sx / n, cy = sy / n; let bx = cx, by = cy, best = -Infinity;
    for (let q = 0; q < comp.length; q += 7) {
      const j = comp[q], x = j % gw, y = (j / gw) | 0, mx = x * STEP, my = y * STEP;
      let near = Infinity; for (const s of seeds) near = Math.min(near, Math.hypot(mx - s.x, (my - s.y) * 1.6));
      const edge = Math.min(x, y, gw - 1 - x, gh - 1 - y) * STEP;
      const score = Math.min(near, 110) * 1.4 - Math.hypot(x - cx, y - cy) * STEP * .45 + Math.min(edge, 80);
      if (score > best) { best = score; bx = x; by = y; }
    }
    labels.push({faction: factionIds[f - 1], x: bx * STEP + STEP / 2, y: by * STEP + STEP / 2, size});
  }
  labelCache.set(key, labels);
  return {key, labels};
}
