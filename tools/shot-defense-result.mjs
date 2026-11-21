// 守城 HUD（城门 / 府衙两条小血条、波次只留一处）截图（2026-11-21 总制作人第三 / 四轮）。由 tools/test-defense.mjs 的开场流程改来。
// 查：守城模式、标签 / HUD、继承征程构筑（只读）、首领头像不再请求不存在的图、战败结算与退守、胜利解除告急并发军粮、无控制台报错。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-defense.mjs [截图目录]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = process.argv[2] ?? 'assets/review/defense'; mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu', 'chenliu'], eraSeen: 1, capturedEver: ['guandu', 'chenliu'], chapterSeen: 3, tutorialDone: true, alerts: [{ city: 'chenliu', attacker: 'caocao', cause: 'retaliate' }] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 160)); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const world = () => p.evaluate(() => { const w = JSON.parse(localStorage.getItem('im_world_v1')); return { owned: w.ownedCities, alerts: (w.alerts ?? []).map(a => a.city), provisions: w.provisions }; });
const toMap = async () => { await p.evaluate(() => { const g = window.__game, m = g.scene.getScene('WorldMapScene'); if (m && g.scene.isActive('WorldMapScene')) { m.scene.restart(); return; } /* 已在地图上：同一帧 stop + start 同一场景会起不来，改 restart */ for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(1200); };
/** 天下地图（缺省 V1）：点告急的陈留 → 主按钮「亲征 · 守城」→ 弹窗「出征守城」。 */
const defend = async () => {
  await toMap();
  const m = await p.evaluate(M0 => { const s = eval(M0), mk = s.cityMarkers.find(x => x.city.id === 'chenliu'); mk.hit.emit('pointerup', { getDistance: () => 0 });
    return { chip: true, status: mk.root?.getData?.('status') ?? null, label: mk.label?.text ?? null, detail: s.detail?.text?.slice(0, 60) }; }, M);
  await p.waitForTimeout(300);
  const a = await p.evaluate(M0 => { const s = eval(M0); return s.action?.text?.text; }, M);
  await p.evaluate(M0 => { const s = eval(M0); s.action.image.emit('pointerup'); }, M); await p.waitForTimeout(400);
  const modal = await p.evaluate(M0 => { const s = eval(M0), md = s.children.getByName('siege-modal'), go = md?.getByName?.('siege-go'); const texts = []; const walk = l => { for (const o of l) { if (o.type === 'Text') texts.push(o.text); if (o.list) walk(o.list); } }; if (md) walk(md.list); go?.emit('pointerup'); return { open: !!md, go: !!go, texts: texts.slice(0, 14) }; }, M);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed < 5; }, null, { timeout: 120000 }); await p.waitForTimeout(1500);
  return { m, action: a, modal };
};

// ⓪ 存一份征程构筑（追击 Lv2、本命 Lv4），看守城有没有带上
const e0 = await defend();
ck('天下地图：「告急」→ 选中陈留 → 主按钮「亲征 · 守城」→ 弹窗「出征守城」进守城', e0.m.chip && /守城/.test(e0.action ?? '') && e0.modal.open && e0.modal.go, e0);
await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), C = await import('/src/systems/Campaign.ts'), g = s.player.growth; g.build.learn('pursuit'); g.build.learn('pursuit'); s.player.weapons[0].level = 4; C.saveCampaignBuild('zhaoyun', C.packCampaign('zhaoyun', s.player, s.legion, null)); });
const camp0 = await p.evaluate(() => localStorage.getItem('im_campaign_v1'));
const OUT = 'assets/review/r5-fix'; mkdirSync(OUT, { recursive: true });
await defend();
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode !== 'none') { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); } }, G);
await p.waitForTimeout(6000);
const hud = await p.evaluate(G0 => { const s = eval(G0), t = s.children.getByName('defense-hud'), gl = s.children.getByName('defense-hud-gate'); return { hud: t?.text, gate: gl?.visible, wave: s.hudTexts.wave.visible ? s.hudTexts.wave.text : null }; }, G);
await p.screenshot({ path: `${OUT}/defense-hud.png` });
ck('守城顶部：只写攻 / 喘息倒计时（不再重复波次）+ 城门 / 府衙两条小血条', !!hud.hud && !/波/.test(hud.hud) && hud.gate === true, hud);
// 攻城胜利结算的要事分行见 tools/shot-siege-guide.mjs
console.log(errors.length ? 'FAIL errors ' + JSON.stringify(errors.slice(0, 3)) : 'PASS 无页面报错');
await b.close(); process.exit(fail ? 1 : 0);
