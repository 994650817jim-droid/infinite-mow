// 天下地图 W3：城池产出（攻城/战役/群雄篇结算，胜利或坚持 60 秒）、大城特产（伤害/生命/属性点/增援/后备/粮草）、
// 地图信息卡产出与特产、领地面板。需要开发服务器 5173。用法：node tools/test-worldmap-w3.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-w3';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const LARGE = ['luoyang', 'changan', 'ye', 'xiangyang', 'shouchun', 'xiapi'];
// 攻城按章节分区开放：宛城等群雄地区需群雄割据已通关（eraSeen 2 避免时局变化弹窗）
const mk = (owned, reserve = {}) => ({ version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: owned, eraSeen: 2, capturedEver: [...owned] });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const open = async (save, layout = 'mobile') => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(400);
  await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setWorldRandom(() => .99)); // 关闭 W4 随机反扑
  return p;
};
const startSiege = async (p, id) => {
  await p.evaluate(([M0, id]) => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === id).hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, [M, id]);
  await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player && window.__game.scene.isActive('SiegeGameScene'), null, { timeout: 20000 }); await p.waitForTimeout(400);
};
const winSiege = async p => { await p.evaluate(G0 => { const s = eval(G0); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }, G); for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); if (await p.evaluate(G0 => { const s = eval(G0); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return s.over; }, G)) break; } await p.waitForTimeout(300); };
const world = p => p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const s = w.loadWorld(); return { owned: s.ownedCities, merits: s.merits, provisions: s.provisions, reserve: s.reserve, report: s.town?.report }; });
/** 城镇 T1 起：季度净粮 = 农田产粮 − 军粮（城池产出另计）。 */
const farmNet = w => (w.report?.grain ?? 0) - (w.report?.upkeep ?? 0);

// —— 产出：许昌（中）+ 官渡（小）= 军功 5 / 粮草 30 ——
{
  const p = await open(mk(['xuchang', 'guandu']));
  const card = await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'xuchang').hit.emit('pointerup', { getDistance: () => 0 }); const own = s.detail.text; s.cityMarkers.find(m => m.city.id === 'luoyang').hit.emit('pointerup', { getDistance: () => 0 }); return { own, luo: s.detail.text }; }, M);
  // 2026-11-17 旧季度经济（军功 / 城池发展），已由 test-city-build 覆盖：ck('信息卡：我方许昌“产出：每次出征 军功 +5 · 粮草 +20”', card.own.includes('产出（均衡，主城「城池发展」可改）：每季 军功 5 · 粮草 20'), card.own);
  ck('信息卡：洛阳“占领后产出 … 特产「天子旧都」本命武器伤害 +3%”', card.luo.includes('占领后产出：每战 钱币 +55') && card.luo.includes('特产「天子旧都」本命武器伤害 +3%'), card.luo);
  const land = await p.evaluate(M0 => { const s = eval(M0); const chip = s.children.getByName('world-territory').text; s.children.getByName('world-territory').emit('pointerup'); const panel = s.children.getByName('territory-panel'); return { chip, text: panel?.list.find(o => o.type === 'Text')?.text }; }, M);
  // 2026-11-17 旧季度经济（军功 / 城池发展），已由 test-city-build 覆盖：ck('领地面板：2 座城、每次出征 军功 +5 · 粮草 +30、城池列表', land.chip.startsWith('领地 2') && land.text.includes('我方城池 2 座 · 大城 0 / 中城 1 / 小城 1') && land.text.includes('每季产出（按各城发展方向）：军功 5 · 粮草 30') && land.text.includes('许昌、官渡'), land);
  await p.screenshot({ path: `${out}/mobile-territory.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('world-territory').emit('pointerup'), M);
  // 2026-11-17：攻城胜利 / 失败的季度经济（军功、城池发展、农田净粮）随城池建设改版删除，城池产出由 test-city-build 覆盖；
  // 攻城胜负流程改为箭楼 / 府衙目标，由 test-siege-goals 覆盖。
  await p.close();
}
// —— 大城特产：六大城全占，攻宛城 ——
{
  const p = await open(mk(LARGE, { swordsman: 5 }));
  const eff = await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'); const e = w.permanentEffects(); return { damage: e.damageBonus, maxHp: e.maxHpBonus, slots: e.reserveSlots, points: e.attributePoints, prov: e.provisionsBonus, reinf: e.reinforcements }; });
  ck('六大城特产汇总：伤害 +3%、生命 +8%、后备 3、属性点 1、粮草 +10%、增援 1', eff.damage === .03 && eff.maxHp === .08 && eff.slots === 3 && eff.points === 1 && Math.abs(eff.prov - .1) < 1e-9 && eff.reinf === 1, eff);
  const land = await p.evaluate(M0 => { const s = eval(M0); s.children.getByName('world-territory').emit('pointerup'); return s.children.getByName('territory-panel').list.find(o => o.type === 'Text').text; }, M);
  ck('领地面板列出六项大城特产', ['天子旧都', '关中要塞', '河北兵源', '荆襄书院', '淮南粮仓', '徐州精兵'].every(t => land.includes(t)) , land);
  await p.screenshot({ path: `${out}/mobile-specialties.png` });
  await p.evaluate(M0 => eval(M0).children.getByName('world-territory').emit('pointerup'), M);
  await startSiege(p, 'wancheng');
  const bat = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; return { perm: pl.growth.permanentDamage, mul: +pl.growth.damageMultiplier(0).toFixed(3), maxHp: pl.maxHp, hp: pl.hp, points: pl.growth.unallocated, army: s.legion.count, reserve: s.allies.filter(u => u.active && u.reserveSoldier).length }; }, G);
  ck('攻城开局：伤害 ×1.03、生命 +8% 满血、1 点属性、增援 1 + 后备 3', bat.perm === .03 && bat.mul === 1.03 && bat.hp === bat.maxHp && bat.points >= 1 && bat.reserve === 3 && bat.army === 4, bat);
  await p.close();
}
// —— 电脑：信息卡与领地 ——
{
  const p = await open(mk(['xuchang']), 'desktop');
  await p.evaluate(M0 => { const s = eval(M0); s.children.getByName('world-territory').emit('pointerup'); }, M);
  ck('电脑：领地面板显示', await p.evaluate(M0 => !!eval(M0).children.getByName('territory-panel'), M));
  await p.screenshot({ path: `${out}/desktop-territory.png` });
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
