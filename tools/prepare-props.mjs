// v2 道具图集整理：ChatGPT 洋红底网格 → 与旧图集同布局（同格尺寸、同帧序）的透明图集。
// 每个新物件按“旧图同一帧的不透明包围盒”放置：等比缩放塞进旧包围盒、底边对齐、水平居中，
// 所以碰撞框 / 显示尺寸 / 接地阴影都沿用旧数据，不用改代码。
// 步骤：硬抠洋红（min(R,B)−G）+ 去洋红溢色 → 去孤立噪点 → 按 COLS×ROWS 取每格内容包围盒 → 对应旧帧包围盒 → 输出。
// 用法：SRC=…/walk_props_a1.png COLS=6 ROWS=3 OLD=public/assets/processed/yellow/camp-props.png OLDCOLS=6 OLDCELL=128 START=0 OUT=public/assets/props-v2/camp-props.png node tools/prepare-props.mjs
// 可选：UNMIX=.8（半透明暖色火焰 / 尘雾：按暖色约束反解不透明度，代替硬抠）、BASE（在已有输出上继续写，分多张源图拼一张图集时用）、COUNT（只取前 N 格）、SKIP=5,11（跳过的源格，不占输出位）、
// UNIFORM=first（同上，但只按第 1 帧定变换：碎裂类后面越摊越大的序列帧用，和完好状态同尺寸）、UNIFORM=1（序列帧：所有帧共用一个变换，按全部源帧并集 → 全部旧帧并集来放，动画不抖）、NOOLD=1（不参考旧帧包围盒，一律按 FILL / BOTTOM 放）、FILL（旧帧为空时占格比例，默认 .82）、BOTTOM（此时底边在格高的比例，默认 .96）、
// SCALE（在旧包围盒基础上整体缩放，默认 1）、OLDROWS（旧图行数，默认按图高算）、KEYHARD / KEYSOFT（抠图阈值，默认 110 / 40）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const E = process.env, { SRC, OUT, OLD } = E;
if (!SRC || !OUT || !OLD) { console.error('需要 SRC / OUT / OLD'); process.exit(2); }
const opt = { COLS: +(E.COLS ?? 6), ROWS: +(E.ROWS ?? 1), OLDCOLS: +(E.OLDCOLS ?? 6), OLDCELL: +(E.OLDCELL ?? 128), START: +(E.START ?? 0), COUNT: E.COUNT ? +E.COUNT : 0, SKIP: (E.SKIP ?? '').split(',').filter(Boolean).map(Number), UNIFORM: E.UNIFORM === '1' || E.UNIFORM === 'first', FIRST: E.UNIFORM === 'first', FILL: +(E.FILL ?? .82), BOTTOM: +(E.BOTTOM ?? .96), NOOLD: E.NOOLD === '1', SCALE: +(E.SCALE ?? 1), KEYHARD: +(E.KEYHARD ?? 110), KEYSOFT: +(E.KEYSOFT ?? 40), UNMIX: E.UNMIX ? +E.UNMIX : 0, FLOOR: +(E.FLOOR ?? .06), OLDROWS: E.OLDROWS ? +E.OLDROWS : 0 };
const b64 = f => readFileSync(f).toString('base64');
const base = E.BASE && existsSync(E.BASE) ? b64(E.BASE) : null;
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, old, base, o]) => {
  const load = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i; };
  const img = await load(src), oldImg = await load(old);
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  const samp = [[0, 0], [W - 24, 0], [0, H - 24], [W - 24, H - 24]].flatMap(([x0, y0]) => { const r = []; for (let y = y0; y < y0 + 24; y += 3) for (let x = x0; x < x0 + 24; x += 3) { const i = (y * W + x) * 4; r.push([d[i], d[i + 1], d[i + 2]]); } return r; });
  const med = k => samp.map(v => v[k]).sort((a, b) => a - b)[samp.length >> 1], K = [med(0), med(1), med(2)], UNMIX = o.UNMIX, FLOOR = o.FLOOR;
  for (let i = 0; i < d.length; i += 4) {
    if (UNMIX) { // UNMIX=w（半透明暖色：火焰外缘、尘雾）：按“还原色不偏洋红（蓝 ≤ w×绿）且不偏绿（红 ≥ 绿）”反解每个像素的不透明度与原色。
      const PR=d[i],PG=d[i+1],PB=d[i+2],[KR,KG,KB]=K,w=UNMIX;
      let a=Math.min((w*(PG-KG)+(KB-PB))/(KB-w*KG),1);
      a=Math.max(a,((PG-KG)+(KR-PR))/(KR-KG),(KR-PR)/KR,(PG-KG)/(255-KG),(KB-PB)/KB,0);
      if(a>.9)a=1; if(a<FLOOR){d[i+3]=0;continue;}
      d[i]=Math.max(0,Math.min(255,KR+(PR-KR)/a));d[i+1]=Math.max(0,Math.min(255,KG+(PG-KG)/a));d[i+2]=Math.max(0,Math.min(255,KB+(PB-KB)/a));d[i+3]=Math.round(a*255); continue; }
    const k = Math.min(d[i], d[i + 2]) - d[i + 1];
    if (k >= o.KEYHARD) { d[i + 3] = 0; continue; }
    if (k > o.KEYSOFT) { d[i + 3] = Math.round(255 * (1 - (k - o.KEYSOFT) / (o.KEYHARD - o.KEYSOFT))); const sp = k * .85; d[i] = Math.max(0, d[i] - sp); d[i + 2] = Math.max(0, d[i + 2] - sp); }
  }
  // 去孤立噪点：周围 5×5 不透明像素少于 4 个的清掉
  const A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = d[i * 4 + 3] > 60 ? 1 : 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; if (!A[i]) continue; let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) n += A[i + dy * W + dx]; if (n < 4) d[i * 4 + 3] = 0; }
  g.putImageData(id, 0, 0);
  const bbox = (data, w, x0, y0, cw, ch, th = 40) => { let l = 1e9, t = 1e9, r = -1, bt = -1; for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) if (data[(y * w + x) * 4 + 3] > th) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y; } return r < 0 ? null : { x: l, y: t, w: r - l + 1, h: bt - t + 1 }; };
  // 旧图
  const OC = o.OLDCELL, oc = document.createElement('canvas'); oc.width = oldImg.width; oc.height = oldImg.height; const og = oc.getContext('2d'); og.drawImage(oldImg, 0, 0); const od = og.getImageData(0, 0, oc.width, oc.height).data;
  const oldRows = o.OLDROWS || Math.round(oldImg.height / OC);
  const out = document.createElement('canvas'); out.width = o.OLDCOLS * OC; out.height = oldRows * OC; const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  if (base) x.drawImage(await load(base), 0, 0);
  // 源格包围盒只取最宽的一段连续列（间隙 ≤ 8 像素算连续）：邻格物件越界伸进来的细条不计入
  const mainBox = (x0, y0, ww, hh, d = id.data, W = c.width) => { const col = []; for (let x = x0; x < x0 + ww; x++) { let n = 0; for (let y = y0; y < y0 + hh; y++) if (d[(y * W + x) * 4 + 3] > 40) n++; col.push(n); }
    let best = null, st = -1, gap = 0, mass = 0; const close = e => { if (st >= 0 && (!best || mass > best.mass)) best = { a: st, b: e, mass }; };
    col.forEach((n, i) => { if (n > 0) { if (st < 0) { st = i; mass = 0; } gap = 0; mass += n; } else if (st >= 0 && ++gap > 8) { close(i - gap); st = -1; } }); close(col.length - 1 - gap);
    return best ? bbox(d, W, x0 + best.a, y0, best.b - best.a + 1, hh) : null; };
  const cw = W / o.COLS, ch = H / o.ROWS, cells = [];
  for (let r = 0; r < o.ROWS; r++) for (let col = 0; col < o.COLS; col++) { const idx = r * o.COLS + col; if (o.SKIP.includes(idx)) continue; const x0 = Math.round(col * cw + 2), y0 = Math.round(r * ch + 2), ww = Math.round(cw - 4), hh = Math.round(ch - 4); cells.push({ idx, box: mainBox(x0, y0, ww, hh) }); }
  const use = o.COUNT ? cells.slice(0, o.COUNT) : cells, log = [];
  const oldBox = f => { if (o.NOOLD) return null; const ox = (f % o.OLDCOLS) * OC, oy = Math.floor(f / o.OLDCOLS) * OC, bb = mainBox(ox, oy, OC, OC, od, oc.width); return bb && { ...bb, x: bb.x - ox, y: bb.y - oy }; };
  let uni = null;
  if (o.UNIFORM) {
    // 并集：源帧各自相对格左上角的包围盒取并；旧帧同理
    const su = (o.FIRST ? use.slice(0, 1) : use).filter(u => u.box).map(u => { const col = u.idx % o.COLS, r = Math.floor(u.idx / o.COLS); return { x: u.box.x - col * cw, y: u.box.y - r * ch, w: u.box.w, h: u.box.h }; });
    const ou = (o.FIRST ? use.slice(0, 1) : use).map((_, i) => oldBox(o.START + i)).filter(Boolean);
    const un = a => { const l = Math.min(...a.map(q => q.x)), t = Math.min(...a.map(q => q.y)), r = Math.max(...a.map(q => q.x + q.w)), bt = Math.max(...a.map(q => q.y + q.h)); return { x: l, y: t, w: r - l, h: bt - t }; };
    uni = { s: un(su), o: ou.length ? un(ou) : null };
  }
  use.forEach((u, i) => {
    const f = o.START + i, dx0 = (f % o.OLDCOLS) * OC, dy0 = Math.floor(f / o.OLDCOLS) * OC;
    x.clearRect(dx0, dy0, OC, OC);
    if (!u.box) { log.push(`${f}:空`); return; }
    const col = u.idx % o.COLS, r = Math.floor(u.idx / o.COLS);
    let s, ob;
    if (uni) { s = uni.s; ob = uni.o; } else { s = { x: u.box.x - col * cw, y: u.box.y - r * ch, w: u.box.w, h: u.box.h }; ob = oldBox(f); }
    if (!ob) { const side = OC * o.FILL; ob = { x: (OC - side) / 2, y: OC * o.BOTTOM - side, w: side, h: side }; }
    const k = Math.min(ob.w / s.w, ob.h / s.h) * o.SCALE, w = s.w * k, h = s.h * k;
    const tx = dx0 + ob.x + ob.w / 2 - w / 2, ty = dy0 + ob.y + ob.h - h;
    x.save(); x.beginPath(); x.rect(dx0, dy0, OC, OC); x.clip();
    // 序列帧（UNIFORM）：整格按同一变换画，后面摊开变大的帧不会被第 1 帧的包围盒裁掉
    if (uni) x.drawImage(c, col * cw, r * ch, cw, ch, tx - s.x * k, ty - s.y * k, cw * k, ch * k);
    else x.drawImage(c, col * cw + s.x, r * ch + s.y, s.w, s.h, tx, ty, w, h);
    x.restore();
    log.push(`${f}:${Math.round(w)}×${Math.round(h)}`);
  });
  return { url: out.toDataURL('image/png'), size: [W, H], out: [out.width, out.height], log };
}, [b64(SRC), b64(OLD), base, opt]);
writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`${OUT}  源 ${res.size.join('×')} → ${res.out.join('×')}\n${res.log.join('  ')}`);
await b.close();
