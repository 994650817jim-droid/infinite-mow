import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const [repo=process.env.GAME_REPO??resolve(import.meta.dirname,'..'),base=process.env.BASE??'http://127.0.0.1:5286',label='cold',repetitions='3']=process.argv.slice(2);
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const out=resolve(process.env.GAUNTLET_EVIDENCE??'output/gauntlet-experience/perf'), rows=[], errors=[];mkdirSync(out,{recursive:true});
const mapCycle=label.startsWith('map-cycle');let previousKeys=null;
const mobile=label.endsWith('-mobile'),normalEntry=label.startsWith('normal-entry');
const viewport=mobile?{width:390,height:844}:{width:1280,height:720};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--enable-precise-memory-info']});
const save=()=>writeFileSync(join(out,label+'.json'),JSON.stringify({browser:browser.version(),viewport:viewport.width+'x'+viewport.height,rows,errors},null,2));
const p=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
p.on('pageerror',e=>{errors.push(e.stack);save()});
// Count WebGL allocations/deletions without holding references to underlying GPU resources.
await p.addInitScript(()=>{
  window.glCounts={};
  for(const ctor of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){
    for(const resource of ['Texture','Buffer','Framebuffer','Renderbuffer','Program','Shader','VertexArray'])for(const prefix of ['create','delete']){
      const proto=ctor.prototype,key=prefix+resource,original=proto[key];
      if(!original||original.__observed)continue;
      const fn=function(...args){const ret=original.apply(this,args);if(prefix==='create'?ret:args[0])window.glCounts[key]=(window.glCounts[key]??0)+1;return ret;};
      fn.__observed=true;proto[key]=fn;
    }
  }
});
const cdp=await p.context().newCDPSession(p);
async function gpuMemory(){
  const session=await browser.newBrowserCDPSession();
  const {processInfo}=await session.send('SystemInfo.getProcessInfo');await session.detach();
  const pid=processInfo.find(x=>x.type.toLowerCase()==='gpu')?.id;
  if(!Number.isSafeInteger(pid))throw Error('Chrome GPU process not found');
  const command=`$ErrorActionPreference='Stop'
$dedicated='\\GPU Process Memory(pid_${pid}_*)\\Dedicated Usage'
$shared='\\GPU Process Memory(pid_${pid}_*)\\Shared Usage'
$samples=(Get-Counter -Counter $dedicated,$shared).CounterSamples
$d=($samples | Where-Object Path -Like '*dedicated usage' | Measure-Object CookedValue -Sum).Sum
$s=($samples | Where-Object Path -Like '*shared usage' | Measure-Object CookedValue -Sum).Sum
if($null -eq $d -or $null -eq $s){ throw 'Missing GPU memory counter' }
[pscustomobject]@{dedicatedMiB=$d/1MB;sharedMiB=$s/1MB} | ConvertTo-Json -Compress`;
  const {stdout}=await promisify(execFile)('pwsh.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:30000});
  return {pid,...JSON.parse(stdout)};
}
async function snap(){
  const x=await p.evaluate(()=>{const g=window.__game,s=g.scene.getScene('GauntletGameScene'),r=g.renderer;
    return {scenes:g.scene.getScenes(true).map(v=>v.sys.settings.key),battleChildren:s.children?.length,activeEnemies:s.enemies?.filter(v=>v.active).length,allies:s.legion?.count,textureKeys:g.textures.getTextureKeys().length,renderType:r.type,renderer:r.gl?.getParameter(r.gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL??r.gl.RENDERER),mythic:g.textures.getTextureKeys().filter(k=>k.startsWith('mythic_')).length,glCounts:window.glCounts,contexts:document.querySelectorAll('canvas').length};
  });
  x.heapMiB=(await cdp.send('Runtime.getHeapUsage')).usedSize/1048576;
  if(label.endsWith('-gpu'))x.gpuMemory=await gpuMemory();
  return x;
}
try {
 for(let i=0;i<Number(repetitions);i++){
  if(i===0||label==='cold'||normalEntry)await p.goto(base+'/?dev=1&gauntlet=1&layout='+(mobile?'mobile':'desktop'),{waitUntil:'domcontentloaded'});
  else if(mapCycle){
   await p.evaluate(()=>{window.__game.scene.getScene('WorldMapScene').launchGauntlet();});
   await p.waitForFunction(()=>window.__game.scene.isActive('GauntletPickScene'));
   await p.evaluate(()=>{window.__game.scene.getScene('GauntletPickScene').launch('zhaoyun');});
  }else await p.evaluate(()=>{window.__game.scene.getScene('MenuScene').scene.start('GauntletGameScene');});
  await p.waitForFunction(()=>{const s=window.__game?.scene.getScene('GauntletGameScene');return s?.sys.isActive()&&s.gWave===1&&s.player?.alive&&s.elapsed>.05;},null,{timeout:120000});
  await p.evaluate(mode=>{
   const s=window.__game.scene.getScene('GauntletGameScene');s.gOrder=Array(10).fill(s.gPool.find(b=>b.id==='zhangliang'));s.player.damageImmune=true;
   if(mode==='army-restart')for(const k of ['guardian','swordsman','spearman','halberdier','rider','archer','crossbowman','medic'])s.legion.recruit(k,3,true);
   if(!mode.startsWith('normal-entry')){s.gAt=s.elapsed-200;return;}
   let previous,wasCombat=false;window.mowFrames=[[],[]];
   const collect=()=>{const t=performance.now(),active=s.gPhase==='mow'&&s.mode==='none';
    if(wasCombat&&active)window.mowFrames[s.elapsed<6.5?0:1].push(t-previous);
    previous=t;wasCombat=active;if(s.gPhase!=='mow')s.game.events.off('postrender',collect);
   };s.game.events.on('postrender',collect);
  },label);
  await p.waitForFunction(()=>{const s=window.__game.scene.getScene('GauntletGameScene');if(s.mode==='levelup')s.chooseUpgrade(0);if(s.mode==='branch')s.chooseBranch(0);return s.gPhase==='boss'&&s.boss?.active;},null,{timeout:120000});
  const frames=await p.evaluate(async()=>{
    const s=window.__game.scene.getScene('GauntletGameScene');const deltas=[],spikes=[];let prev;
    const cb=()=>{let t=performance.now();if(s.mode==='levelup')s.chooseUpgrade(0);if(prev!==undefined&&s.mode==='none'){let d=t-prev;deltas.push(d);if(d>50)spikes.push({ms:d,at:s.elapsed,textures:s.textures.getTextureKeys().length,loading:s.load.isLoading()});}prev=t;};
    s.game.events.on('postrender',cb);await new Promise(r=>setTimeout(r,6500));s.game.events.off('postrender',cb);
    const times=deltas.sort((a,b)=>a-b),n=times.length,sum=times.reduce((a,b)=>a+b,0),tail=times.slice(-Math.ceil(n*.01));
    if(window.mowFrames)window.bossFrames=deltas;
    return {frames:n,ms:sum,fps:n*1000/sum,p99:times[Math.ceil(n*.99)-1],maxMs:times.at(-1),onePctLow:tail.length*1000/tail.reduce((a,b)=>a+b,0),spikes};
  });
  const row={i:i+1,frames,battle:await snap()};rows.push(row);
  if(normalEntry)row.mow=await p.evaluate(()=>window.mowFrames.map(arr=>{const sorted=arr.sort((a,b)=>a-b),n=sorted.length,sum=sorted.reduce((a,b)=>a+b,0),tail=sorted.slice(-Math.ceil(n*.01));return {frames:n,ms:sum,fps:1000*n/sum,p99:sorted[Math.ceil(n*.99)-1],maxMs:sorted.at(-1),onePctLow:1000*tail.length/tail.reduce((a,b)=>a+b,0)};}));
  if(normalEntry)row.whole=await p.evaluate(()=>{const all=window.mowFrames.flat().concat(window.bossFrames).sort((a,b)=>a-b),n=all.length,sum=all.reduce((a,b)=>a+b,0),tail=all.slice(-Math.ceil(n*.01));return {frames:n,ms:sum,fps:n*1000/sum,onePctLow:1000*tail.length/tail.reduce((a,b)=>a+b,0),maxMs:all.at(-1)};});
  save();
  if(mapCycle){
   await p.evaluate(async()=>{history.replaceState(null,'','/?dev=1&layout=desktop');const s=window.__game.scene.getScene('GauntletGameScene');s.gFrom='map';await s.finish(false,'death');});
   await p.getByRole('button',{name:'凯旋归营'}).click();
  }else await p.evaluate(()=>{history.replaceState(null,'','/?dev=1&layout=desktop');window.__game.scene.getScene('GauntletGameScene').scene.start('MenuScene');});
  await p.waitForFunction(scene=>window.__game.scene.isActive(scene),mapCycle?'WorldMapScene':'MenuScene');await p.waitForTimeout(750);
  row.menu=await snap();await cdp.send('HeapProfiler.collectGarbage');row.menuPostGc=await snap();
  const keys=new Set(await p.evaluate(()=>window.__game.textures.getTextureKeys()));
  if(previousKeys){row.addedMenuTextures=[...keys].filter(k=>!previousKeys.has(k));row.removedMenuTextures=[...previousKeys].filter(k=>!keys.has(k));}
  previousKeys=keys;save();
 }
}catch(e){errors.push(String(e));throw e;}finally{save();await browser.close();}
