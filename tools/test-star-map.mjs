// 星图第一期（data/starMap.ts、systems/HeroProgress.ts、systems/RunGrowth.ts；设计稿 docs/STAR_MAP_DESIGN.md）：纯 node，不开浏览器。
// ① 全图连通、84 颗的构成；② 从本区入口到各要星的最少花费与设计稿第 4 节一致（4 / 5 / 5 / 7 / 7，跨系要星 6）；
// ③ 点亮规则：相连、主星门槛（本区 ≥10）、主星最多 2 颗；④ 存档：点亮 / 可用星数 / 洗点 / 读档；
// ⑤ 同样的点数下，星图汇总出的四维生效点与旧式加点完全相等；⑥ 三套示例走法（设计稿第 5 节）按星数取前 N 颗与表一致；
// ⑦ 开关打开时的专精 / 破阵 / 部曲伤害桶；⑧ 开关关闭时 RunGrowth / HeroProgress 的输出与改动前（git 里的 BASE 提交）逐项相同。
// 用法：node tools/test-star-map.mjs      （STAR_BASE=<提交号> 可换对照的提交，默认 718f2bc7 = 星图开工前的 main）
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { relative, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd(), BASE = process.env.STAR_BASE ?? '718f2bc7';
// 存档用的假 localStorage（HeroProgress / MasteryStore / WorldStore 都读它）
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); }, clear: () => store.clear(), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
const ENTRY = `
export * as SM from './src/data/starMap';
export * as HP from './src/systems/HeroProgress';
export * as MS from './src/systems/MasteryStore';
export * as RG from './src/systems/RunGrowth';
export * as HS from './src/data/heroStats';
export * as AT from './src/data/attributes';
export * as PA from './src/ui/PrimaryAttrInfo';
export * as PH from './src/data/pointsHint';
export * as MU from './src/data/mechanicUnlocks';
export * as FX from './src/data/starFx';`;
const ENTRY_BASE = ENTRY.replace(/^export \* as SM.*$/m, '').replace(/^export \* as FX.*$/m, '');
/** 打包在内存里；base = true 时 src 下的文件内容改从 git 的 BASE 提交读（对照「改动前」）。 */
async function load(entry, base) {
  // Phaser 只在界面 / 场景代码里用，这里测的是数据与结算：给一个空壳（任何属性都是一个可继承的空类），免得打包整个引擎
  const stub = { name: 'phaser-stub', setup(b) { b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: "const mk = () => new Proxy(class {}, { get: (t, k) => (k in t || typeof k === 'symbol' ? t[k] : (t[k] = mk())) }); const P = mk(); export default P; export const Scene = P.Scene, GameObjects = P.GameObjects, Math = P.Math, Geom = P.Geom, Scale = P.Scale, Input = P.Input, Display = P.Display;", loader: 'js' })); } };
  const plugins = base ? [stub, { name: 'git-base', setup(b) { b.onLoad({ filter: /[\\/]src[\\/].*\.ts$/ }, a => ({ contents: execFileSync('git', ['show', `${BASE}:${relative(root, a.path).replace(/\\/g, '/')}`], { encoding: 'utf8', maxBuffer: 1 << 28 }), loader: 'ts', resolveDir: a.path.replace(/[\\/][^\\/]*$/, '') })); } }] : [stub];
  const r = await build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', plugins });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64') + '#' + (base ? 'base' : 'new'));
}
let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const { SM, HP, MS, RG, HS, AT, PA, PH, MU, FX } = await load(ENTRY, false);
const ATTRS = AT.ATTRIBUTE_IDS, byName = new Map(SM.STAR_NODES.filter(n => n.kind === 'notable' || n.kind === 'keystone').map(n => [n.name, n]));
ck('开关默认关', SM.starMapOn() === false);

