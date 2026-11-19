// Steam 商店页 / 库图片素材合成（只出素材，不上传）：marketing/steam/originals/ 里的即梦水墨原图 + 已认可的水墨标题字（tools/logo-wordmark.mjs HALO=1，同 public/assets/ui/title_wordmark.webp）。
// 每种尺寸各用一张单独构图的原图（不是同一张裁来裁去），按焦点裁切铺满；有标题的同时出一份 *_notitle.png。标题字是本地字体排的，不让 AI 画字。
// 尺寸按 Steamworks 文档（2026-11-18 查）：store/assets、assets/standard、assets/libraryassets。
// 用法：node tools/steam-assets.mjs [只出某几张的 id，逗号分隔] → marketing/steam/*.png + marketing/steam/preview_all.png（合集预览）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const O = 'marketing/steam/originals/', OUT = 'marketing/steam/';
// fx / fy：裁切中心（原图比例）；zoom：在「铺满」基础上再放大；title：{ x, y 中心（输出比例）, w 宽（输出比例）}；dark：压暗（0~1，页面背景要不抢眼）
export const ASSETS = [
  { id: 'header_capsule', w: 920, h: 430, src: 'jimeng_wide_1.png', fx: .5, fy: .5, zoom: 1, title: { x: .17, y: .2, w: .3 }, where: '商店 · 页头胶囊（Header Capsule，必需）' },
  { id: 'small_capsule', w: 462, h: 174, src: 'jimeng_bg_4.png', fx: .5, fy: .62, zoom: 1, title: { x: .5, y: .48, w: .66 }, veil: .25, where: '商店 · 小胶囊（Small Capsule，必需；Steam 自动缩出 120×45 / 184×69）' },
  { id: 'main_capsule', w: 1232, h: 706, src: 'jimeng_main_1.png', fx: .5, fy: .5, zoom: 1, title: { x: .21, y: .2, w: .33 }, where: '商店 · 主胶囊（Main Capsule，必需）' },
  { id: 'vertical_capsule', w: 748, h: 896, src: 'jimeng_vertical_2.png', fx: .5, fy: .55, zoom: 1, title: { x: .5, y: .12, w: .56 }, where: '商店 · 竖版胶囊（Vertical Capsule，必需；促销 / 季节页）' },
  { id: 'page_background', w: 1438, h: 810, src: 'jimeng_bg_2.png', fx: .5, fy: .5, zoom: 1, dark: .5, where: '商店 · 页面背景（Page Background，可选；要低调不抢内容，无标题）' },
  { id: 'library_capsule', w: 600, h: 900, src: 'jimeng_vertical_3.png', fx: .5, fy: .55, zoom: 1, title: { x: .5, y: .14, w: .74 }, where: '库 · 库胶囊（Library Capsule，必需；自动缩出 300×450）' },
  { id: 'library_header', w: 920, h: 430, src: 'jimeng_wide_3.png', fx: .62, fy: .45, zoom: 1.22, title: { x: .2, y: .19, w: .31 }, where: '库 · 库页头（Library Header，必需；不传则用商店页头）' },
  { id: 'library_hero', w: 3840, h: 1240, src: 'jimeng_wide_2.png', fx: .5, fy: .4, zoom: 1, where: '库 · 库主视觉（Library Hero，必需；规定不得有文字；中间 860×380 安全区放人物）' },
  { id: 'library_logo', w: 1280, h: 720, logo: true, where: '库 · 库 Logo（Library Logo，必需；透明 PNG，只有标题字）' },
];
const only = (process.argv[2] ?? '').split(',').filter(Boolean);
const url = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const srcs = {}; for (const a of ASSETS) if (a.src && !srcs[a.src]) srcs[a.src] = url(O + a.src);
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const res = await p.evaluate(async ({ assets, srcs, mark, only }) => {
  const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
  const wm = await load(mark);
  // 标题字裁到字迹（含晕光）的外框
  const tc = document.createElement('canvas'); tc.width = wm.width; tc.height = wm.height; const tg = tc.getContext('2d', { willReadFrequently: true }); tg.drawImage(wm, 0, 0);
  const td = tg.getImageData(0, 0, wm.width, wm.height).data; let l = wm.width, r = 0, t = wm.height, bt = 0;
  for (let y = 0; y < wm.height; y++) for (let x = 0; x < wm.width; x++) if (td[(y * wm.width + x) * 4 + 3] > 10) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y; }
  const T = { x: l, y: t, w: r - l + 1, h: bt - t + 1 };
  const out = {};
  for (const a of assets) {
    if (only.length && !only.includes(a.id)) continue;
    const c = document.createElement('canvas'); c.width = a.w; c.height = a.h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    const title = (fill) => { const tw = a.w * fill.w, th = tw * T.h / T.w; g.drawImage(wm, T.x, T.y, T.w, T.h, a.w * fill.x - tw / 2, a.h * fill.y - th / 2, tw, th); };
    if (a.logo) { const s = Math.min(a.w / T.w, a.h / T.h) * .98, tw = T.w * s, th = T.h * s; g.drawImage(wm, T.x, T.y, T.w, T.h, (a.w - tw) / 2, (a.h - th) / 2, tw, th); out[a.id] = { title: c.toDataURL('image/png') }; continue; }
    const im = await load(srcs[a.src]);
    // 铺满：按输出比例在原图里取最大裁框，再按 zoom 缩小，中心对准 fx/fy（夹在图内）
    const k = Math.max(a.w / im.width, a.h / im.height) * (a.zoom ?? 1), cw = a.w / k, ch = a.h / k;
    const cx = Math.min(im.width - cw, Math.max(0, im.width * a.fx - cw / 2)), cy = Math.min(im.height - ch, Math.max(0, im.height * a.fy - ch / 2));
    g.drawImage(im, cx, cy, cw, ch, 0, 0, a.w, a.h);
    if (a.dark) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(${Math.round(255 * (1 - a.dark))},${Math.round(255 * (1 - a.dark))},${Math.round(255 * (1 - a.dark * .9))},1)`; g.fillRect(0, 0, a.w, a.h); g.globalCompositeOperation = 'source-over'; }
    const plain = c.toDataURL('image/png');
    if (!a.title) { out[a.id] = { title: plain }; continue; }
    // 小胶囊：字要几乎占满且清楚——在字后面铺一层很淡的宣纸色柔光（边缘渐隐），压住背后的杂乱笔触
    if (a.veil) { const rg = g.createRadialGradient(a.w * a.title.x, a.h * a.title.y, 0, a.w * a.title.x, a.h * a.title.y, a.w * .5); rg.addColorStop(0, `rgba(240,228,204,${a.veil})`); rg.addColorStop(1, 'rgba(240,228,204,0)'); g.fillStyle = rg; g.fillRect(0, 0, a.w, a.h); }
    title(a.title);
    out[a.id] = { title: c.toDataURL('image/png'), plain };
  }
  // 合集预览：每张缩到同一高度排成几行
  const ids = Object.keys(out), H = 220, gap = 14, maxW = 1800; let x = gap, y = gap, rowH = H, items = [];
  for (const id of ids) { const a = assets.find(z => z.id === id), w = Math.round(H * a.w / a.h); if (x + w > maxW) { x = gap; y += rowH + 40; } items.push({ id, x, y, w }); x += w + gap; }
  const pc = document.createElement('canvas'); pc.width = maxW + gap; pc.height = y + H + 44; const pg = pc.getContext('2d'); pg.fillStyle = '#1b1712'; pg.fillRect(0, 0, pc.width, pc.height);
  for (const it of items) { const a = assets.find(z => z.id === it.id), im = await load(out[it.id].title); if (a.logo) { pg.fillStyle = '#3a3128'; pg.fillRect(it.x, it.y, it.w, H); } pg.drawImage(im, it.x, it.y, it.w, H); pg.fillStyle = '#e8d9b8'; pg.font = '15px sans-serif'; pg.fillText(`${it.id} ${a.w}×${a.h}`, it.x, it.y + H + 20); }
  return { out, preview: ids.length === assets.length ? pc.toDataURL('image/png') : null };
}, { assets: ASSETS, srcs, mark: url(O + 'wordmark_halo_2048.png'), only });
const save = (f, d) => writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
for (const [id, v] of Object.entries(res.out)) { save(OUT + id + '.png', v.title); if (v.plain) save(OUT + id + '_notitle.png', v.plain); console.log('ok', id); }
if (res.preview) { save(OUT + 'preview_all.png', res.preview); console.log('ok preview_all'); }
await b.close();
