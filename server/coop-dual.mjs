import {bossStats,beginBossWarning,resolveBossWarning,updateBossPhase,clearBossAttack,makeWarning} from './gauntlet.mjs';

// Mirrors the existing story DualBoss / HEBEI_PLAN: .9 HP, .8 damage, 1.4 gaps,
// 800ms token gap, 12s first combination, 20/15s repeats, survivor rage.
export function startHebei(run,yan,wen,time){
 for(const e of [yan,wen]){e.maxHp=Math.round(e.maxHp*.9);e.hp=e.maxHp;e.echoUsed=true;}
 run.dual={states:[yan,wen].map(boss=>({wave:run.wave,boss,warning:null,followup:null,attackAt:time+2})),fallen:new Set(),nextStart:time+2,nextCombo:time+12,comboCount:0,gather:null,soloUntil:0};
 run.boss=wen;run.warning=null;
}
export const dualState=(run,enemy)=>run.dual?.states.find(s=>s.boss===enemy);
export const dualWarnings=run=>run.dual?.states.map(s=>s.warning).filter(Boolean)??(run.warning?[run.warning]:[]);
export function dualDeaths(run,time){
 const d=run.dual;if(!d)return false;let changed=false;
 for(const s of d.states)if(s.boss.hp<=0&&!d.fallen.has(s.boss.id)){d.fallen.add(s.boss.id);clearBossAttack(s);changed=true;}
 const live=d.states.filter(s=>s.boss.hp>0);
 if(changed){d.gather=null;for(const s of live)clearBossAttack(s);if(live.length===1){const s=live[0];s.boss.enraged=true;s.boss.dualRage=true;s.boss.echoUsed=true;s.attackAt=time+2;d.soloUntil=time+2;d.nextStart=time+2;}}
 if(live.length)run.boss=live[0].boss;
 run.warning=dualWarnings(run)[0]??null;
 return live.length===0;
}
export function stepHebei(run,players,time,dt){
 const d=run.dual;if(!d)return;dualDeaths(run,time);const states=d.states.filter(s=>s.boss.hp>0),targets=players.filter(p=>p.hp>0);if(!states.length||!targets.length)return;
 for(const s of states)updateBossPhase(s,time);
 const busy=states.some(s=>s.warning||s.followup);
 if(states.length===2&&!busy&&!d.gather&&time>=d.nextCombo){
  const p=targets.reduce((a,b)=>Math.hypot(a.x-states[0].boss.x,a.y-states[0].boss.y)<Math.hypot(b.x-states[0].boss.x,b.y-states[0].boss.y)?a:b);
  if(states.every(s=>Math.hypot(s.boss.x-p.x,s.boss.y-p.y)<=500))d.gather={until:time+.65,x:p.x,y:p.y,second:states.some(s=>s.boss.enraged)&&d.comboCount%2===1};
 }
 if(d.gather){const g=d.gather;
  states.forEach((s,i)=>{const tx=Math.max(30,Math.min(930,g.x+(g.second?(i?240:-50):(i?106:-106)))),ty=Math.max(30,Math.min(690,g.y+(g.second?(i?-70:-20):-106))),dx=tx-s.boss.x,dy=ty-s.boss.y,dist=Math.hypot(dx,dy)||1,step=Math.min(dist,360*dt);s.boss.x+=dx/dist*step;s.boss.y+=dy/dist*step;});
  if(time<g.until)return;
  states.forEach((s,i)=>{const pattern=g.second?(i?{kind:'line',name:'刀枪合璧 · 五道骑射',radius:330,lanes:5,spread:.155,halfWidth:11}:{kind:'ring',name:'刀枪合璧 · 回旋',radius:110,innerRadius:0}):{kind:'line',name:'河北双雄 · 交叉夹击',radius:300,halfWidth:i?22:28};
   const w=makeWarning(s.boss,g.second&&i?states[0].boss:g,run.wave,time,pattern);w.endsAt=time+1.425;w.lanes=pattern.lanes;w.spread=pattern.spread;w.halfWidth=pattern.halfWidth;w.power=bossStats(run.wave).power*(g.second&&i?.65:1)*(s.boss.enraged?1.15:1);w.chain=false;w.targetSlot=-1;w.combo=true;s.warning=w;s.attackAt=w.endsAt+1.5;
  });d.comboCount++;d.nextCombo=time+(states.some(s=>s.boss.enraged)?15:20);d.nextStart=time+2.925;d.gather=null;run.warning=dualWarnings(run)[0]??null;return;
 }
 if(time<d.soloUntil||busy||time<d.nextStart)return;
 for(const s of states){const p=targets.reduce((a,b)=>Math.hypot(a.x-s.boss.x,a.y-s.boss.y)<Math.hypot(b.x-s.boss.x,b.y-s.boss.y)?a:b);if(time<s.attackAt||Math.hypot(p.x-s.boss.x,p.y-s.boss.y)>=245)continue;
  if(beginBossWarning(s,p,time)){const gap=s.attackAt-time;s.attackAt=time+gap*1.4*(s.boss.dualRage?.75:1);d.nextStart=s.warning.endsAt+.8;run.warning=s.warning;break;}
 }
}
export function resolveHebei(run,players,time,onHit){
 if(!run.dual)return;dualDeaths(run,time);
 for(const s of run.dual.states)resolveBossWarning(s,players,time,(p,damage)=>onHit(p,Math.min(36,damage*.8*(s.boss.dualRage?1.25:1))));
 run.warning=dualWarnings(run)[0]??null;
}
