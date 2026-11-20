// 副将专属形象（统筹 11-19；美术会话 009bf2c 第 1 批：lt_huangjin / lt_hulao / lt_qunxiong / lt_guandu）：
// 1-3（卜己）、4-x（袁军副将）用 lt_<章节键> 专属图，人物比本章普通精锐大约 1.2–1.3 倍；第 5 章起没有图，回退「精锐 ×1.3」（v2 也要真的放大）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-lieutenant-art.mjs [1-3,4-1,5-1]   截图 assets/review/lieutenant/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/lieutenant'; mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2]?.split(',') ?? ['1-3', '4-1', '5-1'];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const CH = { 1: { key: 'GameScene', cfg: st => ({ chapter: 'huangjin', stage: st }) }, 4: { key: 'GuanduGameScene', reg: 'guanduStage' }, 5: { key: 'ChibiGameScene', reg: 'chibiStage' } };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of ONLY) {
  const [chn, stn] = id.split('-').map(Number), C = CH[chn];
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(id + ' ' + e.message.slice(0, 160)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([C, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); let cfg = {}; if (C.reg) { s0.registry.set(C.reg, st); cfg = C.reg === 'guanduStage' ? {} : { thirdStage: st }; } else cfg = C.cfgv; s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(C.key); }, [{ key: C.key, reg: C.reg, cfgv: C.cfg?.(stn) }, stn]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.phaseRunner && s.elapsed < 8; }, C.key, { timeout: 120000 });
  const r = await p.evaluate(async k => {
    const s = window.__game.scene.getScene(k), P = s.player, R = s.phaseRunner, wait = ms => new Promise(r => setTimeout(r, ms));
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
    clear(); s.updateSpawner = () => {}; if (s.traits) s.traits.pick = () => null; P.damageImmune = true; P.weapons.forEach(w => { w.cooldownLeft = 1e9; });
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    const art = (await import('/src/data/stagePhases.ts')).lieutenantArt(s.phasePlan.chapter);
    for (let i = 0; i < 60 && !R.ltArt() && s.textures.exists(art.walk) === false; i++) await wait(200); // 等专属图载完（没登记的章不会载）
    await wait(400);
    const name = s.phasePlan.lieutenant ?? '测试副将'; R.lieutenant(name); const lt = R.lt.e;
    const el = s.spawnEnemy('elite', lt.x + (lt.x < P.x ? 110 : -110), lt.y, 1, true);
    for (const e of [lt, el]) { e.def = { ...e.def, speed: 0, damage: 0 }; }
    await wait(900); clear();
    // 人物高度：当前帧不透明像素的包围盒高 × 显示缩放
    const cache = {}; const fig = e => { const f = e.sprite.frame, key = e.sprite.texture.key + '/' + f.name; if (!(key in cache)) { const src = f.source.image, c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight; const g = c.getContext('2d'); g.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight); const d = g.getImageData(0, 0, c.width, c.height).data; let top = -1, bot = -1; for (let y = 0; y < c.height; y++) { let any = false; for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { any = true; break; } if (any) { if (top < 0) top = y; bot = y; } } cache[key] = bot - top + 1; } return cache[key] * Math.abs(e.sprite.scaleY); };
    const tag = s.children.list.find(o => o.name === 'lieutenant-tag');
    return { stage: s.hardKey() + '.' + s.hardStage(), chapter: s.phasePlan.chapter, name, ltTex: lt.sprite.texture.key, elTex: el.sprite.texture.key, ltH: Math.round(fig(lt)), elH: Math.round(fig(el)), ratio: Math.round(fig(lt) / fig(el) * 100) / 100, tint: lt.sprite.tintTopLeft.toString(16), tag: tag?.text, want: art.walk };
  }, C.key);
  await p.screenshot({ path: `${OUT}/lieutenant-${id}.png` });
  if (chn <= 4) ck(`${id}（${r.stage}）副将用专属图 ${r.want}，人物比本章精锐大 1.2–1.3 倍，头顶有名牌`, r.ltTex.endsWith(r.want) && r.ratio >= 1.15 && r.ratio <= 1.35 && /副将/.test(r.tag ?? ''), r);
  else ck(`${id}（${r.stage}）没有专属图：回退精锐图，且真的放大约 1.3 倍`, !/lt_/.test(r.ltTex) && r.ltTex === r.elTex && r.ratio >= 1.2 && r.ratio <= 1.4, r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
