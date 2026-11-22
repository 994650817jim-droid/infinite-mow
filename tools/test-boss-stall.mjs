// 首领阶段防拖（data/bossStall.ts，用户 11-21「boss 出来后不打 boss 只刷小兵，是否可以无限刷」；数值按平衡会话 boss-farm-guard.md）：纯 node，不开浏览器。
// 1) 收益额度（按时间）：额度内外的随军粮、掉落（兵装 / 残卷）、战功、经验各一条断言；首领 / 副将不管；各章 / 12-3 的秒数；
// 2) 首领震怒：起点（第 1～9 章 150、第 10～11 章 / 12-1 / 12-2 180、12-3 240）、每 30 秒一层、每层伤害 +10% 移速 +5%、最多 5 层、染红；
// 3) 额度用完刷兵再降一档但不空屏；4) GameScene / Player / BossHud / BossPresence / 攻城 / 副将的接线静态检查。
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

// ———— 1) 额度：各章 / 关秒数
const cfg = (c, s) => C.stallFor(c, s);
ck('额度秒数：第 1～8 章 75、第 9～11 章 / 12-1 / 12-2 90、12-3 150', [1, 4, 8].every(c => cfg(c, 3).quotaSec === 75) && [9, 10, 11].every(c => cfg(c, 2).quotaSec === 90) && cfg(12, 1).quotaSec === 90 && cfg(12, 2).quotaSec === 90 && cfg(12, 3).quotaSec === 150, [1, 8, 9, 11, 12].map(c => cfg(c, 3).quotaSec));
ck('震怒起点：第 1～9 章 150、第 10～11 章 / 12-1 / 12-2 180、12-3 240；表外的章按两头算', [1, 5, 9].every(c => cfg(c, 3).enrageSec === 150) && [10, 11].every(c => cfg(c, 1).enrageSec === 180) && cfg(12, 2).enrageSec === 180 && cfg(12, 3).enrageSec === 240 && cfg(0, 1).enrageSec === 150 && cfg(99, 1).enrageSec === 180);

// 照 GameScene.killEnemy 的发法记账（随军粮 Legion.onKill：杂兵 1 / 精锐 5；押粮卒另加被截的 15 粮；经验 def.xp × (grant.xpMul ?? 首领在场 ×2)）
// 首领段每分钟约 146 杀（boss-farm-guard.md），每 10 杀一个精锐；t = 首领可交战秒数
const run = (fromSec, toSec, quotaSec, opts = {}) => {
  const out = { food: 0, drops: 0, merit: 0, xp: 0, kills: 0 };
  for (let t = fromSec; t < toSec; t += 60 / 146) {
    const kind = opts.kind ?? (out.kills % 10 === 9 ? 'elite' : 'infantry'), g = C.killGrant(kind, t, quotaSec, !!opts.lieutenant);
    if (g.food) out.food += kind === 'elite' ? 5 : kind === 'courier' ? 1 + 15 : 1;
    if (g.drops) out.drops++; // ItemDrops.onKill 掷一次（兵装 / 残卷）
    if (kind === 'elite' && g.merit) out.merit++;
    out.xp += (kind === 'elite' ? 10 : 2) * (g.xpMul ?? BAL.bossSpawn.xpMul); out.kills++;
  }
  return out;
};
const Q = cfg(5, 2).quotaSec, inQ = run(0, Q, Q), over = run(Q, Q + 600, Q); // 正常打 75 秒内 vs 之后只拖不打 10 分钟
ck(`随军钱币：额度内照常（${inQ.kills} 杀 → +${inQ.food}），之后拖 10 分钟（${over.kills} 杀）一粒不给`, inQ.food > 150 && over.food === 0, { inQ: inQ.food, over: over.food });
ck('押粮卒被截的粮也算：额度内 +16、额度外 0', run(0, .1, Q, { kind: 'courier' }).food === 16 && run(Q, Q + .1, Q, { kind: 'courier' }).food === 0);
ck('掉落（兵装 / 残卷）：额度内每杀掷一次，之后不掷', inQ.drops === inQ.kills && over.drops === 0, { inQ: inQ.drops, over: over.drops });
ck('战功：额度内精锐照记，之后的精锐不记', inQ.merit > 0 && over.merit === 0, { inQ: inQ.merit, over: over.merit });
const xpIn = run(0, Q, Q, { kind: 'infantry' }), xpOver = run(Q, Q + 600, Q, { kind: 'infantry' }); // 杂兵 def.xp 按 2 算
ck('经验：额度内杂兵每个 2 × 2 = 4（首领在场 ×2），之后每个 2 × 0.25 = 0.5（不再 ×2）', xpIn.xp === xpIn.kills * 4 && Math.abs(xpOver.xp - xpOver.kills * .5) < 1e-9 && C.killGrant('infantry', Q - .01, Q).xpMul === null, { inPerKill: xpIn.xp / xpIn.kills, overPerKill: xpOver.xp / xpOver.kills });
ck('首领本体、副将不受额度影响（之后照常给）', C.killGrant('boss', 9999, Q) === C.GRANT_FULL && C.killGrant('elite', 9999, Q, true) === C.GRANT_FULL && run(Q, Q + 10, Q, { kind: 'elite', lieutenant: true }).merit > 0);
ck('正常偏慢的首领战不碰额度：p90 用时（2-2 56 / 5-2 53 / 8-2 50 / 10-3 70 / 12-3 103 秒）都在额度内', [[2, 2, 56], [5, 2, 53], [8, 2, 50], [10, 3, 70], [12, 3, 103]].every(([c, s, t]) => t < cfg(c, s).quotaSec));

