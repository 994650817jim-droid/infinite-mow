import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {createCoopServer} from '../server/coop.mjs';
import {hits} from '../server/gauntlet.mjs';
import {SnapshotTimeline} from '../src/coop/SnapshotTimeline.ts';

// node tools/test-coop-weak-network.mjs [all|combined|baseline|latency|jitter|loss] [report directory]
const require = createRequire(new URL('../server/package.json',import.meta.url));
const {WebSocket, WebSocketServer} = require('ws');
const profiles = [
  {id:'baseline', min:0, max:0, loss:0, recovery:0, drop:0},
  {id:'latency', min:100, max:100, loss:0, recovery:0, drop:0},
  {id:'jitter', min:10, max:170, loss:0, recovery:0, drop:0},
  {id:'loss', min:0, max:0, loss:.12, recovery:175, drop:.12},
  {id:'combined', min:55, max:145, loss:.10, recovery:160, drop:.08},
];
function rng(seed) {
  return () => { seed = (Math.imul(1664525,seed) + 1013904223) >>> 0; return seed/2**32; };
}
function stats(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const p = n => sorted.length ? Math.round(sorted[Math.max(0, Math.ceil(n*sorted.length)-1)]*10)/10 : null;
  return {n:sorted.length,p50:p(.5),p95:p(.95),max:p(1)};
}
async function listen(server) {
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return 'http://127.0.0.1:'+server.address().port;
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function relay(target, config) {
  const http = createServer();
  const wss = new WebSocketServer({server:http, path:'/coop-socket'});
  const sockets = new Set(), timers = new Set(), records=[];
  const random=rng(20261125);
  wss.on('connection',front=>{
    const back=new WebSocket(target.replace('http','ws')+'/coop-socket',{origin:target});
    sockets.add(front); sockets.add(back);
    const queued=[];
    const wire = (socket,up) => {
      let due=0;
      const pending=[];
      function pump(){
        if(!pending.length)return;
        const next=pending[0];
        const timer=setTimeout(()=>{
          timers.delete(timer);pending.shift();
          if(socket.readyState===WebSocket.OPEN){
            lane.lag.push(performance.now()-next.entered);socket.send(next.raw);
          }
          pump();
        },Math.max(0,next.due-performance.now()));
        timers.add(timer);
      }
      const lane={direction:up?'up':'down',frames:0,recoveryEvents:0,droppable:0,discarded:0,lag:[]};
      records.push(lane);
      return raw=>{
        const m=JSON.parse(raw);
        lane.frames++;
        const eligible=up?m.type==='input':m.type==='state' && m.gauntlet.general && m.battleMs>0;
        if(eligible) {
          lane.droppable++;
          if(random()<config.drop){lane.discarded++; return;}
        }
        let lag=config.min+(config.max-config.min)*random();
        if(random()<config.loss){lag+=config.recovery; lane.recoveryEvents++;}
        // The ordered queue models retransmission stalling following WebSocket messages.
        const entered=performance.now();
        due=Math.max(due+.03,entered+lag);
        pending.push({due,entered,raw:raw.toString()});
        if(pending.length===1)pump();
      };
    };
    const up=wire(back,true), down=wire(front,false);
    front.on('message',v=>back.readyState===WebSocket.CONNECTING?queued.push(v):up(v));
    back.on('open',()=>{for(const msg of queued) up(msg);});
    back.on('message',down);
    for(const [socket,other] of [[front,back],[back,front]]) {
      socket.on('error',()=>{});
      socket.on('close',()=>{sockets.delete(socket);if(other.readyState!==WebSocket.CLOSED) other.terminate();});
    }
  });
  return {http, records,close:async()=>{
    for(const t of timers)clearTimeout(t);
    for(const s of sockets)s.terminate();
    await new Promise(resolve=>wss.close(resolve)); await new Promise(resolve=>http.close(resolve));
  }};
}
async function client(origin) {
  const ws = new WebSocket(origin.replace('http','ws')+'/coop-socket',{origin});
  const messages=[], stamps=[], hashes=new Map(),timeline=new SnapshotTimeline();
  let current, rendered=-1;
  ws.on('message',raw=>{
    const m=JSON.parse(raw);
    messages.push(m);
    if(m.type==='state'){
      const now=performance.now(), key=m.gauntlet.wave+'/'+m.battleMs;
      stamps.push(now);
      if(!hashes.has(key))hashes.set(key,new Set());
      hashes.get(key).add(digest(m));
      timeline.push(m,now);const pose=timeline.sample(now);
      assert(pose.ms>=rendered && pose.ms<=m.battleMs && pose.mix>=0 && pose.mix<=1,
        JSON.stringify({rendered,sampled:pose.ms,battleMs:m.battleMs,mix:pose.mix,wave:m.gauntlet.wave,arrived:now}));
      rendered=pose.ms;current=m;
    }
  });
  await once(ws,'open');
  return {ws,stamps,hashes,get current(){return current;},send:m=>ws.send(JSON.stringify(m)),async until(fn,ms=8000){
    const end=Date.now()+ms;
    while(Date.now()<end){const i=messages.findIndex(fn);if(i>=0)return messages.splice(0,i+1).at(-1);await delay(10);}
    throw Error('Timed out: '+fn+'; last '+JSON.stringify(messages.slice(-1).map(m=>[m.type,m.wave,m.gauntlet?.wave])));
  }};
}
function pickMove(s,i) {
  const p=s.players[i],foes=s.enemies;
  if(!foes.length||p.hp===0) return {dx:0,dy:0};
  const target=foes.find(f=>f.boss)??foes[0];
  let best=-Infinity, dir;
  for(let k=0;k<24;k++){
    const dx=Math.cos(k*Math.PI/12),dy=Math.sin(k*Math.PI/12);
    const next={x:p.x+dx*38,y:p.y+dy*38};
    if(next.x<30||next.x>930||next.y<30||next.y>690)continue;
    let score=-Math.abs(Math.hypot(next.x-target.x,next.y-target.y)-98);
    for(const f of foes){const d=Math.hypot(next.x-f.x,next.y-f.y);if(d<62)score-=(62-d)*4;}
    for(const w of s.gauntlet.warnings??[])if(!w.resolved&&hits(w,next))score-=250;
    if(score>best){best=score;dir={dx,dy};}
  }
  return dir??{dx:0,dy:0};
}
function compareStates(a,b) {
  let common=0, conflict=0;
  for(const [key,one] of a.hashes){
    const two=b.hashes.get(key);
    // Multiple legitimate transitions can have the same battle time. Exclude ambiguous keys.
    if(one.size!==1||two?.size!==1)continue;
    common++;if([...one][0]!==[...two][0])conflict++;
  }
  assert(common>=12);assert.equal(conflict,0);
  return {common,conflict};
}
function collapseLinks(records){
  return Object.fromEntries(['up','down'].map(d=>{
    const lanes=records.filter(s=>s.direction===d);
    const total=k=>lanes.reduce((v,s)=>v+s[k],0);
    return [d,{frames:total('frames'),recoveryEvents:total('recoveryEvents'),droppable:total('droppable'),
      discarded:total('discarded'),relayDelayMs:stats(lanes.flatMap(s=>s.lag))}];
  }));
}
async function run(config) {
  const rooms=new Map(), game=createCoopServer({rooms,gauntletWarmup:.1,gauntletLineup:Array(10).fill('zhangliang')});
  const serverOrigin=await listen(game.http);
  const proxy=relay(serverOrigin,config), origin=await listen(proxy.http);
  const peers=[];
  async function connect(){const c=await client(origin);peers.push(c);return c;}
  const start=performance.now(), checks={};
  let timer;
  try{
    const a=await connect();let b=await connect();
    a.send({type:'create',heroes:['zhaoyun'],starDraft:4});
    const sa=await a.until(m=>m.type==='session');const room=rooms.get(sa.code);
    b.send({type:'join',code:sa.code,heroes:['zhaoyun'],starDraft:4});
    const sb=await b.until(m=>m.type==='session');
    await a.until(m=>m.type==='lobby'&&m.count===2);
    await b.until(m=>m.type==='lobby'&&m.count===2);
    const rtt=[];
    for(let i=0;i<8;i++){
      const sent=performance.now();a.send({type:'pickHero',hero:'zhaoyun'});
      await a.until(m=>m.type==='lobby'&&m.picks[0].hero==='zhaoyun');
      rtt.push(performance.now()-sent);
    }
    checks.pickAckRttMs=stats(rtt);
    b.send({type:'pickHero',hero:'zhaoyun'});
    await a.until(m=>m.type==='lobby'&&m.picks.every(p=>p.hero));
    a.send({type:'start'});
    await Promise.all([a,b].map(c=>c.until(m=>m.type==='state'&&m.gauntlet.wave===1)));
    timer=setInterval(()=>{
      for(const [i,c] of [a,b].entries())if(c.ws.readyState===WebSocket.OPEN && c.current) c.send({type:'input',...pickMove(c.current,i)});
    },100);
    await delay(config.id==='combined'?5000:4200);
    checks.commonBattleSnapshots=compareStates(a,b);
    checks.snapshotIntervalsMs=[a,b].map(c=>stats(c.stamps.slice(1).map((t,i)=>t-c.stamps[i])));
    checks.heroesMoved=[a,b].map((c,i)=>Math.hypot(c.current.players[i].x-(i?528:432),c.current.players[i].y-360)>1);
    assert(checks.heroesMoved.every(Boolean));
    if(config.id==='combined'){
      b.ws.terminate();await a.until(m=>m.type==='connection'&&m.paused);
      const frozen=room.seconds;
      const pose=JSON.stringify([...room.players.values()].map(p=>[p.slot,p.hero,p.x,p.y,p.hp,p.rescue]));
      const frozenBoss=JSON.stringify(room.enemies.map(e=>[e.id,e.x,e.y,e.hp]));
      const before=performance.now();await delay(1800);
      assert.equal(room.seconds,frozen);
      assert.equal(JSON.stringify([...room.players.values()].map(p=>[p.slot,p.hero,p.x,p.y,p.hp,p.rescue])),pose);
      assert.equal(JSON.stringify(room.enemies.map(e=>[e.id,e.x,e.y,e.hp])),frozenBoss);
      const newPeer=await connect();
      newPeer.send({type:'resume',code:sa.code,token:sb.token});assert.equal((await newPeer.until(m=>m.type==='session')).slot,sb.slot);
      const restored=await newPeer.until(m=>m.type==='state');
      const restoredFromFreeze = restored.battleMs===Math.round(frozen*1000);
      if(restoredFromFreeze)assert.equal(JSON.stringify(restored.players.map(p=>[p.slot,p.hero,p.x,p.y,p.hp,p.rescue])),pose);
      b=newPeer;
      checks.battleReconnect={confirmedPauseMs:Math.round(performance.now()-before),minimumSampledFrozenMs:1800,battleMs:Math.round(frozen*1000),firstDeliveredRestoredMs:restored.battleMs,exactRestoreSnapshotDelivered:restoredFromFreeze,slot:sb.slot};
      await a.until(m=>m.type==='connection'&&!m.paused);
      let pair=await Promise.all([a,b].map(c=>c.until(m=>m.type==='draft'||m.type==='result',130000)));
      assert(pair.every(m=>m.type==='draft'&&m.wave===1),'Natural battle must reach wave-one draft');
      checks.firstWave={naturalKill:true,cleared:room.run.cleared,seconds:Math.round(room.seconds),damage:[...room.players.values()].map(p=>p.damage)};
      console.log(config.id,'natural boss down',checks.firstWave);
      clearInterval(timer);
      const checkpoints=[],waves=[];
      for(let wave=1;wave<=20;wave++){
        const tier=wave<=10?'mortal':wave<=15?'ghost':'divine';
        if(wave!==1){
          const alive=await Promise.all([a,b].map(c=>c.until(m=>m.type==='state'&&m.gauntlet.wave===wave&&m.gauntlet.general)));
          assert.deepEqual(alive[0].gauntlet.general,alive[1].gauntlet.general);
          assert.equal(alive[0].gauntlet.tier,tier);
          assert.equal(alive[0].gauntlet.cleared,wave-1);
          // Only the local fixture shortens boss HP. Admission, drafts, votes and receipts use production code.
          room.run.boss.hp=0;
          pair=await Promise.all([a,b].map(c=>c.until(m=>m.type==='draft'&&m.wave===wave)));
        }
        assert.equal(pair[0].general,pair[1].general);
        assert.equal(pair[0].tier,tier);
        const seconds=pair[0].seconds;
        assert(Number.isInteger(seconds) && seconds>=(waves.at(-1)?.seconds??0));
        assert.equal(seconds,Math.floor(room.seconds));
        assert.equal(pair[1].seconds,seconds);
        waves.push({wave,tier,general:pair[0].general,seconds});
        if(pair[0].checkpoint){
          checkpoints.push(wave);
          assert.deepEqual(pair[0].continuation,pair[1].continuation);
          if(wave===20){
            a.send({type:'finish',wave});
            const result=await Promise.all([a,b].map(c=>c.until(m=>m.type==='result')));
            assert.deepEqual(result[0],result[1]);assert.equal(result[0].reason,'completed');
            assert.equal(result[0].mythicSize,5);assert.equal(result[0].tier,tier);
            assert.equal(result[0].wave,wave);assert.equal(result[0].seconds,seconds);
            assert.equal(result[0].generals,20);assert.equal(result[0].milestones,3);
            assert.equal(result[0].bosses.length,20);assert.equal(result[0].party.length,2);
            assert.deepEqual(result[0].bosses,waves.map(w=>w.general));
            const digestBefore=digest(result[0]);a.send({type:'leave'});b.ws.terminate();
            const deadline=Date.now()+3000;
            while(room.players.get(1)?.disconnectedAt==null&&Date.now()<deadline)await delay(20);
            assert(room.players.get(1)?.disconnectedAt!=null,'Guest disconnect must reach the server');
            b=await connect();b.send({type:'resume',code:sa.code,token:sb.token});
            const receipt=await b.until(m=>m.type==='result');assert.deepEqual(receipt,result[0]);
            checks.settlement={receipt,redeliveryDigest:digestBefore,redeliveryEqual:true};
            break;
          }
          const target=pair[0].continuation[0];
          b.send({type:'challenge',tier:target,wave});
          const voted=await a.until(m=>m.type==='draft'&&m.checkpoint&&m.votes[1]===target);
          assert.equal(voted.votes[0],null);
          if(wave===10){
            b.ws.terminate();await a.until(m=>m.type==='connection'&&m.paused);
            a.send({type:'challenge',tier:target,wave});
            await delay(700);assert.equal(room.phase,'checkpoint');assert.deepEqual(room.votes,[null,target]);
            b=await connect();b.send({type:'resume',code:sa.code,token:sb.token});
            const resumed=await b.until(m=>m.type==='draft'&&m.checkpoint&&m.wave===wave);
            assert.deepEqual(resumed.votes,[null,target]);assert.equal(resumed.seconds,seconds);
            checks.checkpointReconnect={wave,tier,votes:resumed.votes,seconds:resumed.seconds};
          }
          a.send({type:'challenge',tier:target,wave});
          pair=await Promise.all([a,b].map(c=>c.until(m=>m.type==='draft'&&m.wave===wave&&!m.checkpoint)));
          for(const reward of pair)assert.equal(reward.seconds,seconds);
        }
        for(const [i,c] of [a,b].entries())if(pair[i].choices.length)c.send({type:'reward',id:pair[i].choices[0]});
      }
      assert.deepEqual(checkpoints,[10,15,20]);
      checks.checkpoints=checkpoints;checks.waves=waves;
    }
    return {config,checks,links:collapseLinks(proxy.records),elapsedSeconds:Math.round((performance.now()-start)/1000)};
  }finally{
    clearInterval(timer);
    for(const c of peers)c.ws.terminate();
    await proxy.close();await game.close();
  }
}
const selected=process.argv[2]&&process.argv[2]!=='all'?profiles.filter(p=>p.id===process.argv[2]):profiles;
assert(selected.length>0);
const outputDirectory=process.argv[3];
if(outputDirectory)await mkdir(outputDirectory,{recursive:true});
await Promise.all(selected.map(async profile=>{
  const report=await run(profile);
  if(outputDirectory)await writeFile(resolve(outputDirectory,profile.id+'.json'),JSON.stringify(report,null,2)+'\n');
  console.log(profile.id,'PASS',JSON.stringify({rtt:report.checks.pickAckRttMs,matched:report.checks.commonBattleSnapshots,
    receipt:report.checks.settlement && [report.checks.settlement.receipt.mythicSize,report.checks.settlement.receipt.tier,report.checks.settlement.receipt.wave,report.checks.settlement.redeliveryEqual]}));
}));
