import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const [repo=process.env.GAME_REPO??resolve(import.meta.dirname,'..'),base=process.env.BASE??'http://127.0.0.1:5286']=process.argv.slice(2);
const out=resolve(process.env.GAUNTLET_EVIDENCE??'output/gauntlet-experience/perf');mkdirSync(out,{recursive:true});
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const results=[];
try{
 for(const id of ['divine_zhaoyun','divine_zhugeliang','divine_liubei']){
  const p=await browser.newPage({viewport:{width:390,height:844}});await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
  await p.goto(base+'/?gauntlet=1&dev=1&layout=mobile&mythic='+id,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(id=>{const s=window.__game?.scene.getScene('GauntletGameScene');if(s?.mode==='levelup')s.chooseUpgrade(0);return s?.gCur?.id===id&&s.boss?.active;},id,{timeout:120000});
  const data=await p.evaluate(async(id)=>{
    const s=window.__game.scene.getScene('GauntletGameScene'),pl=s.player;
    const M=await import('/src/data/mythicGauntlet.ts'),D=await import('/src/data/gauntlet.ts');
    const start={x:pl.x,y:pl.y}, nav=s.legion.navigation,radius=pl.radius,dt=.04;
    const pass=(a,b,r)=>nav.clearSegment(a.x,a.y,b.x,b.y,r)&&!s.terrain?.pushCircle(b.x,b.y,r)&&(!s.arena||s.arena.inside(b.x,b.y,r));
    const spots=[{name:'spawn',...start}];
    for(const tree of s.terrain?.trees??[]){
     if(tree.burnt)continue;const q={name:'tree-edge',x:tree.x+46,y:tree.y};
     if(pass(q,q,radius)){spots.push(q);break;}
    }
    if(s.arena){const b=s.arena.bounds;const candidates=[[b.left+radius+6,b.top+radius+6],[b.right-radius-6,b.bottom-radius-6]];
      for(const [x,y]of candidates){const q={name:'arena-corner',x,y};if(pass(q,q,radius)){spots.push(q);break;}}
    }
    if(spots.length===1){const q={name:'offset-field',x:pl.x+160,y:pl.y-40};if(pass(q,q,radius))spots.push(q);}
    const towers=D.GAUNTLET_POOL.find(b=>b.id==='haozhao');s.spawnProps(towers,s.boss,s.combatNow);
    const propCount=s.gProps.length;if(propCount!==2)throw Error('two arrow towers required: '+propCount);
    const rows=[];let seed=34438;
    const passRate=(headings)=>headings.filter(Boolean).length;
    for(const at of spots){
     pl.sprite.setPosition(at.x,at.y);
     for(let rep=0;rep<12;rep++){
      const angle=rep*Math.PI/6;
      const boss={x:at.x+Math.cos(angle)*110,y:at.y+Math.sin(angle)*110};
      if(!pass(boss,boss,s.boss.radius))continue;
      const seq=M.mythicSequence(M.mythicBoss(id),boss,at,2,true,0,(a,b)=>pass(a,b,s.boss.radius+3));
      const old=Math.random, volleys=[];
      try{Math.random=()=>((seed=seed*16807%2147483647)/2147483647);
       for(const tower of s.gProps){s.gStrikes.clear();for(const t of s.gProps)t.volleyAt=Infinity;tower.volleyAt=s.combatNow;s.updateProps(s.combatNow);
        volleys.push(s.gStrikes.list.map(a=>({dx:a.x-at.x,dy:a.y-at.y,r:a.r,warn:a.warnMs/1000})));
       }
      }finally{Math.random=old;}
      if(volleys.some(v=>v.length!==3))throw Error('missing native arrow impacts');
      let unsafeStill=false;const headings=[];
      for(let direction=-1;direction<32;direction++){
       let pos={x:at.x,y:at.y},alive=true,secondCenter=null;
       for(let time=dt;time<=Math.max(2.8,seq.at(-1).endsAt)+dt;time+=dt){
        if(direction>=0&&time>=.30&&time<2.05){
         const yaw=direction*2*Math.PI/32,travel=178*(s.terrain?.speedMul(pos.x,pos.y)??1)*dt;
         const next={x:pos.x+Math.cos(yaw)*travel,y:pos.y+Math.sin(yaw)*travel};
         if(pass(pos,next,radius))pos=next;
        }
        if(time>=1.5&&!secondCenter)secondCenter={...pos};
        const hitAt=t=>t<=time+1e-8&&t>time-dt+1e-8;
        if(seq.some(w=>hitAt(w.endsAt)&&M.mythicHit(w,pos))){alive=false;break;}
        if(volleys.some((rain,i)=>rain.some(a=>{const t=a.warn+1.5*i;if(!hitAt(t))return false;const c=i?secondCenter:at;return Math.hypot(pos.x-c.x-a.dx,pos.y-c.y-a.dy)<=a.r+radius*.5;}))){alive=false;break;}
       }
       if(direction<0)unsafeStill=!alive;else headings.push(alive);
      }
      rows.push({spot:at.name,orientation:rep,stationaryHit:unsafeStill,safeHeadings:passRate(headings),volleys,sequence:seq.map(w=>w.name)});
     }
    }
    return {id,spots,terrain:s.terrain?.info??null,arena:s.arena?.bounds??null,propCount,radius,rows};
  },id);results.push(data);writeFileSync(join(out,'escape.json'),JSON.stringify(results,null,2));await p.close();
 }
}finally{await browser.close();}
