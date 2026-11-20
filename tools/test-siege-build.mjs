// 攻城 / 守城 / 军情带上征程构筑（2026-11-20 用户「我发现攻城战之前的build没有了」，统筹定）：
// 开打时只读当前主公的征程构筑（战法、本命等级、四维…），打完不写回；吕布挑战仍空构筑；主线关照旧读、战败退回出征前。
// 正式模式（无 ?dev）从天下地图出征；军情 / 挑战用 ?dev=1 的预览入口只看「带没带」。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-siege-build.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu'], eraSeen: 1, capturedEver: ['guandu'], chapterSeen: 3, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setWorldRandom(() => .99));
const M = "window.__game.scene.getScene('WorldMapScene')";
const toMap = async () => { await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 60000 }); await p.waitForTimeout(900); };
const siege = async id => {
  await toMap();
  await p.evaluate(([M0, id]) => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === id).hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, [M, id]);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.elapsed < 5; }, null, { timeout: 120000 }); await p.waitForTimeout(600);
};
/** 当前战斗场景里主将的构筑。 */
const buildOf = key => p.evaluate(k => { const s = window.__game.scene.getScene(k), g = s.player.growth, own = s.player.weapons[0];
  return { learned: ['pursuit', 'chain'].map(id => g.build.level(id)), weapon: own?.level ?? 0, str: g.attributes.strength, replay: s.campaignReplay, loaded: s.campaignLoaded }; }, key);
const stored = () => p.evaluate(() => localStorage.getItem('im_campaign_v1'));
const core = j => { const h = JSON.parse(j).heroes.zhaoyun.player; return JSON.stringify({ build: h.build, weapons: h.weapons.map(w => [w.id, w.level]), attrs: h.growth?.attributes, mast: h.growth?.masteries }); };
const hpOf = j => { const h = JSON.parse(j).heroes.zhaoyun; return h.hpFrac ?? h.player?.hpFrac ?? h.player?.hp ?? null; };

// ① 写一份已知的征程构筑（追击 Lv2、连环 Lv1、本命 Lv4、力量 3）——用真实的 packCampaign / saveCampaignBuild
await siege('chenliu');
await p.evaluate(async () => { const s = window.__game.scene.getScene('SiegeGameScene'), C = await import('/src/systems/Campaign.ts'), g = s.player.growth;
  g.build.learn('pursuit'); g.build.learn('pursuit'); g.build.learn('chain'); s.player.weapons[0].level = 4; g.attributes.strength = 3;
  C.saveCampaignBuild('zhaoyun', C.packCampaign('zhaoyun', s.player, s.legion, null)); });
const saved0 = await stored();
ck('准备：存档里写入一份征程构筑（追击 Lv2、连环 Lv1、本命 Lv4、力量 3）', !!saved0 && /pursuit/.test(saved0), saved0?.slice(0, 120));

// ② 从天下地图进攻城：开打就带上这份构筑
await siege('chenliu');
const b1 = await buildOf('SiegeGameScene');
ck('攻城开打带上征程构筑：追击 Lv2、连环 Lv1、本命 Lv4、力量 3（只读：campaignReplay 仍为真）', b1.learned.join() === '2,1' && b1.weapon === 4 && b1.str === 3 && b1.replay && b1.loaded, b1);
// ③ 打赢攻城：不写回
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'), g = s.player.growth; g.build.learn('chain'); s.captured = true; s.bossKilled = true; s.finish(true, 'boss'); });
await p.waitForTimeout(800);
ck('攻城打赢（局中又升了连环）：征程构筑不写回，存档不变', (await stored()) === saved0);
// ④ 攻城战败：同样不写回
await siege('xuchang');
const b2 = await buildOf('SiegeGameScene');
await p.evaluate(() => { const s = window.__game.scene.getScene('SiegeGameScene'); s.player.growth.build.learn('chain'); s.finish(false, 'death'); });
await p.waitForTimeout(800);
const after2 = await stored();
ck('再进别的城也带上构筑；攻城战败：构筑不写回（战法 / 本命 / 四维不变，只按战败惩罚压低生命与部曲）', b2.learned.join() === '2,1' && core(after2) === core(saved0), { b2, hp: [hpOf(saved0), hpOf(after2)] });

// ⑤ 回主线关（第三章 3-1，未通关）：照旧读征程构筑；主线战败退回出征前（不写回）
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.registry.remove('campaignTransfer'); g.registry.set('thirdStage', 1); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 1 }); g.scene.start('ThirdGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('ThirdGameScene'); return s?.player && window.__game.scene.isActive('ThirdGameScene') && s.elapsed < 5; }, null, { timeout: 120000 }); await p.waitForTimeout(600);
const b3 = await buildOf('ThirdGameScene');
ck('攻城之后回主线关（3-1）：构筑都在（追击 Lv2、连环 Lv1、本命 Lv4、力量 3），主线照常可写回', b3.learned.join() === '2,1' && b3.weapon === 4 && b3.str === 3 && !b3.replay && b3.loaded, b3);
await p.evaluate(() => { const s = window.__game.scene.getScene('ThirdGameScene'); s.player.growth.build.learn('chain'); s.finish(false, 'death'); });
await p.waitForTimeout(800);
const after3 = await stored();
ck('主线关战败（局中又学了连环）：构筑退回出征前的存档点（战法 / 本命 / 四维与存档点一致，不带局中所得）', core(after3) === core(saved0), { hp: hpOf(after3) });

// ⑥ 军情、吕布挑战（dev 预览入口）：军情带上，挑战仍空构筑
const d = await b.newPage({ viewport: { width: 1280, height: 720 } });
d.on('pageerror', e => errors.push('dev ' + e.message));
await d.addInitScript(([sv, camp]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_campaign_v1', camp); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); } }, [save, saved0]);
await d.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop'); await d.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
const devRun = async (key, reg) => { await d.evaluate(async ([key, reg]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer');
    if (reg === 'intel') { const W = await import('/src/world/WorldIntel.ts'), first = Object.entries(W.BOUNTY_GENERALS)[0]; const ev = { id: 'tb-intel', kind: 'bounty', city: 'luoyang', faction: first[0], general: first[1][0], expires: 9999 }; s0.registry.set('intelEvent', ev.id); s0.registry.set('intelPreview', ev); }
    s0.registry.set('runConfig', { character: 'zhaoyun' }); s0.scene.start(key); }, [key, reg]);
  await d.waitForFunction(k => { const s = window.__game.scene.getScene(k); return s?.player && window.__game.scene.isActive(k) && s.elapsed < 5; }, key, { timeout: 120000 }); await d.waitForTimeout(500);
  return d.evaluate(k => { const s = window.__game.scene.getScene(k), g = s.player.growth; return { learned: ['pursuit', 'chain'].map(id => g.build.level(id)), weapon: s.player.weapons[0]?.level, str: g.attributes.strength }; }, key); };
const intel = await devRun('IntelGameScene', 'intel');
ck('军情战（悬赏）：同样带上征程构筑', intel.learned.join() === '2,1' && intel.weapon === 4 && intel.str === 3, intel);
const lubu = await devRun('LubuGameScene', null);
ck('吕布挑战：仍是空构筑（不读征程构筑）', lubu.learned.join() === '0,0' && lubu.weapon !== 4, lubu);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
