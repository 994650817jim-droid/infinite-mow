// 总制作人第一章通关试玩（r3，main 213ec8f2，新存档赵云）的流程修正：纯 node，不开浏览器。
// 1) 行营存档点：行营里招兵 / 治疗 / 买卖 / 学战法 / 重整与率军出征都写回征程构筑，阵亡续打 = 从出征那一刻开打；
// 2) 两个招兵入口的定位：战斗支援 = 免费补一小队（人数表不变，用户 11-16 批准），行营 = 主要兵源；两处说明同口径；
// 3) 第一章章末：天下地图已开就不进行营、不直赴汜水关，结算 →「黄巾平定 · 展开天下地图」→ 告捷卷 → 献马 → 天下地图；
// 4) 兵装：一键穿戴规则（先品质后评分、信物同名只取一件、别人穿着的不动）、行营「行囊」小红点 + 第一次提示、结算提示行。
// 用法：node tools/test-play-r3-fixes.mjs（NODE_PATH 指向有 esbuild 的 node_modules）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const src = p => readFileSync(join(root, p), 'utf8');
const G = src('src/scenes/GameScene.ts'), C = src('src/ui/CampRestUI.ts'), M = src('src/data/mechanicUnlocks.ts'), L = src('src/data/legion.ts'), S = src('src/systems/ItemStore.ts'), B = src('src/ui/ItemBagUI.ts');

// ———— 1) 行营存档点
ck('saveRestPoint：只在行营里、主线首次打赢、不是测试 / 调试战斗时，把整份征程构筑写回存档点', /protected saveRestPoint\(\): void \{\s*\n\s*if \(!this\.resting \|\| this\.mode !== 'rest' \|\| this\.campaignReplay \|\| isChapterTestRun\(\) \|\| this\.debugModified \|\| this\.debugJumped \|\| this\.player\.damageImmune\) return;\s*\n\s*saveCampaignBuild\(this\.runConfig\.character, packCampaign\(this\.runConfig\.character, this\.player, this\.legion, this\.followers\)\);/.test(G));
ck('行营每次重绘（招兵、治疗、买卖、学战法、重整之后都会重绘）都写回：CampRestUI.render 末尾 onChanged', /this\.renderFormation\(\);\n\s*this\.onChanged\?\.\(\);\n \}/.test(C.replace(/\r\n/g, '\n')) && /this\.campUI\.onChanged=\(\)=>this\.saveRestPoint\(\);/.test(G));
ck('军医 / 学战法 / 重整三个旧回调也走同一个存档点（整份写，不再只改血量 / 战法）', /this\.campUI\.onHealed=\(\)=>this\.saveRestPoint\(\);/.test(G) && /this\.campUI\.onLearnTactic=\(\)=>this\.saveRestPoint\(\);/.test(G) && /this\.campUI\.onRespecSave=\(\)=>this\.saveRestPoint\(\);/.test(G));
ck('率军出征时再写一次（存档点 = 出征那一刻）', /this\.saveRestPoint\(\); \/\/ 率军出征：存档点 = 出征那一刻\s*\n\s*this\.resting = false; this\.scene\.restart\(\);/.test(G));
ck('续打仍读存档点（主线没打过的关 loadCampaignBuild），所以阵亡后从出征那一刻开打', /const carriedState = chained \?\? \(this\.campaignReplay && !this\.inheritsCampaign\(\) \? undefined : loadCampaignBuild\(this\.runConfig\.character\)\);/.test(G));
// 模拟：1-1 打赢存 495 粮 0 兵 → 行营招 6 人（432 粮）→ 出征 1-2 阵亡 → 续打读到的
{ const store = {}; const save = st => { store.v = JSON.parse(JSON.stringify(st)); };
  const camp = { food: 495, troops: 0 }; save(camp); // 打赢那一刻
  const recruit = () => { camp.food -= 10 + Math.round(camp.troops * 2); camp.troops++; save(camp); }; // 每招一人重绘 → onChanged → 存
  for (let i = 0; i < 6; i++) recruit(); save(camp); // 率军出征
  ck('模拟 r3：行营招 6 人后出征、阵亡续打 → 兵 6、粮不回到 495', store.v.troops === 6 && store.v.food < 495, store.v); }

