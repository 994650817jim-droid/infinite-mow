// 随行跟着部曲「出击」（用户 2026-11-17）+ 随行带天赋被动（统筹决定，效果 50%）。电脑布局；需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-follower-sortie.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const rec = (id, kind = 'hero', template = 'spear', name = id, quality = 'orange') => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [] });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const roster = (fs, owned) => ({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun'), ...owned], followers: fs, offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
const R1 = roster(['guanyu', 'r_1', 'r_2'], [rec('guanyu'), rec('r_1', 'common', 'spear', '武璋', 'green'), rec('r_2', 'common', 'bow', '萧朗', 'white')]);
await p.addInitScript(([w, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, R1]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const G = "window.__game.scene.getScene('GameScene')";

// 1. 出击 / 护阵
const so = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, sq = s.followers, o = {};
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = [];
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const m of sq.members) m.maxHp = m.hp = 1e9;
  const wait = async ms => { const c0 = s.combatNow; while (s.combatNow - c0 < ms) await new Promise(r => setTimeout(r, 30)); };
  const dists = () => sq.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y)));
  if (s.legion.order !== 'guard') s.legion.cycleOrder();
  // 精锐在右上 250，几个小兵在左下 220（都血厚）
  s.spawnEnemy('elite', pl.x + 180, pl.y - 170, 40); for (let i = 0; i < 4; i++) s.spawnEnemy('infantry', pl.x - 160 - i * 20, pl.y + 150, 40);
  const pins = s.enemies.filter(e => e.active && !e.isSupplySlot).map(e => [e, e.x, e.y]); // 刷出来就记下原位，整段按住（敌人会朝主将冲）
  let max = 0; const c0 = s.combatNow; while (s.combatNow - c0 < 1500) { for (const [e, x, y] of pins) if (e.active) e.sprite?.setPosition?.(x, y); await new Promise(r => setTimeout(r, 30)); max = Math.max(max, ...dists()); }
  o.guardMax = max; o.guardHits = sq.stats.hits;
  // 精锐与小兵会朝主将冲过来：出击这段每帧把它们按回原位（精锐离主将约 250 像素），看随行是否离开主将去追
  s.legion.cycleOrder(); o.order = s.legion.order; const h0 = sq.stats.hits; let outMax = 0; { const c = s.combatNow; while (s.combatNow - c < 2200) { for (const [e, x, y] of pins) if (e.active) e.sprite?.setPosition?.(x, y); await new Promise(r => setTimeout(r, 30)); outMax = Math.max(outMax, ...dists()); } } o.outMax = outMax;
  o.sortieDist = dists(); o.targets = sq.members.map(m => m.sortieTarget?.kind ?? null); o.sortieHits = sq.stats.hits - h0;
  // 拴绳：临时把出击最远距离调到 150、敌人按在 330 处，随行应追到约 150 处停住（地图边界会把太远的刷怪位置拉回，所以不用 700 外的敌人测）
  const RC = { FOLLOW: sq.rules }, leash0 = RC.FOLLOW.sortieLeash; RC.FOLLOW.sortieLeash = 150; // 改随行实际在用的那份规则（自己 import 的可能是热更新后的另一个实例）
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; await wait(200);
  s.spawnEnemy('elite', pl.x + 330, pl.y, 400); let leashMax = 0; { const c = s.combatNow; while (s.combatNow - c < 2000) { for (const e of s.enemies) if (e.active && e.kind === 'elite') e.sprite?.setPosition?.(pl.x + 330, pl.y); await new Promise(r => setTimeout(r, 30)); leashMax = Math.max(leashMax, ...dists()); } }
  RC.FOLLOW.sortieLeash = leash0; o.leashMax = leashMax;
  // 敌人在 300 处：随行追过去，但不超过 400
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; await wait(200);
  s.spawnEnemy('elite', pl.x + 330, pl.y, 400); let far = 0; const c2 = s.combatNow; while (s.combatNow - c2 < 2000) { for (const e of s.enemies) if (e.active && e.kind === 'elite') e.sprite?.setPosition?.(pl.x + 330, pl.y); await new Promise(r => setTimeout(r, 30)); far = Math.max(far, ...dists()); }
  o.far = far;
  // 切回护阵：按行走速度 ×1.2 跑回来（RECALL，2026-11-17 用户嫌原来一下子就回来了），约 330 像素要 1.5 秒多
  s.legion.cycleOrder(); o.back = s.legion.order; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; await wait(2500); o.backDist = dists();
  return o;
}, G);
ck('护阵：随行紧贴主将（≤ 100 像素）', so.guardMax <= 100, so);
ck('按下出击：随行离开主将去打敌人，优先精锐，并有命中', so.order === 'sortie' && so.outMax > 150 && so.targets.includes('elite') && so.sortieHits > 0, so);
ck('拴绳：出击最远距离（临时调成 150）时随行追到约 150 处就停住', so.leashMax >= 130 && so.leashMax <= 156, so);
ck('出击时敌人在 330 处：随行追过去（> 200），仍不超过 400', so.far > 200 && so.far <= 405, so);
ck('切回护阵：随行跑回主将身边（2.5 秒内 ≤ 80 像素）', so.back === 'guard' && so.backDist.every(d => d <= 80), so);

