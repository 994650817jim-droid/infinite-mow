// 星图战斗内触发特效（样张：背水 / 破阵 / 万人敌，2026-11-21）：ChatGPT 生成的序列帧表（黑底，1536×1024，页面全屏后 1:1 分上 / 下两块截图拼回）→ 亮度转 alpha（透明底）→ 切格、缩放、锚点对齐 → 横条序列帧 PNG + fx.json。
// 输出 public/assets/star-map/fx/：fx_beishui.png（8 帧 × 192×224，2×，显示 96×112，锚点 = 脚底中心 (96,208)/2×）、fx_pozhen.png（8 帧 × 256×256，显示 128×128，锚点 = 中心）、fx_wanrendi.png（6 帧 × 256×144，显示 128×72，锚点 = 椭圆中心 = 主将脚底）。
// 用法：node tools/make-star-fx.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const R = 'public/assets/star-map/originals/raw/', O = 'public/assets/star-map/fx/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync(O, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async (srcs) => {
    const load = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const toAlpha = (cv, floor, peak) => { const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = Math.max(0, Math.min(1, (m - floor) / (peak - floor))); if (m > 0) { a[i] = Math.min(255, a[i] * 255 / m); a[i + 1] = Math.min(255, a[i + 1] * 255 / m); a[i + 2] = Math.min(255, a[i + 2] * 255 / m); } a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); return cv; };
    const stitch = async (top, bot) => { const c = document.createElement('canvas'); c.width = 1536; c.height = 1024; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 1536, 1024); const [a, b2] = await Promise.all([load(top), load(bot)]); g.drawImage(a, 0, 0, 1536, 512, 0, 0, 1536, 512); g.drawImage(b2, 0, 215, 1536, 512, 0, 512, 1536, 512); return c; };
    const out = {};
    // 背水：4×2 格（384×512）；火焰最低处约在格内 y≈470，放到输出 2× 帧 192×224 的 y=208 处；缩放 .4
    { const st = await stitch(srcs.beishui[0], srcs.beishui[1]), W = 192, H = 224, N = 8, strip = document.createElement('canvas'); strip.width = W * N; strip.height = H; const sg = strip.getContext('2d'); sg.imageSmoothingQuality = 'high';
      for (let k = 0; k < N; k++) { const cx = (k % 4) * 384, cy = Math.floor(k / 4) * 512, f = .4; sg.drawImage(st, cx, cy, 384, 512, k * W + (W - 384 * f) / 2, 208 - 470 * f, 384 * f, 512 * f); }
      toAlpha(strip, 10, 170); out.beishui = strip.toDataURL('image/png'); }
    // 破阵：4×2 格，爆点中心在格 (192,256)；取 384×384 方窗缩到 256×256
    { const st = await stitch(srcs.pozhen[0], srcs.pozhen[1]), W = 256, N = 8, strip = document.createElement('canvas'); strip.width = W * N; strip.height = W; const sg = strip.getContext('2d'); sg.imageSmoothingQuality = 'high';
      for (let k = 0; k < N; k++) { const cx = (k % 4) * 384, cy = Math.floor(k / 4) * 512; sg.drawImage(st, cx, cy + 64, 384, 384, k * W, 0, W, W); }
      toAlpha(strip, 10, 190); out.pozhen = strip.toDataURL('image/png'); }
    // 万人敌：2×3 格（768×341），椭圆缩 1/3 → 256×114，居中放进 256×144
    { const st = await stitch(srcs.wanrendi[0], srcs.wanrendi[1]), W = 256, H = 144, N = 6, strip = document.createElement('canvas'); strip.width = W * N; strip.height = H; const sg = strip.getContext('2d'); sg.imageSmoothingQuality = 'high';
      for (let k = 0; k < N; k++) { const cx = (k % 2) * 768, cy = Math.floor(k / 2) * 341; sg.drawImage(st, cx, cy, 768, 341, k * W, (H - 114) / 2, W, 114); }
      toAlpha(strip, 8, 150); out.wanrendi = strip.toDataURL('image/png'); }
    return out;
  }, { beishui: ['beishui', 'beishui'].map((n, i) => rd(R + `fx_${n}_gpt_1_tile${i ? 'Bottom_0_297' : 'Top_0_0'}.jpg`)), pozhen: [0, 1].map(i => rd(R + `fx_pozhen_gpt_1_tile${i ? 'Bottom_0_297' : 'Top_0_0'}.jpg`)), wanrendi: [0, 1].map(i => rd(R + `fx_wanrendi_gpt_1_tile${i ? 'Bottom_0_297' : 'Top_0_0'}.jpg`)) });
  for (const [k, u] of Object.entries(res)) fs.writeFileSync(O + `fx_${k}.png`, Buffer.from(u.split(',')[1], 'base64'));
  const meta = { note: '透明底序列帧横条（2× 图，显示尺寸 = 帧尺寸 / 2）。anchor 为帧内锚点（2× 像素）。',
    beishui: { file: 'fx_beishui.png', frames: 8, frame: [192, 224], display: [96, 112], anchor: [96, 208], anchorMeaning: '主将脚底中心；火焰绕身，中间人形空位不挡人', loop: true, fps: 10, use: '生命 < 40% 时挂在主将身上，depth 在主将之上（火焰在人两侧）或之下均可', blend: 'ADD 可再亮一档，NORMAL 即可' },
    pozhen: { file: 'fx_pozhen.png', frames: 8, frame: [256, 256], display: [128, 128], anchor: [128, 128], anchorMeaning: '爆点中心 = 命中点', loop: false, fps: 16, use: '第 5 下重击命中点播一次，播完销毁', blend: 'NORMAL' },
    wanrendi: { file: 'fx_wanrendi.png', frames: 6, frame: [256, 144], display: [128, 72], anchor: [128, 72], anchorMeaning: '椭圆中心 = 主将脚底；贴地，depth 在主将之下', loop: true, fps: 6, use: '万人敌点亮后常驻主将脚下，缓慢流转', blend: 'NORMAL' } };
  fs.writeFileSync(O + 'fx.json', JSON.stringify(meta, null, 2)); console.log('ok');
} finally { await b.close(); }
