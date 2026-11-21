// 出征前整军（总制作人试玩 + 测试组 honest-journey：1-2 第一次带 19 个兵，之后 5 次重进全是 0 兵开局，攒着上千随军粮没有行营可花）：纯 node，不开浏览器。
// 规则：从存档点开打的主线关（战败后「再战此关」、主页「继续征程」、天下地图出征各章第一关）先进行营整军，点「率军出征」才开战；
// 部曲按存档点恢复（存档点 = 最近一次出征那一刻，行营每一步都写回），天下开启后战败另按 DEFEAT.troopLoss 折损；行营里的花费不回滚。
// 浏览器走两条路见 tools/shot-precamp-retry.mjs。用法：node tools/test-precamp.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const G = src('src/scenes/GameScene.ts'), C = src('src/ui/CampRestUI.ts'), CP = src('src/systems/Campaign.ts'), DF = src('src/data/defeatFlow.ts');

ck('哪些关先整军：从存档点开打（campaignLoaded）——主线没打过的关（天下战役），或只读继承的出征（攻城 / 守城 / 军情 / 支线攻城）；不是测试战斗、部曲已开放', /this\.preCampDue = this\.campaignLoaded && \(this\.campaignReplay \? this\.inheritsCampaign\(\) : this\.worldCampaign\) && !isChapterTestRun\(\) && !this\.encounterPreview && mechOpen\('squad'\);/.test(G) && /this\.campaignLoaded = !!carriedState && !chained;/.test(G));
ck('「再战此关」与「主页 → 继续征程」都是从存档点开打（不带 campaignTransfer）', /if\(retry\)this\.registry\.set\('autoCampaignEntry',true\);this\.scene\.start\('MenuScene'\)/.test(G) && /if\(!victory\)\{this\.registry\.remove\('campaignTransfer'\);/.test(G));
ck('顺序：关前剧情（章头 → 过场 → 军情 → 羁绊）看完 → 整军 → 出征后才开新手引导', /if \(chapterId && this\.preCampDue\) \{ this\.preCampArmed = true; this\.storyDir\.beginStage\(\(\) => \{ if \(!this\.preCampDue \|\| this\.over\) \{ done\(\); return; \} this\.preCampDue = false; this\.openPreCamp\(done\); \}\); \}/.test(G));
ck('篇章没有关前剧情时：开打后等军情卷轴等放完（mode 回到 none）直接整军', /if \(this\.preCampDue\) \{ const tryOpen = \(\): void => \{ if \(!this\.preCampDue \|\| this\.preCampArmed \|\| this\.over\) \{[^\n]*if \(this\.mode !== 'none'\) return;[^\n]*this\.preCampDue = false; this\.openPreCamp\(\(\) => \{\}\); \};/.test(G));
ck('整军页 = 行营（招兵 / 军医 / 商人 / 布阵），右上写「出征 · 本关名」，商人货架另算一次来访', /protected openPreCamp\(after: \(\) => void\): void \{\s*\n\s*this\.preCamp = true; this\.preCampAfter = after; this\.resting = true;[^\n]*\n[^\n]*musterBase[^\n]*\n\s*if \(this\.campUI\) this\.campUI\.preBattle = this\.chapter\.name;\s*\n\s*this\.restIntroPlayed = true;[^\n]*\n\s*this\.renderRecruit\(\); this\.setMode\('rest'\);/.test(G) && /this\.preCamp = false; this\.resting = false; this\.restIntroPlayed = false;/.test(G) && /open\(key:string,destination:string\)\{if\(this\.preBattle\)key\+=':pre';/.test(C) && /this\.next\.setText\(this\.preBattle\?'出征 · '\+this\.preBattle:'下一关 · '\+this\.destination\);/.test(C));
ck('「率军出征」（按钮 / Enter / 旧招兵面板）都走 departRest：整军页 → 本关开战，打赢后的行营 → 下一关', /this\.campUI=new CampRestUI\(this,this\.player,this\.legion,\(\)=>this\.departRest\(\)\);/.test(G) && /if \(this\.mode === 'rest'\) this\.departRest\(\);/.test(G) && /protected departRest\(\): void \{\s*\n\s*if \(!this\.preCamp\) \{ this\.continueCampaign\(\); return; \}/.test(G));
ck('整军出征：存档点写成出征那一刻，花费不回滚（commitBattle 后重开「进行中战斗」快照），关前剧情之后的流程（新手引导）照常', /this\.saveRestPoint\(\); \/\/ 存档点 = 出征那一刻\s*\n\s*this\.preCamp = false; this\.resting = false;[^\n]*\n\s*this\.setMode\('none'\);\s*\n\s*commitBattle\(\); beginBattle\(this\.scene\.key\);[^\n]*\n\s*const after = this\.preCampAfter; this\.preCampAfter = null; after\?\.\(\);/.test(G));
ck('部曲按存档点恢复：存档点存整支部曲（army.exportState）；天下开启后战败按 troopLoss 折损', /army: army\.exportState\(\)/.test(CP) && /const soldiers = Array\.isArray\(s\.army\?\.soldiers\) \? s\.army\.soldiers : \[\], lose = Math\.floor\(soldiers\.length \* o\.troopLoss\);/.test(CP) && /troopLoss:/.test(DF));
ck('行营每一步写回存档点（saveRestPoint 在整军页同样生效：resting + rest 模式；只读继承的出征只写增量）', /protected saveRestPoint\(\): void \{\s*\n\s*if \(!this\.resting \|\| this\.mode !== 'rest' \|\| isChapterTestRun\(\)/.test(G) && /this\.campUI\.onChanged=\(\)=>this\.saveRestPoint\(\);/.test(G));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
