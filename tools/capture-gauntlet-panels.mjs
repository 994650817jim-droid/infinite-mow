import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createCoopServer } from '../server/coop.mjs';

const base = (process.env.BASE ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = resolve(process.argv[2] ?? 'screenshots/gauntlet-panels');
const layouts = {mobile:{width:390,height:844}, desktop:{width:1280,height:720}};
const soloLayouts = process.env.LAYOUT ? [process.env.LAYOUT] : Object.keys(layouts);
assert.ok(soloLayouts.every(layout => Object.hasOwn(layouts,layout)), 'LAYOUT must be mobile or desktop');
const errors = [];
const captures = [];
const browser = await chromium.launch({channel:'chrome', args:['--mute-audio']});
const requested = process.argv.slice(3);
const selected = id => !requested.length || requested.includes(id);
mkdirSync(out, {recursive:true});

async function open(layout, path, before) {
  const p = await browser.newPage({viewport:layouts[layout],isMobile:layout==='mobile',hasTouch:layout==='mobile'});
  p.on('pageerror', e => {errors.push(String(e));console.error(e.stack);});
  if (before) await before(p);
  await p.goto(base + '/?' + path + '&layout=' + layout, {waitUntil:'domcontentloaded'});
  return p;
}

async function capture(p, layout, id, heading) {
  const dialog = p.locator('dialog.campaign-gate[open]');
  await dialog.getByRole('heading',{name:heading, exact:true}).waitFor({timeout:30000});
  await p.evaluate(async () => {
    await document.fonts.ready;
    const dialog = document.querySelector('dialog[open]');
    await Promise.all(Array.from(dialog.querySelectorAll('img'), img => img.decode().catch(() => {})));
    const url = dialog.querySelector('header').style.getPropertyValue('--chapter-art').match(/url\("?(.*?)"?\)/)[1];
    const cover = new Image(); cover.src = url; await cover.decode();
  });
  const evidence = await dialog.evaluate(d => {
    const b = d.getBoundingClientRect();
    const r = el => {const a=el.getBoundingClientRect();return [a.x,a.y,a.width,a.height].map(Math.round)};
    return {text:d.innerText, panel:r(d), inside:b.left>=0 && b.right<=innerWidth+1 && b.top>=0 && b.bottom<=innerHeight+1,
      overflowX:d.scrollWidth>d.clientWidth+1,
      buttons:[...d.querySelectorAll('button')].map(b => ({text:b.textContent,rect:r(b)})),
      images:[...d.querySelectorAll('img')].map(i => i.naturalWidth)};
  });
  assert.ok(evidence.inside && !evidence.overflowX, JSON.stringify(evidence));
  assert.ok(evidence.images.every(w => w>0));
  for (const {rect:[x,y,w,h]} of evidence.buttons) {
    assert.ok(w>=44 && h>=44 && x>=0 && y+h<=layouts[layout].height+1, JSON.stringify(evidence));
  }
  await p.screenshot({path:join(out,layout+'-'+id+'.png')});
  const roster = dialog.getByText(/^已击败名将/);
  if (await roster.count()) {
    await roster.click();
    const names = await dialog.locator('details[open] .roster small').allTextContents();
    assert.ok(names.length);
    evidence.bosses = names;
    await roster.click();
  }
  captures.push({layout,id,...evidence});
  console.log(layout,id,heading);
}

async function solo(layout, id, tier, milestones, heading) {
  const extreme = id === 'extreme-clear';
  // Isolated browser storage. The DEV jump enters the actual game and uses normal receipt writes.
  const p = await open(layout, 'gauntlet=1&story=off' + (extreme?'&challenge=extreme':''));
  try {
    await p.waitForFunction(() => window.__game?.scene.getScene('GauntletGameScene')?.player?.sprite.active, null,{timeout:120000});
    await p.evaluate(({tier,milestones,id,extreme}) => {
      const s = window.__game.scene.getScene('GauntletGameScene');
      if (s.mythicSize !== (extreme?10:5)) throw Error('Wrong route');
      const wave = milestones === 0 ? 4 : 10 + (milestones-1)*s.mythicSize;
      const roster = [...s.gOrder.slice(0,10), ...s.roster.ghost, ...s.roster.divine];
      s.gWave=wave; s.gTier=tier; s.gMilestones=milestones;
      s.gCleared=milestones>0; s.gKills=roster.slice(0,wave-(milestones===0?1:0));
      // A natural checkpoint follows a spawned and defeated boss. The base scene checks both flags.
      s.bossSpawned=milestones>0; s.bossKilled=milestones>0;
      // Supply a coherent checkpoint ledger. These are visual fixtures, never measured match statistics.
      s.kills = 12 * s.gKills.length;
      s.damageDealt = 215 * s.gKills.length;
      s.elapsed = 43 * s.gKills.length;
      if (id === 'defeat') s.finish(false,'death');
      else s.openClearChoice();
    },{tier,milestones,id,extreme});
    if (id==='standard-clear' || id==='extreme-clear' || id==='withdrawn') {
      await p.locator('dialog[open]').getByRole('button',{name:/收兵/}).click();
    }
    await capture(p,layout,id,heading);
  } catch (error) {
    console.error(id, await p.evaluate(() => {
      const s=window.__game?.scene.getScene('GauntletGameScene');
      return {heading:document.querySelector('dialog h2')?.textContent, mode:s?.mode, options:s?.upgradeOptions?.map(o=>o.id), phase:s?.gPhase,
        victory:s?.over, milestone:s?.gMilestones, wave:s?.gWave, sys:s?.sys?.settings.status, gameTime:s?.time?.now,
        result:s?.gResult, score:s?.resultTexts?.subtitle.text, loop:s?.game.loop.sleeping, keys:Object.keys(localStorage).filter(k=>k.includes('gauntlet'))};
    }));
    throw error;
  } finally { await p.close(); }
}

async function coop() {
  const rooms = new Map();
  const server = createCoopServer({origins:[base],rooms,gauntletWarmup:.5});
  server.http.listen(0,'127.0.0.1'); await once(server.http,'listening');
  const port = server.http.address().port;
  const clients = [];
  try {
    for (const layout of Object.keys(layouts)) {
      const p = await open(layout, 'dev=1&story=off', p => p.addInitScript(port => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(url,protocols) { super(String(url).includes('/coop-socket')?'ws://127.0.0.1:'+port+'/coop-socket':url,protocols); }
        };
      },port));
      clients.push(p);
      await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null,{timeout:120000});
      await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('CoopScene'));
      await p.locator('.coop-layer').waitFor({timeout:120000});
    }
    const [host,guest] = clients;
    await host.getByRole('button',{name:'创建房间'}).click();
    const code = (await host.locator('.coop-code').innerText()).trim();
    await guest.evaluate(code => window.__game.scene.getScene('CoopScene').connect({type:'join',code}),code);
    await guest.locator('.coop-code').waitFor();
    for (const [i,p] of clients.entries()) {
      await p.evaluate(i => {const s=window.__game.scene.getScene('CoopScene'); s.send({type:'pickHero',hero:s.availableHeroes[i] ?? s.availableHeroes[0]});},i);
    }
    const room = rooms.get(code);
    const wait = async (f, label) => {
      for (let i=0;i<500;i++) {if(f())return;await new Promise(r=>setTimeout(r,80));}
      throw Error('Timeout '+label);
    };
    await wait(()=>[...room.players.values()].every(p=>p.hero), 'both picks');
    // Put the live test server at wave 10; its normal combat, checkpoint, finish and broadcast run afterwards.
    room.run.wave=10; room.run.cleared=9;
    // Keep all ten generals distinct while using a single ordinary gate boss.
    if (room.run.lineup[9].dual) {
      const single = room.run.lineup.findIndex(b=>!b.dual);
      [room.run.lineup[9],room.run.lineup[single]]=[room.run.lineup[single],room.run.lineup[9]];
    }
    room.run.history=room.run.lineup.slice(0,9);
    await host.evaluate(()=>window.__game.scene.getScene('CoopScene').send({type:'start'}));
    async function defeatGate() {
      await wait(()=>room.run.boss, 'gate boss');
      const boss=room.run.boss;
      const [p1,p2]=[...room.players.values()];
      boss.x=(p1.x+p2.x)/2; boss.y=(p1.y+p2.y)/2; boss.hp=5;
      await wait(()=>room.phase==='checkpoint','gate result');
    }
    async function checkpointPhoto(kind) {
      const folder=join(out,'coop-votes');
      mkdirSync(folder,{recursive:true});
      for (const [i,layout] of Object.keys(layouts).entries()) {
        const p=clients[i], card=p.locator('.coop-card.campaign-gate');
        assert.equal(await card.count(),1);
        await card.locator('.commander').evaluate(img=>img.decode());
        assert.ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && [...el.querySelectorAll('footer button')].every(b=>{
          const r=b.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.top>=0 && r.bottom<=innerHeight+1;
        })));
        await p.screenshot({path:join(folder,layout+'-'+kind+'.png')});
      }
    }
    await defeatGate();
    await host.getByRole('button',{name:/挑战鬼将/}).click();
    await guest.getByRole('button',{name:'进入无尽'}).click();
    for(const p of clients) await p.getByText('两人选择不同，可改选或收兵结算').waitFor();
    assert.deepEqual(room.votes,['ghost','endless']);
    await checkpointPhoto('ghost-split');
    await guest.getByRole('button',{name:/挑战鬼将/}).click();
    await wait(()=>room.phase==='draft','matching votes advance');
    room.run.warmup=30;
    for(const p of clients) await p.locator('.coop-reward').first().click();
    await wait(()=>room.phase==='battle' && room.run.wave===11,'both rewards acknowledged');
    assert.equal(room.run.tier,'ghost');
    room.run.wave=15;room.run.cleared=14;room.run.warmup=.5;room.run.started=room.seconds;
    room.run.history.push(...room.run.roster.ghost.slice(0,4));
    room.run.upcoming=room.run.roster.ghost.at(-1);
    await defeatGate();
    for(const p of clients) await p.getByRole('heading',{name:'天门将启'}).waitFor();
    await guest.getByRole('button',{name:/挑战神将/}).click();
    await host.getByText('战友已选择，请确认去向').waitFor();
    await guest.getByText('已确认，等待战友').waitFor();
    await checkpointPhoto('divine-pending');
    await host.getByRole('button',{name:'结束并结算'}).click({timeout:30000});
    for (const [i,layout] of Object.keys(layouts).entries()) await capture(clients[i],layout,'coop','收兵归营');
    assert.equal(room.result.party.length,2);
    assert.equal(room.result.generals,15);
    assert.equal(room.result.reason,'withdrawn');
    writeFileSync(join(out,'coop-server-result.json'), JSON.stringify(room.result,null,2));
  } finally {
    for (const p of clients) await p.close();
    await server.close();
  }
}
try {
  const cases = [
    ['ghost-gate','mortal',1,'鬼门已开'], ['divine-gate','ghost',2,'天门将启'],
    ['standard-clear','divine',3,'三界凯旋'], ['extreme-clear','divine',3,'三界凯旋'],
    ['withdrawn','mortal',1,'收兵归营'], ['defeat','mortal',0,'沙场败退'],
  ];
  for (const layout of soloLayouts) for (const [id,...params] of cases) {
    if (selected(id)) await solo(layout,id,...params);
  }
  if (selected('coop')) await coop();
  assert.deepEqual(errors,[]);
} finally {
  writeFileSync(join(out,requested.length?requested.join('-')+'-audit.json':'screens-audit.json'),JSON.stringify({captures,errors},null,2));
  await browser.close();
}