// ———— 2) 震怒
const st = cfg(5, 3).enrageSec, st12 = cfg(12, 3).enrageSec;
ck('正常打法不叠层：p90 与最长局（10-3 116 秒、12-3 142 秒）都是 0 层', C.enrageStacks(116, cfg(10, 3).enrageSec) === 0 && C.enrageStacks(142, st12) === 0 && C.enrageStacks(149.9, st) === 0);
ck('到点 1 层，之后每 30 秒一层，最多 5 层', C.enrageStacks(150, st) === 1 && C.enrageStacks(179.9, st) === 1 && C.enrageStacks(180, st) === 2 && C.enrageStacks(270, st) === 5 && C.enrageStacks(9999, st) === 5, [150, 180, 270, 9999].map(t => C.enrageStacks(t, st)));
const m1 = C.enrageMul(1), m5 = C.enrageMul(5), m9 = C.enrageMul(9);
ck('每层伤害 +10%、移速 +5%；5 层 ×1.5 / ×1.25 封顶', Math.abs(m1.damage - 1.1) < 1e-9 && Math.abs(m1.speed - 1.05) < 1e-9 && Math.abs(m5.damage - 1.5) < 1e-9 && Math.abs(m5.speed - 1.25) < 1e-9 && m9.damage === m5.damage, { m1, m5 });
ck('身体染红：0 层不变、满层朱红、按原底色相乘', C.rageTint(0) === 0xffffff && C.rageTint(5) === S.enrage.tint && C.rageTint(5, 0x808080) === ((0x80 << 16) | (Math.round(0x80 * 0x8a / 255) << 8) | Math.round(0x80 * 0x74 / 255)) && C.rageTint(1) !== 0xffffff, { t1: C.rageTint(1).toString(16), t5: C.rageTint(5).toString(16) });

// ———— 3) 刷兵
const capBoss = Math.round(BAL.enemyCap * BAL.bossSpawn.capMul), capSpent = Math.round(BAL.enemyCap * BAL.bossSpawn.capMul * S.spent.capMul);
ck(`额度用完：同屏上限 ${capBoss} → ${capSpent}、间隔 ×${S.spent.intervalMul}、每批 ×${S.spent.burstMul}（还留够割草的量，不空屏）`, capSpent < capBoss && capSpent >= 20 && S.spent.intervalMul > 1 && S.spent.burstMul > 0 && S.spent.burstMul < 1, { capBoss, capSpent });

