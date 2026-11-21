// 总制作人第五轮复测（支线 / 攻城 / 军情出征）：纯 node，不开浏览器。
// 1) 只读继承征程构筑的出征（攻城 / 守城 / 军情 / 支线攻城关）也先整军；整军只把增量（花的粮、新招的兵、治的血）写回存档点；
// 2) 支线关时长：首领 150 / 180 / 210 / 240 秒出场，波次按比例拉长、刷兵放慢，首领生命 ×1.6；
// 3) 支线关的关隘 / 城池：攻城关 = 城墙 + 城门，其余去掉孤城门。
// 用法：node tools/test-play-r7-fixes.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const G = src('src/scenes/GameScene.ts'), CP = src('src/systems/Campaign.ts'), SR = src('src/scenes/SideRouteGameScene.ts');

// ———— 1)
ck('谁先整军：主线（从存档点开打）+ 只读继承的出征（攻城 / 守城 / 军情 / 支线攻城关）；网址预览、测试战斗不整军', /this\.preCampDue = this\.campaignLoaded && \(this\.campaignReplay \? this\.inheritsCampaign\(\) : this\.musterOnSortie\(\)\) && !isChapterTestRun\(\) && !this\.encounterPreview && mechOpen\('squad'\);/.test(G) && /protected inheritsCampaign\(\) \{ return true; \}/.test(src('src/scenes/SiegeGameScene.ts')) && /protected inheritsCampaign\(\) \{ return true; \}/.test(src('src/scenes/IntelGameScene.ts')) && /kind === 'siege'; \}/.test(SR));
ck('没剧情的出征：等军情卷轴放完（mode 回到 none）再进整军', /const tryOpen = \(\): void => \{[^\n]*if \(this\.mode !== 'none'\) return;/.test(G));
ck('只读继承：整军前记底（开局已加的援军 / 后备不算新招），每一步只写增量；主线照旧写整份', /if \(this\.campaignReplay\) this\.musterBase = \{ food: this\.legion\.food, kinds: this\.soldierKinds\(\) \};/.test(G) && /if \(this\.campaignReplay\) \{ if \(this\.preCamp && this\.inheritsCampaign\(\)\) this\.saveMusterDelta\(\); return; \}/.test(G) && /if \(!s\.reserveSoldier\) out\[s\.kind\]/.test(G));
// 模拟 patchCampaignMuster（照 Campaign.ts 写法）：存档点 food 600、兵 2；整军花 150 粮招 3 个、军医治到 100%
{ const save = { heroes: { zhaoyun: { player: { hpFrac: .55 }, army: { food: 600, soldiers: [{ kind: 'swordsman', hp: 80 }, { kind: 'archer', hp: 40 }], recruited: 2 } } } };
  globalThis.localStorage = { _v: JSON.stringify(save), getItem() { return this._v; }, setItem(_k, v) { this._v = v; } };
  const C = await load('src/systems/Campaign.ts').catch(e => ({ err: String(e).slice(0, 120) }));
  if (C.patchCampaignMuster) {
    const ok = C.patchCampaignMuster('zhaoyun', { foodSpent: 150, recruits: { swordsman: 2, spearman: 1 }, hpFrac: 1 }), v = JSON.parse(localStorage.getItem()).heroes.zhaoyun;
    ck('整军写回：粮 600 → 450、兵 2 → 5（新兵满血）、主将血 55% → 100%，原有兵不动', ok && v.army.food === 450 && v.army.soldiers.length === 5 && v.army.soldiers[0].hp === 80 && v.player.hpFrac === 1, { food: v.army.food, n: v.army.soldiers.length, hp: v.player.hpFrac });
  } else ck('整军写回函数（静态）', /export function patchCampaignMuster\(hero: CharacterId,/.test(CP) && /s\.army\.food = Math\.max\(0, Math\.round\(\(s\.army\.food \?\? 0\) - Math\.max\(0, o\.foodSpent\)\)\);/.test(CP), C.err);
}

// ———— 2)
const R = await load('src/data/sideRoutes.ts'), T = R.SIDE_TIMING;
ck('支线首领出场：第 1～4 关 150 / 180 / 210 / 240 秒；首领生命 ×1.6', R.sideBossAt(1) === 150 && R.sideBossAt(2) === 180 && R.sideBossAt(3) === 210 && R.sideBossAt(9) === 240 && T.bossHpMul === 1.6);
{ const xp = R.SIDE_ROUTES.find(x => x.id === 'xiapi'), base = { name: 'b', pace: 120 / 90, waves: [{ name: 'a', start: 0 }, { name: 'b', start: 45 }, { name: 'c', start: 90 }], enemies: { boss: { hp: 1000 }, infantry: { hp: 10 } } };
  const c1 = R.sideBattle(xp, 1, base);
  ck('下邳第 1 关（小沛）：首领 90 → 150 秒出场，波次 0 / 75 / 150，刷兵曲线放慢（pace 1.33 → 1），首领生命 1900 → 3040', c1.waves.map(w => w.start).join('/') === '0/75/150' && c1.pace === 1 && c1.enemies.boss.hp === 3040, { waves: c1.waves.map(w => w.start), pace: c1.pace, hp: c1.enemies.boss.hp }); }

// ———— 3)
const F = await load('src/data/arcForts.ts');
ck('支线攻城关 = 城池（城墙 + 城门）；野战 / 终局去掉孤城门；ARC_FORTS 列了的照旧', F.sideFort('siege')?.kind === 'city' && F.sideFort('field')?.kind === 'clear' && F.sideFort('final')?.kind === 'clear' && F.sideFort(undefined) === undefined && /get fort\(\): ArcFort \| undefined \{ const st = this\.arcStage; return ARC_FORTS\[r\.id \+ '\.' \+ st\] \?\? sideFort\(r\.stages\[st - 1\]\?\.kind\); \}/.test(SR));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
