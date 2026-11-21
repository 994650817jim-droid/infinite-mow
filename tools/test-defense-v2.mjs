// 守城 v2 试玩版（共享笔记 defense-redesign-v2.md v2.2）· a 段：纯 node，不开浏览器。
// 开关默认关；场地几何（城外在下、走道 3.5 身位、墙身挡人只留马道缺口、四面封边）；分段与岗位；自动站位；马道寻路；镜头；接线。
// 用法：node tools/test-defense-v2.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const V = await load('src/data/defenseV2.ts'), D = V.DEFENSE_V2;

// ———— 开关
ck('开关默认关；?defenseV2=1 开、?defenseV2=0 关（优先于存档设置）', V.defenseV2On('') === false && V.defenseV2On('?defenseV2=1') === true && V.defenseV2On('?defenseV2=0') === false && V.defenseV2On('?dev=1') === false);

// ———— 几何
const g = V.v2Geometry({ x: 0, y: 0 });
ck('城外在下：墙脚 F 在走道南沿 W 以南（外墙立面高 ' + D.layout.face + '），城内在内侧女墙以北', g.F - g.W === D.layout.face && g.W - g.top === D.layout.walk && g.innerTop < g.top && g.cityTop < g.innerTop && g.outBot > g.F, { W: g.W, top: g.top, F: g.F });
ck('主将开局站在城头走道中线、城门西侧', g.start.y === (g.top + g.W) / 2 && g.start.x < g.gx && V.onWalk(g, g.start));
ck('走道宽 240（3.5 个身位）', D.layout.walk === 240);
const inBox = (p, r = 14) => g.boxes.some(b => p.x > b.left - r && p.x < b.right + r && p.y > b.top - r && p.y < b.bottom + r);
ck('墙身挡人：走道和城外之间（墙面上）任何一点都在碰撞框里', [-1200, -600, 0, 600, 1200].every(x => inBox({ x: g.gx + x, y: (g.W + g.F) / 2 })));
ck('走道上能走：走道中线（段里、门楼上）不在碰撞框里', [-1100, -700, -300, 0, 300, 700, 1100].every(x => !inBox({ x: g.gx + x, y: (g.top + g.W) / 2 })), { gx: g.gx });
ck('内侧女墙挡人、只在两个马道口留缺口', !inBox({ x: g.ramps[0], y: g.top - 20 }, 6) && !inBox({ x: g.ramps[1], y: g.top - 20 }, 6) && inBox({ x: g.gx, y: g.top - 20 }) && inBox({ x: g.gx - 600, y: g.top - 20 }));
ck('四面封边：墙两端外侧、城内北边、城外南边都封死', inBox({ x: g.X0 - 100, y: g.W }) && inBox({ x: g.X1 + 100, y: g.F + 300 }) && inBox({ x: g.gx, y: g.cityTop - 50 }) && inBox({ x: g.gx, y: g.outBot + 50 }));
ck('城外 / 城内判定', V.isOutside(g, { x: 0, y: g.F + 10 }) && !V.isOutside(g, { x: 0, y: g.W - 10 }));

// ———— 分段与岗位
ck('城头分 4 段（城门楼两侧各两段），每段一个梯口在段中点', g.segs.length === 4 && g.segs.every(s => s.ladderX > s.x0 && s.ladderX < s.x1) && g.segs[1].x1 <= g.gx - D.layout.gateHalf + 1 && g.segs[2].x0 >= g.gx + D.layout.gateHalf - 1);
const cre = g.posts.filter(p => p.kind === 'crenel'), gua = g.posts.filter(p => p.kind === 'guard'), ram = g.posts.filter(p => p.kind === 'ramp');
ck('岗位：每段 4 垛口（避开梯口）+ 梯口 2 驻守，马道口 2；都在走道上', cre.length === 16 && gua.length === 8 && ram.length === 2 && cre.every(p => Math.abs(p.x - g.segs[p.seg].ladderX) > D.posts.mouth - 1) && [...cre, ...gua, ...ram].every(p => p.y > g.top && p.y < g.W), { cre: cre.length, gua: gua.length });
ck('垛口在走道南沿（贴外沿垛口），梯口驻守在梯口落点两侧', cre.every(p => g.W - p.y === D.posts.crenelDy) && gua.every(p => Math.abs(Math.abs(p.x - g.segs[p.seg].ladderX) - D.posts.guardDx) < 1));
// 自动站位
const units = [...Array(6)].map((_, i) => ({ id: i + 1, kind: 'archer', ranged: true })).concat([...Array(12)].map((_, i) => ({ id: 100 + i, kind: i % 2 ? 'spearman' : 'swordsman', ranged: false })), [{ id: 200, kind: 'rider', ranged: false }, { id: 201, kind: 'medic', ranged: false }]);
const m = V.assignPosts(units, g), kinds = k => [...m.values()].filter(p => p.kind === k).length;
ck('自动站位：远程进垛口、近战先进梯口（8）再进马道口（2），多的近战 / 骑兵 / 军医进预备队', kinds('crenel') === 6 && kinds('guard') === 8 && kinds('ramp') === 2 && kinds('reserve') === 4 && m.get(200).kind === 'reserve' && m.get(201).kind === 'reserve', { crenel: kinds('crenel'), guard: kinds('guard'), ramp: kinds('ramp'), reserve: kinds('reserve') });
ck('垛口四段轮着填（6 个远程：每段至少 1 个）、梯口每段 2 个', new Set([...m.entries()].filter(([, p]) => p.kind === 'crenel').map(([, p]) => p.seg)).size === 4 && [0, 1, 2, 3].every(s => [...m.values()].filter(p => p.kind === 'guard' && p.seg === s).length === 2));
ck('预备队在城内、城门内侧', [...m.values()].filter(p => p.kind === 'reserve').every(p => p.y < g.innerTop && Math.abs(p.x - g.gx) < 200));
// 马道寻路
const res = [...m.values()].find(p => p.kind === 'reserve'), crenel = g.posts.find(p => p.kind === 'crenel' && p.seg === 1);
const w1 = V.nextWaypoint(g, res, crenel);
ck('城里的兵去城头：先去最近的马道口（不穿墙）', g.ramps.includes(w1.x) && w1.y < g.innerTop, w1);
const w2 = V.nextWaypoint(g, { x: w1.x, y: w1.y }, crenel);
ck('到了马道口：穿过缺口上城头', w2.x === w1.x && w2.y > g.top, w2);
ck('已在城头：直接去岗位', JSON.stringify(V.nextWaypoint(g, { x: crenel.x + 300, y: (g.top + g.W) / 2 }, crenel)) === JSON.stringify(crenel));
ck('镜头：主将在城头往城外让 ' + D.camera.onWall + '，在城里不让', D.camera.onWall > 80 && V.onWalk(g, g.start) && !V.onWalk(g, { x: g.gx, y: g.innerTop - 100 }));

