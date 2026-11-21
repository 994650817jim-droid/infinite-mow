// 守城 v2 试玩版（共享笔记 defense-redesign-v2.md v2.2）· a 段：纯 node，不开浏览器。
// 开关默认关；场地几何（城外在下、走道 3.5 身位、墙身挡人只留马道缺口、四面封边）；分段与岗位；自动站位；马道寻路；镜头；接线。
// b 段：镜头锁墙脚（城外留 ≥ 240 截图像素）、一键 F 站位与优先级、占段判定、爬梯速度、门楼半透明、单行横幅、推下城、只用手绘图。
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
ck('走道上能走：走道中线（段里、门楼上）不在碰撞框里', [-850, -600, -300, 0, 300, 600, 850].every(x => !inBox({ x: g.gx + x, y: (g.top + g.W) / 2 })), { gx: g.gx });
ck('内侧女墙挡人、只在两个马道口留缺口', !inBox({ x: g.ramps[0], y: g.top - 20 }, 6) && !inBox({ x: g.ramps[1], y: g.top - 20 }, 6) && inBox({ x: g.gx, y: g.top - 20 }) && inBox({ x: g.gx - 600, y: g.top - 20 }));
ck('四面封边：走道两端外（角楼）挡住，场地四边外封死；城外 / 城里可以走到角楼底下（到场地边）', inBox({ x: g.X0 - 100, y: g.W }) && inBox({ x: g.X1 + 100, y: g.W - 60 }) && inBox({ x: g.bounds.right + 60, y: g.F + 300 }) && inBox({ x: g.bounds.left - 60, y: g.innerTop - 100 }) && inBox({ x: g.gx, y: g.cityTop - 50 }) && inBox({ x: g.gx, y: g.outBot + 50 }) && !inBox({ x: g.X1 + 100, y: g.F + 300 }) && !inBox({ x: g.X0 - 100, y: g.innerTop - 100 }));
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
{ // 电脑布局：设计画面 960×540、战场倍率 0.88 × zoomMul；截图 1280 宽 = 设计 ×4/3
  const z = .88 * D.camera.zoomMul, H = 540, scr = (wy, c) => (wy - c) * z + H / 2;
  const at = y => V.cameraCenterY(g, { x: g.gx - 500, y }, z, H), mid = (g.top + g.W) / 2;
  const c0 = at(mid), cS = at(g.W - 30), cN = at(g.top + 20);
  const outPx = c => (H - scr(g.F, c)) * 4 / 3, heroPx = (y, c) => scr(y, c) * 4 / 3;
  ck('镜头（a 段验收第 2 条）：主将在走道中线 / 南沿时，墙脚以下的城外地面 ≥ 240 截图像素；主将脚下离屏幕顶 ≥ ' + D.camera.heroMin + ' 设计像素',
    outPx(c0) >= 240 && outPx(cS) >= 240 && scr(mid, c0) >= D.camera.heroMin - .5 && scr(g.top + 20, cN) >= D.camera.heroMin - .5 && D.camera.zoomMul < 1,
    { mid: { out: Math.round(outPx(c0)), hero: Math.round(heroPx(mid, c0)) }, south: { out: Math.round(outPx(cS)) }, north: { out: Math.round(outPx(cN)), hero: Math.round(heroPx(g.top + 20, cN)) } });
  ck('镜头：主将下城进城不让（回正）', at(g.innerTop - 100) === null && V.cameraCenterY(g, { x: g.gx, y: g.innerTop - 100 }, z, H) === null);
}

