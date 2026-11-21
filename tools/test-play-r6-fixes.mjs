// 总制作人第六轮试玩（8-1 阳平关，main 7119870c）：① 第 3～12 章篇章场景从存档点开打先整军；② 战败「退守 X」真的进城（城里军医 / 募兵所），
// 出城回天下地图选中这一仗的关卡（主按钮就是再出征）。纯 node，不开浏览器。浏览器实走见 tools/shot-r6-hanzhong.mjs。
// 用法：node tools/test-play-r6-fixes.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
// Phaser 换成空壳（DefeatRetreat → WorldStore 间接引到 Phaser，这里只测纯函数）；localStorage 用内存的
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const stub = { name: 'stub-phaser', setup(b) { b.onResolve({ filter: /^phaser(3spectorjs)?$/ }, a => ({ path: a.path, namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'const P = new Proxy(function () {}, { get: () => P, construct: () => ({}) }); export default P;', loader: 'js' })); } };
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', loader: { '.png': 'empty' }, plugins: [stub] }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const G = src('src/scenes/GameScene.ts'), T = src('src/scenes/ThirdGameScene.ts'), GD = src('src/scenes/GuanduGameScene.ts'), TW = src('src/scenes/TownScene.ts'), CS = src('src/scenes/CityScene.ts'), M = src('src/main.ts');

// ———— ① 整军覆盖第 3～12 章
ck('整军判定走 musterOnSortie：主线没打过的关从存档点开打，第一、二章默认看天下战役标记（worldCampaign）', G.includes('this.preCampDue = this.campaignLoaded && (this.campaignReplay ? this.inheritsCampaign() : this.musterOnSortie()) && !isChapterTestRun() && !this.encounterPreview && mechOpen(\'squad\');') && G.includes('protected musterOnSortie(): boolean { return this.worldCampaign; }'));
ck('篇章场景（ThirdGameScene 一族）和官渡覆盖成 true（原来 worldCampaign 只在第一、二章设，8-1 两次都直接开打）', /protected musterOnSortie\(\)\{return true;\}/.test(T) && /protected musterOnSortie\(\) \{ return true; \}/.test(GD));
// 第 3～12 章的战斗场景都是 ThirdGameScene 一族或官渡
const arcs = ['ChibiGameScene', 'JingnanGameScene', 'ShuGameScene', 'XiangfanGameScene', 'NanzhengGameScene', 'HanzhongGameScene', 'YilingGameScene', 'BeifaGameScene'];
const fam = { ShuGameScene: 'src/scenes/ShuGameScene.ts', XiangfanGameScene: 'src/scenes/XiangfanGameScene.ts', NanzhengGameScene: 'src/scenes/NanzhengGameScene.ts', HanzhongGameScene: 'src/scenes/HanzhongGameScene.ts', YilingGameScene: 'src/scenes/YilingGameScene.ts', BeifaGameScene: 'src/scenes/BeifaGameScene.ts', JingnanGameScene: 'src/scenes/JingnanGameScene.ts' };
const thirdBased = arcs.every(k => k === 'ChibiGameScene' ? /thirdGameSceneClass\(BattleScene,\{key:'ChibiGameScene'/.test(M) : /thirdGameSceneClass\(|extends Third\b|extends Arc\b/.test(src(fam[k])));
ck('第 3～12 章的战斗场景（赤壁 / 荆南 / 入蜀 / 襄樊 / 南征 / 汉中 / 夷陵 / 北伐 + 群雄 ThirdGameScene）都是 ThirdGameScene 一族，官渡另覆盖', thirdBased && /const ThirdBattleScene=thirdGameSceneClass\(BattleScene\)/.test(M) && /guanduGameSceneClass\(BattleScene\)/.test(M));
ck('同章连打（下一关带着 transfer）不重复整军；测试战斗 / 网址预览不整军（沿用原判定）', G.includes('this.campaignLoaded = !!carriedState && !chained;'));

// ———— ② 战败退守真的进城
ck('「退守 X」：城 → TownScene（城里军医 / 募兵所），营寨 → CityScene；记下这一仗（retreatReturn：地图节点 / 攻城的城 / 惩罚）', G.includes("this.registry.set('retreatReturn', { node: battleNodeId(this.hardKey()), city: this.defeatCity, stage: this.chapter.name, name: t.name, notes: [...this.defeatNotes] });") && G.includes("if (t.kind === 'city') this.scene.start('TownScene', { city: t.id }); else this.scene.start('CityScene');") && !G.includes("this.registry.set('defeatRetreat',"));
ck('城里 / 营寨：进来弹一条败退提示（6 秒）；「返回天下地图」消费 retreatReturn（选中这一仗），平时照旧选这座城', TW.includes("if (!takeRetreatReturn(this.registry)) this.registry.set('mapFocusCity', this.cityId);") && TW.includes('this.toast(retreatToast(r), 6000)') && CS.includes("takeRetreatReturn(this.registry);this.scene.start('WorldMapScene');") && CS.includes('this.toast(retreatToast(r),6000)'));
const R = await load('src/world/DefeatRetreat.ts');
const fake = init => { const m = new Map(Object.entries(init)); return { m, get: k => m.get(k), set: (k, v) => m.set(k, v), remove: k => m.delete(k) }; };
const hz = R.battleNodeId('hanzhong');
ck('汉中之战在地图上有节点（8-1 退守后选中它）；攻城 / 军情没有节点', hz === 'hanzhong' && R.battleNodeId('no-such-battle') === null, { hz });
{ const r = fake({ retreatReturn: { node: 'hanzhong', city: null }, mapFocusCity: 'xuchang' }); const ok = R.takeRetreatReturn(r);
  ck('出城回地图：有关卡节点 → 选中节点（mapFocusNode），不选城；retreatReturn 用掉', ok && r.m.get('mapFocusNode') === 'hanzhong' && !r.m.has('mapFocusCity') && !r.m.has('retreatReturn')); }
{ const r = fake({ retreatReturn: { node: null, city: 'chenliu' } }); const ok = R.takeRetreatReturn(r);
  ck('攻城 / 守城战败（没有节点）→ 选中那座城', ok && r.m.get('mapFocusCity') === 'chenliu' && !r.m.has('mapFocusNode')); }
{ const r = fake({}); ck('平时进城再出来（没有 retreatReturn）→ 照旧', R.takeRetreatReturn(r) === false && r.m.size === 0); }
const tip = R.retreatToast({ stage: '汉中 · 阳平关', name: '许昌', notes: ['主将负伤 · 下次出征生命 55%', '部曲折损 3 人'] });
ck('败退提示：哪一仗、退到哪、惩罚、军医、回地图再出征（已选中这一仗）、开打前先整军（城里不一定建了募兵所，不提它）', /阳平关/.test(tip) && /退守许昌/.test(tip) && /部曲折损 3 人/.test(tip) && /军医/.test(tip) && /整军/.test(tip) && /再出征/.test(tip) && !/募兵所/.test(tip), tip);
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
