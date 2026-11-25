import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const [root,out,navRoot=root]=process.argv.slice(2);
const {ArmyEvasion,armyExit}=await import(pathToFileURL(join(resolve(root),'src/rules/retinueTactics.ts')));
const req=createRequire(join(resolve(navRoot),'package.json'));
const build=await req('esbuild').build({entryPoints:[join(resolve(navRoot),'src/systems/LegionNavigation.ts')],bundle:true,write:false,platform:'node',format:'esm'});
const {LegionNavigation}=await import('data:text/javascript;base64,'+Buffer.from(build.outputFiles[0].contents).toString('base64'));
const percentile=(array,p)=>[...array].sort((a,b)=>a-b)[Math.min(array.length-1,Math.floor(array.length*p))];
const millis=n=>Math.round(n*1000)/1000;
const stats=xs=>({median:millis(percentile(xs,.5)),p95:millis(percentile(xs,.95)),max:millis(Math.max(...xs))});
function trial(blocked,frames,count){
  const units=Array.from({length:count},(_,id)=>({id,x:390+(id%10)*1.75,y:290+Math.floor(id/10)*1.75}));
  const threats=[{kind:'line',x:290,y:300,angle:0,radius:256,halfWidth:45},
    {kind:'sweep',x:345,y:300,angle:0,radius:160,arc:2.1},{kind:'circle',x:406,y:300,radius:68}];
  const nav=new LegionNavigation();
  if(blocked)nav.setBoxes([{left:369,right:376,top:268,bottom:334},{left:432,right:439,top:268,bottom:334},
    {left:369,right:439,top:268,bottom:274},{left:369,right:439,top:329,bottom:334}]);
  let calls=0;const clear=(a,p)=>{calls++;return nav.clearSegment(a.x,a.y,p.x,p.y,6);};
  const planner=ArmyEvasion&&new ArmyEvasion();
  const wall=[],initial=[],atChange=[],cached=new WeakMap();let found=0;
  const cpu0=process.cpuUsage();let initialCalls,changeCalls;
  for(let i=0;i<frames;i++){
    // The same objects change direction at frame 61, as in a live cone re-aim.
    if(i===60){threats[1].angle+=.42;threats[0].halfWidth-=3;}
    const old=calls,ts=performance.now();planner?.begin(threats);
    for(const u of units){
      const goal=planner?planner.exit(u,6,clear,u.id,i/60):armyExit(threats,u,6,clear,u.id,cached.get(u));
      if(goal){found++;if(!planner)cached.set(u,goal);}
    }
    const elapsed=performance.now()-ts;
    if(!i){initial.push(elapsed);initialCalls=calls-old;}
    else if(i===60){atChange.push(elapsed);changeCalls=calls-old;}
    else wall.push(elapsed);
  }
  const cpu=process.cpuUsage(cpu0);
  return {wall,initial,atChange,cpu:((cpu.user+cpu.system)/1000)/frames,calls,initialCalls,changeCalls,found};
}
const result={node:process.version,count:100,frames:120,repetitions:9,clock:'60 simulation ticks/s; actual wall and process CPU measured; no render or waits'};
for(const blocked of [true,false]){
  for(let i=0;i<3;i++)trial(blocked,120,100);
  const runs=Array.from({length:9},()=>trial(blocked,120,100));
  result[blocked?'trapped':'open']={cpuMsPerFrame:stats(runs.map(r=>r.cpu)),steadyWallMs:stats(runs.flatMap(r=>r.wall)),
    firstWallMs:stats(runs.flatMap(r=>r.initial)),changedWallMs:stats(runs.flatMap(r=>r.atChange)),
    clearCallsPerTrial:runs[0].calls,clearCallsOnFirst:runs[0].initialCalls,clearCallsOnChange:runs[0].changeCalls,exitOffers:runs[0].found};
}
writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
