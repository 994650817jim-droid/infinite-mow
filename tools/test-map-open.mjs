// 舆图能开能关（2026-11-20 用户「我打不开小地图」）：电脑版 1-1（dev=1）。两种方式各开关一次：真实按键 M、点角上卷轴（关：再按 M / 点展开的卷轴）。
// 开着：舆图画面（battle-map-scroll-mid、MapView）可见、mode = map、计时不走；关上：HUD（状态框、战况线、计时、行囊、设置、卷轴小图）全部回来、计时继续走。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-map-open.mjs   截图 assets/review/battle-map/open-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/battle-map';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.battleMap && s.mode === 'none' && s.elapsed > 2 && s.children.getByName('battle-map-scroll'); }, null, { timeout: 180000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; });
await p.mouse.click(640, 400); // 画布拿键盘焦点
/** 可见 = visible、alpha > 0、且这个镜头真的会画它（主镜头 / UI 镜头没把它过滤掉）。 */
const snap = () => p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), cams = s.cameras.cameras;
  const drawn = o => !!o && o.visible && o.alpha > .01 && cams.some(c => c.visible && !(o.cameraFilter & c.id)) && (!o.parentContainer || o.parentContainer.visible);
  const by = n => s.children.getByName(n);
  const bm = s.battleMap, big = bm?.big?.root;
  return {
    legend: bm?.big?.painted?.stats.legend ?? null, hint: bm?.open3?.hint ? { text: bm.open3.hint.text, l: Math.round(bm.open3.hint.x - bm.open3.hint.width / 2), r: Math.round(bm.open3.hint.x + bm.open3.hint.width / 2), axL: Math.round(bm.open3.left.x), axR: Math.round(bm.open3.right.x) } : null,
    mode: s.mode, state: bm?.stats.state, t: bm?.stats.t, now: s.combatNow, timer: s.hudTexts.timer.text,
    mapMid: drawn(by('battle-map-scroll-mid')), mapView: drawn(big), dim: drawn(by('battle-map-dim')),
    hud: { status: drawn(by('hud-status-frame')), track: drawn(by('battle-track')), timer: drawn(s.hudTexts.timer), bag: drawn(by('bag-bundle-icon')), scroll: drawn(by('battle-map-scroll')), settings: !!s.settingsButton ? drawn(s.settingsButton) : null },
  };
});
const waitState = st => p.waitForFunction(st => window.__game.scene.getScene('GameScene').battleMap?.stats.state === st, st, { timeout: 6000 }).catch(() => {});
const hudOk = h => Object.entries(h).filter(([, v]) => v === false).map(([k]) => k);
const round = async (how, openFn, closeFn) => {
  const s0 = await snap();
  ck(`${how} 开图前：HUD 全在`, hudOk(s0.hud).length === 0, s0);
  await openFn(); await waitState('open'); await p.waitForTimeout(300);
  const a = await snap(); await p.waitForTimeout(1200); const a2 = await snap();
  await p.screenshot({ path: `${out}/open-${how}.png` });
  ck(`${how} 开：舆图画面出现（卷轴、地图、暗底），进入 map 模式`, a.state === 'open' && a.mode === 'map' && a.mapMid && a.mapView && a.dim, a);
  if (how === 'key-m') { // 2026-11-20 用户「左下角标识太大了，也没做好后面的框」
    ck('图例：紧凑（宽 ≤ 240、高 ≤ 36，原来 292×46），无拉伸框', !!a.legend && a.legend.w > 100 && a.legend.w <= 240 && a.legend.h <= 36, a.legend);
    ck('卷起提示缩短、在两根画轴之间', !!a.hint && a.hint.l > a.hint.axL && a.hint.r < a.hint.axR && a.hint.text.length <= 12, a.hint);
  }
  ck(`${how} 开着：计时不走`, Math.abs(a2.now - a.now) < 1, { a: a.now, a2: a2.now });
  await closeFn(); await waitState('closed'); await p.waitForTimeout(400);
  const c = await snap(); await p.waitForTimeout(1500); const c2 = await snap();
  await p.screenshot({ path: `${out}/closed-${how}.png` });
  ck(`${how} 关：卷回、mode none、舆图画面收起`, c.state === 'closed' && c.mode === 'none' && !c.mapMid && !c.mapView, c);
  ck(`${how} 关：HUD 全部回来（状态框、战况线、计时、行囊、设置、卷轴小图）`, hudOk(c2.hud).length === 0, c2.hud);
  ck(`${how} 关：计时继续走`, c2.now - c.now > 1000, { c: c.now, c2: c2.now });
};
await round('key-m', () => p.keyboard.press('KeyM'), () => p.keyboard.press('KeyM'));
// 点角上卷轴（画面坐标：游戏 960×540 → 1280×720）
const iconAt = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), o = s.children.getByName('battle-map-scroll'), k = s.scale.displaySize.width / s.scale.gameSize.width; const r = s.game.canvas.getBoundingClientRect(); return [r.left + o.x * (r.width / 960), r.top + o.y * (r.height / 540)]; });
await round('click', () => p.mouse.click(iconAt[0], iconAt[1]), () => p.mouse.click(640, 300));
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
await b.close();
process.exit(fail ? 1 : 0);
