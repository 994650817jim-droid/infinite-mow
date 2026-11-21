// 守城 v2 · 总制作人全场走查路线（walk1 那 18 个点位）重拍：预览入口，主将挪到每个点位截图 → assets/review/defense-v2/walk2/*.jpg
// 每个点位断言：画布内不露底色（地面盖满镜头 + 镜头在场地 + 边带以内 + 截屏里没有整列近黑）；走道两端外 / 城垛上的点位要被夹回走道；
// 另列出城里立着的布景（查「城里插着敌方的旗」）、开打第一帧城墙已建好（走查 G）。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2-walk2.mjs [窗口宽 窗口高]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', VW = +(process.argv[2] ?? 960), VH = +(process.argv[3] ?? 540), OUT = 'assets/review/defense-v2/walk2' + (VW !== 960 || VH !== 540 ? '-' + VW + 'x' + VH : '') + (process.env.HD ? '-hd' + process.env.HD : '');
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: VW, height: VH } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_defense_v2_guide_v1', JSON.stringify(['start', 'ladder', 'ram', 'sortie', 'rest', 'gate'])); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&defenseV2=1&defensePreview=1&layout=desktop&story=off' + (process.env.HD ? '&hd=' + process.env.HD : ''), { timeout: 180000 });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.defenseV2; }, null, { timeout: 180000 });
  const first = await ev(() => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = true; return { built: s.defenseV2.stats.built, el: +s.elapsed.toFixed(2) }; });
  ck('走查 G：开打第一帧城墙已建好（场地图在 preload 里先载）', first.built, first);
  const unblock = () => ev(() => { const s = window.__S; for (let i = 0; i < 6 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.setMode('none'); else if (s.mode === 'branch') s.chooseBranch?.(1); else if (['story', 'attributes', 'bossloot'].includes(s.mode)) s.setMode('none'); else break; } });
  await wait(2500); await unblock();
  const G = await ev(() => { const g = window.__S.defenseV2.g; return { gx: g.gx, W: g.W, F: g.F, top: g.top, innerTop: g.innerTop, cityTop: g.cityTop, outBot: g.outBot, WX0: g.WX0, WX1: g.WX1, stairTop: g.stairTop, stairB: g.stairB, ramps: g.ramps, segs: g.segs.map(s => s.ladderX), keep: g.keep, B: g.bounds }; });
  const rim = G.W - 50, P = [
    ['w1-left-end', G.WX0 + 40, G.W - 100], ['w1b-left-beyond', G.WX0 - 120, G.W - 100], ['w2-seg1', G.segs[0], G.W - 100], ['w3-gate', G.gx, G.W - 120],
    ['w3b-gate-on-crenel', G.gx, G.W + 30, 'crenel'], ['w4-seg4', G.segs[3], G.W - 100], ['w5-right-end', G.WX1 - 40, G.W - 100], ['w5b-right-beyond', G.WX1 + 120, G.W - 100],
    ['x1-ramp-left-top', G.ramps[0], G.stairTop - 24], ['x2-ramp-left-mid', G.ramps[0], (G.stairTop + G.stairB) / 2], ['x3-ramp-right', G.ramps[1], (G.stairTop + G.stairB) / 2], ['x4-keep', G.keep.x, G.keep.y + 70],
    ['x5-city-topleft-corner', G.B.left + 60, G.cityTop + 60], ['x6-city-topright-corner', G.B.right - 60, G.cityTop + 60], ['x7-outside-gate', G.gx, G.F + 150],
    ['x8-out-bottomleft', G.B.left + 60, G.outBot - 60], ['x9-out-bottomright', G.B.right - 60, G.outBot - 60], ['x10-enemy-camp', G.gx - 620, G.F + 820],
  ];
  for (const [name, x, y, kind] of P) {
    await ev(([x, y]) => { const s = window.__S; s.player.sprite.setPosition(x, y); }, [x, y]);
    await wait(900); await unblock();
    const st = await ev(async () => {
      const s = window.__S, g = s.defenseV2.g, c = s.cameras.main, v = c.worldView, gr = s.ground, B = g.bounds, P2 = 220; // 用相机实际看到的世界（worldView，渲染后），不自己按原点推
      const ground = gr.x <= v.x + 1 && gr.x + gr.width >= v.right - 1 && gr.y <= v.y + 1 && gr.y + gr.height >= v.bottom - 1;
      const cam = v.x >= B.left - P2 - 1 && v.right <= B.right + P2 + 1 && v.y >= B.top - P2 - 1 && v.bottom <= B.bottom + P2 + 1;
      // 截屏扫整列近黑（画布内露底色）：每 4 列取一列、每列隔 6 行取样，≥ 70% 近黑算一条黑边
      const img = await new Promise(res => s.game.renderer.snapshot(im => res(im)));
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let dark = 0; const cols = [];
      for (let x = 0; x < cv.width; x += 4) { let n = 0, k = 0; for (let yy = 0; yy < cv.height; yy += 6) { const i = (yy * cv.width + x) * 4; k++; if (d[i] < 28 && d[i + 1] < 24 && d[i + 2] < 20) n++; } if (n / k >= .7) { dark++; if (cols.length < 6) cols.push(x); } }
      return { x: Math.round(s.player.x), y: Math.round(s.player.y), r: s.player.radius, ground, cam, darkCols: dark, cols, origin: c.originX, view: [Math.round(v.x), Math.round(v.y), Math.round(v.width), Math.round(v.height)] };
    });
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
    const okBlack = st.ground && st.cam && st.darkCols === 0;
    let okPos = true;
    if (name.endsWith('left-beyond')) okPos = st.x >= G.WX0 + st.r - 2; // 走不出端头平台
    if (name.endsWith('right-beyond')) okPos = st.x <= G.WX1 - st.r + 2;
    if (kind === 'crenel') okPos = st.y <= rim - st.r + 1; // 走查 E：放到城垛上被夹回走道
    ck(`${name}：画布内不露底色${okPos !== true || name.includes('beyond') || kind ? ' · 位置被夹回走道' : ''}`, okBlack && okPos, st);
  }
  // 走查 F：城里立着的布景（不该有敌方的旗）
  const cityProps = await ev(() => { const s = window.__S, g = s.defenseV2.g, out = []; for (const o of s.children.list) { if (!o.visible || !o.texture || o.y >= g.innerTop - 10 || o.y < g.cityTop - 60 || o.scrollFactorX === 0) continue; const k = o.texture.key, n = o.name || ''; if (/^defv2-(keep|stair|end|gate|walk|ramp)|terrain-|arena-|shadow/.test(n) || /ground|shadow|walk_sheet|_walk|attack/.test(k)) continue; out.push({ n, k, f: String(o.frame?.name ?? ''), x: Math.round(o.x), y: Math.round(o.y) }); } return out; });
  const flags = cityProps.filter(q => /flag|banner|旗|yuan|capture/i.test(q.k + q.n + q.f));
  ck('走查 F：城里没有敌方的旗', flags.length === 0, { flags, sample: cityProps.slice(0, 12) });
  ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
} catch (e) { fail++; console.log('FAIL 异常 · ' + e.message.split('\n')[0]); }
await b.close();
console.log(fail ? `失败 ${fail} 项` : '全部通过');
process.exit(fail ? 1 : 0);