// ———— 2) 两个招兵入口
const LG = await load('src/data/legion.ts');
ck('战斗支援人数表不变（用户 11-16 批准的 2 / 3 / 3 / 4 / 4）', JSON.stringify(LG.FREE_RECRUIT_BY_TIER) === '[2,3,3,4,4]', LG.FREE_RECRUIT_BY_TIER);
ck('定位写进数据注释与两处说明：战斗支援 = 免费补一小队；行营招兵 = 主要兵源（随军粮按人招、越招越贵）', /战斗支援 = 补员：免费补一小队/.test(L) && /行营招兵 = 主要兵源/.test(L) && /行营招兵是主要兵源：随军粮按人招，在编越多越贵/.test(C) && /战斗中的「战斗支援」只免费补一小队/.test(C) && /战斗支援：每次免费补一小队兵；大批招兵去行营（随军粮按人招）/.test(M));

// ———— 3) 第一章章末
ck('1-3 打赢、天下地图已开（正常主线）：ch1Map，不进行营、不直赴汜水关（nextWest = 0）', /const ch1Map=victory&&this\.worldCampaign&&!this\.runConfig\.encounter&&this\.chapter\.id==='huangjin'&&this\.chapter\.stage===3&&worldUnlocked\(\);this\.ch1MapEnd=ch1Map;/.test(G) && /\(this\.chapter\.id==='huangjin'&&this\.chapter\.stage===3\)\?\(ch1Map\?0:1\):/.test(G) && /if \(victory && !this\.runConfig\.encounter && !this\.ch1MapEnd && /.test(G));
ck('结算主按钮「黄巾平定 · 展开天下地图」→ 告捷卷 → 献马（首次）→ 天下地图', /ch1Map\?'黄巾平定 · 展开天下地图':canAdvance\?/.test(G) && /if\(ch1Map\)\{this\.showChapter1End\(\);return;\}/.test(G) && /protected showChapter1End\(\): void \{[\s\S]{0,900}confirm: '确认 · 展开天下地图'[\s\S]{0,300}if \(this\.merchantStoryDue\(\)\) \{ this\.showMerchantHorseStory\(\(\) => this\.showChapter1MapAfterStory\(\)\); return; \} this\.showChapter1MapAfterStory\(\);/.test(G));
ck('地图没开（测试 / 调试战斗）仍走旧流程（行营 → 汜水关）', /\(ch1Map\?0:1\)/.test(G) && /const toMap=this\.chapter\.id==='huangjin'&&worldUnlocked\(\);/.test(G));

// ———— 4) 兵装
const I = await load('src/data/items.ts'), A = await load('src/data/gearAuto.ts');
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mk = (q, slot) => I.rollItem(q, rng, slot, 1);
const helmW = mk('white', 'helm'), helmB = mk('blue', 'helm'), armorG = mk('green', 'armor'), bootsP = mk('purple', 'boots'), bootsG = mk('green', 'boots');
ck('评分：各词条 ÷ 兵装上限之和 × 100（同品质才比评分）；先比品质：蓝 > 白、紫 > 绿', A.itemScore(helmB) > 0 && A.compareGear(helmB, helmW) > 0 && A.compareGear(bootsP, bootsG) > 0 && A.compareGear(helmW, helmB) < 0, { w: A.itemScore(helmW), b: A.itemScore(helmB) });
const plan1 = A.gearPlan({}, [helmW, helmB, armorG, bootsG, bootsP], 1);
ck('空身：每位挑最好的一件（头盔蓝、甲胄绿、战靴紫）', plan1.length === 3 && plan1.find(p => p.slot === 'helm')?.item === helmB && plan1.find(p => p.slot === 'armor')?.item === armorG && plan1.find(p => p.slot === 'boots')?.item === bootsP, plan1.map(p => p.slot + ':' + p.item.quality));
ck('身上已有更好的不换；有更好的才换', A.gearPlan({ helm: helmB, armor: armorG, boots: bootsP }, [helmW, bootsG], 1).length === 0 && A.gearPlan({ helm: helmW }, [helmB], 1)[0]?.item === helmB);
const tok = (q, id) => I.rollCharm(q, rng, id, 1);
const charmIds = [...new Set([...src('src/data/charms.ts').matchAll(/\b(charm_[a-z_]+)\b/g)].map(m => m[1]))];
const c1 = tok('purple', charmIds[0]), c1b = tok('green', charmIds[0]), c2 = tok('blue', charmIds[1]);
if (c1 && c1b && c2) {
  const one = A.gearPlan({}, [c1b, c1, c2], 1), two = A.gearPlan({}, [c1b, c1, c2], 2);
  ck('信物一位：挑最好的那件', one.length === 1 && one[0].item === c1 && one[0].slot === 'token', one.map(p => p.slot + ':' + p.item.quality));
  ck('信物两位：同名只取一件（紫的那件 + 另一种蓝的），分到 token / token2', two.length === 2 && two.some(p => p.item === c1) && two.some(p => p.item === c2) && !two.some(p => p.item === c1b) && new Set(two.map(p => p.slot)).size === 2, two.map(p => p.slot + ':' + p.item.base + ':' + p.item.quality));
  ck('信物两位都穿着、来了一件更好的不同名：只换掉较差的那位', (() => { const r = A.gearPlan({ token: c1, token2: c2 }, [tok('orange', charmIds[2])].filter(Boolean), 2); return r.length === 1 && r[0].slot === 'token2'; })());
} else ck('信物样本', false, { charmIds: charmIds.slice(0, 3) });
ck('行囊「一键穿戴」：只挑没被任何武将穿着的（行囊 + 战斗中缴获），按位穿；有更好的没穿时按钮带小红点', /export function gearUpgrades\(hero: GearOwner, extra: readonly ItemInstance\[\] = \[\], s: ItemSave = loadItems\(\)\)[\s\S]{0,300}s\.bag\.filter\(i => !worn\.has\(i\.uid\)\)/.test(S) && /private autoWear\(\): void \{\s*\n\s*const picks = gearUpgrades\(this\.hero, this\.o\.runLoot \?\? \[\]\); let n = 0;\s*\n\s*for \(const p of picks\) if \(this\.wear\(p\.item, p\.slot\)\) n\+\+;/.test(B) && /'一键穿戴', 'item-auto-wear'/.test(B) && /item-auto-wear-dot/.test(B));
ck('equipItem 可指定位（信物第二位），须与道具的位相符', /export function equipItem\(hero: GearOwner, uid: string, slot\?: LoadoutKey\): boolean/.test(S) && /const fits = slot && \(slot === itemSlot\(item\) \|\| \(slot === 'token2' && itemSlot\(item\) === 'token' && tokenSlots\(\) > 1\)\);/.test(S));
ck('行营「行囊」小红点（有更好的没穿）+ 第一次提示「点右上「行囊」，再点「一键穿戴」」（打开行囊或一键穿戴后不再提示）', /this\.bagDot\?\.setVisible\(ups>0\);if\(ups>0&&!this\.notice&&!gearGuideSeen\(\)\)/.test(C) && /markGearGuideSeen\(\);this\.onOpenBag\?\.\(\);/.test(C) && /this\.campUI\.gearUpgrades=\(\)=>mechShown\('gear'\)\?gearUpgrades\(this\.runConfig\.character,this\.itemDrops\?\.runLoot\?\?\[\]\)\.length:0;/.test(G) && /markGearGuideSeen\(\);/.test(B));
ck('结算：行囊有更好的兵装没穿时写一行；行囊玩法引子改成「一键穿戴」', /行囊里有 '\+n\+' 件更好的兵装没穿 · 点「行囊」→「一键穿戴」/.test(G) && /按 B 打开行囊，点「一键穿戴」换上最好的/.test(M));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
