// 随行用本命武器（用户 2026-11-16「随行武将要用他们自己的攻击」）：12 名可玩武将分 4 批当随行，
// 检查每人都用自己的武器出手、不计入主将输出 / 被动层数 / 技艺、武器等级按随行等级映射、特效在半透明图层，
// 以及 150 敌人 + 3 随行时的帧率。需要开发服务器；只测电脑布局。用法：BASE=http://127.0.0.1:5173/ node tools/test-follower-weapons.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const ALL = ['zhaoyun', 'guanyu', 'huangzhong', 'zhuge', 'zhangfei', 'machao', 'weiyan', 'liubei', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'];
const batches = [['zhaoyun', ['guanyu', 'huangzhong', 'zhuge']], ['zhaoyun', ['zhangfei', 'machao', 'weiyan']], ['zhaoyun', ['liubei', 'pangtong', 'huangyueying']], ['guanyu', ['sunshangxiang', 'diaochan', 'zhaoyun']]];
const rec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const roster = (lord, fs) => ({ version: 1, lord, lordFinal: true, owned: [rec(lord), ...fs.map(rec)], followers: fs, offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 3 });
// 随行上限 / 招贤馆等级读营寨（fa1c773）：营寨 town 只从 version ≥ 8 的存档读入，主营 1 级时其他建筑被压回 1 级 → 种 version 8 + 主营 3、招贤馆 3
const world = { version: 8, town: { levels: { hall: 3, barracks: 1, farm: 1, talent: 3 } }, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const zero = { strength: 0, agility: 0, intellect: 0, command: 0 };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: { huangzhong: { level: 15, xp: 0, attributes: zero } } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.addInitScript(([w, h, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, heroes, roster(...batches[0])]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const G = "window.__game.scene.getScene('GameScene')";
const restart = async (lord, fs) => {
  await p.evaluate(([G0, r, lord]) => { localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: lord, weapon: undefined }); window.__prevPlayer = s.player; s.scene.restart(); }, [G, roster(lord, fs), lord]);
  await p.waitForTimeout(500);
  await p.waitForFunction(([lord, n]) => { const s = window.__game.scene.getScene('GameScene'); // 认准重启后新建的主将对象（同一主将连测两批时，旧场景上条件也成立，会抢跑）
    return s?.player && s.player !== window.__prevPlayer && s.runConfig?.character === lord && (s.followers?.members.length ?? 0) === n && s.__DEV_ACTIONS; }, [lord, fs.length], { timeout: 60000 });
  await p.waitForTimeout(800);
};
const seen = new Set();
for (const [lord, fs] of batches) {
  await restart(lord, fs);
  const r = await p.evaluate(async G0 => {
    const s = eval(G0), pl = s.player, f = s.followers;
    pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
    pl.weapons = []; // 只看随行：主将不出手
    // 记录不是友军结算的命中（战场道具爆炸等环境伤害除外），按调用来源分组
    const leak = {}; const orig = s.hitEnemy.bind(s); s.hitEnemy = (e, d, t, src, fromAlly = false, wh = true) => { if (!fromAlly) { const st = new Error().stack; if (!/Supplies|supplies/.test(st)) { const k = src + ' < ' + st.split('\n').slice(2, 4).map(x => x.trim().replace(/\(.*\//, '(')).join(' < '); leak[k] = (leak[k] ?? 0) + d; } } return orig(e, d, t, src, fromAlly, wh); };
    s.playerDamageDealt = 0; const allyBefore = s.allyDamageDealt ?? 0, stacks0 = pl.passive.snapshot(s.combatNow).stacks ?? 0, mast0 = JSON.stringify(pl.growth.masteries);
    const t0 = s.combatNow; let wave = 0; // 按游戏内时间等 4.5 秒（满载时帧数低，游戏时间比真实时间慢；诸葛亮随行约 2.6 秒才挥一次旗）
    while (s.combatNow - t0 < 4500) {
      if (s.enemies.filter(e => e.active && !e.isSupplySlot).length < 18) { wave++; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + wave; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 110, pl.y + Math.sin(a) * 110, 6); } }
      await new Promise(r => setTimeout(r, 120));
    }
    s.hitEnemy = orig; delete s.hitEnemy;
    return {
      members: f.members.map(m => ({ hero: m.recruit.hero, run: !!m.weaponRun, hits: m.hits, wl: m.weaponLevel, lv: m.level })),
      lordDamage: Object.values(leak).reduce((a, b) => a + b, 0), leak, envDamage: s.playerDamageDealt, allyGain: Math.round((s.allyDamageDealt ?? 0) - allyBefore), stacks: (pl.passive.snapshot(s.combatNow).stacks ?? 0) - stacks0, mastSame: JSON.stringify(pl.growth.masteries) === mast0,
      layer: (() => { const l = s.children.getByName('follower-fx'); return l ? { alpha: l.alpha, kids: l.list.length } : null; })(),
    };
  }, G);
  for (const m of r.members) { seen.add(m.hero); ck(`${m.hero} 随行用本命武器出手`, m.run && m.hits > 0, m); }
  ck(`[${fs.join(' / ')}] 不计入主将：主将输出 0、被动层数不涨、技艺不变`, r.lordDamage === 0 && r.stacks === 0 && r.mastSame && r.allyGain > 0, r);
  ck(`[${fs.join(' / ')}] 随行特效在半透明图层（不透明度 0.85）`, r.layer && Math.abs(r.layer.alpha - .85) < .01, r.layer);
  if (fs.includes('huangzhong')) { const hz = r.members.find(m => m.hero === 'huangzhong'); const want = lv => [1, 8, 15, 22, 30].filter(x => lv >= x).length; ck('武器等级按随行等级映射（1 / 8 / 15 / 22 / 30 级 → 武器 1–5 级）：黄忠 Lv.15 → 武器 3 级，其余按起始等级', hz.lv === 15 && hz.wl === 3 && r.members.every(m => m.wl === want(m.lv)), r.members); }
}
ck('12 名可玩武将都测到', ALL.every(h => seen.has(h)), [...seen]);
// 性能：150 敌人，有 / 无 3 名随行，各测 4 秒帧间隔
const perf = async (label, off = false) => p.evaluate(async ([G0, label, off]) => {
  const s0 = eval(G0); if (off) { s0.__parkedFollowers = s0.followers ?? s0.__parkedFollowers; s0.followers = null; } else if (s0.__parkedFollowers) { s0.followers = s0.__parkedFollowers; s0.__parkedFollowers = null; } // 暂停 / 恢复随行（同一场里交替测，排除预热与负载波动）
  if (!off && s0.followers) for (const m of s0.followers.members) { m.downed = false; m.act = null; m.maxHp = m.hp = 1e9; } // 测性能时随行不倒，保证一直在出手
  const s = eval(G0), pl = s.player; pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; await new Promise(r => setTimeout(r, 300));
  for (let i = 0; i < 150; i++) { const a = i / 150 * Math.PI * 2, d = 160 + (i % 5) * 50; s.spawnEnemy('infantry', pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d, 600); }
  const enemiesStart = s.enemies.filter(e => e.active && !e.isSupplySlot).length; // 测量开始时场上的敌人数（随行会边测边打死一些）
  const gaps = []; let last = performance.now(); const t0 = last;
  while (performance.now() - t0 < 4000) { await new Promise(r => requestAnimationFrame(r)); const now = performance.now(); gaps.push(now - last); last = now; }
  gaps.sort((a, b) => a - b); const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return { label, enemiesStart, enemies: s.enemies.filter(e => e.active).length, fps: Math.round(1000 / avg), p95: Math.round(gaps[Math.floor(gaps.length * .95)]), mines: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length + (s.children.getByName('follower-fx')?.list.filter(o => o.name === 'pangtong-mine').length ?? 0), fxKids: s.children.getByName('follower-fx')?.list.length ?? 0 };
}, [G, label, off]);
await restart('zhaoyun', ['guanyu', 'zhuge', 'pangtong']);
// 带 / 不带随行交替各测两次，各取帧率较好的一次
const runs = []; for (const off of [false, true, false, true]) runs.push(await perf(off ? '无随行' : '3 随行', off));
const best = off => runs.filter(r => (r.label === '无随行') === off).sort((a, b) => b.fps - a.fps)[0];
const withF = best(false), noF = best(true);
console.log('PERF', JSON.stringify(withF), JSON.stringify(noF));
ck('性能：150 敌人 + 3 随行（关羽 / 诸葛亮 / 庞统）帧率不低于无随行时的 85%', withF.fps >= noF.fps * .85 && withF.enemiesStart >= 140 && noF.enemiesStart >= 140, { withF, noF });
ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
