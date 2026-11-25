// Run from the game checkout. Each browser has its own temporary profile; all endpoints are loopback.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
const require=createRequire(resolve('package.json'));
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const {createCoopServer}=await import(pathToFileURL(resolve('server/coop.mjs')));
const {paySpoils,recruitCompany,companyWire}=await import(pathToFileURL(resolve('server/coop-retinue.mjs')));
const {chromium}=require('playwright'),rooms=new Map(),origin='http://127.0.0.1:5241';
const api=createCoopServer({rooms,origins:[origin],gauntletWarmup:999,emberRandom:()=>0});
api.http.listen(0,'127.0.0.1');await once(api.http,'listening');
process.env.VITE_COOP_URL='ws://127.0.0.1:'+api.http.address().port+'/coop-socket';
const web=await createServer({server:{host:'127.0.0.1',port:5241,strictPort:true,hmr:false,watch:null}});
await web.listen();const browser=await chromium.launch({channel:'chrome'});
try{
 const errors=[],pages=[];
 for(const [width,height] of [[390,844],[1280,720]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width===390,isMobile:width===390});
   page.on('pageerror',e=>errors.push(String(e)));pages.push(page);
   await page.goto(origin+'/?layout='+(width===390?'mobile':'desktop'));
   await page.waitForFunction(()=>window.__game?.scene.isActive('MenuScene'),null,{timeout:90000});
   await page.evaluate(()=>{window.__game.scene.getScene('MenuScene').scene.start('CoopScene');});
   await page.getByRole('button',{name:'创建房间'}).waitFor({timeout:90000});
 }
 const [a,b]=pages;await a.getByRole('button',{name:'创建房间'}).click();await a.locator('.coop-code').waitFor();
 const code=await a.locator('.coop-code').innerText(),room=rooms.get(code);
 await b.evaluate(code=>{window.__game.scene.getScene('CoopScene').connect({type:'join',code});},code);
 await b.locator('.coop-code').waitFor();
 for(const p of pages)await p.evaluate(()=>{window.__game.scene.getScene('CoopScene').send({type:'pickHero',hero:'zhaoyun'});});
 await a.waitForFunction(()=>document.querySelectorAll('.coop-reward').length===0);
 const wait=async pred=>{const end=Date.now()+8000;while(!pred()){if(Date.now()>end)throw Error('room timeout');await new Promise(r=>setTimeout(r,15));}};
 await wait(()=>[...room.players.values()].every(p=>p.hero));await a.evaluate(()=>{window.__game.scene.getScene('CoopScene').send({type:'start'});});
 await wait(()=>room.phase==='battle');
 room.run.boss={id:8000,general:room.run.upcoming,boss:true,hp:0};room.enemies=[room.run.boss];
 for(const p of pages){const recruit=p.getByRole('button',{name:/招募三人/});await recruit.click();await p.waitForFunction(()=>document.querySelector('.coop-party')?.textContent.includes('部曲 3/')); }
 await a.locator('.coop-reward').filter({hasText:'火种'}).click();await b.locator('.coop-reward').first().click();
 await wait(()=>room.run.wave===2);await a.getByRole('button',{name:/护阵中/}).click();await wait(()=>room.players.get(0).company.order==='sortie');assert.equal(room.players.get(1).company.order,'guard');
 // Observe the actual state submitted to the renderer, on both clients.
 for(const page of pages)await page.evaluate(()=>{const s=window.__game.scene.getScene('CoopScene'),draw=s.drawTroops;
   s.drawTroops=function(state,...rest){const result=draw.call(this,state,...rest);if(state.burning?.includes(8500))window.sawFire=true;return result;};});
 const hero=room.players.get(0);hero.fireIn=0;room.spawnIn=999;
 room.enemies=[{id:8500,x:hero.x+55,y:hero.y,hp:200,maxHp:200,boss:false,hitIn:999}];
 for(const page of pages)await page.waitForFunction(()=>window.sawFire===true,null,{timeout:8000});
 // Scale fixture using real camp shops and real per-wave payouts; leave combat, network and renderer running normally.
 for(let wave=2;wave<=4;wave++){room.run.wave=wave;room.phase='draft';paySpoils(room);for(const p of room.players.values()){p.choices=['damage'];recruitCompany(room,p,{wave,receipt:p.company.receipt});p.choices=[];}room.phase='battle';}
 room.enemies=Array.from({length:48},(_,i)=>({id:9000+i,x:60+50*(i%12),y:60+45*Math.floor(i/12),hp:150,maxHp:150,boss:false,hitIn:0}));
 const bytes=Buffer.byteLength(JSON.stringify(companyWire(room)));
 for(const page of pages)await page.evaluate(()=>{window.times=[];let prev=performance.now();window.frameListener=()=>{const t=performance.now();window.times.push(t-prev);prev=t;};window.__game.events.on('postrender',window.frameListener);});
 await a.waitForTimeout(5500);
 const measurements=[];
 for(const page of pages){const s=await page.evaluate(()=>{window.__game.events.off('postrender',window.frameListener);
   const t=window.times.slice(1).sort((a,b)=>a-b),scene=window.__game.scene.getScene('CoopScene'),poses=scene.companyView.poses;
   return {width:innerWidth,renderedSoldiers:poses.size,missing:[...poses.values()].filter(p=>p.body.texture.key==='__MISSING').length,frames:t.length,fps:1000*t.length/t.reduce((a,b)=>a+b,0),p95ms:t[Math.ceil(.95*t.length)-1]};});
   assert.ok(s.frames>0&&s.renderedSoldiers>0);assert.equal(s.missing,0);measurements.push(s);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({measurements,allySnapshotBytes:bytes,authoritativeSoldiers:companyWire(room).length,liveEnemies:room.enemies.length},null,2));
}finally{await browser.close();await web.close();await api.close();}
