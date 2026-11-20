// 兵器专职 24 个分支实战触发 + 卡面图标（wave-progression-redesign §4.7）。
// 用法：BASE=http://127.0.0.1:5241/ node tools/test-weapon-branches.mjs   截图在 assets/review/stage-phases/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/stage-phases'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 320) + (ok ? '' : ' … ' + JSON.stringify(d).slice(320, 900)) : '')); };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

async function open(start) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); for (const [k, v] of Object.entries(st.reg ?? {})) s0.registry.set(k, v);
    s0.registry.set('runConfig', { character: 'zhaoyun', ...(st.run ?? {}) }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start(st.key); }, start);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > .5 && s.elapsed < 8; }, start.key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true; window.__banners = [];
    const sb = s.showWaveBanner.bind(s); s.showWaveBanner = (t, d, c) => { window.__banners.push(t + (c ? ' | ' + c : '')); return sb(t, d, c); };
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') { s.chooseRecruit?.(0); s.__DEV_ACTIONS?.closePopup?.(); } else if (s.mode === 'parley') s.parley?.choose?.('execute'); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; }, start.key);
  return p;
}
const branchFire = async (hero, branches) => {
  const out = {};
  for (const br of branches) {
    const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2, character: hero } });
    await p.evaluate(br => { const s = window.__S; window.__calm(); const w = s.player.weapons[0]; w.level = 5; w.branch = br; w.over = 0; s.player.stats.cooldownMul = .5; for (const a of s.allies) if (a.active) a.hp = Math.max(1, a.maxHp * .4); }, br);
    for (let k = 0; k < 4; k++) { await p.evaluate(() => { const s = window.__S; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; s.spawnEnemy(i % 3 ? 'infantry' : 'shield', s.player.x + Math.cos(a) * 110, s.player.y + Math.sin(a) * 110, 3, true); } if (s.player.sprite) s.player.sprite.x += 90; window.__calm(); }); await p.waitForTimeout(1400); }
    out[br] = await p.evaluate(() => { const r = window.__S.branchRt; return r ? { ...r.stats } : null; });
    if (br === 'gy_qinglong') await p.screenshot({ path: `${OUT}/branch-gy-qinglong.png` });
    await p.close();
  }
  return out;
};
{
  const heroes = { zhaoyun: ['zy_longdan', 'zy_bainiao'], guanyu: ['gy_qinglong', 'gy_danqi'], zhangfei: ['zf_duanqiao', 'zf_nuhou'], liubei: ['lb_rende', 'lb_sanying'], zhuge: ['zg_liaoyuan', 'zg_bazhen'], huangzhong: ['hz_chuanyang', 'hz_huoshi'], machao: ['mc_tieqi', 'mc_weishui'], weiyan: ['wy_ziwu', 'wy_hanzhong'], pangtong: ['pt_lianying', 'pt_lianhuan'], huangyueying: ['hy_liannu', 'hy_muniu'], sunshangxiang: ['ss_wanren', 'ss_benxi'], diaochan: ['dc_biyue', 'dc_meirenji'] };
  const r = {}; for (const [h, bs] of Object.entries(heroes)) Object.assign(r, await branchFire(h, bs));
  const noHit = ['zf_nuhou', 'lb_rende', 'wy_hanzhong'], bad = Object.entries(r).filter(([k, v]) => !v || v.procs < 1 || (!noHit.includes(k) && v.hits < 1)).map(([k]) => k);
  ck('24 个兵器专职分支在战斗里都会触发（12 名武将 × 2）', bad.length === 0 && Object.keys(r).length === 24, { bad, r });
}
// 卡面图标：24 枚都载入
{
  const p = await open({ key: 'GameScene', run: { chapter: 'hulao', westStage: 2 } });
  const ic = await p.evaluate(async () => { const wb = await import('/src/data/weaponBranches.ts'); return wb.WEAPON_BRANCHES.filter(b => !window.__S.textures.exists(b.icon)).map(b => b.id); });
  ck('24 枚分支卡面图标都已载入（branch_icon_*）', ic.length === 0, ic);
  await p.close();
}
await b.close();
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
console.log(fail ? `FAILED ${fail}` : 'ALL PASS');
process.exit(fail ? 1 : 0);