// ① 构成与连通
{
  const kinds = {}; for (const n of SM.STAR_NODES) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
  ck('84 颗：4 入口 / 52 小星 / 24 要星 / 4 主星', SM.STAR_NODES.length === 84 && same(kinds, { gate: 4, small: 52, notable: 24, keystone: 4 }), kinds);
  ck('编号不重复、连线两端都存在、没有自环 / 重复', new Set(SM.STAR_NODES.map(n => n.id)).size === 84 && SM.STAR_EDGES.every(([a, b]) => a !== b && SM.STAR_BY_ID.has(a) && SM.STAR_BY_ID.has(b)) && new Set(SM.STAR_EDGES.map(([a, b]) => [a, b].sort().join('|'))).size === SM.STAR_EDGES.length, SM.STAR_EDGES.length);
  const seen = new Set(['strength.G']), q = ['strength.G']; while (q.length) for (const n of SM.starNeighbors(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  ck('全图连通（从力量入口走得到每一颗）', seen.size === 84, seen.size);
  ck('相邻查询是对称的', SM.STAR_NODES.every(n => n.links.every(l => SM.starNeighbors(l).includes(n.id))));
  ck('四个入口连成一圈', ATTRS.every((a, i) => SM.starNeighbors(SM.gateOf(a)).includes(SM.gateOf(ATTRS[(i + 1) % 4]))));
  const small = { strength: 0, agility: 0, intellect: 0, command: 0 }; for (const n of SM.STAR_NODES) if (n.attr && n.kind === 'small') small[n.attr]++;
  ck('每一维 13 颗小星（区内 11 + 桥上 2），加别人的入口时最多 14 点', ATTRS.every(a => small[a] === 13), small);
  ck('旧专精 12 颗有 perk 标记；第三期起没有「效果未实现」的星：12 颗新要星有 STAR_EFFECT、4 颗主星有 STAR_KEYSTONE', SM.STAR_NODES.filter(n => n.perk).length === 12 && SM.STAR_NODES.every(n => !n.todo) && same(Object.keys(SM.STAR_KEYSTONE).sort(), SM.STAR_NODES.filter(n => n.kind === 'keystone').map(n => n.id).sort()) && same(Object.keys(SM.STAR_EFFECT).sort(), SM.STAR_NODES.filter(n => n.kind === 'notable' && !n.perk).map(n => n.id).sort()));
  const names = ATTRS.flatMap(a => [1, 2, 3].map(t => SM.starNode(SM.perkStarId(a, t)).name)), old = ATTRS.flatMap(a => AT.PRIMARY_PERK_INFO[a].map(p => p.name));
  ck('三档专精对应 NC / NL1 / NL2，名字与 PRIMARY_PERK_INFO 一致', same(names, old), names);
}
// ② 最少花费（设计稿第 4 节）
{
  const COST = { 千钧: 4, 破阵: 5, 斩将: 7, 铁骨: 5, 背水: 7, 轻骑: 4, 游刃: 5, 疾影: 7, 连击: 5, 追风: 7, 凝神: 4, 连珠: 5, 广域: 7, 余烬: 5, 妙算: 7, 励军: 4, 募众: 5, 同袍: 7, 严阵: 5, 号令: 7 };
  const bad = Object.entries(COST).filter(([name, c]) => { const n = byName.get(name); return !n || SM.starCost([], n.id, SM.gateOf(n.region)) !== c; });
  ck('区内 20 颗要星从本区入口的最少花费与设计稿一致（4 / 5 / 5 / 7 / 7）', bad.length === 0 && Object.keys(COST).length === 20, bad);
  const bridges = ['骁锐', '奇谋', '帷幄', '身先士卒'].map(name => { const n = byName.get(name); return [name, ...n.between.map(a => SM.starCost([], n.id, SM.gateOf(a)))]; });
  ck('跨系要星从任一侧入口 6 星', bridges.every(b => b[1] === 6 && b[2] === 6), bridges);
  ck('主星从本区入口连通最少 7 星（含主星本身；另有门槛）', ATTRS.every(a => SM.starCost([], a + '.K', SM.gateOf(a)) === 7));
}
// ③ 点亮规则
{
  const G = 'strength.G';
  ck('只能点亮相连的：入口旁的 T1 可以，隔一颗的 T2 不行', SM.canLight([], 'strength.T1', G) && !SM.canLight([], 'strength.T2', G) && !SM.canLight([], 'nope', G) && !SM.canLight(['strength.T1'], 'strength.T1', G));
  ck('别人的入口当普通小星：花 1 星、加 1 点；自己的入口免费、不加点', SM.canLight([], 'agility.G', G) && same(SM.starPoints(['agility.G'], G), { strength: 0, agility: 1, intellect: 0, command: 0 }) && SM.starsSpent(['agility.G'], G) === 1 && SM.starsSpent([], G) === 0 && same(SM.starPoints([], G), { strength: 0, agility: 0, intellect: 0, command: 0 }));
  const path = ['strength.T1', 'strength.T2', 'strength.C1', 'strength.NC', 'strength.C2', 'strength.C3']; // 连到主星的最短路：本区 6 颗 + 入口 = 7
  ck('主星门槛：相连但本区不够 10 颗时不能点', SM.regionLit(path, 'strength', G) === 7 && !SM.canLight(path, 'strength.K', G), SM.lightBlock(path, 'strength.K', G));
  const nine = [...path, 'strength.L1', 'strength.L2']; // 本区 9
  ck('本区 9 颗（含入口）仍不能点，10 颗可以', !SM.canLight(nine, 'strength.K', G) && SM.canLight([...nine, 'strength.R1'], 'strength.K', G), [SM.regionLit(nine, 'strength', G), SM.regionLit([...nine, 'strength.R1'], 'strength', G)]);
  ck('别区的星不算进本区门槛', !SM.canLight([...nine, 'agility.G'], 'strength.K', G));
  // 主星最多 2 颗：关羽走法里有万人敌、一骑当千；把敏捷、智力两区补满后第三颗（火烧连营）仍点不了
  const all = SM.STAR_NODES.filter(n => n.kind !== 'keystone').map(n => n.id), two = [...all, 'strength.K', 'agility.K'];
  ck('主星最多同时 2 颗', SM.canLight(all, 'intellect.K', G) && SM.keystonesLit(two) === 2 && !SM.canLight(two, 'intellect.K', G), SM.lightBlock(two, 'intellect.K', G));
  ck('orderStars 丢掉点不到的（不相连 / 第三颗主星 / 不认识的）', same(SM.orderStars(['strength.T2', 'strength.T1', 'xx', 'command.K'], G), ['strength.T1', 'strength.T2']) && SM.orderStars([...all, 'strength.K', 'agility.K', 'intellect.K', 'command.K'], G).filter(id => id.endsWith('.K')).length === 2);
  ck('starsAt：每升 1 级 1 颗，不减速', [1, 2, 10, 26, 54, 70].map(SM.starsAt).join() === '0,1,9,25,53,69');
  ck('入口：有主属性的按主属性，招募武将按本色最高一维', SM.heroGate('guanyu') === 'strength.G' && SM.heroGate('zhuge') === 'intellect.G' && SM.heroGate('liubei') === 'command.G' && SM.heroGate('zhaoyun') === 'agility.G' && SM.heroEntryAttr('bow') === 'agility' && SM.heroEntryAttr('strategist') === 'intellect' && SM.heroEntryAttr('张郃') === 'strength' && SM.heroEntryAttr('r_12', HS.statSource('程普')) === 'command');
}
// ⑥ 三套示例走法（设计稿第 5 节的表）
const TABLE = {
  guanyu: { 9: ['7/0/0/0', '千钧、破阵'], 25: ['10/6/0/0', '千钧、破阵、铁骨、斩将、万人敌、背水、骁锐、游刃、轻骑'], 53: ['11/12/3/8', '千钧、破阵、铁骨、斩将、万人敌、背水、骁锐、游刃、轻骑、连击、疾影、身先士卒、严阵、追风、一骑当千、励军、募众、号令、奇谋'], 69: ['12/12/9/10', '千钧、破阵、铁骨、斩将、万人敌、背水、骁锐、游刃、轻骑、连击、疾影、身先士卒、严阵、追风、一骑当千、励军、募众、号令、奇谋、凝神、同袍、连珠、广域、妙算、余烬、帷幄'] },
  zhuge: { 9: ['0/0/7/0', '凝神、连珠'], 25: ['0/0/10/6', '凝神、连珠、余烬、火烧连营、广域、帷幄、励军、严阵、妙算'], 53: ['4/9/11/11', '凝神、连珠、余烬、火烧连营、广域、帷幄、励军、严阵、妙算、募众、号令、同袍、三军统帅、奇谋、轻骑、游刃、连击、骁锐'], 69: ['10/11/11/12', '凝神、连珠、余烬、火烧连营、广域、帷幄、励军、严阵、妙算、募众、号令、同袍、三军统帅、奇谋、轻骑、游刃、连击、骁锐、千钧、破阵、疾影、铁骨、斩将、背水、追风'] },
  liubei: { 9: ['0/0/0/7', '励军、募众'], 25: ['5/0/0/11', '励军、募众、严阵、同袍、三军统帅、号令、身先士卒、帷幄、铁骨'], 53: ['12/1/9/11', '励军、募众、严阵、同袍、三军统帅、号令、身先士卒、帷幄、铁骨、凝神、千钧、妙算、破阵、连珠、斩将、背水、万人敌、余烬、广域、骁锐'], 69: ['13/9/10/11', '励军、募众、严阵、同袍、三军统帅、号令、身先士卒、帷幄、铁骨、凝神、千钧、妙算、破阵、连珠、斩将、背水、万人敌、余烬、广域、骁锐、轻骑、游刃、疾影、追风、连击、奇谋'] },
};
for (const key of Object.keys(TABLE)) {
  const P = SM.STAR_PRESETS[key], gate = SM.heroGate(P.hero), all = SM.presetStars(key);
  ck(`预设 ${P.name}：整条顺序每一步都合规（81 颗，前缀任取都能直接摆）`, all.length === 81 && same(SM.orderStars(all, gate), all) && [9, 25, 53, 69].every(n => same(SM.orderStars(SM.presetStars(key, n), gate), SM.presetStars(key, n))));
  const got = Object.fromEntries([9, 25, 53, 69].map(n => { const s = SM.presetStars(key, n), p = SM.starPoints(s, gate); return [n, [ATTRS.map(a => p[a]).join('/'), s.map(id => SM.starNode(id)).filter(x => !x.attr).map(x => x.name).join('、')]]; }));
  ck(`预设 ${P.name}：Lv10 / 26 / 54 / 70（9 / 25 / 53 / 69 星）的小星数与要星清单和设计稿的表一致`, same(got, TABLE[key]), Object.fromEntries(Object.entries(got).map(([n, v]) => [n, v[0]])));
}

// ④ 存档：点亮 / 可用星数 / 洗点 / 读档（这些接口不看开关）
{
  store.clear(); HP.resetHeroCache(); MS.resetMasteryCache();
  ck('新武将 Lv1：没有星可点', HP.heroFreeStars('guanyu') === 0 && HP.lightHeroStar('guanyu', 'strength.T1') === false && same(HP.heroStars('guanyu'), []));
  HP.setHeroStars('guanyu', [], 4); // Lv4 = 3 颗星
  ck('Lv4：3 颗可点；不相连的点不了', HP.heroStarsTotal('guanyu') === 3 && HP.heroFreeStars('guanyu') === 3 && !HP.lightHeroStar('guanyu', 'strength.T2'));
  const lit = ['strength.T1', 'strength.T2', 'strength.C1'].map(id => HP.lightHeroStar('guanyu', id));
  ck('点亮 3 颗后用完，第 4 颗点不了', lit.every(Boolean) && HP.heroFreeStars('guanyu') === 0 && !HP.lightHeroStar('guanyu', 'strength.NC') && same(HP.heroStars('guanyu'), ['strength.T1', 'strength.T2', 'strength.C1']) && same(HP.heroStarPoints('guanyu'), { strength: 3, agility: 0, intellect: 0, command: 0 }));
  ck('开关关着：旧属性点接口不受星影响', same(HP.heroAttrs('guanyu'), { strength: 0, agility: 0, intellect: 0, command: 0 }) && HP.heroFreePoints('guanyu') === 3);
  HP.resetHeroCache();
  ck('读档后还在', same(HP.heroStars('guanyu'), ['strength.T1', 'strength.T2', 'strength.C1']) && JSON.parse(store.get(HP.HEROES_KEY)).heroes.guanyu.stars.length === 3);
  { const v = JSON.parse(store.get(HP.HEROES_KEY)); v.heroes.guanyu.stars = ['strength.T1', 'bogus', 'strength.K', 'strength.T2', 7]; store.set(HP.HEROES_KEY, JSON.stringify(v)); HP.resetHeroCache(); }
  ck('读档时丢掉不认识的 / 点不到的星', same(HP.heroStars('guanyu'), ['strength.T1', 'strength.T2']));
  HP.allocateHeroAttr('guanyu', 'strength');
  SM.setStarMap(true);
  ck('开关打开：四维点数 = 小星汇总，可用点 = 没点的星，旧式加点被拒', same(HP.heroAttrs('guanyu'), { strength: 2, agility: 0, intellect: 0, command: 0 }) && HP.heroFreePoints('guanyu') === 1 && HP.allocateHeroAttr('guanyu', 'agility') === false && same(HP.enlistHero('guanyu').attributes, { strength: 2, agility: 0, intellect: 0, command: 0 }));
  const r = MS.respec('guanyu');
  ck('洗点（MasteryStore.respec，开关打开）：星全部退回，等级与旧属性点不动，本章首次免费', r.ok && same(HP.heroStars('guanyu'), []) && HP.heroFreeStars('guanyu') === 3 && HP.heroLevel('guanyu') === 4 && JSON.parse(store.get(HP.HEROES_KEY)).heroes.guanyu.attributes.strength === 1 && !('stars' in JSON.parse(store.get(HP.HEROES_KEY)).heroes.guanyu), r.message);
  ck('洗点第二次按等级收钱币（沿用旧规则：100 × 等级）', MS.respecCost('guanyu') === 400);
  SM.setStarMap(false);
  ck('开关关着：洗点仍是清旧属性点', (HP.resetHeroAttrs('guanyu'), JSON.parse(store.get(HP.HEROES_KEY)).heroes.guanyu.attributes.strength === 0));
  const set = HP.setHeroStars('liubei', SM.presetStars('liubei', 25), 26);
  ck('setHeroStars + 预设：刘备 Lv26 摆 25 颗', set.length === 25 && HP.heroLevel('liubei') === 26 && HP.heroFreeStars('liubei') === 0 && same(HP.heroStarPoints('liubei'), { strength: 5, agility: 0, intellect: 0, command: 11 }));
}

// ⑤ 同样的点数：星图汇总出的四维生效点 === 旧式加点
{
  const mk = (hero, level, attrs, stars) => { const g = new RG.RunGrowth(hero); g.heroLevel = level; if (attrs) Object.assign(g.attributes, attrs); if (stars) g.setStars(stars); return g; };
  const NUM = g => ({ pts: ATTRS.map(a => g.pts(a)), dmg: g.damageMultiplier(0), aspd: g.attackSpeedMultiplier(0), move: g.movementMultiplier(), crit: g.criticalBonus(), hp: g.bonusMaxHp(), allyHp: g.allyHpMultiplier(), area0: 1 + AT.ATTRIBUTE_EFFECT.intellect.area * g.pts('intellect'), skill: g.skillDamageMultiplier(), spell: g.spellWeaponMultiplier('flame_banner'), primary: g.primaryBonus(), guard: g.commandSelfGuard() });
  let n = 0, bad = [];
  for (const key of Object.keys(TABLE)) for (const hero of ['guanyu', 'zhuge', 'liubei', 'zhaoyun', 'diaochan', 'mengde']) for (const stars of [0, 3, 9, 14, 25, 40, 53, 69, 81]) {
    // 把预设走法搬到这位武将的入口上不一定合规，所以只在预设自己的武将上用整条走法；别的武将用「同样的点数」对照旧式公式
    const level = stars + 1, gateHero = SM.STAR_PRESETS[key].hero, lit = SM.presetStars(key, stars), p = SM.starPoints(lit, SM.heroGate(gateHero));
    SM.setStarMap(false); const old = mk(hero, level, p, null), oldN = NUM(old), direct = ATTRS.map(a => HS.statEffective(HS.statSource(hero), a, p[a], level));
    if (hero === gateHero) {
      SM.setStarMap(true); const g = mk(hero, level, null, lit), pt = ATTRS.map(a => g.pts(a)), attrs = { ...g.attributes };
      SM.setStarMap(false); const again = mk(hero, level, attrs, null); // 关掉开关、手填同样点数：除专精外的数值应一模一样
      if (!same(attrs, p) || !same(pt, oldN.pts) || !same(pt, direct) || !same(NUM(again), oldN)) bad.push([key, hero, stars, attrs, pt, oldN.pts]);
      // 开着开关时，不靠专精的那些量也应和旧式逐位相同
      SM.setStarMap(true); const on = NUM(g); SM.setStarMap(false);
      for (const k of ['pts', 'area0', 'spell', 'primary', 'guard', 'skill']) /* 生命、部曲生命第二期起会被铁骨、身先士卒、严阵改动，另测 */ if (!same(on[k], oldN[k])) bad.push([key, hero, stars, k, on[k], oldN[k]]);
    } else if (!same(oldN.pts, direct)) bad.push([key, hero, stars, 'direct']);
    n++;
  }
  ck(`同样的点数下，星图汇总出的四维生效点与旧式完全相等（${n} 组：3 套走法 × 6 位武将 × 9 个星数）`, bad.length === 0, bad.slice(0, 3));
  SM.setStarMap(true);
  const g = mk('guanyu', 26, null, SM.presetStars('guanyu', 25));
  ck('关羽 25 星：主属性 +1% / 点按力量小星数算（10 点封顶）', g.attributes.strength === 10 && g.primaryBonus() === 10 * AT.PRIMARY_BONUS.perPoint && mk('guanyu', 10, null, SM.presetStars('guanyu', 9)).primaryBonus() === 7 * AT.PRIMARY_BONUS.perPoint);
  SM.setStarMap(false);
}

// ⑦ 开关打开：专精查要星、破阵 ×1.6 + 定身每秒一次、部曲伤害加法桶、每级 1 星
{
  SM.setStarMap(true);
  const g = new RG.RunGrowth('zhaoyun'); g.heroLevel = 20; // 敏捷武将
  g.setStars(['strength.G', 'strength.T1', 'strength.T2', 'strength.C1', 'strength.NC', 'strength.L1', 'strength.L2', 'strength.NL1']);
  ck('专精改查要星：敏捷武将跨区点亮千钧（第 1 档）、破阵（第 2 档），没点斩将；自己的敏捷专精一档没有', g.perk('strength', 1) && g.perk('strength', 2) && !g.perk('strength', 3) && !g.perk('agility', 1) && g.primaryTier() === 0 && g.attributes.strength === 6 && g.attributes.agility === 0);
  ck('破阵重击 ×1.6（关着 ×2）', g.crushMul() === 1.6 && (SM.setStarMap(false), g.crushMul() === AT.PRIMARY_PERK.strength.crushMul && g.crushMul() === 2));
  SM.setStarMap(true);
  ck('破阵定身每秒最多一次', g.crushStunReady(1000) === true && g.crushStunReady(1500) === false && g.crushStunReady(1999) === false && g.crushStunReady(2000) === true && g.crushStunReady(2100) === false);
  SM.setStarMap(false); ck('关着：每次重击都定身', g.crushStunReady(2100) && g.crushStunReady(2101)); SM.setStarMap(true);
  const c = new RG.RunGrowth('guanyu'); c.heroLevel = 30; const before = c.allyDamageMultiplier();
  c.setStars(['command.G', 'command.T1', 'command.T2', 'command.C1', 'command.NC']);
  const cmd = 1 + AT.ATTRIBUTE_EFFECT.command.allyDamage * c.pts('command');
  ck('励军进部曲伤害加法桶：桶 = +15%，相加后再乘统御点数那一项', c.allyDamageBucket() === AT.PRIMARY_PERK.command.allyDamage && c.allyDamageMultiplier() === cmd * (1 + c.allyDamageBucket()) && c.allyDamageMultiplier() > before && new RG.RunGrowth('guanyu').allyDamageBucket() === 0, [before, c.allyDamageMultiplier()]);
  const z = new RG.RunGrowth('zhuge'); z.heroLevel = 12; z.setStars(SM.presetStars('zhuge', 9));
  ck('诸葛亮 9 星：凝神、连珠生效，广域没有；攻速含凝神', z.perk('intellect', 1) && z.perk('intellect', 2) && !z.perk('intellect', 3) && z.primaryTier() === 2 && z.attackSpeedMultiplier(0) > 1.1 && z.areaMultiplier() === 1 + AT.ATTRIBUTE_EFFECT.intellect.area * z.pts('intellect'));
  ck('每升 1 级 1 颗星（Lv25 以后也不减速）', RG.attributePointsBetween(24, 40) === 16 && RG.attributePointsBetween(40, 70) === 30 && RG.levelsToNextAttributePoint(45) === 1);
  const player = { maxHp: 100, healed: 0, heal(n) { this.healed += n; } }, l = new RG.RunGrowth('guanyu'); l.unallocated = 2;
  ck('战斗内点亮：花 1 颗、点不到的不花、没星不能点', l.lightStar(player, 'strength.T2') === false && l.lightStar(player, 'strength.T1') && l.unallocated === 1 && l.attributes.strength === 1 && l.lightStar(player, 'strength.T2') && l.lightStar(player, 'strength.C1') === false && same(l.stars, ['strength.T1', 'strength.T2']));
  l.syncStars(['strength.T1'], true); const kept = [...l.stars]; l.syncStars(['strength.T1'], false);
  ck('换关 syncStars：同章连打保留本局点的，新开一场按存档', same(kept, ['strength.T1', 'strength.T2']) && same(l.stars, ['strength.T1']) && l.attributes.strength === 1);
  SM.setStarMap(false);
  ck('关着：lightStar 不生效', new RG.RunGrowth('guanyu').lightStar(player, 'strength.T1') === false);
}

// ⑨ 第二期：12 颗新要星的效果（数值 = 设计稿第 4 节的表）
{
  SM.setStarMap(true);
  const E = SM.STAR_EFFECT, ALL = SM.STAR_NODES.filter(n => n.kind !== 'keystone').map(n => n.id), id = name => byName.get(name).id;
  const base = SM.presetStars('guanyu', 9); // 千钧、破阵 + 7 力量小星，没有任何新要星
  const mk = (hero, extra = [], level = 30) => { const g = new RG.RunGrowth(hero); g.heroLevel = level; g.stars = [...extra]; return g; }; // 直接写 stars：只开某一颗的效果，点数不变
  const a = mk('guanyu'), near = [100, 100], far = [200, 100];
  ck('没点新要星：十二项都是「没有效果」', a.critDamageBonus() === 0 && a.pickupMultiplier() === 1 && same(a.dotBonus(), { mul: 1, extraMs: 0 }) && a.jinnangMultiplier() === 1 && a.allyBossTakenMultiplier() === 1 && a.allyNearDamageFactor(0, 0) === 1 && a.allyNearTakenFactor(0, 0) === 1 && a.starHit(0, true, true, false) === 1 && a.allyDamageBucket() === 0);
  { const g = mk('guanyu', [id('铁骨')]); ck('铁骨：生命上限 +8%（基础生命的），受伤 −5%', g.bonusMaxHp() > a.bonusMaxHp() && Math.abs((g.bonusMaxHp() - a.bonusMaxHp()) / a.bonusMaxHp() * (AT.ATTRIBUTE_EFFECT.strength.hp * a.pts('strength')) - .08) < .002 && Math.abs(g.incomingDamageMultiplier() / a.incomingDamageMultiplier() - .95) < 1e-12, [a.bonusMaxHp(), g.bonusMaxHp()]); }
  { const g = mk('guanyu', [id('背水')]); g.hpRatio = .41; const hi = g.damageMultiplier(0); g.hpRatio = .39; const lo = g.damageMultiplier(0); ck('背水：生命低于 40% 时伤害 +15%（40% 以上没有）', hi === a.damageMultiplier(0) && Math.abs(lo / hi - 1.15) < 1e-12, [hi, lo]); }
  { const g = mk('zhaoyun', [id('连击')]); ck('连击：暴击伤害 +20%', g.critDamageBonus() === .2); }
  { const g = mk('zhaoyun', [id('追风')]), z = mk('zhaoyun'); g.recordMovement(0, .016); z.recordMovement(0, .016); const still = g.attackSpeedMultiplier(0) === z.attackSpeedMultiplier(0); g.recordMovement(3, .016); z.recordMovement(3, .016);
    ck('追风：移动中攻速 +8%（站着没有），拾取范围 +20%', still && Math.abs(g.attackSpeedMultiplier(0) / z.attackSpeedMultiplier(0) - 1.08) < 1e-12 && g.pickupMultiplier() === 1.2 && z.pickupMultiplier() === 1); }
  { const g = mk('zhuge', [id('余烬')]); ck('余烬：持续伤害 +20%、多烧 1 秒', same(g.dotBonus(), { mul: 1.2, extraMs: 1000 })); }
  { const g = mk('zhuge', [id('妙算')]); ck('妙算：锦囊效果 ×1.15', g.jinnangMultiplier() === 1.15); }
  { const g = mk('liubei', [id('严阵')]), z = mk('liubei'); ck('严阵：部曲生命 +15%，部曲受首领伤害 −15%', Math.abs(g.allyHpMultiplier() / z.allyHpMultiplier() - 1.15) < 1e-12 && g.allyBossTakenMultiplier() === .85); }
  { const g = mk('liubei', [id('号令')]), g2 = mk('liubei', [id('号令'), id('励军')]);
    ck('号令：主将身边（220 内）的部曲 +12%，进加法桶——单点时 ×1.12，和励军一起是 (1 + 15% + 12%) 而不是 ×1.15 ×1.12', g.allyNearDamageFactor(...near) === 1.12 && g.allyNearDamageFactor(...far) === 1 && g.allyNearDamageFactor(220, 0) === 1.12 && g.allyNearDamageFactor(221, 0) === 1 && Math.abs(g2.allyNearDamageFactor(...near) * (1 + g2.allyDamageBucket()) - 1.27) < 1e-12 && g2.allyDamageBucket() === .15, [g2.allyNearDamageFactor(...near), SM.STAR_NEAR_RADIUS]); }
  { const g = mk('zhaoyun', [id('骁锐')]), z = mk('zhaoyun'); ck('骁锐：武器伤害 +6%（非武器伤害不加），攻速 +6%', g.starHit(0, true, false, false) === 1.06 && g.starHit(0, false, false, false) === 1 && Math.abs(g.attackSpeedMultiplier(0) / z.attackSpeedMultiplier(0) - 1.06) < 1e-12); }
  { const g = mk('zhaoyun', [id('奇谋')]);
    const before = g.starHit(1000, false, false, false), critHit = g.starHit(1000, true, true, true), within = g.starHit(3999, false, false, false), spellWeapon = g.starHit(2000, true, false, true), physical = g.starHit(2000, true, false, false), after = g.starHit(4000, false, false, false);
    ck('奇谋：暴击后 3 秒内法术伤害 +12%（非武器伤害、法术武器的命中），物理武器命中不加，触发的那一下本身不加，过 3 秒没有', before === 1 && critHit === 1 && within === 1.12 && spellWeapon === 1.12 && physical === 1 && after === 1, [before, critHit, within, spellWeapon, physical, after]); }
  { const g = mk('zhuge', [id('帷幄')]), g2 = mk('zhuge', [id('帷幄'), id('励军')]); ck('帷幄：每 1 点智力生效点部曲伤害 +0.8%，和励军相加', Math.abs(g.allyDamageBucket() - .008 * g.pts('intellect')) < 1e-12 && g.pts('intellect') > 5 && Math.abs(g2.allyDamageBucket() - (.15 + .008 * g2.pts('intellect'))) < 1e-12 && g2.allyDamageMultiplier() === (1 + AT.ATTRIBUTE_EFFECT.command.allyDamage * g2.pts('command')) * (1 + g2.allyDamageBucket()), [g.pts('intellect'), g.allyDamageBucket()]); }
  { const g = mk('guanyu', [id('身先士卒')]); ck('身先士卒：主将身边的部曲受伤 −10%，主将生命上限 +6%', g.allyNearTakenFactor(...near) === .9 && g.allyNearTakenFactor(...far) === 1 && g.bonusMaxHp() > a.bonusMaxHp() && mk('guanyu', [id('身先士卒'), id('铁骨')]).bonusMaxHp() - a.bonusMaxHp() === Math.round((mk('guanyu', [id('铁骨')]).bonusMaxHp() - a.bonusMaxHp()) * 14 / 8), [a.bonusMaxHp(), g.bonusMaxHp()]); }
  { const g = mk('zhaoyun', [id('游刃')]); ck('闪避合计封顶 20%（现在只有游刃 10%）', g.dodgeChance() === .1 && SM.STAR_TUNING.dodgeCap === .2); }
  // 统御一路全拿：励军 + 帷幄 + 号令（身边）相加，不相乘
  { const g = mk('liubei', [id('励军'), id('帷幄'), id('号令')]), b = g.allyDamageBucket(); ck('部曲伤害桶：励军 + 帷幄 + 号令相加后再乘统御那一项', Math.abs(g.allyDamageMultiplier() * g.allyNearDamageFactor(0, 0) - (1 + AT.ATTRIBUTE_EFFECT.command.allyDamage * g.pts('command')) * (1 + b + .12)) < 1e-12, [b]); }
  // 开关关着：星全亮也没有任何效果
  SM.setStarMap(false);
  const off = mk('guanyu', ALL), none = mk('guanyu'); off.hpRatio = none.hpRatio = .2; off.recordMovement(3, .016); none.recordMovement(3, .016); off.spellSurgeUntil = 1e9;
  ck('开关关着：星全亮也没有任何效果（十二项都是中性值，原有数值不变）', off.critDamageBonus() === 0 && off.pickupMultiplier() === 1 && same(off.dotBonus(), { mul: 1, extraMs: 0 }) && off.jinnangMultiplier() === 1 && off.allyBossTakenMultiplier() === 1 && off.allyNearDamageFactor(0, 0) === 1 && off.allyNearTakenFactor(0, 0) === 1 && off.starHit(0, true, true, true) === 1 && off.starHit(0, false, false, false) === 1 && off.allyDamageBucket() === 0
    && off.damageMultiplier(0) === none.damageMultiplier(0) && off.attackSpeedMultiplier(0) === none.attackSpeedMultiplier(0) && off.bonusMaxHp() === none.bonusMaxHp() && off.incomingDamageMultiplier() === none.incomingDamageMultiplier() && off.allyHpMultiplier() === none.allyHpMultiplier() && off.allyDamageMultiplier() === none.allyDamageMultiplier());
}
// ⑪ 第三期：4 颗主星（数值 = 设计稿第 4 节的表）
{
  SM.setStarMap(true);
  const id = name => byName.get(name).id, mk = (hero, extra = [], level = 30) => { const g = new RG.RunGrowth(hero); g.heroLevel = level; g.stars = [...extra]; return g; };
  const near = x => Math.abs(x) < 1e-12;
  { const a = mk('guanyu'), g = mk('guanyu', [id('万人敌')]);
    ck('万人敌：主将全伤害 +15%，对首领再 +5%（精锐、小兵不加），部曲伤害 −30%', near(g.damageMultiplier(0) / a.damageMultiplier(0) - 1.15) && near(g.gearHitMultiplier('boss') / a.gearHitMultiplier('boss') - 1.05) && g.gearHitMultiplier('elite') === a.gearHitMultiplier('elite') && g.gearHitMultiplier('infantry') === 1 && g.allyDamageBucket() === -.3 && near(g.allyDamageMultiplier() / a.allyDamageMultiplier() - .7), [a.damageMultiplier(0), g.damageMultiplier(0)]); }
  { const a = mk('zhaoyun'), g = mk('zhaoyun', [id('一骑当千')]), g2 = mk('zhaoyun', [id('一骑当千'), id('游刃')]);
    ck('一骑当千：暴击 +10%，闪避 +10%（和游刃合计封顶 20%），生命上限 ×0.8', near(g.criticalBonus() - a.criticalBonus() - .1) && g.dodgeChance() === .1 && g2.dodgeChance() === .2 && SM.STAR_TUNING.dodgeCap === .2 && g.maxHpMultiplier() === .8 && a.maxHpMultiplier() === 1, [g.dodgeChance(), g2.dodgeChance()]); }
  { const a = mk('zhuge'), g = mk('zhuge', [id('火烧连营')]), P = SM.STAR_PYRE;
    const took = [0, 100, 200, 300, 400, 500, 600, 999, 1000, 1050, 1100].map(t => g.pyreTake(t));
    ck('火烧连营：法术武器冷却 +15%（攻速 ÷1.15）；爆燃任意 1 秒内最多 6 次', near(g.attackSpeedMultiplier(0) / a.attackSpeedMultiplier(0) - 1 / 1.15) && same(took, [true, true, true, true, true, true, false, false, true, false, true]) && a.pyreTake(0) === false, took);
    ck('火烧连营的常量：范围 / 比例 / 每秒上限 / 基准兵种', P.radius === 90 && P.ratio === .1 && P.perSecond === 6 && P.windowMs === 1000 && P.basis === 'infantry', P); }
  { const a = mk('liubei'), g = mk('liubei', [id('三军统帅')]), both = mk('liubei', [id('三军统帅'), id('万人敌')]), full = mk('liubei', [id('三军统帅'), id('励军'), id('号令')]);
    ck('三军统帅：部曲伤害 +30%（进桶）、部曲生命 +20%、免费招兵 +1；主将自身伤害 −25%', g.allyDamageBucket() === .3 && near(g.allyDamageMultiplier() / a.allyDamageMultiplier() - 1.3) && near(g.allyHpMultiplier() / a.allyHpMultiplier() - 1.2) && g.freeRecruitBonus() === 1 && mk('liubei', [id('三军统帅'), id('募众')]).freeRecruitBonus() === 2 && near(g.damageMultiplier(0) / a.damageMultiplier(0) - .75));
    ck('万人敌 + 三军统帅：部曲伤害正好抵消，主将伤害 ×1.15 ×0.75', near(both.allyDamageBucket()) && near(both.allyDamageMultiplier() - a.allyDamageMultiplier()) && near(both.damageMultiplier(0) / a.damageMultiplier(0) - 1.15 * .75));
    ck('统御一路：励军 + 三军统帅 + 号令（身边）= 1 + 15% + 30% + 12%，不相乘', near(full.allyDamageMultiplier() * full.allyNearDamageFactor(0, 0) / a.allyDamageMultiplier() - 1.57), [full.allyDamageBucket()]); }
  SM.setStarMap(false);
  const off = mk('zhaoyun', SM.STAR_NODES.map(n => n.id)), none = mk('zhaoyun');
  ck('开关关着：四颗主星都点着也没有任何效果', off.maxHpMultiplier() === 1 && off.pyreTake(0) === false && off.freeRecruitBonus() === none.freeRecruitBonus() && off.criticalBonus() === none.criticalBonus() && off.dodgeChance() === none.dodgeChance() && off.damageMultiplier(0) === none.damageMultiplier(0) && off.attackSpeedMultiplier(0) === none.attackSpeedMultiplier(0) && off.gearHitMultiplier('boss') === none.gearHitMultiplier('boss') && off.allyDamageMultiplier() === none.allyDamageMultiplier() && off.allyHpMultiplier() === none.allyHpMultiplier());
}
// ⑫ 第四期：战斗内反馈（触发信号、状态、图标与特效挂点的数据表）
{
  SM.setStarMap(true);
  const id = name => byName.get(name).id, mk = (hero, extra = []) => { const g = new RG.RunGrowth(hero); g.heroLevel = 30; g.stars = [...extra]; return g; };
  const named = SM.STAR_NODES.filter(n => n.kind === 'notable' || n.kind === 'keystone');
  ck('28 颗要星 / 主星都有图标，文件都在 public/assets/star-map/', named.length === 28 && named.every(n => FX.STAR_ICON_FILE[n.id] && existsSync(join(root, 'public', FX.starIconUrl(n.id)))) && Object.keys(FX.STAR_ICON_FILE).length === 28 && FX.starIconKey('strength.NL1') === 'sm_icon_pozhen', named.filter(n => !FX.STAR_ICON_FILE[n.id]).map(n => n.name));
  const kinds = k => Object.entries(FX.STAR_FEEDBACK).filter(e => e[1] === k).map(e => SM.starNode(e[0]).name).sort();
  ck('反馈分类：触发式 = 破阵 / 连珠 / 游刃 / 火烧连营，限时式 = 疾影 / 奇谋，状态式 = 背水 / 号令 / 身先士卒 / 追风', same(kinds('trigger'), ['破阵', '连珠', '游刃', '火烧连营'].sort()) && same(kinds('timed'), ['疾影', '奇谋'].sort()) && same(kinds('state'), ['背水', '号令', '身先士卒', '追风'].sort()));
  const fx = Object.entries(FX.STAR_FX);
  ck('特效挂点表：8 项（背水 / 万人敌 / 三军统帅 / 半径环 / 破阵 / 连珠 / 游刃 / 火烧连营），每项有贴图 key、帧数、帧率、锚点、缩放', same(fx.map(e => e[0]).sort(), ['beishui', 'haoling', 'huoshao', 'lianzhu', 'pozhen', 'sanjun', 'wanrendi', 'youren']) && fx.every(([, d]) => d.key.startsWith('star_fx_') && d.url.startsWith('assets/star-map/fx/') && d.frames > 0 && (d.fps > 0 || d.frames === 1) && d.alpha > 0 && d.alpha <= 1 && d.frameW > 0 && d.frameH > 0 && d.scale > 0 && d.anchor.x >= 0 && d.anchor.y <= 1 && SM.starNode(d.star)) && same(fx.filter(e => e[1].mode === 'loop').map(e => e[0]).sort(), ['beishui', 'haoling', 'sanjun', 'wanrendi']));
  ck('特效表里标了 ready 的项，图一定已经在 fx 目录里（没到位的必须是 ready = false，不会去加载）', fx.every(([, d]) => !d.ready || existsSync(join(root, 'public', d.url))), fx.filter(e => e[1].ready).map(e => e[0]));
  { const J = JSON.parse(readFileSync(join(root, 'public/assets/star-map/fx/fx.json'), 'utf8')), ready = fx.filter(e => e[1].ready);
    const bad = ready.filter(([k, d]) => { const j = J[k]; return !j || d.url !== 'assets/star-map/fx/' + j.file || d.frames !== j.frames || d.frameW !== j.frame[0] || d.frameH !== j.frame[1] || d.fps !== j.fps || Math.abs(d.anchor.x - j.anchor[0] / j.frame[0]) > 1e-9 || Math.abs(d.anchor.y - j.anchor[1] / j.frame[1]) > 1e-9 || Math.abs(d.frameW * d.scale - j.display[0]) > 1e-9 || Math.abs(d.frameH * d.scale - j.display[1]) > 1e-9 || (d.frames > 1 && (d.mode === 'loop') !== j.loop); }).map(e => e[0]);
    const T = FX.STAR_FX;
    ck('8 个特效都已接上，参数与美术的 fx.json 逐项一致（帧数 / 单帧尺寸 / 帧率 / 锚点 / 显示尺寸 / 是否循环），fx.json 里的每一项也都在表里', ready.length === 8 && bad.length === 0 && same(Object.keys(J).filter(k => k !== 'note').sort(), fx.map(e => e[0]).sort()) && FX.STAR_FX_FOOT === 26, bad);
    ck('透明度与层次：万人敌 .7 贴地、光环 .35 贴地、帅旗 .8 在主将之下、火环贴地、背水在主将之上；游刃按朝向翻转；光环点亮号令或身先士卒都显示', T.wanrendi.alpha === .7 && T.wanrendi.layer === 'ground' && T.haoling.alpha === .35 && T.haoling.layer === 'ground' && T.haoling.alsoStar === 'bridge3.h' && T.haoling.when === 'lit' && T.sanjun.alpha === .8 && T.sanjun.layer === 'under' && T.huoshao.layer === 'ground' && T.huoshao.at === 'kill' && T.beishui.layer === 'over' && T.beishui.when === 'state' && T.youren.flipWithFacing === true && !('fxRadius' in SM.STAR_PYRE)); }
  { const g = mk('guanyu', [id('破阵'), id('连珠')]); g.crushMul({ x: 5, y: 6 }); g.crushMul(); const p = g.takePulses();
    ck('破阵重击发触发信号（带命中点），取走后清空；没点亮的星不发', same(p, [{ id: 'strength.NL1', x: 5, y: 6 }, { id: 'strength.NL1' }]) && g.takePulses().length === 0 && (mk('guanyu').crushMul({ x: 1, y: 1 }), mk('guanyu').takePulses().length === 0)); }
  { const g = mk('zhuge', [id('连珠')]); let doubled = 0; for (let i = 0; i < 400; i++) if (g.spellEcho({ x: 1, y: 2 }) === 2) doubled++; const p = g.takePulses();
    ck('连珠翻倍几次就发几次信号（积压最多 64 条）', doubled > 20 && p.length === Math.min(64, doubled) && p.every(x => x.id === 'intellect.NL1' && x.x === 1), [doubled, p.length]); }
  { const g = mk('zhaoyun', [id('游刃'), id('一骑当千')]); let dodged = 0; for (let i = 0; i < 300; i++) { if (g.rollDodge()) dodged++; } const p = g.takePulses();
    ck('闪避（合计 20%）：闪掉一次，游刃和一骑当千各发一个信号', dodged > 30 && dodged < 100 && p.length === Math.min(64, dodged * 2) && p[0].id === 'agility.NL1' && p[1].id === 'agility.K', [dodged]); }
  { const g = mk('zhuge', [id('火烧连营')]); const ok = g.pyreTake(100, 7, 8); ck('火烧连营爆燃发信号（带击杀点）', ok && same(g.takePulses(), [{ id: 'intellect.K', x: 7, y: 8 }])); }
  { const g = mk('zhaoyun', [id('背水'), id('追风'), id('号令'), id('身先士卒'), id('疾影'), id('奇谋'), id('千钧')]);
    g.hpRatio = .5; g.recordMovement(0, .016); const a = ['strength.NR2', 'agility.NR2', 'command.NR2', 'bridge3.h', 'agility.NL2', 'bridge1.h', 'strength.NC'].map(x => g.starActive(x, 1000, false));
    g.hpRatio = .3; g.recordMovement(3, .016); g.hasteUntil = 2000; g.starHit(900, true, true, false); const b = ['strength.NR2', 'agility.NR2', 'command.NR2', 'bridge3.h', 'agility.NL2', 'bridge1.h', 'strength.NC'].map(x => g.starActive(x, 1000, true));
    ck('状态：背水看残血、追风看移动、号令 / 身先士卒看身边有没有部曲、疾影 / 奇谋看暴击后的时间；常驻的星和没点亮的星返回 null', same(a, [false, false, false, false, false, false, null]) && same(b, [true, true, true, true, true, true, null]) && g.starActive('bridge1.h', 3900, true) === false && mk('zhaoyun').starActive('strength.NR2', 0, true) === null, [a, b]); }
  SM.setStarMap(false);
  { const g = mk('zhaoyun', SM.STAR_NODES.map(n => n.id)); g.crushMul({ x: 1, y: 1 }); for (let i = 0; i < 50; i++) { g.spellEcho(); g.rollDodge(); } g.pyreTake(0, 1, 1); g.pulse('strength.NL1');
    ck('开关关着：不发任何信号，状态一律 null', g.takePulses().length === 0 && g.starActive('strength.NR2', 0, true) === null && g.starActive('agility.NR2', 0, true) === null); }
  // 掷骰次数与原来一致：rollDodge 每次只调一次 Math.random（原来是 Math.random() < dodgeChance()）
  { const r = Math.random; let calls = 0; Math.random = () => { calls++; return .99; }; const g = mk('zhaoyun'); for (let i = 0; i < 25; i++) g.rollDodge(); Math.random = r; ck('闪避改走 rollDodge 后仍是每次只掷一次骰子', calls === 25, calls); }
}
// ⑩ 第二期：开关打开时的显示
{
  SM.setStarMap(true);
  const lit = SM.presetStars('guanyu', 9), s = PA.primarySummary('guanyu', 7, 10, lit);
  ck('专精小标按星是否点亮：关羽 9 星 = 千钧、破阵亮，斩将还差 2 星；破阵说明写 ×1.6', same(s.tiers.map(t => t.on), [true, true, false]) && s.tiers[2].left === 2 && same(s.chips, ['◆ 千钧', '◆ 破阵', '◇ 斩将 · 还差 2 星']) && s.tiers[1].desc.includes('×1.6') && !s.tip.body.includes('×2') && s.next.includes('斩将'), s.chips);
  const z = PA.primarySummary('zhaoyun', 10, 10, ['agility.T1']);
  ck('点数够 10 但没点要星：一档都不亮（不再按 4 / 7 / 10 点）', z.tiers.every(t => !t.on) && same(z.tiers.map(t => t.left), [3, 4, 6]), z.chips);
  ck('「属性点 N 未加」改「N 星未点」（行营 / 结算 / 营寨），玩法卡叫「星图」', PH.pointsLeftText(3) === '3 星未点' && PH.pointsResultLine({ n: 3, where: 'X' }) === '星图  3 星未点 · 去X点亮' && PH.pointsCityToast(3).includes('3 星未点') && MU.MECHANICS.attributes.name === '星图' && MU.MECHANICS.attributes.tip.includes('星图') && PH.pointsHint(2, { world: false, battle: true }).where.includes('星图'));
  SM.setStarMap(false);
  ck('开关关着：字样照旧', PH.pointsLeftText(3) === '属性点 3 未加' && PH.pointsResultLine({ n: 3, where: 'X' }) === '属性点  3 点未加 · 去X加点' && PH.pointsCityToast(3) === '有 3 点属性点没加 · 主帐「武将谱」里加点' && MU.MECHANICS.attributes.name === '四维加点' && MU.MECHANICS.attributes.tip.startsWith('按 C（头像旁「属性」）') && PA.primarySummary('guanyu', 7, 10, lit).chips[2] === '◇ 斩将 · 再加 3 点');
}

// ⑧ 开关关闭时与改动前（BASE 提交）逐项相同
{
  let haveBase = true; try { execFileSync('git', ['cat-file', '-e', BASE + '^{commit}'], { stdio: 'ignore' }); } catch { haveBase = false; }
  if (!haveBase) ck(`对照提交 ${BASE} 不在本仓库里（STAR_BASE 可改）`, false);
  else {
    const snapshot = M => {
      const { RG, HP, MS, AT, PA, PH, MU } = M, out = [], ALLSTARS = SM.STAR_NODES.map(n => n.id);
      for (const hero of ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong', 'zhuge', 'diaochan', 'liubei', 'mengde', 'lvbu', 'zhurong'])
        for (const [level, attrs] of [[1, [0, 0, 0, 0]], [5, [4, 0, 0, 0]], [9, [0, 4, 3, 1]], [12, [7, 2, 0, 2]], [20, [0, 7, 7, 5]], [26, [10, 4, 4, 6]], [40, [3, 10, 10, 3]], [54, [12, 9, 4, 10]], [62, [14, 0, 10, 14]], [30, [0, 0, 0, 10]]]) {
          const g = new RG.RunGrowth(hero); g.heroLevel = level; ATTRS.forEach((a, i) => { g.attributes[a] = attrs[i]; });
          g.hasteUntil = 5000; g.stars = ALLSTARS; g.hpRatio = .2; g.lowHp = level % 2 === 0; g.recordMovement(level % 3 ? 3 : 0, .016); // 星全亮、残血、移动中：开关关着都不该有影响（旧代码里这几个字段没人读）
          out.push([PA.primarySummary(hero, attrs[ATTRS.indexOf(AT.primaryAttribute(hero))], 10), g.aimCriticalBonus(), g.masteryLabel()]);
          out.push([hero, level, ATTRS.map(a => g.pts(a)), g.primaryTier(), ATTRS.flatMap(a => [1, 2, 3].map(t => g.perk(a, t))), g.damageMultiplier(0), g.attackSpeedMultiplier(0), g.movementMultiplier(), g.criticalBonus(), g.bonusMaxHp(),
            g.incomingDamageMultiplier(), g.allyDamageMultiplier(), g.allyHpMultiplier(), g.primaryBonus(), g.spellWeaponMultiplier('flame_banner'), g.spellWeaponMultiplier('spear_orbit'), g.skillDamageMultiplier(), g.areaMultiplier(), g.dodgeChance(),
            g.freeRecruitBonus(), g.followerRevive(), g.gearHitMultiplier('boss'), g.gearHitMultiplier('elite'), g.gearHitMultiplier('minion'), g.hasAttributeRoom]);
        }
      out.push([PH.pointsHint(3, { world: true, battle: true }), PH.pointsHint(3, { world: false, battle: true }), PH.pointsGuideText({ n: 3, where: 'X' }), MU.MECHANICS.attributes.name, MU.MECHANICS.attributes.tip, JSON.stringify(MU.MECHANICS.attributes)]);
      out.push(Array.from({ length: 80 }, (_, i) => [RG.attributePointsBetween(1, i + 1), RG.attributePointsBetween(i + 1, i + 4), RG.levelsToNextAttributePoint(i + 1), AT.attributePointsAt(i + 1)]));
      // HeroProgress / MasteryStore：同一串操作，比返回值和最后的存档原文
      store.clear(); HP.resetHeroCache(); MS.resetMasteryCache();
      const ops = [];
      ops.push(HP.enlistHero('guanyu'), HP.creditHeroXp('guanyu', 5000), HP.heroFreePoints('guanyu'), HP.allocateHeroAttr('guanyu', 'strength'), HP.allocateHeroAttr('guanyu', 'strength'), HP.allocateHeroAttr('guanyu', 'command'), HP.heroAttrs('guanyu'), HP.heroFreePoints('guanyu'), HP.heroStatE('guanyu', 'strength'), HP.heroStatE('guanyu', 'agility'));
      ops.push(HP.enlistHero('zhuge'), HP.creditHeroXp('zhuge', 1200), HP.allocateHeroAttr('zhuge', 'intellect'), HP.heroInfo('zhuge'), MS.respecCost('guanyu'), MS.respec('guanyu'), HP.heroAttrs('guanyu'), HP.heroFreePoints('guanyu'), MS.respecCost('guanyu'), HP.pointsAt(30), HP.heroFreePoints('r_3'), HP.heroAttrs('r_3'));
      HP.resetHeroCache(); ops.push(HP.heroAttrs('zhuge'), HP.heroInfo('guanyu'));
      const saves = [store.get(HP.HEROES_KEY), store.get(MS.MASTERY_KEY)].map(s => JSON.stringify(JSON.parse(s)));
      return { out, ops, saves };
    };
    SM.setStarMap(false);
    const now = snapshot({ RG, HP, MS, AT, PA, PH, MU }), was = snapshot(await load(ENTRY_BASE, true));
    ck(`开关关闭：RunGrowth 的数值与 ${BASE} 逐项相同（10 位武将 × 10 组点数 × 25 项，另 80 个等级的点数表）`, same(now.out, was.out), now.out.length);
    ck(`开关关闭：HeroProgress / 洗点的返回值与 ${BASE} 相同`, same(now.ops, was.ops), now.ops.length);
    ck(`开关关闭：没点过星时存档原文与 ${BASE} 相同（不多出字段）`, same(now.saves, was.saves), now.saves[0].length);
  }
}
console.log(`\n${fail ? 'FAILED' : 'OK'} · ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