// ———— 4) 接线
const src = p => readFileSync(join(root, p), 'utf8');
const G = src('src/scenes/GameScene.ts'), P = src('src/entities/Player.ts'), H = src('src/ui/BossHud.ts'), SG = src('src/scenes/SiegeGameScene.ts'), CF = src('src/config.ts'), BP = src('src/systems/BossPresence.ts'), SP = src('src/systems/StagePhases.ts');
ck('config.ts 首领在场的刷兵 / 经验倍率与本测试一致', /enemyCap: 150,/.test(CF) && /bossSpawn: \{ capMul: \.5, intervalMul: 2, burstMul: \.5, xpMul: 2 \}/.test(CF));
ck('首领登场（spawnBoss）：主线关按章 / 关取；攻城 / 军情 / 挑战 / 支线按已开放章节数取章默认值（关序传 0，不套按关覆盖）', /this\.bossClearStage\(boss\);[^\n]*\n\s*\{ const sc = this\.stageChapter\(\); this\.bossStallCfg = stallFor\(sc \?\? chaptersOpen\(\), sc \? this\.hardStage\(\) : 0\);/.test(G) && /protected lootChapter\(\): number \{ return this\.stageChapter\(\) \?\? chaptersOpen\(\); \}/.test(G));
ck('第 12 章开放后的攻城 / 军情：用第 12 章默认 90 / 180 秒，不是 12-3 的 150 / 240', C.stallFor(12, 0).quotaSec === 90 && C.stallFor(12, 0).enrageSec === 180, C.stallFor(12, 0));
// 覆盖范围（平衡会话 boss-farm-guard.md 第 0 节）：只有 1-1、1-2、2-1、2-2 走 90 秒战线推进（frontlineBoss），其余都加额度 / 震怒
{ const sc = n => src('src/scenes/' + n + '.ts');
  const enc = ['ThirdGameScene', 'GuanduGameScene', 'IntelGameScene', 'SiegeGameScene'].filter(n => !/encounter:\s*'qunxiong'/.test(sc(n)));
  const st3 = ['LubuGameScene', 'SideRouteGameScene'].filter(n => !/chapter: 'hulao', westStage: 3/.test(sc(n)));
  ck('第 3–12 章（ThirdGameScene 一系）/ 军情 / 攻城都设 encounter、挑战 / 支线按第 3 关：都不是战线推进关，额度 / 震怒照加', enc.length === 0 && st3.length === 0 && /protected frontlineBoss\(\):boolean\{return this\.battleStage\(\)<3&&!this\.runConfig\.encounter;\}/.test(G), { enc, st3 }); }
ck('killEnemy：首领在场（双首领的主首领 / 攻城守将 / 守城都是 this.boss；战线推进关不管）按首领的钟发收益，副将豁免，城墙 / 补给位不算', /const grant = this\.boss\?\.active && !this\.frontlineBoss\(\) && !enemy\.isSupplySlot && enemy\.def\.behavior !== 'wall' \? killGrant\(enemy\.kind, this\.bossClockMs\(\) \/ 1000, this\.bossStallCfg\.quotaSec, !!this\.phaseRunner\?\.isLieutenant\(enemy\)\) : GRANT_FULL; this\.killGrant = grant;/.test(G) && /isLieutenant\(e: Enemy\): boolean \{ const t = this\.lt; return !!t && !t\.down && t\.e === e && e\.spawnId === t\.life; \}/.test(SP));
ck('粮 / 掉落 / 战功 / 经验都看 grant', /if \(grant\.food\) this\.legion\.onKill\(enemy\);/.test(G) && /if \(grant\.drops\) this\.itemDrops\?\.onKill\(enemy\);/.test(G) && /else if\(enemy\.kind==='elite'&&grant\.merit(&&this\.runMerit\.elite<BATTLE_LOOT_CAP\[this\.battleCapKind\(\)\]\.merit)?\)this\.runMerit\.elite\+\+/.test(G) && /enemy\.def\.xp \* \(grant\.xpMul \?\? \(this\.boss\?\.active && enemy\.kind !== 'boss' \? BALANCE\.bossSpawn\.xpMul : 1\)\)/.test(G));
ck('押粮卒被截的粮（EnemyTraits gainFood）看 killGrant', /gainFood:n=>\{if\(this\.killGrant\.food\)this\.legion\.food\+=n;\}/.test(G));
ck('首领的钟：只在可交战时走（不无敌、不在城头、不在过场）；双首领两人同一个钟，取较短的（从第二名出场起算）', /if \(!e\.invulnerable && !this\.cutscene\?\.active && !\(e === this\.boss && this\.dzLubu\?\.hidesBossBar\)\) e\.engagedMs \+= dt \* 1000;/.test(G) && /return duo\.length \? Math\.min\(\.\.\.duo\) : this\.boss\?\.engagedMs \?\? 0;/.test(G) && /enrageStacks\(\(duo\.includes\(e\) \? duoMs : e\.engagedMs\) \/ 1000, this\.bossStallCfg\.enrageSec\)/.test(G));
ck('刷兵：额度时间过了，首领段的上限 / 间隔 / 每批再乘 BOSS_STALL.spent', /const spent = bossOn && !this\.frontlineBoss\(\) && this\.bossClockMs\(\) \/ 1000 >= this\.bossStallCfg\.quotaSec, S = BOSS_STALL\.spent;/.test(G) && /B\.capMul \* \(spent \? S\.capMul : 1\)/.test(G) && /\* \(spent \? S\.intervalMul : 1\)/.test(G) && /B\.burstMul \* \(spent \? S\.burstMul : 1\)/.test(G));
ck('震怒：每帧更新（主首领 + 双首领；战线推进关的首领与追兵不震怒）；移速按比例；身体染红（baseTint，受击闪白后复原）；主将受伤倍率；一次横幅 + 血条印', /this\.updateBossRage\(dt\);/.test(G) && /if \(this\.boss\?\.active && !this\.frontlineBoss\(\)\) list\.push\(this\.boss\);/.test(G) &&/speed: e\.def\.speed \* k/.test(G) && /e\.baseTint = n > 0 \? rageTint\(n, e\.rageTint0\) : e\.rageTint0; e\.sprite\.setTint\(e\.baseTint\);/.test(G) && /this\.player\.rageTakenMul = enrageMul\(top\)\.damage;/.test(G) && /!this\.bossRageAnnounced\) \{ this\.bossRageAnnounced = true; this\.showWaveBanner\('首领震怒'/.test(G) && /this\.bossHud\.rage = top;/.test(G));
ck('首领发红光：BossPresence 的辉光（显卡滤镜，非代码画特效）震怒时转朱红、呼吸加快', /const rage = boss\.rageStacks > 0; sl\.glow\.fx\.color = rage \? BOSS_STALL\.enrage\.glow/.test(BP));
ck('Player.takeDamage 乘 rageTakenMul（默认 1）', /rageTakenMul = 1;/.test(P) && /this\.formationTakenMul \* this\.rageTakenMul \*/.test(P));
ck('BossHud：单首领百分比左边、双首领两框上方的小「怒」印（不弹大框）；隐藏 / 销毁都带上', /if \(this\.rage > 0\) this\.drawRage\(x0 \+ R\.w - 14 - T\.pct\.width - 8/.test(H) && /if \(this\.rage > 0\) this\.drawRage\(GAME_WIDTH \/ 2/.test(H) && /this\.breakT, this\.rageT, this\.portrait/.test(H) && (H.match(/this\.rageT\.setVisible\(false\)/g) ?? []).length >= 4);
ck('攻城不给赏的守军：只扣真记上的战功（超额精锐本来没记，不多扣）', /const m0 = this\.runMerit\.elite;[\s\S]{0,200}if \(elite && this\.runMerit\.elite > m0\) this\.runMerit\.elite -= 1;/.test(SG));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
