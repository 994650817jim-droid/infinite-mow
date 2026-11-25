import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
const [repo,label,layout='desktop',mode='short',series='cold',base='http://127.0.0.1:5294']=process.argv.slice(2);
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Expected a loopback test server');
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const mobile=layout==='mobile';
const setup={viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1};
const disk=mode.includes('disk')?await chromium.launchPersistentContext('',{...setup,channel:'chrome',args:['--mute-audio','--disk-cache-size=536870912']}):null;
const browser=disk?.browser()??await chromium.launch({channel:'chrome',args:['--mute-audio']});
const context=disk??await browser.newContext(setup);
const p=await context.newPage(),cdp=await context.newCDPSession(p),errors=[];
await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
p.on('pageerror',e=>errors.push(e.message));
const evidence=resolve(process.env.GAUNTLET_EVIDENCE??(basename(import.meta.dirname)==='tools'?'output/gauntlet-next/perf':import.meta.dirname));mkdirSync(evidence,{recursive:true});
const out=join(evidence,label),trace=mode.includes('trace'),full=mode.includes('full');
await p.addInitScript(({diagnostic,dense})=>{
 performance.setResourceTimingBufferSize(4000);
 window.prepareCapture=(launch=performance.now())=>{
  window.gauntletCapture={launch,active:null,first:null,boss:null,ends:null,intervals:[],pop:[],kept:0};const data=window.gauntletCapture;
  let prev,previousMode,lastWall=0;
  const listen=()=>{
   const game=window.__game;if(!game){requestAnimationFrame(listen);return}
   if(diagnostic&&!game.textures._probe){
    game.textures._probe=true;data.uploads=[];
    for(const method of ['addImage','addSpriteSheet','addCanvas']){
     const original=game.textures[method];game.textures[method]=function(key,...args){const start=performance.now(),ret=original.call(this,key,...args),end=performance.now();if(data.active!=null&&end-start>=1)data.uploads.push({key,start,ms:end-start});return ret;};
    }
   }
   const record=()=>{
    const s=game.scene.getScene('GauntletGameScene');
    if(!s?.sys.isActive()||!s.player?.alive||s.gWave!==1||s.over)return;
    const t=performance.now();
    if(data.active===null){performance.mark('arena-active');data.active=t;s.gOrder=Array(10).fill(s.gPool.find(b=>b.id==='zhangliang'));s.player.damageImmune=true}
    if(s.elapsed>0 && s.mode==='none' && data.first===null){data.first=t;performance.mark('arena-control')}
    if(data.boss===null&&s.gPhase==='boss'&&s.boss?.active){data.boss=t;performance.mark('arena-boss')}
    if(dense&&s.gPhase==='mow'&&s.elapsed>=54.5&&!data.densityCheckpoint){
     const active=()=>s.enemies.filter(e=>e.active).length,n=active();
     for(let j=n;j<66;j++){const a=2*Math.PI*j/66;s.spawnEnemy('infantry',s.player.x+360*Math.cos(a),s.player.y+360*Math.sin(a),1,true)}
     data.densityCheckpoint={elapsed:s.elapsed,natural:n,after:active()};
    }
    if(prev!==undefined) data.intervals.push([t,t-prev,s.elapsed,s.gPhase,s.mode,previousMode]);
    if(t-lastWall>1000){data.pop.push([s.elapsed,s.enemies.filter(e=>e.active).length,s.legion.count,game.textures.getTextureKeys().length]);lastWall=t}
    prev=t;previousMode=s.mode;
    if(s.mode==='levelup')s.chooseUpgrade(0);else if(s.mode==='branch')s.chooseBranch(0);
   };game.events.on('postrender',record);window.stopCapture=()=>game.events.off('postrender',record);
  };listen();
 };
 window.prepareCapture(0);
},{diagnostic:mode.includes('probe'),dense:mode.includes('dense')});
function stats(rows){const a=rows.map(x=>x[1]).sort((a,b)=>a-b),tail=a.slice(-Math.ceil(a.length*.01)),sum=x=>x.reduce((a,b)=>a+b,0);return {n:a.length,average:a.length*1000/sum(a),low:1000*tail.length/sum(tail),p99:a[Math.ceil(.99*a.length)-1],max:a.at(-1),over50:a.filter(x=>x>50).length}}
const reports=[];
try{
 for(const trial of series.split(',')){
  const startTrace=()=>cdp.send('Tracing.start',{categories:'toplevel,blink.user_timing,devtools.timeline,v8,gpu,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
  if(trace&&!mode.includes('bosstrace'))await startTrace();
  if(trial==='repeat'){
   await p.evaluate(()=>{history.replaceState(null,'','/?dev=1');window.__game.scene.getScene('GauntletGameScene').scene.start('MenuScene')});
   await p.waitForFunction(()=>window.__game.scene.isActive('MenuScene'));await p.waitForTimeout(750);
   await p.evaluate(()=>{window.prepareCapture();window.__game.scene.getScene('MenuScene').scene.start('GauntletGameScene')});
  }else if(trial==='picker'){
   await p.goto(base+'/?opening=0&layout='+layout,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>window.__game?.scene.isActive('MenuScene')&&window.__game.scene.getScene('MenuScene').children.getByName('home-gauntlet'),null,{timeout:120000});
   await p.evaluate(()=>{window.__game.scene.getScene('MenuScene').children.getByName('home-gauntlet').emit('pointerdown')});
   await p.waitForFunction(()=>window.__game.scene.getScene('GauntletPickScene')?.gauntletPicker?.root?.visible);
   await p.evaluate(()=>{window.gauntletCapture.launch=performance.now();performance.mark('confirm-sortie');window.__game.scene.getScene('GauntletPickScene').gauntletPicker.root.getByName('hero-confirm').emit('pointerdown')});
  }else {
   if(trial==='hot'&&new URL(base).port==='5298')await p.goto('about:blank');
   await p.goto(base+'/?dev=1&gauntlet=1&layout='+layout,{waitUntil:'domcontentloaded'});
  }
  if(mode.includes('bosstrace')){
   await p.waitForFunction(gate=>window.__game?.scene.getScene('GauntletGameScene')?.elapsed>gate,mode.includes('peek')?7:49,{timeout:150000});
   await startTrace();
   if(mode.includes('peek'))await p.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene');s.gAt=s.elapsed-55});
  }
  await p.waitForFunction(full=>{const f=window.gauntletCapture,s=window.__game?.scene.getScene('GauntletGameScene');return f?.first!=null&&s?.sys.isActive()&&(full?f.boss&&performance.now()-f.boss>=6500:s.elapsed>=6.5)},full,{timeout:150000});
  const data=await p.evaluate(()=>{window.stopCapture();const game=window.__game,r=game.renderer,ext=r.gl.getExtension('WEBGL_debug_renderer_info');const assets=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/'));return {...window.gauntletCapture,assetTiming:{count:assets.length,transfer:assets.reduce((n,e)=>n+e.transferSize,0),cached:assets.filter(e=>e.transferSize===0&&e.decodedBodySize>0).length},renderer:r.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),canvas:[game.canvas.width,game.canvas.height]}});
  if(trace){
   const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await done;let parts=[];
   while(true){const x=await cdp.send('IO.read',{handle:stream,size:1048576});parts.push(Buffer.from(x.data,x.base64Encoded?'base64':'utf8'));if(x.eof)break}
   await cdp.send('IO.close',{handle:stream});writeFileSync(out+'-'+trial+'.trace.json.gz',gzipSync(Buffer.concat(parts)));
  }
  const r=data.intervals.filter(x=>x[4]==='none'&&x[5]==='none');
  const report={trial,layout,browser:browser.version(),errors,renderer:data.renderer,canvas:data.canvas,assetTiming:data.assetTiming,navigationToControl:data.first,launchToControl:data.first-data.launch,pop:data.pop,first:stats(r.filter(x=>x[3]==='mow'&&x[2]<6.5)),mow:stats(r.filter(x=>x[3]==='mow'&&x[2]>=6.5)),boss:stats(r.filter(x=>x[3]==='boss'&&x[0]<=data.boss+6500))};
  writeFileSync(out+'-'+trial+'.frames.json.gz',gzipSync(JSON.stringify(data)));
  writeFileSync(out+'.json',JSON.stringify([...reports,report],null,2));
  if(mode.includes('ui')){
   const state=()=>p.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene'),edges=s.starPanel?.lines.flatMap(x=>[x.ink,x.gold])??[];return {mode:s.mode,built:!!s.starPanel?.built,nodes:s.starPanel?.nodes.size??0,edges:edges.length,croppedEdges:edges.filter(x=>x.type==='Image'&&x.isCropped).length,hero:s.runConfig.character,bag:s.textures.exists('bag_panel_bg'),formation:s.textures.exists('formation_sigils'),activeEnemies:s.enemies.filter(e=>e.active).length}});
   await p.waitForFunction(()=>{const s=window.__game.scene.getScene('GauntletGameScene');if(s.mode==='levelup')s.chooseUpgrade(0);if(s.mode==='branch')s.chooseBranch(0);return s.mode==='none'&&s.pointsButton?.visible});
   report.beforeOpen=await state();
   const start=await p.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene'),t=performance.now();s.pointsButton.emit('pointerdown');return t});
   await p.waitForFunction(()=>window.__game.scene.getScene('GauntletGameScene').starPanel?.built,null,{timeout:30000});
   report.panelOpenMs=await p.evaluate(t=>performance.now()-t,start);report.afterOpen=await state();
   await p.screenshot({path:out+'-'+trial+'-star-map.png'});
   await p.evaluate(()=>{window.__game.scene.getScene('GauntletGameScene').starPanel.closeBtn.emit('pointerup')});
   await p.waitForFunction(()=>window.__game.scene.getScene('GauntletGameScene').mode==='none');
   const x0=await p.evaluate(()=>window.__game.scene.getScene('GauntletGameScene').player.x);
   await p.keyboard.down('ArrowRight');await p.waitForTimeout(280);await p.keyboard.up('ArrowRight');
   report.movePx=await p.evaluate(x=>window.__game.scene.getScene('GauntletGameScene').player.x-x,x0);
   await p.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene');s.openBattleBag()});
   await p.waitForFunction(()=>{const s=window.__game.scene.getScene('GauntletGameScene');return s.children.getByName('item-bag')&&s.textures.exists('bag_slot_frame')});
   report.bagArt=await p.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene');return ['bag_slot_frame','bag_q_purple','bag_pocket'].every(key=>s.textures.exists(key))});
  }
  if (data.first == null || report.first.n < 30 || errors.length || (full && report.boss.n < 30)) throw Error(JSON.stringify({trial, report}));
  reports.push(report);writeFileSync(out+'.json',JSON.stringify(reports,null,2));writeFileSync(out+'-'+trial+'.frames.json.gz',gzipSync(JSON.stringify(data)));console.log(trial,JSON.stringify([report.launchToControl,report.first,report.mow,report.boss]));
 }
}finally{await browser.close()}
