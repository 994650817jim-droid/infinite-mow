import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [repo=process.env.GAME_REPO??resolve(import.meta.dirname,'..'), route='standard',base=process.env.BASE??'http://127.0.0.1:5286',fixture='realtime',growthPolicy='starmap']=process.argv.slice(2);
assert.ok(['standard','extreme'].includes(route));
assert.ok(['realtime','unassisted','natural-stars'].includes(fixture));
assert.ok(['starmap','legacy'].includes(growthPolicy));
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const dir=resolve(process.env.GAUNTLET_EVIDENCE??'output/gauntlet-experience/perf');mkdirSync(dir,{recursive:true});
const out=join(dir,route+'-'+fixture+(growthPolicy==='legacy'?'':'-starmap')+'.json');
const record={route,fixture,growthPolicy,rows:[],errors:[]};const save=()=>writeFileSync(out,JSON.stringify(record,null,2));
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
record.browser=browser.version();
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>{record.errors.push(e.stack);save()});
 // Isolate an in-progress single-player run from unrelated Vite hot reloads.
 await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
 await p.goto(base+'/?gauntlet=1&dev=1&layout=desktop'+(route==='extreme'?'&challenge=extreme':''),{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
 await p.evaluate(async({route,fixture,growthPolicy})=>{
   const s=window.__game.scene.getScene('GauntletGameScene'),pl=s.player;
   window.runRows=[];window.rescues=[];window.picks=[];window.starSpends=[];window.startWall=Date.now();
   const R=await import('/src/data/gauntlet.ts');
   let seed=7751;const rnd=()=>((seed=seed*16807%2147483647)/2147483647);
   s.gOrder=R.pickBosses(s.gPool,rnd);
   const info=()=>({wave:s.gWave,phase:s.gPhase,tier:s.gTier,time:s.elapsed,wallSeconds:(Date.now()-window.startWall)/1000,
     id:s.waveBoss().id,hp:pl.hp,maxHp:pl.maxHp,level:pl.level,xp:pl.xp,stars:[...pl.growth.stars],weapons:pl.weapons.map(w=>[w.id,w.level,w.branch??null]),formation:s.gFormations,allies:s.legion.count,followers:s.gFollowers.length,losses:s.legion.dead,recruits:s.gRecruits.men,
     damage:s.damageDealt,kills:s.kills,skillDamage:s.weaponHit(),armor:pl.stats.armor,food:s.legion.food,rescues:window.rescues.length,attrs:{...pl.growth.attributes},
     displayed:s.children.length,textures:s.textures.getTextureKeys().length,objects:s.enemies.length+s.allies.length});
   // Continue tracking late checkpoints after a normally fatal hit. Record the unassisted survival endpoint first.
   const oldGuard=pl.damageGuard;
   if(fixture==='realtime')pl.damageGuard=(d,now)=>{const value=oldGuard?oldGuard(d,now):d;
     if(value>=pl.hp&&!(pl.growth.build.treasures.includes('revival_jade')&&!pl.growth.revivalUsed)){
       window.rescues.push({...info(),incoming:value});pl.hp=pl.maxHp;
     }return value;
   };
   let lastKey='',lastRecruit=0,center={x:pl.x,y:pl.y},lastAttrs=0;
   const snapshot=()=>{const k=s.gWave+':'+s.gPhase;if(k!==lastKey){window.runRows.push(info());lastKey=k;}};
   const choose=()=>{
    const opts=s.upgradeOptions;
    if(!opts.length)return;
    if(fixture==='natural-stars'&&s.mode==='levelup'&&s.gRerollFree>0&&!opts.some(o=>o.id.startsWith('gauntlet_star_'))&&!window.picks.some(v=>v.id.startsWith('gauntlet_star_'))){
      const reroll=s.levelPanel.getByName('upgrade-reroll');
      if(reroll?.visible&&reroll.input?.enabled){reroll.emit('pointerdown');return;}
    }
    let ranks;
    if(s.gPhase==='choice')ranks=[s.gTier==='mortal'?'gauntlet_ghost':s.gTier==='ghost'?'gauntlet_divine':'gauntlet_settle'];
    else if(s.mode==='bossloot'&&opts.some(o=>o.id==='gauntlet_spoils'))ranks=[...(s.gFollowers.length<3?['gauntlet_follow']:[]),...(pl.hp/pl.maxHp<.6?['gauntlet_spoils']:[]),'gauntlet_star_','gauntlet_bless','gauntlet_spoils'];
    else ranks=['signature_weapon_','weapon_over_','gauntlet_star_','martial_','tactic_','gauntlet_gear_'];
    if(fixture==='natural-stars'&&s.gPhase!=='choice')ranks=['gauntlet_star_',...ranks];
    let i=-1;for(const prefix of ranks){i=opts.findIndex(x=>x.id.startsWith(prefix));if(i>=0)break;}i=Math.max(0,i);
    window.picks.push({wave:s.gWave,mode:s.mode,id:opts[i].id,offered:opts.map(x=>x.id)});s.chooseUpgrade(i);
   };
   function drive(){
    if(s.over)return;
    snapshot();
    if(s.mode==='branch'){s.chooseBranch(0);return;}
    if(s.mode==='levelup'||s.mode==='bossloot'){choose();return;}
    if(s.mode==='attributes'){
      if(growthPolicy==='legacy'){s.setMode(s.attributeReturn??'none');return;}
      const panel=s.starPanel;if(!panel?.built)return;
      const legal=[...panel.nodes.values()].filter(v=>!v.n.todo&&panel.block(v.n.id)===null);
      const choice=legal.find(v=>v.n.region==='strength')??legal[0];
      if(choice){
        const before=pl.growth.unallocated,previousStars=[...pl.growth.stars];choice.hit.emit('pointerup',{upTime:s.time.now});panel.lightBtn.hit.emit('pointerup');
        if(pl.growth.unallocated===before-1)window.starSpends.push({wave:s.gWave,time:s.elapsed,id:choice.n.id,previousStars,afterStars:[...pl.growth.stars],lost:previousStars.filter(id=>!pl.growth.stars.includes(id))});
      }
      panel.closeBtn.emit('pointerup');return;
    }
    if(s.mode!=='none')return;
    if(pl.growth.unallocated>0&&s.elapsed-lastAttrs>1){lastAttrs=s.elapsed;
      if(growthPolicy==='starmap'){
        if(s.pointsButton?.visible&&s.pointsButton.input?.enabled)s.pointsButton.emit('pointerdown');
        if(s.mode!=='none')return;
      }else for(const id of ['strength','agility','command','intellect'])if(s.attributeAdd(id))break;
    }
    if(s.recruitOpen()&&lastRecruit!==s.gWave){if(s.recruitTroops())lastRecruit=s.gWave;}
    const e=s.boss?.active?s.boss:null,dx=pl.x-(e?.x??center.x),dy=pl.y-(e?.y??center.y),dist=Math.hypot(dx,dy)||1,r=e?91:155;
    const pull=Math.max(-2,Math.min(2,(r-dist)/50));
    s.debugMoveActive=true;s.debugMove.set(-dy/dist+dx/dist*pull,dx/dist+dy/dist*pull);
    if(dist<1.01)s.debugMove.set(1,0);
   }
   window.info=info;window.timer=setInterval(drive,100);window.progress=()=>({rows:window.runRows,rescues:window.rescues,picks:window.picks,starSpends:window.starSpends,current:{...info(),mode:s.mode,bossHP:s.boss?.hp,over:s.over,choices:s.upgradeOptions.map(o=>o.id)},width:s.roster.ghost.length});
   if(s.roster.ghost.length!==(route==='standard'?5:10))throw Error('wrong route');
 },{route,fixture,growthPolicy});
 const began=Date.now();let same=0,last='';
 while(true){await p.waitForTimeout(3500);Object.assign(record,await p.evaluate(()=>window.progress()));save();
   const c=record.current, state=JSON.stringify([c.time,c.wave,c.phase,c.bossHP,c.mode]);
   same=state===last?same+1:0;last=state;
   if(c.over){record.finished=c.wave===(route==='standard'?20:30)&&c.phase==='done';record.terminal=record.finished?'settled':'defeated';save();break;}
   if(same>14||Date.now()-began>3*3600000)throw Error('route stalled '+JSON.stringify(c));
 }
 assert.deepEqual(record.errors,[]);
 assert.ok(fixture!=='realtime'||record.finished,'instrumented route ended before the final checkpoint');
 if(fixture==='natural-stars'){
  assert.ok(record.starSpends.every(x=>x.lost.length===0),'previously held stars disappeared after a legal star-map purchase');
  const drawn=record.picks.filter(v=>v.id.startsWith('gauntlet_star_')).map(v=>v.id.slice('gauntlet_star_'.length));
  assert.ok(drawn.some(id=>record.starSpends.some(v=>v.previousStars.includes(id)&&v.afterStars.includes(id))),'no random reward was followed by a star-map purchase in this run');
 }
}catch(e){record.errors.push(String(e));throw e;}finally{save();await browser.close();}
