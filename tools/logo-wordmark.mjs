// 标题字「三国 / 乱世千军」本地排字（AI 画不准汉字，字由本地字体排）：游戏标题字体 IMWarTitle（public/assets/fonts/war-title.woff2）。
// 用法：[HALO=1] [BG=开始界面背景图] [BASE=AI 装饰底.png] node tools/logo-wordmark.mjs <out.png> [style=inkwash|ink]
//   inkwash（默认，用户 11-17 定水墨风）：浓淡变化（大尺度墨色噪声）+ 飞白（顺笔向的干笔丝，边缘多、中间少）+ 边缘晕墨 + 朱红方印「乱世千军」（印边略残）。
//   ink：平涂浓墨 + 微晕（早期草稿）。
//   HALO=1：字后垫一层米色宣纸晕光，放在深色开始界面上也看得清。
//   BASE：先画 AI 的水墨装饰底（透明 PNG，按画布等比放入）再写字。
//   BG：输出 1920×1080 的「开始界面合成预览」：背景图铺满并压暗一点，标题字放在上方居中。
//   不给 BG 时输出 2048×1024 透明 PNG。
//   ICON=字：改出 1024 方形应用图标——宣纸底（PAPER=0 关掉）+ 单个大字 + 右下竖印「乱世」。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [out, style = 'inkwash'] = process.argv.slice(2), env = process.env;
const url = (f, t) => f ? `data:${t};base64,` + readFileSync(f).toString('base64') : null;
const args = { icon: env.ICON || '', paper: env.PAPER !== '0', font: url('public/assets/fonts/war-title.woff2', 'font/woff2'), style, halo: env.HALO === '1', base: url(env.BASE, 'image/png'), bg: url(env.BG, 'image/webp') };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ({ icon, paper, font, style, halo, base, bg }) => {
    const ff = new FontFace('IMWarTitle', `url(${font})`); await ff.load(); document.fonts.add(ff);
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const W = icon ? 1024 : 2048, H = 1024, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d', { willReadFrequently: true })]; };
    // —— 值噪声（可重复）——
    const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t);
      const a = hash(xi, yi), b2 = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1), u = s(xf), v = s(yf);
      return a + (b2 - a) * u + (c2 - a) * v + (a - b2 - c2 + d) * u * v; };
    const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.1, y * 2.1) * .3 + vnoise(x * 4.3, y * 4.3) * .15;
    // —— 排字：先在遮罩层写黑字 ——
    const [mc, mg] = mk();
    const layout = [];
    const place = (txt, size, cx, cy, spacing) => {
      mg.font = `${size}px IMWarTitle`; const chars = [...txt], w = chars.map(ch => mg.measureText(ch).width), total = w.reduce((a, b2) => a + b2, 0) + spacing * (chars.length - 1);
      let x = cx - total / 2; chars.forEach((ch, i) => { layout.push({ ch, size, x: x + w[i] / 2, y: cy }); x += w[i] + spacing; }); return total;
    };
    const big = icon ? 760 : 300, small = 150, cx = W / 2;
    if (!icon) place('三国', small, cx, H * .27, small * .3);
    const tw = icon ? place(icon, big, cx - 30, H * .5, 0) : place('乱世千军', big, cx - 60, H * .6, big * .02);
    mg.textBaseline = 'middle'; mg.textAlign = 'center'; mg.fillStyle = '#000';
    for (const L of layout) { mg.font = `${L.size}px IMWarTitle`; mg.fillText(L.ch, L.x, L.y); }
    const [oc, og] = mk();
    if (icon && paper) { // 宣纸底：米色 + 纤维噪声 + 四周压暗
      const pd = og.createImageData(W, H), q = pd.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, n = fbm(x / 60, y / 60) * .6 + vnoise(x / 3, y / 9) * .25 + vnoise(x / 9, y / 2.5) * .15, d = Math.hypot(x - W / 2, y - H / 2) / (W * .72), k = 1 - Math.max(0, d - .45) * .55 - (n - .5) * .09;
        q[i] = 236 * k; q[i + 1] = 222 * k; q[i + 2] = 192 * k; q[i + 3] = 255; }
      og.putImageData(pd, 0, 0); }
    if (base) { const im = await load(base); const s = Math.min(W / im.width, H / im.height); og.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s); }
    if (halo) { og.save(); og.filter = 'blur(38px)'; og.globalAlpha = .9; og.drawImage(mc, 0, 0); og.globalCompositeOperation = 'source-in'; og.fillStyle = '#efe3c8'; og.fillRect(0, 0, W, H); og.restore();
      const [hc, hg] = mk(); hg.filter = 'blur(38px)'; hg.drawImage(mc, 0, 0); hg.filter = 'blur(14px)'; hg.drawImage(mc, 0, 0); hg.globalCompositeOperation = 'source-in'; hg.fillStyle = '#efe3c8'; hg.fillRect(0, 0, W, H);
      og.globalAlpha = .92; og.drawImage(hc, 0, 0); og.drawImage(hc, 0, 0); og.globalAlpha = 1; }
    if (style === 'ink') {
      og.save(); og.shadowColor = 'rgba(20,14,10,.45)'; og.shadowBlur = 15; og.drawImage(mc, 0, 0); og.restore();
    } else {
      // 晕墨：模糊过的淡墨垫在字下
      const [bc, bg2] = mk(); bg2.filter = 'blur(7px)'; bg2.drawImage(mc, 0, 0); bg2.filter = 'blur(2px)'; bg2.drawImage(mc, 0, 0);
      const bd = bg2.getImageData(0, 0, W, H), m = mg.getImageData(0, 0, W, H), md = m.data, out = og.createImageData(W, H), od = out.data, bdd = bd.data;
      // 笔向：大模糊遮罩的梯度是笔画法线，切线 = 笔向；飞白丝沿笔向拉长
      const [dc, dg] = mk(); dg.filter = 'blur(10px)'; dg.drawImage(mc, 0, 0); const dd = dg.getImageData(0, 0, W, H).data;
      const A2 = (x, y) => dd[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4 + 3];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, a0 = md[i + 3] / 255, blurA = bdd[i + 3] / 255;
        let a = 0, ink = 0;
        if (a0 > 0) {
          // 浓淡：大尺度噪声 .62~1
          const dens = (icon ? .7 : .45) + (icon ? .3 : .55) * Math.min(1, Math.max(0, (fbm(x / 120, y / 120) - .25) * 1.9));
          // 飞白：沿笔向拉长的细丝噪声；「干笔区」（大尺度噪声高处，像笔锋收尾墨尽）和笔画边缘最容易出白
          const gx = A2(x + 4, y) - A2(x - 4, y), gy = A2(x, y + 4) - A2(x, y - 4), gm = Math.hypot(gx, gy);
          const tx = gm > 6 ? -gy / gm : .96, ty = gm > 6 ? gx / gm : -.28; // 切线（中间平坦处用默认斜向）
          const u = x * tx + y * ty, v = -x * ty + y * tx, streak = vnoise(u / 55, v / 1.6) * .65 + vnoise(u / 20, v / 1) * .35;
          const zone = Math.max(0, (fbm(x / 110 + 7, y / 110 + 3) - (icon ? .64 : .56)) * 3.4), edge = 1 - Math.min(1, blurA * 1.15);
          const dry = zone > 0 ? streak - .66 + zone * .34 + edge * .18 : streak - .9 + edge * .25;
          a = a0 * (dry > 0 ? Math.max(0, 1 - dry * 5) : 1);
          ink = dens;
        }
        const bleed = Math.max(0, blurA - a0) * .42;
        const A = Math.min(1, a + bleed * (1 - a));
        if (A <= 0) continue;
        // 浓处近黑、淡处偏暖灰（宿墨色）
        const t = a > 0 ? ink : .35, r = 14 + (1 - t) * 110, gg = 12 + (1 - t) * 100, bb = 10 + (1 - t) * 84;
        od[i] = r; od[i + 1] = gg; od[i + 2] = bb; od[i + 3] = Math.round(A * 255 * (a > 0 ? (.7 + .3 * ink) : 1));
      }
      const [tc, tg] = mk(); tg.putImageData(out, 0, 0); og.drawImage(tc, 0, 0);
    }
    // —— 朱红方印「乱世千军」（右起竖读：右列乱世、左列千军），印边略残 ——
    const sz = icon ? 230 : 140, sx = icon ? W - sz * .78 : cx - 60 + tw / 2 + sz * .62, sy = icon ? H - sz * .78 : H * .6 + big * .2;
    const [sc, sg] = mk(); sg.translate(sx, sy); sg.rotate(-.06);
    sg.fillStyle = '#b3241c'; sg.beginPath(); sg.roundRect(-sz / 2, -sz / 2, sz, sz, 10); sg.fill();
    sg.globalCompositeOperation = 'destination-out'; sg.strokeStyle = '#000'; sg.lineWidth = 6; sg.strokeRect(-sz / 2 + 12, -sz / 2 + 12, sz - 24, sz - 24);
    sg.font = `${sz * .36}px IMWarTitle`; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#000';
    if (icon) { sg.font = `${sz * .5}px IMWarTitle`; sg.fillText('乱', 0, -sz * .2); sg.fillText('世', 0, sz * .24); } else { sg.fillText('千', -sz * .19, -sz * .16); sg.fillText('军', -sz * .19, sz * .2); sg.fillText('乱', sz * .19, -sz * .16); sg.fillText('世', sz * .19, sz * .2); }
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over';
    const sd = sg.getImageData(0, 0, W, H), s2 = sd.data;
    for (let y = Math.floor(sy - sz); y < sy + sz; y++) for (let x = Math.floor(sx - sz); x < sx + sz; x++) { const i = (y * W + x) * 4; if (s2[i + 3] && vnoise(x / 3.5, y / 3.5) * .6 + vnoise(x / 11, y / 11) * .4 > .74) s2[i + 3] = 0; }
    sg.putImageData(sd, 0, 0); og.globalAlpha = .93; og.drawImage(sc, 0, 0); og.globalAlpha = 1;
    if (!bg) return oc.toDataURL('image/png');
    // —— 开始界面合成预览 ——
    const PW = 1920, PH = 1080, pc = document.createElement('canvas'); pc.width = PW; pc.height = PH; const pg = pc.getContext('2d');
    const im = await load(bg), s = Math.max(PW / im.width, PH / im.height); pg.drawImage(im, (PW - im.width * s) / 2, (PH - im.height * s) / 2, im.width * s, im.height * s);
    pg.fillStyle = 'rgba(10,8,6,.35)'; pg.fillRect(0, 0, PW, PH);
    pg.drawImage(oc, (PW - 1300) / 2, 30, 1300, 650);
    return pc.toDataURL('image/png');
  }, args);
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out, style, args.halo ? '晕光' : '', env.BASE ? '叠底 ' + env.BASE : '', env.BG ? '开始界面预览' : '');
} finally { await b.close(); }
