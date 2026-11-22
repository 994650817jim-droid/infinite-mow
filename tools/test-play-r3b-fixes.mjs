// 总制作人第二轮试玩补充（第 5～8 条）：纯 node，不开浏览器。
// 5) 属性点提醒：有没加的点、且有地方能加时 → 行营顶部、结算一行、营寨进门一句；第一次能加时引导一次；
// 6) 章节第一关前整军：天下地图出征（从存档点开打）也先进出征整军（a5eb9c15 同一套）；
// 7) 攻城城外段没人护送冲车：先催、再出城袭扰，越拖越多；
// 8) 行营买的兵装：打赢后的行营直接入行囊（没丢，粮由存档点修正）；整军页买的也直接入行囊；第三章起 / 攻城 / 军情的缴获与行营购买原来被当成测试战斗丢掉，一并修。
// 用法：node tools/test-play-r3b-fixes.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const G = src('src/scenes/GameScene.ts'), C = src('src/ui/CampRestUI.ts'), CS = src('src/scenes/CityScene.ts'), SM = src('src/systems/SiegeMidCity.ts');

// ———— 5) 属性点
const P = await load('src/data/pointsHint.ts');
ck('有点、能加：说几点、去哪加（营寨武将谱 / 战斗中按 C「星图」；2026-11-22 星图正式打开后的字样）', JSON.stringify(P.pointsHint(13, { world: true, battle: false })) === JSON.stringify({ n: 13, where: '营寨主帐「武将谱」' }) && P.pointsHint(3, { world: true, battle: true }).where === '营寨主帐「武将谱」或战斗中按 C「星图」');
ck('没点、或哪都还加不了（第一章天下未开、四维加点未开）：不催', P.pointsHint(0, { world: true, battle: true }) === null && P.pointsHint(13, { world: false, battle: false }) === null);
ck('行营 / 整军页：顶部资源行后面「属性点 N 未加 ⓘ」+ 悬停说明去哪加', /pointsHint\?:\(\)=>\{n:number;where:string\}\|null;/.test(C) && /* 2026-11-21 军粮改钱币：资源行挪进 CampRestUI.paintCoins（数字随铜钱落袋跳），文字同口径 */ /const txt='随军钱币 '\+food\+' · 兵力 '\+this\.army\.count\+tail;/.test(C) && /tail=ph\?\(starMapOn\(\)\?' · '\+pointsLeftText\(ph\.n\)\+' ⓘ':' · 属性点 '\+ph\.n\+' 未加 ⓘ'\):'';/.test(C) && /this\.resTip\.setText\(ph\?\(starMapOn\(\)\?'点星：':'加点：'\)\+ph\.where:''\);/.test(C) && /this\.campUI\.pointsHint=\(\)=>this\.pointsHint\(\);/.test(G));
ck('结算一行「属性点 N 点未加 · 去…加点」；第一次能加时（行营 / 结算）弹一次引导卡', /'\\n属性点  '\+ph\.n\+' 点未加 · 去'\+ph\.where\+'加点'/.test(G) && /if \(mode === 'rest'\) this\.pointsGuide\(\);/.test(G) && /protected pointsGuide\(\): void \{[\s\S]{0,300}localStorage\.getItem\(POINTS_GUIDE_KEY\) === '1'[\s\S]{0,200}showBarkCard\(this, \{ side: 'left', name: '新玩法 · 属性点', text: pointsGuideText\(h\) \}\);/.test(G));
ck('营寨进门：主公有没加的点 → 一句「主帐「武将谱」里加点」', /pointsHint\(heroFreePoints\(h as never\),\{world:true,battle:mechOpen\('attributes'\)\}\);if\(ph\)this\.time\.delayedCall\(stableNew\?2600:600,\(\)=>this\.toast\('有 '\+ph\.n\+' 点属性点没加 · 主帐「武将谱」里加点'\)\);/.test(CS));

// ———— 6) 章节第一关前整军
ck('天下地图出征各章第一关：从存档点开打（主线没打过、天下战役）→ 先进出征整军（同战败重进一套）', /this\.preCampDue = this\.campaignLoaded && \(this\.campaignReplay \? this\.inheritsCampaign\(\) : this\.musterOnSortie\(\)\)/.test(G) && /this\.registry\.remove\('campaignTransfer'\); this\.registry\.set\('worldCampaign', true\);/.test(src('src/scenes/WorldMapScene.ts')));

// ———— 7) 攻城城外段
const S = await load('src/data/siegeMedium.ts'), I = S.MID_SIEGE.idle;
ck('数值在 MID_SIEGE.idle：15 秒催、30 秒出城一队 6 人，之后每 25 秒一队、每队 +2（封顶 14）', I.urgeMs === 15000 && I.sallyMs === 30000 && I.repeatMs === 25000 && I.squad === 6 && I.grow === 2 && I.max === 14, I);
{ // 模拟：三分钟站着不动 → 几次催、几队、多少人
  let since = -1, urged = 0, next = 0, sallies = 0, men = 0; const step = (near, now) => { if (near) { since = -1; sallies = 0; return; } if (since < 0) { since = now; next = now + I.sallyMs; return; } if (!urged && now - since >= I.urgeMs) urged++; if (now < next) return; men += Math.min(I.max, I.squad + I.grow * sallies); sallies++; next = now + I.repeatMs; };
  for (let t = 0; t <= 180000; t += 100) step(false, t);
  ck('站着三分钟：催 1 次、出城 7 队约 80 人（不再「什么都不发生」）', urged === 1 && sallies === 7 && men >= 60, { urged, sallies, men }); }
ck('接线：冲车在走（move）时每帧判断主将在不在护送范围；回到冲车旁清零；出城兵冲主将（城门 / 大城护城河南岸）', /const near = Math\.hypot\(p\.x - r\.x, p\.y - r\.y\) <= M\.ram\.escortRadius;\s*\n\s*this\.updateIdle\(near, now\);/.test(SM) && /if \(near\) \{ this\.idleSince = -1; this\.idleUrged = false; this\.idleSallies = 0; return; \}/.test(SM) && /this\.h\.banner\('冲车无人护送', true,/.test(SM) && /this\.h\.banner\('守军出城袭扰！', true,/.test(SM));

// ———— 8) 行营 / 整军买的兵装、第三章起的缴获
ck('兵装入库的「测试战斗」只算测试 / 调试 / 网址预览（不再把篇章式战斗 runConfig.encounter 当测试；合并后统一走 lootBlocked）', /protected lootBlocked\(\): boolean \{ return this\.debugRun\(\) \|\| this\.encounterPreview; \}/.test(G) && (G.match(/this\.lootBlocked\(\)/g) ?? []).length >= 3 && !/debug=isChapterTestRun\(\)\|\|this\.debugModified\|\|this\.debugJumped\|\|!!this\.player\.damageImmune\|\|!!this\.runConfig\.encounter,dep=depositRunLoot/.test(G));
ck('行营（已结算）与整军页（还没开打）买的兵装都直接入行囊，不算本局缴获', /this\.campUI\.onBuyItem=item=>\{const debug=this\.(lootBlocked|lootDebug)\(\);if\(\(this\.over\|\|this\.preCamp\)&&!debug\)addItems\(\[item\]\);/.test(G));
ck('行营花的随军钱币随存档点写回（256f24b5），重进不再回到打赢那一刻', /this\.campUI\.onChanged=\(\)=>this\.saveRestPoint\(\);/.test(G));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
