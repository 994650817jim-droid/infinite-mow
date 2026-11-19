// 人马比例检查（11-19 用户「请注意人和马的比例要正常」）：不用开发服务器，直接读图集 PNG，在无头浏览器画布里量人物 / 马的不透明包围盒，
// 按游戏里的摆位规则（马蹄 = 帧 280 行落地；骑者帧 240 行 = 马镫，离地 stirrup；首领整体 ×1.4）拼出联系表：每格「步战本人 · 骑马 · 步兵」。
// 量出：骑者相对步战缩放（骑乘图与行走图同像素密度时应 = 1）、马身长 / 骑者站高（目标 1.2–1.4）、马背高 / 骑者站高（髋～腰 ≈ .5–.62）、骑者臀部是否落在马背上。
// 用法：node tools/mount-proportions.mjs [after]  → assets/review/mount-proportions/contact-<tag>.png + 控制台表格
// 参数（与 src/data/mounts.ts、HeroMount.ts、BossMount.ts 对应）在下面 P；改代码时同步改这里。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'now', OUT = 'assets/review/mount-proportions';
mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(readFileSync(new URL('./mount-proportions.json', import.meta.url), 'utf8'));
const P = cfg[TAG]; if (!P) throw new Error('no config ' + TAG);
const pub = 'public/';
const img = p => 'data:image/png;base64,' + readFileSync(pub + p).toString('base64');
const H = cfg.heroes, B = cfg.bosses, T = cfg.troops;
const files = {}; const need = p => { files[p] ??= img(p); return p; };
for (const h of H) { need(h.walk); need(h.ride); need(`assets/horses-v2/${h.horse}_walk.png`); }
for (const b of B) { need(b.walk); need(`assets/ride-v2/boss_${b.id}_ride.png`); need(`assets/horses-v2/${b.horse}_walk.png`); }
for (const t of T) need(t.file);
need('assets/processed-v2/enemies/enemy_infantry_walk.png'); need('assets/horses-v2/enemy_brown_walk.png');
const br = await chromium.launch({ channel: 'chrome', headless: true });
const page = await br.newPage();
const res = await page.evaluate(async ({ files, P, H, B, T }) => {
  const im = {}; await Promise.all(Object.entries(files).map(([k, u]) => new Promise(r => { const i = new Image(); i.onload = () => { im[k] = i; r(); }; i.src = u; })));
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  /** 某格（col,row，边长 cell）的不透明包围盒（帧内像素）。 */
  const box = (k, cell, col, row) => { const i = im[k]; cv.width = cell; cv.height = cell; g.clearRect(0, 0, cell, cell); g.drawImage(i, col * cell, row * cell, cell, cell, 0, 0, cell, cell); const d = g.getImageData(0, 0, cell, cell).data; let t = cell, b = -1, l = cell, r = -1; for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (d[(y * cell + x) * 4 + 3] > 60) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; } return { t, b, l, r, w: r - l + 1, h: b - t + 1 }; };
  /** 马背高：马图侧视帧里，马身中段（包围盒水平 35%–60%）每列最上面的不透明像素，取中位数 → 帧内 y。 */
  const back = (k, cell, col, row, bx) => { const i = im[k]; cv.width = cell; cv.height = cell; g.clearRect(0, 0, cell, cell); g.drawImage(i, col * cell, row * cell, cell, cell, 0, 0, cell, cell); const d = g.getImageData(0, 0, cell, cell).data; const ys = []; for (let x = Math.round(bx.l + bx.w * .35); x <= bx.l + bx.w * .6; x++) for (let y = 0; y < cell; y++) if (d[(y * cell + x) * 4 + 3] > 60) { ys.push(y); break; } ys.sort((a, c) => a - c); return ys[ys.length >> 1]; };
  const rows = [];
  // 联系表：每格 330×300（显示像素 ×1.4），地线在 y=285
  const S = 1.4, CW = 330, CH = 300, GY = 285, all = [...H.map(h => ({ ...h, kind: 'hero' })), ...B.map(b => ({ ...b, kind: 'boss' })), ...T.map(t => ({ ...t, kind: 'troop' }))];
  const cols = 4, sheet = document.createElement('canvas'); sheet.width = cols * CW; sheet.height = Math.ceil(all.length / cols) * CH; const sg = sheet.getContext('2d'); sg.fillStyle = '#c9b48a'; sg.fillRect(0, 0, sheet.width, sheet.height);
  const draw = (k, cell, col, row, sc, x, groundY, footRow) => { sg.drawImage(im[k], col * cell, row * cell, cell, cell, x - cell * sc / 2, groundY - footRow * sc, cell * sc, cell * sc); };
  const inf = 'assets/processed-v2/enemies/enemy_infantry_walk.png', infB = box(inf, 128, 0, 2), infH = infB.h * P.troopScale;
  all.forEach((u, n) => {
    const ox = (n % cols) * CW, oy = Math.floor(n / cols) * CH, G = oy + GY;
    sg.strokeStyle = '#7a6440'; sg.beginPath(); sg.moveTo(ox + 4, G); sg.lineTo(ox + CW - 4, G); sg.stroke();
    sg.fillStyle = '#2a1c10'; sg.font = '13px sans-serif'; sg.fillText(u.name, ox + 6, oy + 16);
    const pres = u.kind === 'boss' ? 1.4 : 1;
    // 步兵对照（右侧）
    draw(inf, 128, 0, 2, P.troopScale * S, ox + CW - 30, G, infB.b + 1);
    if (u.kind === 'troop') {
      const tb = box(u.file, u.cell, 0, 2), sc = P.troopScale * (u.mounted ? P.cavalryScale : 1);
      draw(u.file, u.cell, 0, 2, sc * S, ox + CW / 2, G, tb.b + 1);
      rows.push({ name: u.name, unitH: +(tb.h * sc).toFixed(1), unitW: +(tb.w * sc).toFixed(1), infH: +infH.toFixed(1), ratioToInf: +(tb.h * sc / infH).toFixed(2) });
      return;
    }
    // 步战本人（左侧）
    const wb = box(u.walk, u.cell, 0, 2), footSc = (u.kind === 'hero' ? 88 / u.cell : .5) * pres, standH = wb.h * footSc;
    draw(u.walk, u.cell, 0, 2, footSc * S, ox + 40, G, wb.b + 1);
    // 骑马（中间）：马、骑者按游戏摆位
    const bk = u.kind === 'boss' ? P.bossK : 1, hk = `assets/horses-v2/${u.horse}_walk.png`, hb = box(hk, 288, 0, 2), hSc = P.horseScale * pres * bk, rk = u.kind === 'hero' ? u.ride : `assets/ride-v2/boss_${u.id}_ride.png`;
    const rb = box(rk, 256, 0, 2), rSc = P.rideScale * pres * bk, stir = (u.stirrup ?? P.stirrup) * pres * bk, /* 骡车鞍低：RIDE_STIRRUP 24×.85 */ cx = ox + CW / 2 + 10;
    draw(hk, 288, 0, 2, hSc * S, cx, G, 280);
    draw(rk, 256, 0, 2, rSc * S, cx, G - stir * S, 240);
    const hBack = back(hk, 288, 0, 2, hb), backH = (280 - hBack) * hSc, horseLen = hb.w * hSc, horseTop = (280 - hb.t) * hSc;
    // 骑者臀部（座位）：骑乘帧里座位约在 RIDE_SEAT_ROW（帧内 y），落地后离地高度；与马背比较：正 = 浮起、负 = 陷进
    const seatH = (240 - P.seatRow) * rSc + stir, riderTop = (240 - rb.t) * rSc + stir, riderSeatedH = rb.h * rSc;
    rows.push({ name: u.name, standH: +standH.toFixed(1), riderVsFoot: +(rSc / footSc).toFixed(3), horseLen_over_stand: +(horseLen / standH).toFixed(2), back_over_stand: +(backH / standH).toFixed(2), seat_minus_back: +(seatH - backH).toFixed(1), mountedTop_over_stand: +(Math.max(riderTop, horseTop) / standH).toFixed(2), seated_over_stand: +(riderSeatedH / standH).toFixed(2) });
  });
  return { rows, png: sheet.toDataURL('image/png') };
}, { files, P, H, B, T });
writeFileSync(`${OUT}/contact-${TAG}.png`, Buffer.from(res.png.split(',')[1], 'base64'));
console.table(res.rows);
await br.close();