// ———— 接线
const S = src('src/scenes/SiegeGameScene.ts'), G = src('src/scenes/GameScene.ts'), L = src('src/systems/Legion.ts'), T = src('src/systems/LegionTactics.ts'), W = src('src/systems/DefenseWallV2.ts');
ck('攻城场景：守城且开关开 → 新守城（只铺地面、不建旧 DefenseBattle）；关 → 旧守城照旧', /const v2 = this\.defense && !this\.intercept && defenseV2On\(\);/.test(S) && /bare: v2\}\);/.test(S) && /if \(this\.defense && !this\.intercept\) \{ if \(v2\) this\.setupDefenseV2\(\); else this\.setupDefense\(\); \}/.test(S));
ck('刷兵只在城外（不在城外的落点挪到城外敌营），首领在城外', /if \(this\.defV2 && kind !== 'boss' && !this\.defInside && !this\.defV2\.isOutside\(\{x, y\}\)\) \{ const sp = this\.defV2\.spawnPoint\(\);/.test(S) && /if \(this\.defV2\) \{ const p = this\.defV2\.spawnPoint\(\); return this\.spawnEnemy/.test(S) && /const bp = this\.defV2\.bossPoint\(\); b\.sprite\.setPosition\(bp\.x, bp\.y\);/.test(S));
ck('镜头偏移、E 叫预备队走场景钩子（护阵键 / 手柄 Y / 部曲按钮都先问 legionOrderOverride）', /\+ this\.cameraBiasY\(\);/.test(G) && /protected cameraBiasY\(\) \{ return this\.defV2\?\.cameraBias\(this\.player\) \?\? 0; \}/.test(S) && /cycleOrder: \(\) => \{ if \(this\.legionOrderOverride\(\)\) return;/.test(G) && /if \(button === PAD\.Y\) \{ if \(!this\.legionOrderOverride\(\)\) this\.legion\.cycleOrder\(\); return true; \}/.test(G) && /this\.defV2\.callReserve\(this\.player\.x\); return true;/.test(S));
ck('部曲岗位钩子：Legion.postOf → 战术按岗位站 / 选敌不按主将拴、垛口射程 ×1.6、卡住按岗位归位', /this\.tactics\.postOf = this\.postOf;/.test(L) && /\* \(this\.postRangeMul\?\.\(u\) \?\? 1\);/.test(L) && /const p = this\.postOf\?\.\(u\) \?\? this\.formation\.position\(u\)/.test(L) && /private thinkPost\(u: Ally, post:/.test(T) && /if \(this\.postOf\?\.\(u\)\) \{ let best/.test(T));
ck('墙图复用 2-3 洛阳 2.5D 城墙（正面朝城外）：墙段从外侧城垛往下裁、城门楼两层、走道用同图石板带往上铺（手绘拼接）', /setCrop\(0, A\.seg\.crenel, A\.seg\.w, A\.seg\.h - A\.seg\.crenel\)/.test(W) && /defv2-gate-front/.test(W) && /c\.drawImage\(segImg, 0, A\.seg\.walkTop/.test(W));
const I = src('src/systems/ItemDrops.ts');
ck('定时宝箱落点走钩子（守城 v2 挪回走道，别落在墙面 / 城外）；其它关不给钩子照旧', /place\?: \(x: number, y: number\) => \{ x: number; y: number \};/.test(I) && /const q = this\.place\?\.\(/.test(I) && /this\.itemDrops\.place = \(x, y\) => this\.fieldPlace\(x, y\);/.test(S));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
