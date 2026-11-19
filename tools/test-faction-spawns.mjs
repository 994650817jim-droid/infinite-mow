// 各章只刷本章势力的兵（用户 11-19「3-2还有黄巾兵出来」）：每关开一局、从末波开始正常刷兵一段时间，记下所有敌兵的行走图 / 新兵种 id。
// 断言：第一章以外不出现黄巾图（yellow_*）；新兵种（data/enemyRoster）只出本关配兵表里有的。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-faction-spawns.mjs [2-3,3-2,4-1,7-1,11-1]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const heroRec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [heroRec('zhaoyun')], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 10, agility: 9, intellect: 0, command: 0 } } } };
const CH = { 1: { key: 'GameScene', cfg: st => ({ chapter: 'huangjin', stage: st }) }, 2: { key: 'GameScene', cfg: st => ({ chapter: 'hulao', westStage: st }) }, 3: { key: 'ThirdGameScene', reg: 'thirdStage' }, 4: { key: 'GuanduGameScene', reg: 'guanduStage' }, 7: { key: 'ShuGameScene', reg: 'shuStage' }, 11: { key: 'NanzhengGameScene', reg: 'nanzhengStage' } };
const STAGES = (process.argv[2] ?? '2-3,3-2,4-1,7-1,11-1').split(',');
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 700) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
for (const id of STAGES) {
  const [chn, stn] = id.split('-').map(Number), C = CH[chn];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(id + ' ' + e.message.slice(0, 160)));
  await p.addInitScript(([r, w, h]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, [roster, world, heroes]);
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 120000 });
  await p.evaluate(([C, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); let cfg = {}; if (C.reg) { s0.registry.set(C.reg, st); cfg = C.reg === 'guanduStage' ? {} : { thirdStage: st }; } else cfg = C.cfgv; s0.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(C.key); }, [{ key: C.key, reg: C.reg, cfgv: C.cfg?.(stn) }, stn]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed < 6; }, C.key, { timeout: 120000 });
  const r = await p.evaluate(async k => {
    const s = window.__game.scene.getScene(k), mix = (await import('/src/data/enemyRoster.ts')).STAGE_MIX;
    const clear = () => { for (let i = 0; i < 20 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else if (s.mode === 'recruit') s.chooseRecruit?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } };
    s.player.damageImmune = true;
    const w = s.chapter.waves; if (s.devSetTime) s.devSetTime(w.length ? w[w.length - 1].start + 5 : 120); // 末波：兵种最全（新兵种多在第 2 波以后）
    const sheets = {}, rosters = {}; let n = 0; const seen = new Set(); const t = performance.now(); s.devTimeScale = 3;
    while (performance.now() - t < 22000 && !s.over) {
      clear();
      for (const e of s.enemies) { if (!e.active || e.isSupplySlot || e.kind === 'boss' || seen.has(e.spawnId)) continue; seen.add(e.spawnId); n++;
        const key = (e.walkSheet || e.sprite.texture.key || '').replace(/^readable_/, ''); sheets[key] = (sheets[key] ?? 0) + 1; if (e.def.roster) rosters[e.def.roster] = (rosters[e.def.roster] ?? 0) + 1; }
      await new Promise(r => setTimeout(r, 150));
    }
    s.devTimeScale = 1;
    const stage = s.hardKey() + '.' + s.hardStage(), allowed = Object.keys(mix[stage]?.traits ?? {}); if (allowed.includes('xunshou')) allowed.push('beast');
    const want = Object.entries(mix[stage]?.traits ?? {}).filter(([, e]) => (e.wave ?? 2) <= w.length).map(([id]) => id);
    return { stage, chapter: s.chapter.id, n, sheets, rosters, allowed, want };
  }, C.key);
  const yellow = Object.keys(r.sheets).filter(k => /yellow_/.test(k)), foreignRoster = Object.keys(r.rosters).filter(x => !r.allowed.includes(x));
  ck(`${id}（${r.stage}）：只刷本章势力的兵——没有黄巾图，新兵种都在本关配兵表里`, r.n >= 15 && (chn === 1 || yellow.length === 0) && foreignRoster.length === 0, { n: r.n, yellow, foreignRoster, rosters: r.rosters, sheets: r.sheets });
  if (r.want.length) ck(`${id}：本关配兵表里的新兵种确实刷得出来（第三章起的篇章场景也算）`, r.want.some(x => r.rosters[x] > 0), { want: r.want, rosters: r.rosters });
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
