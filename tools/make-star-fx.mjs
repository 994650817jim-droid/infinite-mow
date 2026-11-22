// 星图战斗内触发特效（2026-11-21）：ChatGPT 生成的序列帧表（黑底，1536×1024，页面全屏后 1:1 分上 / 下两块截图拼回）→ 亮度转 alpha（透明底）→ 切格、缩放、锚点对齐
// → 横条序列帧 PNG + fx.json。样张 3 个（背水 / 破阵 / 万人敌 v1）+ 第二批（万人敌 v2 / 号令光环 / 三军统帅 / 连珠 / 游刃 / 火烧连营）。
// 全部 2× 图，显示尺寸 = 帧尺寸 / 2。用法：node tools/make-star-fx.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const R = 'public/assets/star-map/originals/raw/', O = 'public/assets/star-map/fx/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync(O, { recursive: true });
// 每个特效：src = 原图前缀（_tileTop_0_0 / _tileBottom_0_297）；grid = 列 × 行；cell = 格宽 × 格高；win = 从每格取的窗口 [x,y,w,h]；frame = 输出帧 [w,h]；place = 窗口在帧里的位置 [x,y,w,h]；alpha = [floor, peak]
const JOBS = {
  beishui:  { src: 'fx_beishui_gpt_1', grid: [4, 2], cell: [384, 512], win: [0, 0, 384, 512], frame: [192, 224], place: [19, 20, 154, 205], alpha: [10, 170] },
  pozhen:   { src: 'fx_pozhen_gpt_1', grid: [4, 2], cell: [384, 512], win: [0, 64, 384, 384], frame: [256, 256], place: [0, 0, 256, 256], alpha: [10, 190] },
  wanrendi: { src: 'fx_wanrendi_gpt_2', grid: [2, 3], cell: [768, 341], win: [0, 0, 768, 341], frame: [320, 180], place: [0, 19, 320, 142], alpha: [8, 130] },
  haoling:  { src: 'fx_haoling_gpt_1', grid: [1, 1], cell: [1536, 1024], win: [20, 120, 1496, 745], frame: [912, 454], place: [0, 0, 912, 454], alpha: [8, 120] },
  sanjun:   { src: 'fx_sanjun_gpt_1', grid: [3, 2], cell: [512, 512], win: [90, 30, 420, 440], frame: [224, 240], place: [0, 0, 224, 235], alpha: [8, 150] },
  lianzhu:  { src: 'fx_lianzhu_gpt_1', grid: [4, 2], cell: [384, 512], win: [0, 64, 384, 384], frame: [224, 224], place: [0, 0, 224, 224], alpha: [8, 170] },
  youren:   { src: 'fx_youren_gpt_1', grid: [3, 2], cell: [512, 512], win: [16, 16, 480, 480], frame: [192, 192], place: [0, 0, 192, 192], alpha: [8, 170] },
  huoshao:  { src: 'fx_huoshao_gpt_1', grid: [4, 2], cell: [384, 512], win: [0, 64, 384, 384], frame: [320, 320], place: [0, 0, 320, 320], alpha: [10, 170] },
};
const META = {
  note: '透明底序列帧横条（2× 图，显示尺寸 = 帧尺寸 / 2）。anchor 为帧内锚点（2× 像素）。fps 为建议播放帧率。',
  beishui: { name: '背水', file: 'fx_beishui.png', frames: 8, frame: [192, 224], display: [96, 112], anchor: [96, 208], anchorMeaning: '主将脚底中心；火焰绕身，中间人形空位不挡人', loop: true, fps: 10, use: '生命 < 40% 时挂在主将身上' },
  pozhen: { name: '破阵', file: 'fx_pozhen.png', frames: 8, frame: [256, 256], display: [128, 128], anchor: [128, 128], anchorMeaning: '爆点中心 = 命中点', loop: false, fps: 16, use: '第 5 下重击命中点播一次，播完销毁' },
  wanrendi: { name: '万人敌（v2，加粗提亮放大）', file: 'fx_wanrendi.png', frames: 6, frame: [320, 180], display: [160, 90], anchor: [160, 90], anchorMeaning: '椭圆中心 = 主将脚底；贴地，depth 在主将之下', loop: true, fps: 6, use: '万人敌点亮后常驻主将脚下，纹路缓慢顺时针转动' },
  haoling: { name: '号令 / 身先士卒 范围光环', file: 'fx_haoling.png', frames: 1, frame: [912, 454], display: [456, 227], anchor: [456, 227], anchorMeaning: '椭圆中心 = 主将脚底；环宽 ≈ 440（半径 ≈ 220）', loop: false, fps: 0, use: '单张静图，很淡：建议 alpha 0.35；可整张缓慢转 / 呼吸（不要闪），贴地，depth 在主将之下' },
  sanjun: { name: '三军统帅 帅旗虚影', file: 'fx_sanjun.png', frames: 6, frame: [224, 240], display: [112, 120], anchor: [24, 229], anchorMeaning: '旗杆底部；放在主将身后（左后方），旗面朝右飘；半透明', loop: true, fps: 6, use: '三军统帅点亮后常驻，depth 在主将之下，建议 alpha 0.8' },
  lianzhu: { name: '连珠 双环回响', file: 'fx_lianzhu.png', frames: 8, frame: [224, 224], display: [112, 112], anchor: [112, 112], anchorMeaning: '圆心 = 命中点', loop: false, fps: 14, use: '法术伤害翻倍时命中点播一次' },
  youren: { name: '游刃 风痕残影', file: 'fx_youren.png', frames: 6, frame: [192, 192], display: [96, 96], anchor: [96, 96], anchorMeaning: '帧中心 = 主将身侧（风痕朝左掠过，主将在右侧；向右闪避时水平翻转）', loop: false, fps: 14, use: '闪避成功时播一次' },
  huoshao: { name: '火烧连营 贴地火环', file: 'fx_huoshao.png', frames: 8, frame: [320, 320], display: [160, 160], anchor: [160, 160], anchorMeaning: '环心 = 被击杀敌人脚底，贴地', loop: false, fps: 12, use: '敌人被法术击杀后原地播一次；depth 在单位之下' },
};
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([jobs, srcs]) => {
    const load = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const toAlpha = (cv, floor, peak) => { const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = Math.max(0, Math.min(1, (m - floor) / (peak - floor))); if (m > 0) { a[i] = Math.min(255, a[i] * 255 / m); a[i + 1] = Math.min(255, a[i + 1] * 255 / m); a[i + 2] = Math.min(255, a[i + 2] * 255 / m); } a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); return cv; };
    const out = {};
    for (const [k, j] of Object.entries(jobs)) {
      const [a, b2] = await Promise.all(srcs[k].map(load)); const st = document.createElement('canvas'); st.width = 1536; st.height = 1024; const sg = st.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, 1536, 1024); sg.drawImage(a, 0, 0, 1536, 512, 0, 0, 1536, 512); sg.drawImage(b2, 0, 215, 1536, 512, 0, 512, 1536, 512);
      const N = j.grid[0] * j.grid[1], [W, H] = j.frame, strip = document.createElement('canvas'); strip.width = W * N; strip.height = H; const g = strip.getContext('2d'); g.imageSmoothingQuality = 'high';
      for (let i = 0; i < N; i++) { const cx = (i % j.grid[0]) * j.cell[0], cy = Math.floor(i / j.grid[0]) * j.cell[1]; g.drawImage(st, cx + j.win[0], cy + j.win[1], j.win[2], j.win[3], i * W + j.place[0], j.place[1], j.place[2], j.place[3]); }
      toAlpha(strip, j.alpha[0], j.alpha[1]); out[k] = strip.toDataURL('image/png');
    }
    return out;
  }, [JOBS, Object.fromEntries(Object.entries(JOBS).map(([k, j]) => [k, [rd(R + j.src + '_tileTop_0_0.jpg'), rd(R + j.src + '_tileBottom_0_297.jpg')]]))]);
  for (const [k, u] of Object.entries(res)) fs.writeFileSync(O + `fx_${k}.png`, Buffer.from(u.split(',')[1], 'base64'));
  fs.writeFileSync(O + 'fx.json', JSON.stringify(META, null, 2)); console.log('ok', Object.keys(res).join(','));
} finally { await b.close(); }