// 2. 随行带天赋被动（效果 50%）
const R2 = roster(['guanyu', 'zhuge', 'diaochan'], [rec('guanyu'), rec('zhuge'), rec('diaochan')]);
await p.evaluate(([G0, r]) => { localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = eval(G0); window.__prevPlayer = s.player; s.scene.restart(); }, [G, R2]);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prevPlayer && s.followers?.members.length === 3 && s.__DEV_ACTIONS; }, null, { timeout: 60000 });
await p.waitForTimeout(800);
const pv = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, sq = s.followers, o = {}, [gy, zg, dc] = sq.members;
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = []; for (const m of sq.members) m.maxHp = m.hp = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  o.has = sq.members.map(m => !!m.passive && m.passive.characterId === m.recruit.hero); o.inList = s.followerPassives.length;
  // 关羽蓄满：招牌技伤害加成只有一半（主将版 ×1.25 → 随行 ×1.125）
  gy.passive.stacks = gy.passive.maxStacks; const c = gy.passive.beginCast('guandao'); o.gyEmp = c.empowered; o.gyMul = +c.damageMul.toFixed(4);
  const lord0 = pl.passive.snapshot(s.combatNow).stacks;
  const t0 = s.combatNow; let wave = 0;
  while (s.combatNow - t0 < 6000) { if (s.enemies.filter(e => e.active && !e.isSupplySlot).length < 14) { wave++; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + wave; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 110, pl.y + Math.sin(a) * 110, 10); } } await new Promise(r => setTimeout(r, 60)); }
  o.zgStacks = zg.passive.snapshot(s.combatNow).stacks + zg.passive.snapshot(s.combatNow).burns; o.zgGains = zg.passive.gains ?? null;
  o.dcCharms = dc.passive.charmViews().length; o.hearts = (s.children.list.concat(s.children.getByName('follower-fx')?.list ?? [])).filter(x => x.name === 'diaochan-mark').length;
  o.lordStacks = pl.passive.snapshot(s.combatNow).stacks - lord0;
  // 被动 / 招牌特效每帧上限：同一帧连发 10 次只放 3 个
  let ok = 0; for (let i = 0; i < 10; i++) if (s.followerFxBudget()) ok++; o.budget = ok;
  return o;
}, G);
await p.screenshot({ path: `${out}/follower-passive-desktop.png` });
ck('名将随行都带上自己的天赋被动', pv.has.every(Boolean) && pv.inList === 3, pv);
ck('被动效果按 50%：关羽随行蓄满后伤害加成 ×1.125（主将版 ×1.25）', pv.gyEmp && pv.gyMul === 1.125, pv);
ck('诸葛亮随行的被动自己蓄层 / 灼烧', pv.zgStacks > 0 || (pv.zgGains ?? 0) > 0, pv);
ck('貂蝉随行给敌人挂上魅惑（离间）', pv.dcCharms > 0 || pv.hearts > 0, pv);
ck('主将自己的被动不受随行影响（主将无武器时层数不涨）', pv.lordStacks === 0, pv);
ck('被动 / 招牌特效每帧上限 3 个', pv.budget === 3, pv);
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
