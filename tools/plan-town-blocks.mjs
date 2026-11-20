// 城池街区规划（用户 2026-11-20：「我想建筑物密度类似于图二」）：在浏览器里读城池底图像素，把民居店铺成排填进空地，写出 src/town/TownBlocks.ts。
// 能放的地：泥地 / 浅草（排除路面石板与地基石边 = 低饱和、水面、画上的深色树木）。还要避开：建筑位（府衙 / 屯田 / 募兵所，按 3 级大小，空着的地基也保持清楚）、
// 营寨功能建筑分署 / 旅商 / 军医、它们的名牌、手摆的装饰（TOWN_DECOR）、居民路网（TOWN_ROADS 两侧）、城墙下。
// 用法：BASE=http://127.0.0.1:5173/ node tools/plan-town-blocks.mjs   （需要开发服务器）
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage();
await p.goto(base + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.isActive('HomeScene') || !!window.__game, null, { timeout: 120000 });
const plan = await p.evaluate(async () => {
  const L = await import('/src/town/TownLife.ts'), S = await import('/src/scenes/TownScene.ts');
  const out = {}, stats = {};
  for (const tier of ['small', 'medium', 'large']) {
    const bmp = await createImageBitmap(await (await fetch(`/assets/town-city/bg_${tier}.webp`)).blob());
    const cv = new OffscreenCanvas(1536, 1024), cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, 1536, 1024); const px = cx.getImageData(0, 0, 1536, 1024).data;
    const ground = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= 1536 || y >= 1024) return false; const i = (y * 1536 + x) * 4, r = px[i], g = px[i + 1], bl = px[i + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), s = mx ? (mx - mn) / mx : 0, v = mx / 255;
      if (bl > r + 8 && bl >= g) return false;          // 水
      if (s < .17) return false;                          // 石板小径、地基石边、灯笼（大道石板偏暖，另用 PAVED 多边形挡）
      if (v < .3) return false;                           // 阴影、树干
      if (g >= r && v < .62) return false;                // 画上的深绿树冠
      return true; };
    // hard：房基不能压（建筑位地基整块、功能建筑 / 装饰的占地）；labels：房顶不能盖住名牌；art：功能建筑画面——只拦站在它前面（底边更靠下）的房子，身后的房子被它挡住无妨
    const hard = [], labels = [], art = [];
    for (const sl of Object.values(S.SLOTS[tier])) { const w = sl.w * 1.06; hard.push([sl.x - w / 2 - 6, sl.y - w * .4, sl.x + w / 2 + 6, sl.y + 14]); art.push([sl.x - w / 2 - 6, sl.y - w * .68, sl.x + w / 2 + 6, sl.y + 14, sl.y]); labels.push([sl.x - 80, sl.y - 40, sl.x + 80, sl.y + 8]); }
    for (const [id, sl] of Object.entries(L.HQ_SLOTS[tier])) { const small = id === 'merchant' || id === 'medic', w = sl.w * (small ? 1 : 1.06); hard.push([sl.x - w * .55, sl.y - w * .32, sl.x + w * .55, sl.y + 14]); art.push([sl.x - w * .55, sl.y - w * (small ? .95 : .66), sl.x + w * .55, sl.y + 14, sl.y]); labels.push([sl.x - 70, sl.y - 36, sl.x + 70, sl.y + 8]); }
    for (const it of L.TOWN_DECOR[tier]) { const w = it.w || L.decorWidth(it.a + it.f) || 60; hard.push([it.x - w / 2 - 4, it.y - 40, it.x + w / 2 + 4, it.y + 8]); art.push([it.x - w / 2 - 4, it.y - w * .85, it.x + w / 2 + 4, it.y + 8, it.y]); }
    // 小城是泥土路（与空地同色，只能靠路网缓冲挡），缓冲放宽到土路实际宽度
    const ROAD_PAD = tier === 'small' ? 36 : 14, CAP = { small: 36, medium: 40, large: 40 }[tier];
    const net = L.TOWN_ROADS[tier], segs = net.edges.map(([a, c]) => [net.nodes[a], net.nodes[c]]);
    const nearRoad = (x, y) => segs.some(([a, c]) => { const dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))), hw = a[2] + (c[2] - a[2]) * t; return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < hw + ROAD_PAD; });
    // 大道 / 横街（暖色石板，颜色分不出，手标多边形）：中城中轴大道；大城中轴御道 + 横街
    const PAVED = { small: [], medium: [[[682, 286], [940, 286], [1045, 1024], [578, 1024]]], large: [[[692, 276], [952, 276], [1020, 1024], [622, 1024]], [[0, 500], [1536, 500], [1536, 575], [0, 575]]] }[tier];
    const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const paved = (x, y) => PAVED.some(q => inPoly(x, y, q));
    const ov = (q, l, t, r, b2) => l < q[2] && r > q[0] && t < q[3] && b2 > q[1];
    const TYPES = [['st', 0], ['st', 2], ['st', 1], ['st', 0], ['st', 3], ['st', 2], ['st', 0], ['st', 1]];
    // 摊棚只沿路摆、每城至多 6 个；粮仓至多 3 座（同一张图摆多了扎眼）
    const byRoad = (x, y) => segs.some(([a, c]) => { const dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))), hw = a[2] + (c[2] - a[2]) * t; return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < hw + 70; });
    let stalls = 0, grains = 0;
    const placed = [];
    let seed = tier.length * 977;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let y = 352; y <= 1018; y += 6) {
      for (let x = 30; x <= 1506; x += 6) {
        const start = Math.floor(rnd() * TYPES.length);
        const opts = [...Array.from({ length: 4 }, (_, k) => TYPES[(start + k) % TYPES.length]), ['ct', 0]];
        for (let k = 0; k < opts.length; k++) {
          const [a, f] = opts[k]; if (placed.length >= CAP) break; if (a === 'ct' && (stalls >= 6 || !byRoad(x, y))) continue; if (a === 'st' && f === 2 && placed.filter(q => q.a === 'st' && q.f === 2).length > placed.length * .3 + 1) continue; if (a === 'st' && f === 3 && grains >= 3) continue;
          const w = L.decorWidth(a + f), h = w * (f === 1 && a === 'st' ? .95 : .78);
          const l = x - w / 2, r = x + w / 2; if (l < 4 || r > 1532) continue;
          if (placed.some(q => Math.abs(q.y - y) < 46 && l < q.r + 8 && r > q.l - 8)) continue;
          if (hard.some(q => ov(q, l + 6, y - 34, r - 6, y + 4)) || labels.some(q => ov(q, l + 6, y - h + 10, r - 6, y + 4)) || art.some(q => y > q[4] - 6 && ov(q, l + 6, y - h + 10, r - 6, y + 4))) continue;
          let okN = 0, n = 0; for (let yy = y - 34; yy <= y - 2; yy += 8) for (let xx = l + 8; xx <= r - 8; xx += 8) { n++; if (ground(xx, yy) && !nearRoad(xx, yy) && !paved(xx, yy)) okN++; }
          if (okN / n < .88) continue;
          placed.push({ a, f, x, y, l, r, flip: rnd() < .4 ? 1 : 0 }); if (a === 'ct') stalls++; if (a === 'st' && f === 3) grains++;
          x += w / 2; break;
        }
      }
    }
    // 府衙等级门槛：约一半 1 级就有，其余 2、3 级陆续盖起
    out[tier] = placed.map((q, i) => [q.a, q.f, Math.round(q.x), Math.round(q.y), (i * 7) % 8 < 4 ? 1 : (i * 7) % 8 < 6 ? 2 : 3, q.flip]);
    stats[tier] = { n: placed.length, lv1: out[tier].filter(q => q[4] === 1).length };
  }
  return { out, stats };
});
const body = `/**
 * 城池街区（tools/plan-town-blocks.mjs 生成，勿手改）：按底图像素找出泥地 / 草地空地，避开路面、水、画上的树、建筑位地基、营寨分署、名牌与路网，
 * 成排填满民居店铺（11-20 用户「我想建筑物密度类似于图二」）。每项 [图集, 帧, x, y(底边), 府衙等级门槛, 镜像]。
 */
import type { CityTier } from '../world/WorldCities';
export const TOWN_BLOCKS: Record<CityTier, Array<[string, number, number, number, number, 0 | 1]>> = {
${['small', 'medium', 'large'].map(t => `  ${t}: [\n${plan.out[t].map(q => `    ${JSON.stringify(q)},`).join('\n')}\n  ],`).join('\n')}
};
`;
writeFileSync('src/town/TownBlocks.ts', body);
console.log(JSON.stringify(plan.stats));
await b.close();