// ———— 接线
const S = src('src/scenes/SiegeGameScene.ts'), G = src('src/scenes/GameScene.ts'), L = src('src/systems/Legion.ts'), T = src('src/systems/LegionTactics.ts'), W = src('src/systems/DefenseWallV2.ts');
ck('攻城场景：守城且开关开 → 新守城（只铺地面、不建旧 DefenseBattle）；关 → 旧守城照旧', /const v2 = this\.defense && !this\.intercept && defenseV2On\(\);/.test(S) && /bare: v2\}\);/.test(S) && /if \(this\.defense && !this\.intercept\) \{ if \(v2\) this\.setupDefenseV2\(\); else this\.setupDefense\(\); \}/.test(S));
ck('刷兵只在城外（不在城外的落点挪到城外敌营），首领在城外', /if \(this\.defV2 && kind !== 'boss' && !this\.defInside && !this\.defV2\.isOutside\(\{x, y\}\)\) \{ const sp = this\.defV2\.spawnPoint\(\);/.test(S) && /if \(this\.defV2\) \{ const p = this\.defV2\.spawnPoint\(\); return this\.spawnEnemy/.test(S) && /const bp = this\.defV2\.bossPoint\(\); b\.sprite\.setPosition\(bp\.x, bp\.y\);/.test(S));
ck('镜头偏移、E 叫预备队走场景钩子（护阵键 / 手柄 Y / 部曲按钮都先问 legionOrderOverride）', /\+ this\.cameraBiasY\(\);/.test(G) && /protected cameraBiasY\(\) \{ return this\.defV2\?\.cameraBias\(this\.player, this\.cameras\.main\.zoom \/ RENDER_SCALE, GAME_HEIGHT\) \?\? 0; \}/.test(S) && /cycleOrder: \(\) => \{ if \(this\.legionOrderOverride\(\)\) return;/.test(G) && /if \(button === PAD\.Y\) \{ if \(!this\.legionOrderOverride\(\)\) this\.legion\.cycleOrder\(\); return true; \}/.test(G) && /this\.defV2\.callReserve\(this\.player\.x\); return true;/.test(S));
ck('部曲岗位钩子：Legion.postOf → 战术按岗位站 / 选敌不按主将拴、垛口射程 ×1.6、卡住按岗位归位', /this\.tactics\.postOf = this\.postOf;/.test(L) && /\* \(this\.postRangeMul\?\.\(u\) \?\? 1\);/.test(L) && /const p = this\.postOf\?\.\(u\) \?\? this\.formation\.position\(u\)/.test(L) && /private thinkPost\(u: Ally, post:/.test(T) && /if \(this\.postOf\?\.\(u\)\) \{ let best/.test(T));
ck('墙图：墙段 / 角楼复用 2-3 洛阳 2.5D 城墙（正面朝城外，从外侧城垛往下裁、最后一块裁到地图边）；城门楼两层；走道是美术组 walkway_a / b', W.includes('im.setCrop(A.seg.w - tw, A.seg.crenel, tw, A.seg.h - A.seg.crenel)') && /defv2-gate-front/.test(W) && W.includes('c.drawImage(s.textures.get(KEY.walkA)') && W.includes('c.drawImage(s.textures.get(KEY.walkB)'));
// ———— b 段
const Asl = src('src/systems/DefenseAssaultV2.ts'), O = src('src/systems/SishuiObstacles.ts'), K = src('src/systems/BattleHotkeys.ts'), AA = D.assault, AR = D.art;
{ const WK = AR.walkway, P2 = g.posts, bandBot = g.top + D.layout.band;
  ck('走道换成美术组 walkway_a / b（1024×256、1:1、a / b 交替横铺）：图上沿（内侧女墙顶）对齐走道北沿，多出的压在外侧城垛后面', WK.w === 1024 && WK.h === 256 && WK.h - D.layout.walk <= D.art.crenelOver && W.includes('s.textures.createCanvas(walkKey, WK.w * 2, WK.h)') && W.includes('g.top + WK.h / 2, x1 - x0, WK.h, walkKey'));
  ck('女墙带不站人：内侧女墙碰撞伸进走道 ' + D.layout.band + '（图上女墙带 ' + WK.band + '），所有岗位、马道上下点都在女墙带以南', D.layout.band <= WK.band && g.boxes.some(b => b.top === g.innerTop && b.bottom === bandBot) && P2.every(p => p.y > bandBot + 14) && V.nextWaypoint(g, { x: g.ramps[0], y: g.innerTop - 60 }, P2[0]).y > bandBot + 14);
  ck('马道口：女墙带在缺口处换成路面（同一张走道图的路面行盖上去）；城门楼那一截不铺走道（门楼图自带楼前平台）', W.includes("setName('defv2-ramp-gap')") && W.includes('[[g.X0, g.gx - gHalf], [g.gx + gHalf, g.X1]]')); }
{ const GA = AR.gate, gs = (g.F - (g.W - AR.crenelOver)) / (GA.ground - GA.crenel), ss = (g.F - (g.W - AR.crenelOver)) / (AR.seg.ground - AR.seg.crenel), at = py => g.F - (GA.ground - py) * gs;
  ck('城门楼换成可通行版 gate_passable_v2：和墙段同缩放（外侧城垛顶→墙脚齐平），后排女墙顶对齐走道北沿（差 ≤ 10），楼阁台基在修门位以北', GA.w === 873 && GA.h === 816 && Math.abs(gs - ss) < .01 && Math.abs(at(GA.rear) - g.top) <= 10 && at(GA.base) < V.v2Spots(g).gate.y - 12, { gs: +gs.toFixed(3), rear: Math.round(at(GA.rear) - g.top), base: Math.round(at(GA.base) - g.top) });
  ck('城门楼：楼阁在人后面（整张图压在走道所有人身后）、外侧城垛那层在人前面；去掉了「人进范围楼阁半透明」的过渡', /KEY\.gate\)\.setOrigin\(\.5, A\.gate\.ground \/ A\.gate\.h\)\.setScale\(gs\)\.setDepth\(actorDepth\(g\.top\) - \.01\)/.test(W) && /front\.setCrop\(0, A\.gate\.crenel, A\.gate\.w, A\.gate\.h - A\.gate\.crenel\)/.test(W) && !/fadeGate|gateFade|gateAlpha/.test(W) && !('gateFade' in D)); }
ck('横幅（a 段第 4 条 / b 段验收第 3 条）：一次一行、放在计时器下方那一行（不挡墙面）；同类提示第一次完整句子、之后只出短句（「第 1 段失守」）', S.includes('if (this.defV2) this.v2Notice(text, danger, captionText); else super.showWaveBanner') && S.includes("const line = first ? (caption ? text + '　' + caption : text) : (this.v2Short ?? text), y = DEFENSE_V2.notice.y;") && D.notice.y < 90 && Asl.includes("'这段梯子上人更快——清掉这段的敌兵就夺回', ") && Asl.includes(" 段失守"));
// 一键 F 的站位与优先级
const SP = V.v2Spots(g), up = () => true, none = () => false;
ck('一键 F 站位：每段梯口在梯子顶端（走道南沿）、滚木架在梯口东侧、油锅在门楼前沿、修门在门楼内侧；都在走道上', SP.ladders.length === 4 && SP.racks.length === 4 && [...SP.ladders, ...SP.racks, SP.oil, SP.gate].every(p => p.y > g.top && p.y < g.W) && SP.oil.x === g.gx && SP.gate.y < SP.oil.y);
ck('站梯口：梯子立着 → 推梯；梯子没立 → 不算梯口', V.spotAt(g, SP.ladders[1], up)?.kind === 'ladder' && V.spotAt(g, SP.ladders[1], none) === null);
ck('站滚木架 → 滚木（是这一段的）；站门楼前沿 → 泼油；站门楼内侧 → 修门；空地 → 没有', V.spotAt(g, SP.racks[2], up)?.kind === 'rack' && V.spotAt(g, SP.racks[2], up)?.seg === 2 && V.spotAt(g, SP.oil, up)?.kind === 'oil' && V.spotAt(g, SP.gate, up)?.kind === 'gate' && V.spotAt(g, { x: g.segs[0].x0 + 20, y: g.top + 20 }, up) === null);
ck('优先级 梯口 > 滚木架（两处都够得着时推梯）', V.spotAt(g, { x: (SP.ladders[0].x + SP.racks[0].x) / 2, y: (SP.ladders[0].y + SP.racks[0].y) / 2 }, up)?.kind === 'ladder');
ck('城头分段判定：走道上按段的 x 范围；墙面 / 城外 / 城里不算', V.walkSegment(g, { x: g.segs[3].ladderX, y: g.W - 20 }) === 3 && V.walkSegment(g, { x: g.segs[3].ladderX, y: g.F - 10 }) === -1 && V.walkSegment(g, { x: g.gx, y: (g.top + g.W) / 2 }) === -1 && V.walkSegment(g, { x: g.segs[0].ladderX, y: g.innerTop - 40 }) === -1);
ck('爬梯：从墙脚爬到翻上垛口用 ' + AA.ladder.climbSec + ' 秒；占段后 ×' + AA.capture.fastMul, Math.abs((g.F - (g.W - 26)) / V.climbSpeed(g) - AA.ladder.climbSec) < 1e-6 && AA.capture.fastMul === 2 && AA.capture.minFoes === 3);
// 接线
ck('爬梯 / 摔下城的人不受墙身碰撞（SishuiObstacles.pass），F 走场景钩子（守城 v2 不再当「出击」）', /pass\?:\(e:Enemy\)=>boolean;/.test(O) && /!this\.pass\?\.\(e\)/.test(O) && /case 'sortie': if \(h\.interact\?\.\(\)\) return true;/.test(K) && /interact: \(\) => this\.interactOverride\(\)/.test(G) && /protected interactOverride\(\) \{ if \(!this\.assault\) return false; if \(this\.mode === 'none' && !this\.over\) this\.assault\.interact\(\); return true; \}/.test(S) && /this\.sishuiObstacles\.pass = e => this\.assault\?\.ghost\(e\) \?\? false;/.test(S));
ck('敌兵步进：爬梯 / 城外排梯、砍门走 assault.step；攻城主将先砍门', /if \(this\.assault\?\.step\(enemy, dt\)\) return true;/.test(S) && /if \(this\.assault\?\.bossStep\(enemy, dt\)\) return true;/.test(S));
ck('主将近战往下打墙面 / 墙脚 ×' + AA.hero.belowMelee + '，打中走道南沿普通兵 → 推下城；精英 / 首领推不下', /raw \*= DEFENSE_V2\.assault\.hero\.belowMelee;/.test(S) && /this\.assault!\.tryPushOff\(enemy, this\.player\);/.test(S) && /e\.kind === 'elite' \|\| e\.kind === 'boss'/.test(Asl));
ck('镜头拉远只在电脑布局（HUD 在 UI 镜头上不受影响）；登城武器范围 ×' + AA.hero.rampartMul, /if \(IS_DESKTOP\) this\.cameras\.main\.setZoom\(RENDER_SCALE \* BATTLE_ZOOM_DESKTOP \* DEFENSE_V2\.camera\.zoomMul\);/.test(S) && /this\.player\.passive\.rampartMul = on \? DEFENSE_V2\.assault\.hero\.rampartMul : 1;/.test(S));
ck('特效只用现有手绘图 / 序列帧（云梯车、冲车、滚木堆、地火、水墨圈），不画代码像素特效', ['siege_mid_ladder', 'siege_mid_ram', 'siege_mid_barb', 'ground_fire', 'siege_capture'].every(k => Asl.includes("'" + k + "'")) && !/fillCircle|fillEllipse|strokeEllipse|add\.circle|add\.ellipse|particles/.test(Asl));
ck('数值都在 data/defenseV2.ts（云梯 / 冲车 / 城门 / 占段 / 推下城 / 滚木 / 热油 / 修门）', ['ladder', 'ram', 'gate', 'capture', 'push', 'hero', 'spots', 'logs', 'oil', 'repair'].every(k => k in AA) && AA.ladder.segCap === 8 && AA.gate.hp.medium > 0);
ck('开打主将站在垛口后（走道南半边），计时器下的关名透明（不压城头主将头顶）', D.layout.heroDy < D.layout.walk / 2 && S.includes('this.player.sprite.setPosition(start.x, w.g.W - DEFENSE_V2.layout.heroDy);') && S.includes('this.hudTexts.chapter.setAlpha(0);'));
ck('回血点（泉眼 / 水井）走 healPlace：守城 v2 放城里（内侧女墙以北）；F 提示压到顶部计时器时改放主将脚下', G.includes('place:(x,y)=>this.healPlace(x,y)') && S.includes('protected healPlace(x: number, y: number) { const w = this.defV2?.g; if (!w || y < w.innerTop - 40) return super.healPlace(x, y); return super.healPlace(Math.max(w.X0 + 80, Math.min(w.X1 - 80, x)), w.innerTop - 90); }') && Asl.includes('(above - v.y) / v.height < .17 ? p.y + 26 : above'));
// ———— c 段 · 定宽场地（用户「防守战不要是无限大地图，这样城墙就可以铺开」）
{ const L = D.layout, B = g.bounds, run = (g.X1 - g.X0) / 178, cs = (g.F - (g.W - AR.crenelOver)) / (AR.corner.ground - AR.corner.crenel), cw = AR.corner.w * cs, towerL = g.X0 + 10 - cw, towerR = g.X1 - 10 + cw;
  ck('走道全长 ' + (g.X1 - g.X0) + '（主将基础移速 178 → 一头跑到另一头 ' + run.toFixed(1) + ' 秒，要求 8～10 秒）；地图全宽 ' + (B.right - B.left), run >= 8 && run <= 10.05, { walk: g.X1 - g.X0, map: B.right - B.left, run: +run.toFixed(1) });
  ck('城墙两端贴地图边：角楼外沿到场地边界不超过 30（城外 / 城里横向就到角楼外沿为止）', B.left - towerL >= 0 && B.left - towerL <= 30 && towerR - B.right >= 0 && towerR - B.right <= 30, { towerL: Math.round(towerL), left: B.left, towerR: Math.round(towerR), right: B.right });
  const segW = g.segs.map(s => Math.round(s.x1 - s.x0));
  ck('4 段城墙等宽、城门楼居中；每段梯口在段中点、滚木架和垛口都在段里', new Set(segW).size === 1 && Math.abs((g.segs[1].x1 + g.segs[2].x0) / 2 - g.gx) < 1 && V.v2Spots(g).racks.every((r, i) => r.x > g.segs[i].x0 + 10 && r.x < g.segs[i].x1 - 10) && g.posts.filter(p => p.kind === 'crenel').every(p => p.x > g.segs[p.seg].x0 && p.x < g.segs[p.seg].x1), { segW });
  ck('梯子只搭墙段（不搭门楼、不搭角楼）：梯口都在走道两端以内、门楼两侧以外', g.segs.every(s => s.ladderX > g.X0 + 40 && s.ladderX < g.X1 - 40 && Math.abs(s.ladderX - g.gx) > L.gateHalf + 40));
  const def = V.v2ArenaDef(g), inB = (p, pad = 0) => p.x >= B.left + pad && p.x <= B.right - pad && p.y >= B.top + pad && p.y <= B.bottom - pad;
  ck('有边场地：北边民居、南边敌营营栅、东西山崖（地形层 / StageArena 画，不是空气墙）；边带 ' + L.edgeBand, def.edges.n === 'houses' && def.edges.s === 'palisade' && def.edges.w === 'cliff' && def.edges.e === 'cliff' && def.band === L.edgeBand && JSON.stringify(def.bounds) === JSON.stringify(B));
  ck('刷兵口（敌营）、攻城主将、出城落点、府衙、城门内侧楼梯口、开局点都在场内', def.gates.every(p => inB(p, 30)) && inB({ x: g.gx, y: g.F + D.spawn.bossDy }) && inB({ x: g.gx, y: g.F + D.sortie.outDy }) && inB(g.keep, 60) && inB({ x: g.gx, y: g.innerTop - D.keep.stairDy }) && inB(g.start) && D.spawn.xs.every(x => inB({ x: g.gx + x + Math.sign(x) * D.spawn.jitter, y: g.F + D.spawn.dy }, 0)));
  ck('城外深度 = 墙脚 → 敌营（约一屏多），敌营贴下边；城里 = 走道 → 府衙', g.outBot - g.F === L.outside && L.outside >= 750 && g.outBot - (g.F + D.spawn.dy) <= 200 && g.keep.y - g.cityTop <= 200 && g.keep.y < g.innerTop);
  ck('场景接线：守城 v2 的有边场地 / 地形走 arenaDef / terrainDef 钩子（StageArena 夹镜头、挪人回场内）', S.includes('protected arenaDef() { return this.defV2 ? v2ArenaDef(this.defV2.g) : super.arenaDef(); }') && S.includes('protected terrainDef() { return this.defV2 ? arenaTerrain(v2ArenaDef(this.defV2.g)) : super.terrainDef(); }') && G.includes('const tc0=this.terrainDef()') && G.includes('const def=this.arenaDef();if(def)this.arena=new StageArena')); }
// ———— c 段 · 波次 / 赏粮 / 出城 / 府衙 / 增援 / 引导 / 舆图
{ const WV = D.waves, n = WV.count.medium, st = V.v2WaveStarts(n);
  ck('波次：中城 ' + n + ' 波（小 3 / 中 4 / 大 5）；每波攻 ' + WV.attackSec + ' 秒 → 喘息 ' + WV.restSec + ' 秒，末波 ' + WV.finalSec + ' 秒', WV.count.small === 3 && WV.count.large === 5 && st.length === n && st[1] === WV.attackSec + WV.restSec && V.v2Phase(n, 1).phase === 'attack' && V.v2Phase(n, WV.attackSec + 1).phase === 'rest' && V.v2Phase(n, st[n - 1] + 1).phase === 'final' && V.v2Phase(n, st[n - 1] + WV.finalSec + 1).phase === 'done');
  ck('每波器械越来越多（云梯车 2→4、冲车 0→1→2）；出城砸掉的云梯车下一波少一架（最少 1）', V.v2Engines(0).ladders === 2 && V.v2Engines(0).rams === 0 && V.v2Engines(2).ladders === 4 && V.v2Engines(1, 1).ladders === 2 && V.v2Engines(0, 5).ladders === 1);
  const r0 = V.v2WaveReward(0, 1), r1 = V.v2WaveReward(1, .5);
  ck('守得干净有奖：四段无失 + 城门满 = ' + r0.food + ' 粮（四段无失还有下一波部曲伤害加成）；失守 1 段、门半血 = ' + r1.food, r0.clean && !r1.clean && r0.food === 4 * D.reward.perSeg + D.reward.gate && r1.food === 3 * D.reward.perSeg + D.reward.gate / 2);
  ck('预备队按威胁自动增援：没威胁不派，一架梯子 1 个，越乱越多（每段最多 ' + D.reinforce.max + '）', V.v2ReinforceNeed(0) === 0 && V.v2ReinforceNeed(2) === 1 && V.v2ReinforceNeed(5) === 3 && V.v2ReinforceNeed(99) === D.reinforce.max);
  ck('出城冲阵：攻城 ' + D.sortie.afterSec + ' 秒后（或喘息）每波一次，开门 ' + D.sortie.durationSec + ' 秒，回门洞关门 / 时间到拉回；兵器冷却清零 + 移速 ×' + D.sortie.speedMul, Asl.includes('private sortieReady(): boolean') && Asl.includes("if (sp.kind === 'gate' && this.sortieReady()) { this.startSortie(); return true; }") && Asl.includes('if (now >= this.sortie.until) { this.endSortie(true); return; }') && S.includes('heroBoost: (mul, sec) => { for (const wp of this.player.weapons) wp.cooldownLeft = 0;'));
  ck('出城收益：砸掉云梯车 → 这一波那段不再立梯、下一波少一架；砸掉冲车 → 这一波不再来冲车；出城时 E 不可用、预备队不上城补位、冲车撞不到门', Asl.includes('this.segBlocked[l.seg] = this.wave; if (this.sortie.open) { this.nextCut++;') && Asl.includes('if (this.sortie.open) { this.ramCutWave = this.wave;') && S.includes("if (this.assault?.sortieOpen) { this.showWaveBanner('出城中 · E 不可用', false); return true; }") && S.includes('this.defV2.update(this.combatNow, this.assault?.sortieOpen)') && Asl.includes('this.gate.open || this.resting || this.sortie.open || now < r.next'));
  ck('喘息：不刷兵、梯子不上人、冲车不撞；滚木 / 热油补满；Space 跳过', S.includes('if (this.defend?.resting || this.assault?.resting) return;') && Asl.includes('this.logs = this.logs.map(() => A.logs.charges); this.oil.charges = A.oil.charges;') && Asl.includes('if (this.resting) continue; // 喘息：梯子不上人') && Asl.includes("if (ph.phase === 'rest' && this.h.skipPressed())"));
  ck('门破：城外近战穿门洞进城（淡出淡入）、城里离主将远的砍府衙；府衙归零 = 府衙失守（不按阵亡）；门楼内侧 F 下城、城门内侧 F 上城头', Asl.includes('private toArch(e: Enemy, dt: number): boolean') && Asl.includes('if (e.y < g.innerTop - 4) return this.raid(e, dt);') && Asl.includes('if (this.keep.hp <= 0) { this.done = true; this.h.lose(); return; }') && S.includes("lose: () => { if (!this.over) this.finish(false, 'keep'); }") && Asl.includes("return 'F · 下城守府衙'") && Asl.includes("return 'F · 上城头'") && D.keep.hp.medium > 0);
  ck('首次引导：开局 / 立梯 / 冲车撞门 / 能出城 / 喘息 / 门破各一张军师卡，每张只出一次（存档）', ['start', 'ladder', 'ram', 'sortie', 'rest', 'gate'].every(k => D.guide[k]) && S.includes('if (seen.includes(key)) return;') && ["guide('ladder')", "guide('ram')", "guide('sortie')", "guide('rest')", "guide('gate')"].every(k => Asl.includes(k)) && S.includes("this.v2Guide('start')"));
  const PM = src('src/ui/PaintedMap.ts');
  ck('舆图（M）：守城里以整张场地为画心，画四段城头状态（守着 / 有梯 / 失守）、城门 / 府衙血量、云梯车 / 冲车', PM.includes('const c = h.center?.() ?? h.player()') && PM.includes("this.label(w.state === 'lost' ? '失守' : '有梯'") && S.includes('protected mapCenter() { const b = this.defV2?.g.bounds;') && S.includes('protected mapFort() { return this.assault?.fort() ?? super.mapFort(); }'));
  ck('背面冲车（撞锤朝上朝城门开）：行进帧 0 / 1 + 上下颠 ' + 1.5 + ' 像素；撞门帧 2 → 3 往城门前冲再回弹 + 门上木屑序列帧', Asl.includes("file: 'assets/siege-v2/defense-v2/ram_back.png'") && Asl.includes('Math.sin(now / 95) * RAM_BACK.bob') && Asl.includes('y: r.y - RAM_BACK.lunge') && Asl.includes("this.h.fx('fx_death_props'")); }

const I = src('src/systems/ItemDrops.ts');
ck('定时宝箱落点走钩子（守城 v2 挪回走道，别落在墙面 / 城外）；其它关不给钩子照旧', /place\?: \(x: number, y: number\) => \{ x: number; y: number \};/.test(I) && /const q = this\.place\?\.\(/.test(I) && /this\.itemDrops\.place = \(x, y\) => this\.fieldPlace\(x, y\);/.test(S));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
