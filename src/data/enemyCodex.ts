import {ROSTER, STAGE_MIX, type RosterType, type TraitDef} from './enemyRoster';
import {CHAPTER_TIMELINE} from '../world/ChapterTimeline';
export {CHAPTER_TIMELINE as CODEX_CHAPTERS};
export const CODEX_ENEMIES=Object.values(ROSTER);
export function chapterEnemies(chapter:number):number[]{
 const arc=CHAPTER_TIMELINE[chapter]?.id,ids=new Set(Object.entries(STAGE_MIX).filter(([key])=>key.startsWith(arc+'.')).flatMap(([,mix])=>Object.keys(mix.traits)));
 for(const id of [...ids]){const t=ROSTER[id]?.trait;if(t?.kind==='tamer')ids.add(t.beast);}
 return CODEX_ENEMIES.map((e,i)=>ids.has(e.id)?i:-1).filter(i=>i>=0);
}
const sec=(ms:number)=>ms/1000+'秒',pct=(v:number)=>Math.round(v*100)+'%';
function traitInfo(t:TraitDef):[string,string]{switch(t.kind){
 case 'signal':return [`原地鸣号${sec(t.warnMs)}，完成后从外围招来${t.reinforcements}名普通步兵；每名传令骑最多成功一次。受击中断后需等${sec(t.retryMs)}。`,'看到「鸣号」优先攻击打断，避免留下援兵；不会在主将脚下凭空出兵。'];
 case 'brace':return [`锁定方向架枪${sec(t.warnMs)}，随后直刺${t.range}、宽${t.width}，伤害${t.damage}，间隔${sec(t.everyMs)}。架枪期间，主将正面兵器伤害减少${pct(t.front)}。`,'起手后绕侧，等直刺落空再反打；火焰和部曲协击不受该格挡影响。'];
 case 'fanarcher':return [`原地瞄准${sec(t.warnMs)}后发射3支散射箭，箭程${t.range}，每支为本兵基础攻击${pct(t.damageMul)}；间隔${sec(t.everyMs)}。`,'预警锁定后不再追踪。横移离开三条箭道，利用空隙接近。'];
 case 'swarm':return ['按自身兵种追击；部分以小队成群出现，主要靠数量与机动压迫。','不要被围住，边移动边用范围攻击削减数量。'];
 case 'heavy':return [`贴近后蓄力${sec(t.warnMs)}砸地，半径${t.slamRadius}、伤害${t.damage}，不吃强制击退。`,'看到砸地起手就离开落点，利用收招空档攻击。'];
 case 'healer':if(t.channelMs)return [`原地施药${sec(t.channelMs)}，为${t.radius}范围内生命比例最低的至多${t.maxTargets}名普通敌军回复${pct(t.share)}最大生命；完成后间隔${sec(t.everyMs)}，不治疗自身与首领。`,'看到施药立即攻击打断；引开伤兵或击败药师，阻止治疗。'];return [`每${sec(t.everyMs)}治疗${t.radius}范围内普通友军${pct(t.share)}最大生命，不治疗首领。`,'绕过前排优先处理治疗，避免敌群持续回复。'];
 case 'lobber':return [`远处抛投，落点预警${sec(t.warnMs)}，半径${t.radius}、伤害${t.damage}；间隔${sec(t.everyMs)}。`,'持续移动离开落点，拉近距离压制投手。'];
 case 'torch':return [`行进时每${sec(t.dropEveryMs)}留下地火，持续${sec(t.fireMs)}；倒下时半径${t.burstRadius}爆燃。`,'不要沿着火路追击，击杀时留出距离。'];
 case 'poison':return [`毒箭使中毒持续${t.seconds}秒，每层每秒${t.dps}伤害，最多${t.maxStacks}层。`,'横移躲箭，避免连续叠毒；毒伤本身不会把主将降到零生命。'];
 case 'horsearcher':return [`围绕主将约${t.orbit}距离游走，每${sec(t.everyMs)}射箭，不进行普通骑兵冲锋。`,'利用远程攻击或切入其环绕路线，不要只直线追赶。'];
 case 'tamer':return [`带${t.beasts}只猛兽入场；驯兽兵倒下后，所属猛兽移速变为${t.enrage}倍。`,'先控制兽群数量，再处理驯兽兵，避免集体狂暴。'];
 case 'ambusher':return [`接近时现身，随后以${t.dash}倍速度突进${sec(t.dashMs)}。${t.fireMs?'现身处留下火焰。':''}`,'小心独立旗影和可疑兵影，现身后横移，不要扎进伏兵中央。'];
 case 'shieldwall':return [`缓慢转向，正面抵挡${pct(t.front)}伤害；靠近后每${sec(t.everyMs)}盾击。`,'绕到侧后进攻，不要站在盾面前持续对砍。'];
 case 'javelin':return [`保持${t.range}左右距离掷标枪，每${sec(t.everyMs)}一击；被贴近会后撤。`,'横移躲矛，利用地形切断后撤路线。'];
 case 'sweeper':return [`蓄力${sec(t.warnMs)}后横扫，范围${t.range}、张角${t.arcDeg}度、伤害${t.damage}。`,'贴近时留意起手，退出扇面或绕到背后。'];
 case 'stance':return [`举盾${sec(t.upMs)}时正面抵挡${pct(t.front)}伤害；放盾${sec(t.downMs)}时连射${t.shots}箭。`,'举盾时绕侧，放盾连射后集中攻击。'];
 case 'courier':return [`${sec(t.runMs)}内逃离即带来${t.reinforce}名援兵；截杀可获得${t.food}钱币（受本关奖励规则限制）。`,'优先截住运粮路线，既减少援兵又取得补给。'];
 case 'amphibious':return [`水中不受常规减速，水中移速倍率${t.waterSpeed}。`,'不要在水里与其竞速，拉回陆地交战。'];
 case 'fireship':return [`碰到主将或被击毁后爆燃，半径${t.radius}、伤害${t.damage}，并留下${sec(t.fireMs)}地火。`,'保持距离提前击毁，避免在燃烧区域集合。'];
 case 'lancer':return [`起手${sec(t.warnMs)}后沿锁定方向刺出长${t.range}、宽${t.width}的枪路，伤害${t.damage}。`,'向枪路两侧躲闪，直刺期间不会追踪转向。'];
 case 'leaper':return [`预警${sec(t.warnMs)}后扑向落点，半径${t.radius}、伤害${t.damage}。`,'离开预警落点，落地后再接近攻击。'];
 case 'sniper':return [`蓄力${sec(t.chargeMs)}后沿${t.length}长、${t.width}宽的直线狙击，伤害${t.damage}。`,'横向离开预警线，避免沿射线后退。'];
 case 'net':return [`投网命中减速${pct(t.slow)}，持续${sec(t.slowMs)}，投网间隔${sec(t.everyMs)}。`,'不要停在落点，被缠住时避免继续冲进敌群。'];
 case 'aura':return [`${t.radius}范围内${t.maxTargets?`至多${t.maxTargets}名`:""}普通友军移速×${t.speedMul}、伤害×${t.damageMul}，首领不受益。`,'优先击败光环提供者，削弱周围敌群。'];
 case 'volley':return [`每${sec(t.everyMs)}标记主将脚下，预警${sec(t.warnMs)}后落箭，半径${t.radius}、伤害${t.damage}。`,'不要在标记内停留，分散部曲避免同时受击。'];
 case 'roller':return [`预警${sec(t.warnMs)}后沿${t.length}长、${t.width}宽的路线滚出擂木，伤害${t.damage}。`,'离开整条滚木通道，绕侧处理擂木兵。'];
 case 'firepot':return [`火罐落点预警${sec(t.warnMs)}，留下${sec(t.fireMs)}地火；倒下时还会爆燃。`,'避开落点并保持距离击杀，别被火区封住退路。'];
 case 'burst':return [`每${sec(t.everyMs)}连射${t.shots}箭，箭间隔${sec(t.gapMs)}。`,'保持横向移动，不要只躲第一箭就站定。'];
 case 'guard':return [`在首领${t.radius}范围内受到伤害×${t.mul}；主将接近时会主动拦截。`,'将护卫引离首领，再集中攻击。'];
 case 'firearrow':return [`每${sec(t.everyMs)}放一支火箭，落点留下${sec(t.fireMs)}火焰。`,'躲过箭后继续离开落点，避免停在余火上。'];
}}
export function enemyCodexBody(e:RosterType):string {const [feature,counter]=traitInfo(e.trait);const stages=Object.entries(STAGE_MIX).filter(([,m])=>e.id in m.traits).map(([key])=>{const [arc,n]=key.split('.');return (CHAPTER_TIMELINE.findIndex(c=>c.id===arc)+1)+'-'+n;});return '兵种特色\n'+feature+'\n\n应对方法\n'+counter+'\n\n出现关卡\n'+(stages.join('、')||'随驯兽兵出现')+'\n\n相对本章同类兵基线\n生命 ×'+e.mul.hp+' · 移速 ×'+e.mul.speed+' · 基础攻击 ×'+e.mul.damage+'\n实际生命与攻击还受关卡阶段影响，不是固定面板数值。\n\n同场数量\n该兵种最多 '+e.cap+' 名，还受已有特殊兵比例与角色上限限制。';}
