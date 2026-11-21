// 总制作人新存档试玩（11-20，赵云正式模式 1-1 / 1-2）的几处修正：纯 node，不开浏览器。
// 1) 末位首领倒下后主将无敌、残兵溃退直到捡宝箱结算（1-1 张梁倒下 2 秒后主将被围死，结算成「已击败 · 阵亡」）；
// 2) 战线推进关（1-1、1-2、2-1、2-2）不再叠首领阶段额度 / 震怒（两套计时不打架）；
// 3) 第一章战线推进给一次喘息（回 30% 血 + 3 秒无敌 + 横幅「某某追来」）；
// 4) 部曲没开放：三选一不出兵阵战法（守望等），战败小贴士不写「按 E 让部曲出击」；
// 5) 征程构筑打输不存（设计）：战败结算写明。
// 用法：node tools/test-play-1120-fixes.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8');
const G = src('src/scenes/GameScene.ts'), P = src('src/entities/Player.ts'), U = src('src/data/upgrades.ts'), B = src('src/data/builds.ts');

// ———— 1) 收尾保护
ck('收尾判定：末位首领已倒（bossKilled）、没有追兵首领还在、还没结算', /protected get victoryHold\(\): boolean \{ return this\.bossKilled && this\.chasingBosses\.length === 0 && !this\.over; \}/.test(G));
ck('每帧（战斗进行中）调 holdVictory：主将 victoryGuard，场上残兵（非首领 / 补给位 / 城墙）溃退、不贴身出手', /this\.updateBossRage\(dt\);\s*\n\s*this\.holdVictory\(\);/.test(G) && /const hold = this\.victoryHold; this\.player\.victoryGuard = hold; if \(!hold\) return;/.test(G) && /e\.routUntil = Math\.max\(e\.routUntil, until\); e\.contactCd = Math\.max\(e\.contactCd, \.5\);/.test(G));
ck('Player.takeDamage：victoryGuard 时不受伤（所有伤害都走这里）', /if \(!this\.alive \|\| this\.damageImmune \|\| this\.victoryGuard \|\| now < this\.invulnUntil/.test(P) && /victoryGuard = false;/.test(P));
// 模拟：首领倒下那一帧起，被围着挨打也不会死
{ const p = { alive: true, hp: 14, victoryGuard: false, takeDamage(raw) { if (!this.alive || this.victoryGuard) return false; this.hp = Math.max(0, this.hp - raw); if (this.hp <= 0) this.alive = false; return true; } };
  const scene = { bossKilled: true, chasingBosses: [], over: false }; p.victoryGuard = scene.bossKilled && scene.chasingBosses.length === 0 && !scene.over;
  for (let i = 0; i < 40; i++) p.takeDamage(6); // 2 秒里被 40 下
  ck('张梁倒下后 2 秒被围 40 下：14 血的主将还活着', p.alive && p.hp === 14, { hp: p.hp }); }
ck('追兵首领还在（战线推进后本关首领被打倒）不提前保护：要继续打追兵', /this\.chasingBosses\.length === 0/.test(G));

// ———— 2) 战线推进关不叠首领阶段额度 / 震怒
const F = await load('src/data/frontline.ts');
ck('战线推进：首领出场 90 秒（FRONTLINE.bossMs），只限 battleStage < 3 且没有 encounter（1-1、1-2、2-1、2-2）', F.FRONTLINE.bossMs === 90000 && /protected frontlineBoss\(\):boolean\{return this\.battleStage\(\)<3&&!this\.runConfig\.encounter;\}/.test(G) && /if\(this\.frontlineBoss\(\)&&this\.boss\?\.active&&this\.firstBossAt>=0&&this\.combatNow>=this\.firstBossAt\+FRONTLINE\.bossMs\)this\.advanceFrontline\(\);/.test(G));
ck('这几关：额度不扣收益、额度后不降刷兵、首领与追兵不震怒', /const grant = this\.boss\?\.active && !this\.frontlineBoss\(\) && /.test(G) && /const spent = bossOn && !this\.frontlineBoss\(\) && /.test(G) && /if \(this\.boss\?\.active && !this\.frontlineBoss\(\)\) list\.push\(this\.boss\);/.test(G) && !/updateBossRage[\s\S]{0,900}this\.chasingBosses/.test(G));

// ———— 3) 喘息
const b1 = F.frontlineBreather(1), b2 = F.frontlineBreather(2);
ck('第一章推进给喘息：回 30% 生命、3 秒无敌；第二章不给', b1 && b1.heal === .3 && b1.invulnMs === 3000 && b2 === null, { b1, b2 });
ck('advanceFrontline：按章取喘息 → 回血、无敌（受击闪烁）、横幅「首领名 + 追来」；不给喘息照旧「战线推进」', /const br=frontlineBreather\(CHAPTER_INDEX\[this\.hardKey\(\)\]\?\?0\);/.test(G) && /if\(br\)\{this\.player\.heal\(this\.player\.maxHp\*br\.heal\);this\.player\.invulnUntil=Math\.max\(this\.player\.invulnUntil,this\.combatNow\+br\.invulnMs\);this\.frontlineBreaths\+\+;this\.showWaveBanner\(name\+'追来'/.test(G) && /else this\.showWaveBanner\(`第 1\/\$\{waves\.length\} 波/.test(G));
{ const hp = { max: 300, cur: 14 }; hp.cur = Math.min(hp.max, hp.cur + hp.max * b1.heal); ck('1-1 剩 14 血推进到 1-2：回到 104 血', hp.cur === 104, hp); }

// ———— 4) 没开放的玩法不出卡 / 不出提示
const formationTactics = [...B.slice(0, B.indexOf('export const TREASURES')).matchAll(/^ (\w+): \{ name: '([^']+)', tag: 'formation'/gm)].map(m => m[2]);
ck(`三选一：部曲没开放时兵阵战法不出（${formationTactics.join('、')}）`, formationTactics.includes('守望') && /if\(school==='formation'&&!mechOpen\('squad'\)\)continue;/.test(U) && /import \{ mechOpen \} from '\.\/mechanicUnlocks';/.test(U));
const D = await load('src/data/defeatFlow.ts'), seq = n => { let i = 0; return () => (i++ % n) / n; };
const tipsAt = (stage, open) => { const r = seq(50), s = new Set(); for (let i = 0; i < 50; i++) s.add(D.defeatTip(stage, () => open, r)); return [...s]; };
const t11 = tipsAt(1, false), t12 = tipsAt(2, true), t13 = tipsAt(3, true);
ck('1-1（部曲没开）：小贴士不写「按 E 让部曲出击」，也不提张宝符柱 / 张角天雷', t11.length >= 2 && t11.every(t => !/按 E|张宝|张角/.test(t)), t11);
ck('1-2（部曲已开）：会出部曲与张宝符柱；1-3 才出张角天雷', t12.some(t => /按 E/.test(t)) && t12.some(t => /张宝/.test(t)) && !t12.some(t => /张角/.test(t)) && t13.some(t => /张角/.test(t)), { t12, t13 });
ck('GameScene 战败小贴士按关 + mechOpen 抽', /const tip = defeatTip\(stage, id => mechOpen\(id\)\);/.test(G));

// ———— 5) 征程构筑打输不存：结算写明
ck('战败结算写明征程构筑：本关新学的不保留；有存档从上一关打赢时的构筑开始，征程第一仗从零开始', /本关新学的战法不保留/.test(D.buildCarryNote(true)) && /上一关打赢时/.test(D.buildCarryNote(true)) && /从零开始/.test(D.buildCarryNote(false)) && /if \(!this\.campaignReplay\) this\.resultTexts\.body\.setText\(this\.resultTexts\.body\.text \+ '\\n' \+ buildCarryNote\(!!loadCampaignBuild\(this\.runConfig\.character\)\)\);/.test(G));
ck('存档规则本身没动：只在主线首次打赢（victory && bossKilled && !campaignReplay）时 saveCampaignBuild', /if\(victory&&this\.bossKilled&&!this\.campaignReplay&&!\(isChapterTestRun\(\)\|\|this\.debugModified\|\|this\.debugJumped\|\|this\.player\.damageImmune\)\)saveCampaignBuild\(/.test(G));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
