// 首领阶段防拖（data/bossStall.ts，用户 11-21「boss 出来后不打 boss 只刷小兵，是否可以无限刷」）：纯 node，不开浏览器。
// 1) 收益额度：首领登场后前 60 杂兵 / 2 精锐照常给，超出后随军粮、掉落（兵装 / 残卷）、战功、经验各一条断言；
// 2) 首领震怒：起点（默认 150 秒、12-3 按预期用时顺延）、每 20 秒一层、伤害 / 移速封顶，正常打法用时内不叠；
// 3) 额度用完刷兵再降一档但不空屏；4) GameScene / Player / BossHud / 攻城的接线静态检查（双首领、追兵、攻城守将、守城都走同一套）。
// 用法：node tools/test-boss-stall.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const C = await load('src/data/bossStall.ts'), S = C.BOSS_STALL;
const BAL = { enemyCap: 150, bossSpawn: { capMul: .5, intervalMul: 2, burstMul: .5, xpMul: 2 } }; // src/config.ts BALANCE（下面静态核对）

// ———— 1) 收益额度：照 GameScene.killEnemy 的发法记账（随军粮 Legion.onKill：杂兵 1 / 精锐 5；经验 def.xp × (grant.xpMul ?? 首领在场 ×2)）
const run = kills => {
  const q = new C.BossQuota(), out = { food: 0, drops: 0, merit: 0, xp: 0 };
  for (const k of kills) {
    const g = q.onKill(k);
    if (g.food) out.food += k === 'elite' ? 5 : k === 'courier' ? 1 + 15 : 1; // 押粮卒：本身 1 + 被截的粮 15（EnemyTraits gainFood）
    if (g.drops) out.drops++; // ItemDrops.onKill 掷一次（兵装 / 残卷）
    if (k === 'elite' && g.merit) out.merit++;
    out.xp += (k === 'elite' ? 10 : 2) * (g.xpMul ?? BAL.bossSpawn.xpMul);
  }
  return { ...out, spent: q.spent };
};
const N = S.quota.normal, E = S.quota.elite;
const inQ = run([...Array(N).fill('infantry'), ...Array(E).fill('elite')]);
const over = run([...Array(N).fill('infantry'), ...Array(E).fill('elite'), ...Array(40).fill('infantry'), ...Array(3).fill('elite')]);
const extra = { food: over.food - inQ.food, drops: over.drops - inQ.drops, merit: over.merit - inQ.merit, xp: over.xp - inQ.xp };
ck(`额度 ${N} 杂兵 / ${E} 精锐（派单建议 60 / 2）`, N === 60 && E === 2, S.quota);
ck('随军粮：额度内照常（60×1 + 2×5 = 70），超出的 40 杂兵 + 3 精锐一粒不给', inQ.food === 70 && extra.food === 0, { inQ: inQ.food, extra: extra.food });
ck('押粮卒被截的粮也算进额度：额度内 +16，超额 0', run(['courier']).food === 16 && run([...Array(N).fill('infantry'), 'courier']).food === N, { inside: run(['courier']).food });
ck('掉落（兵装 / 残卷）：额度内每杀掷一次（62 次），超出后不掷', inQ.drops === N + E && extra.drops === 0, { inQ: inQ.drops, extra: extra.drops });
ck('战功：额度内精锐 2 个记 2，超出的 3 个精锐不记', inQ.merit === 2 && extra.merit === 0, { inQ: inQ.merit, extra: extra.merit });
ck('经验：额度内杂兵 ×2（首领在场），超出 ×0.25 且不再 ×2', inQ.xp === N * 2 * 2 + E * 10 * 2 && extra.xp === 40 * 2 * .25 + 3 * 10 * .25, { inQ: inQ.xp, extra: extra.xp });
ck('额度用完才「刷兵再降一档」；首领本体不占额度', !run(Array(N - 1).fill('infantry')).spent && run(Array(N).fill('infantry')).spent && new C.BossQuota().onKill('boss') === C.GRANT_FULL);

// ———— 2) 震怒
const st = C.enrageStartSec('huangjin.3'), st12 = C.enrageStartSec('beifa.3'), R = S.enrage;
ck('起点：普通关 150 秒；12-3 司马懿按预期用时顺延（100 × 2.5 = 250 秒）', st === 150 && st12 === 250, { st, st12 });
ck('正常打法不叠层：章末首领 36–49 秒、诸葛亮慢局 87 秒、12-3 赢的局 80–100 秒都是 0 层', C.enrageStacks(49, st) === 0 && C.enrageStacks(87, st) === 0 && C.enrageStacks(100, st12) === 0 && C.enrageStacks(149.9, st) === 0);
ck('到点 1 层，之后每 20 秒一层', C.enrageStacks(150, st) === 1 && C.enrageStacks(169.9, st) === 1 && C.enrageStacks(170, st) === 2 && C.enrageStacks(330, st) === 10, [150, 170, 330].map(t => C.enrageStacks(t, st)));
const m1 = C.enrageMul(1), m10 = C.enrageMul(10), m30 = C.enrageMul(30);
ck('每层伤害 +10%、移速 +4%；封顶 +100% / +30%', Math.abs(m1.damage - 1.1) < 1e-9 && Math.abs(m1.speed - 1.04) < 1e-9 && m10.damage === 2 && m30.damage === 2 && Math.abs(m30.speed - 1.3) < 1e-9 && Math.abs(C.enrageMul(7).speed - 1.28) < 1e-9, { m1, m10, m30 });

