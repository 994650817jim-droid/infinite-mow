// 兵种胸像立绘导入：public/assets/troop-portraits/originals/<kind>_portrait_original.png（ChatGPT 生成，原图不改动）
// → 去底（四角为纯色底时从边缘泛洪抠掉）→ 按不透明区域裁边 → 方形留白 → <kind>_portrait.png（512）+ <kind>_portrait.webp（256）
// → 写 manifest.json（headY：头部中心在输出图中的高度比例，按不透明区域顶部 + 头部估算）。
// 用法：开发服务器 5173 运行时 node tools/prepare-troop-portraits.mjs
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const DIR = 'public/assets/troop-portraits', KINDS = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
const found = KINDS.filter(k => existsSync(`${DIR}/originals/${k}_portrait_original.png`));
if (!found.length) { console.log('originals/ 下没有 <kind>_portrait_original.png，未做任何改动。'); process.exit(0); }
const b = await chromium.launch({ channel: 'chrome', headless: true });
const portraits = [];
try {
  const p = await b.newPage(); await p.goto(process.env.BASE ?? 'http://127.0.0.1:5173/');
  for (const kind of found) {
    const src = 'data:image/png;base64,' + readFileSync(`${DIR}/originals/${kind}_portrait_original.png`).toString('base64');
    const r = await p.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode();
      const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, W, H), d = px.data, at = (x, y) => (y * W + x) * 4;
      // 去底：四角都不透明且颜色相近 → 从边缘泛洪抠掉相近色
      const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => at(x, y));
      const opaque = corners.every(i => d[i + 3] > 240), ref = corners[0];
      const near = (i, tol) => Math.abs(d[i] - d[ref]) + Math.abs(d[i + 1] - d[ref + 1]) + Math.abs(d[i + 2] - d[ref + 2]) < tol;
      let keyed = false;
      if (opaque && corners.every(i => near(i, 40))) {
        keyed = true; const seen = new Uint8Array(W * H), stack = [];
        for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
        while (stack.length) { const j = stack.pop(); if (seen[j]) continue; seen[j] = 1; const i = j * 4; if (!near(i, 60)) continue; d[i + 3] = 0;
          const x = j % W, y = (j / W) | 0; if (x > 0) stack.push(j - 1); if (x < W - 1) stack.push(j + 1); if (y > 0) stack.push(j - W); if (y < H - 1) stack.push(j + W); }
        // 洋红 / 绿幕这类“人物里不会出现”的底色：被弓弦、手臂圈住的封闭空隙泛洪进不去，全图再抠一遍
        const r0 = d[ref], g0 = d[ref + 1], b0 = d[ref + 2], chroma = (r0 > 200 && b0 > 200 && g0 < 80) || (g0 > 200 && r0 < 80 && b0 < 80);
        if (chroma) for (let i = 0; i < d.length; i += 4) if (d[i + 3] && near(i, 90)) d[i + 3] = 0;
        g.putImageData(px, 0, 0);
      }
      // 不透明区域包围盒
      let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[at(x, y) + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 <= x0) return { error: '图中没有不透明内容' };
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.round(Math.max(bw, bh) * 1.12), ox = (side - bw) / 2, oy = (side - bh) / 2;
      const out = size => { const o = document.createElement('canvas'); o.width = o.height = size; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; const k = size / side; og.drawImage(c, x0, y0, bw, bh, ox * k, oy * k, bw * k, bh * k); return o; };
      // 头部中心估计：不透明区域顶部往下约 18% 的内容高度（胸像构图）
      const headY = (oy + Math.min(bh, bw) * .2) / side;
      return { keyed, alphaOk: !opaque || keyed, size: [W, H], png: out(512).toDataURL('image/png'), webp: out(256).toDataURL('image/webp', .9), headY: Math.round(headY * 1000) / 1000 };
    }, src);
    if (r.error) { console.log('SKIP', kind, r.error); continue; }
    writeFileSync(`${DIR}/${kind}_portrait.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    writeFileSync(`${DIR}/${kind}_portrait.webp`, Buffer.from(r.webp.split(',')[1], 'base64'));
    portraits.push({ kind, file: `${kind}_portrait.webp`, png: `${kind}_portrait.png`, headY: r.headY, source: `originals/${kind}_portrait_original.png`, keyedBackground: r.keyed, date: new Date().toISOString().slice(0, 10) });
    console.log('OK', kind, JSON.stringify({ size: r.size, keyed: r.keyed, headY: r.headY }));
  }
} finally { await b.close(); }
const manifestPath = `${DIR}/manifest.json`, prev = JSON.parse(readFileSync(manifestPath, 'utf8'));
const merged = [...(prev.portraits ?? []).filter(x => !portraits.some(p => p.kind === x.kind)), ...portraits].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
writeFileSync(manifestPath, JSON.stringify({ ...prev, portraits: merged }, null, 2) + '\n');
console.log('manifest:', merged.map(x => x.kind).join(', '));
