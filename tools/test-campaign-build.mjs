// 征程构筑（2026-11-17，skill-carryover-proposal.md）：主线每赢一关存一份按武将的构筑（im_campaign_v1），
// 新开一场（天下地图 / 营寨 / 选关 / 结算「下一关」/ 重开游戏）进未通关的主线关时恢复；重打已通关的关用空构筑；
// 本局遗物不继承；恢复后兵装加成仍在。电脑布局 1280×720。需要开发服务器 5173。用法：node tools/test-campaign-build.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
const battle = async stage => {
  await p.goto(base + `?dev=1&autostart=1&stage=${stage}&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; });
  await p.waitForTimeout(400);
};

// 1) 1-1：攒一份构筑，存档（真实流程在首领战胜利时自动存；测试战斗不写，这里直接调同一个函数）
await battle(1);
const saved = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), c = await window.__mod('/src/systems/Campaign.ts'), st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), g = s.player.growth, out = {};
  st.setAutoSalvageWhite(false); const armor = it.rollItem('purple', Math.random, 'armor'); st.addItems([armor]); st.equipItem('zhaoyun', armor.uid);
  g.build.learn('pursuit'); g.build.learn('pursuit'); g.build.learn('ember'); g.learn('dragon_gallop'); s.player.weapons[0].level = 3; s.player.level = 7;
  c.saveCampaignBuild('zhaoyun', c.packCampaign('zhaoyun', s.player, s.legion));
  const raw = JSON.parse(localStorage.getItem('im_campaign_v1')); out.key = !!raw?.heroes?.zhaoyun; out.relics = raw.heroes.zhaoyun.player.relics; out.treasures = raw.heroes.zhaoyun.player.build?.treasures; out.slot = (await window.__mod('/src/systems/SaveSlots.ts')).PROGRESS_KEYS.includes('im_campaign_v1');
  out.replay11 = s.campaignReplay; return out;
});
ck('存档：征程构筑写进 im_campaign_v1（随存档位），不存遗物 / 宝物字段（2026-11-17 并入信物库）', saved.key && saved.relics === undefined && saved.treasures === undefined && saved.slot, saved);

// 2) 新开一场进 1-2（没有内存里的 transfer，相当于从地图 / 营寨 / 选关 / 重开游戏进入）：恢复构筑
await battle(2);
const loaded = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth;
  return { loaded: s.campaignLoaded, replay: s.campaignReplay, pursuit: g.build.level('pursuit'), ember: g.build.level('ember'), gallop: g.masteries.dragon_gallop, weapon: s.player.weapons[0].level, level: s.player.level, gearHp: g.gear.hp > 0, full: s.player.hp === s.player.maxHp, relicsField: 'relics' in s.player }; });
ck('新开一场进未通关的主线关（1-2）：战法、技艺、武器等级、局内等级都恢复', loaded.loaded && !loaded.replay && loaded.pursuit === 2 && loaded.ember === 1 && loaded.gallop === 1 && loaded.weapon === 3 && loaded.level === 7, loaded);
ck('恢复后兵装加成仍在（以前同章连打会丢）、血量回满、没有本局遗物', loaded.gearHp && loaded.full && !loaded.relicsField, loaded);

// 3) 已通关的旧关（重打）：空构筑，也不改存档里的构筑
await p.evaluate(async () => { const hp = await window.__mod('/src/systems/HeroProgress.ts'); hp.claimFirstClear('huangjin-2'); });
await battle(2);
const replay = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), g = s.player.growth, c = await window.__mod('/src/systems/Campaign.ts');
  return { replay: s.campaignReplay, loaded: s.campaignLoaded, pursuit: g.build.level('pursuit'), level: s.player.level, stillSaved: c.loadCampaignBuild('zhaoyun')?.player.level }; });
ck('重打已通关的关：用空构筑（不读），存档里的征程构筑不变', replay.replay && !replay.loaded && replay.pursuit === 0 && replay.level === 1 && replay.stillSaved === 7, replay);

// 4) 换武将：各自一份
const other = await p.evaluate(async () => { const c = await window.__mod('/src/systems/Campaign.ts'); localStorage.setItem('im_campaign_v1', '{bad'); const broken = c.loadCampaignBuild('zhaoyun'); localStorage.removeItem('im_campaign_v1'); return { guanyu: c.loadCampaignBuild('guanyu') ?? null, broken: broken ?? null, empty: c.loadCampaignBuild('zhaoyun') ?? null }; });
ck('每位武将各一份（关羽没打过为空）；老档没有 / 损坏时为空构筑不报错', other.guanyu === null && other.broken === null && other.empty === null, other);
// 5) 老档（没有征程构筑）进未通关的关：空构筑开局
await battle(3);
const fresh = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { loaded: s.campaignLoaded, level: s.player.level, pursuit: s.player.growth.build.level('pursuit') }; });
ck('老档没有征程构筑：未通关的主线关从空构筑开局', !fresh.loaded && fresh.level === 1 && fresh.pursuit === 0, fresh);

// 6) 局内等级跨章继承（2026-11-17 战功另改为击杀精英 / 首领得的货币，见 test-merit；这里只验局内等级接续）
await battle(1);
// 局内等级跨章继承：1-3 打赢后存的征程构筑，第二章 2-1 接着上次的等级（本关起点也是这个等级）
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'), c = await window.__mod('/src/systems/Campaign.ts'), hp = await window.__mod('/src/systems/HeroProgress.ts');
  s.player.level = 11; c.saveCampaignBuild('zhaoyun', c.packCampaign('zhaoyun', s.player, s.legion)); hp.claimFirstClear('huangjin-3'); });
await p.goto(base + '?dev=1&autostart=1&chapter=hulao&westStage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
const cross = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { chapter: s.chapter.id, stage: s.chapter.westStage, loaded: s.campaignLoaded, level: s.player.level, start: 0 }; });
ck('1-3 → 2-1：局内等级接着上次的等级（Lv.11），不归零', cross.chapter === 'hulao' && cross.loaded && cross.level === 11, cross);
await battle(3);
const old = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { replay: s.campaignReplay, level: s.player.level, start: 0 }; });
ck('重打已通关的 1-3：临时空构筑，局内等级从 Lv.1 开始（之前定的规则不变）', old.replay && old.level === 1, old);

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
