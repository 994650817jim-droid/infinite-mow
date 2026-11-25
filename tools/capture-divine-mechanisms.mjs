import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
const repo=resolve(import.meta.dirname,'..'),out=process.env.OUT??join(tmpdir(),'gauntlet-acceptance');
const {chromium}=createRequire(join(repo,'package.json'))('playwright');
mkdirSync(out,{recursive:true});
const base=(process.env.BASE??'http://127.0.0.1:5173').replace(/\/$/,'');
const browser=await chromium.launch({channel:'chrome'});
try{
for (const hero of ['divine_zhaoyun','divine_zhugeliang','divine_liubei']){
 for(const mobile of [false,true]){
  const dir=join(out,hero,mobile?'mobile':'desktop');mkdirSync(dir,{recursive:true});
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
  const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(base+'/?gauntlet=1&dev=1&layout='+(mobile?'mobile':'desktop')+'&mythic='+hero);
  await p.waitForFunction(id=>window.__game?.scene.getScene('GauntletGameScene')?.gCur?.id===id,hero,{timeout:90000});
  await p.evaluate(()=>{
    const s=window.__game.scene.getScene('GauntletGameScene'),c=s.gCtrl,b=s.boss;
    s.game.loop.sleep();window.proofClock=s.game.loop.now;
    b.sprite.setPosition(s.player.x-90,s.player.y+10);b.hp=b.maxHp*.45;c.next=s.combatNow/1000+.1;c.casts=2;c.queue=[];
  });
  const records=[];
  for(let frame=0;frame<72;frame++){
    const r=await p.evaluate(()=>{
      const s=window.__game.scene.getScene('GauntletGameScene'),c=s.gCtrl;
      for(let j=0;j<3;j++){if(s.mode==='levelup')s.chooseUpgrade(0);s.game.step(window.proofClock+=25,25);}
      const w=c?.queue?.[0];return {mode:s.mode,actor:s.gCur?.id,x:s.boss?.x,y:s.boss?.y,clock:s.combatNow/1000,
        move:w?.name,resolved:w?.resolved,started:w?.startsAt,cast:w?.transit?.cast,spirit:w?.spirit,fieldHp:w?.constellation?.hp,eye:c?.eye?.actor?.active,broken:w?.constellation?.broken};
    });
    if(r.mode!=='none'||r.actor!==hero)continue;
    records.push(r);
    await p.screenshot({path:join(dir,String(frame).padStart(3,'0')+'.jpg'),type:'jpeg',quality:84});
  }
  writeFileSync(join(dir,'timeline.json'),JSON.stringify({hero,mobile,errors,records},null,2));
  console.log(hero,mobile,new Set(records.map(r=>r.move)),errors);
  if(errors.length || !records.some(r=>r.resolved) || !records.some(r=>r.move))process.exitCode=1;
  await p.close();
 }
}
}finally{await browser.close();}