// ———— 3) 刷兵
const capBoss = Math.round(BAL.enemyCap * BAL.bossSpawn.capMul), capSpent = Math.round(BAL.enemyCap * BAL.bossSpawn.capMul * S.spent.capMul);
ck(`额度用完：同屏上限 ${capBoss} → ${capSpent}、间隔 ×${S.spent.intervalMul}、每批 ×${S.spent.burstMul}（还留够割草的量，不空屏）`, capSpent < capBoss && capSpent >= 20 && S.spent.intervalMul > 1 && S.spent.burstMul > 0 && S.spent.burstMul < 1, { capBoss, capSpent });

// ———— 4) 接线
const src = p => readFileSync(join(root, p), 'utf8');
const G = src('src/scenes/GameScene.ts'), P = src('src/entities/Player.ts'), H = src('src/ui/BossHud.ts'), SG = src('src/scenes/SiegeGameScene.ts'), CF = src('src/config.ts');
ck('config.ts 首领在场的刷兵 / 经验倍率与本测试一致', /enemyCap: 150,/.test(CF) && /bossSpawn: \{ capMul: \.5, intervalMul: 2, burstMul: \.5, xpMul: 2 \}/.test(CF));
ck('首领登场（spawnBoss）：额度清零、震怒起点按关（hardKey.stage）', /this\.bossClearStage\(boss\);[^\n]*\n\s*this\.bossQuota\.reset\(\); this\.bossRageStart = enrageStartSec\(this\.hardKey\(\) \+ '\.' \+ this\.hardStage\(\)\);/.test(G));
ck('killEnemy：首领在场（双首领的主首领 / 攻城守将 / 守城都是 this.boss）的杂兵 / 精锐击杀记额度，城墙 / 补给位不记', /const grant = this\.boss\?\.active && !enemy\.isSupplySlot && enemy\.def\.behavior !== 'wall' \? this\.bossQuota\.onKill\(enemy\.kind\) : GRANT_FULL; this\.killGrant = grant;/.test(G));
ck('粮 / 掉落 / 战功 / 经验都看 grant', /if \(grant\.food\) this\.legion\.onKill\(enemy\);/.test(G) && /if \(grant\.drops\) this\.itemDrops\?\.onKill\(enemy\);/.test(G) && /else if\(enemy\.kind==='elite'&&grant\.merit\)this\.runMerit\.elite\+\+/.test(G) && /enemy\.def\.xp \* \(grant\.xpMul \?\? \(this\.boss\?\.active && enemy\.kind !== 'boss' \? BALANCE\.bossSpawn\.xpMul : 1\)\)/.test(G));
ck('押粮卒被截的粮（EnemyTraits gainFood）看 killGrant', /gainFood:n=>\{if\(this\.killGrant\.food\)this\.legion\.food\+=n;\}/.test(G));
ck('刷兵：额度用完后首领段的上限 / 间隔 / 每批再乘 BOSS_STALL.spent', /const spent = bossOn && this\.bossQuota\.spent, S = BOSS_STALL\.spent;/.test(G) && /B\.capMul \* \(spent \? S\.capMul : 1\)/.test(G) && /\* \(spent \? S\.intervalMul : 1\)/.test(G) && /B\.burstMul \* \(spent \? S\.burstMul : 1\)/.test(G));
ck('震怒每帧更新：主首领 + 双首领 + 追兵首领；只在可交战时计时；移速按比例叠乘；主将受伤倍率；一次横幅 + 血条印', /this\.updateBossRage\(dt\);/.test(G) && /for \(const x of this\.dual\?\.alive \?\? \[\]\)/.test(G) && /for \(const t of this\.chasingBosses\)/.test(G) && /if \(!e\.invulnerable && !this\.cutscene\?\.active[^\n]*e\.rageMs \+= dt \* 1000;/.test(G) && /speed: e\.def\.speed \* k/.test(G) && /this\.player\.rageTakenMul = enrageMul\(top\)\.damage;/.test(G) && /!this\.bossRageAnnounced\) \{ this\.bossRageAnnounced = true; this\.showWaveBanner\('首领震怒'/.test(G) && /this\.bossHud\.rage = top;/.test(G));
ck('Player.takeDamage 乘 rageTakenMul（默认 1）', /rageTakenMul = 1;/.test(P) && /this\.formationTakenMul \* this\.rageTakenMul \*/.test(P));
ck('BossHud：单首领百分比左边、双首领两框上方各画「怒」印；隐藏 / 销毁都带上', /if \(this\.rage > 0\) this\.drawRage\(x0 \+ R\.w - 14 - T\.pct\.width - 8/.test(H) && /if \(this\.rage > 0\) this\.drawRage\(GAME_WIDTH \/ 2/.test(H) && /this\.breakT, this\.rageT, this\.portrait/.test(H) && (H.match(/this\.rageT\.setVisible\(false\)/g) ?? []).length >= 4);
ck('攻城不给赏的守军：只扣真记上的战功（超额精锐本来没记，不多扣）', /const m0 = this\.runMerit\.elite;[\s\S]{0,200}if \(elite && this\.runMerit\.elite > m0\) this\.runMerit\.elite -= 1;/.test(SG));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
