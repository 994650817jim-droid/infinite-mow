import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const [repo=process.env.GAME_REPO??resolve(import.meta.dirname,'..'),base=process.env.BASE??'http://127.0.0.1:5286']=process.argv.slice(2);
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const dir=resolve(process.env.GAUNTLET_EVIDENCE??'output/gauntlet-experience/perf');mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const rows=[];
try{
 for(const id of ['divine_zhaoyun','divine_zhugeliang','divine_liubei']){
  const p=await browser.newPage({viewport:{width:390,height:844}});await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
  await p.goto(base+'/?gauntlet=1&dev=1&layout=mobile&mythic='+id,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(id=>{const s=window.__game?.scene.getScene('GauntletGameScene');if(s?.mode==='levelup')s.chooseUpgrade(0);return s?.gCur?.id===id&&s.boss?.active;},id,{timeout:120000});
  const row=await p.evaluate(async(id)=>{
    const s=window.__game.scene.getScene('GauntletGameScene'),pl=s.player,D=await import('/src/data/gauntlet.ts');
    const c=s.gCtrl,now=s.combatNow,begin={x:pl.x,y:pl.y,hp:pl.hp};
    for(const k of ['swordsman','spearman','archer','guardian','rider','halberdier','crossbowman','medic'])s.legion.recruit(k,3,true);
    const starting=s.legion.units.map(a=>({id:a.id,life:a.lifeId,x:a.x,y:a.y,hp:a.hp}));
    s.boss.sprite.setPosition(pl.x+110,pl.y);s.boss.hp=Math.floor(s.boss.maxHp*.45);
    c.queue=[];c.next=now/1000+.05;c.casts=2;
    s.spawnProps(D.GAUNTLET_POOL.find(b=>b.id==='haozhao'),s.boss,now);
    s.gProps.forEach((o,i)=>o.volleyAt=now+50+1500*i);
    const hits=[],names=[],source={value:'other'},hpHook=pl.takeDamage.bind(pl);
    pl.takeDamage=(d,t)=>{const before=pl.hp,changed=hpHook(d,t);if(changed)hits.push({source:source.value,at:(t-now)/1000,hpBefore:before,hpAfter:pl.hp});return changed;};
    for(const [obj,label] of [[c,'mythic'],[s.gStrikes,'arrows']]){const original=obj.update.bind(obj);obj.update=(...args)=>{source.value=label;try{return original(...args);}finally{source.value='other';}};}
    const started=Date.now();
    await new Promise((ok,fail)=>{const timer=setInterval(()=>{
      if(Date.now()-started>30000){clearInterval(timer);fail(Error('retreat timed out: '+s.mode));return;}
      if(s.mode==='levelup')s.chooseUpgrade(0);
      if(s.mode==='branch')s.chooseBranch(0);
      const t=(s.combatNow-now)/1000;
      s.debugMoveActive=true;s.debugMove.set(t>=.3?-1:0,t>=.3?.5:0);
      const w=c.queue?.[0];if(w&&!names.includes(w.name))names.push(w.name);
      if(t>=4.7||s.over){clearInterval(timer);ok();}
    },25);});
    const units=s.legion.units,travel=starting.map(i=>{const u=units.find(a=>a.id===i.id&&a.lifeId===i.life);return {id:i.id,alive:!!u?.active,traveled:u?Math.hypot(u.x-i.x,u.y-i.y):0,hpChange:(u?.hp??0)-i.hp};});
    return {id,begin,combatSeconds:(s.combatNow-now)/1000,wallSeconds:(Date.now()-started)/1000,heroDistance:Math.hypot(pl.x-begin.x,pl.y-begin.y),heroHp:pl.hp,sourceHits:hits,standing:s.legion.count,arrows:{...s.gStrikes.metrics},names,travel,over:s.over};
  },id);rows.push(row);writeFileSync(join(dir,'retreat.json'),JSON.stringify(rows,null,2));await p.close();
 }
}finally{await browser.close();}
