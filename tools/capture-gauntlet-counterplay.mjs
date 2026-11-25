// Capture the live Phaser scene at fixed combat-clock intervals for repeatable visual review.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [boss, layout = 'desktop', firstCast = '0'] = process.argv.slice(2);
assert.ok(/^(ghost_lubu|divine_caocao|divine_zhouyu|ghost_zhangxiu)$/.test(boss));
const mobile = layout === 'mobile';
const out = resolve(process.env.OUT ?? '.build-tmp/gauntlet-counterplay', boss, layout, 'cast-' + firstCast);
mkdirSync(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome', args:['--mute-audio']});
try {
  const p = await browser.newPage({viewport:mobile ? {width:390,height:844} : {width:1280,height:720}, isMobile:mobile, hasTouch:mobile});
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.goto((process.env.BASE ?? 'http://127.0.0.1:5173') + '/?gauntlet=1&dev=1&mythic=' + boss + '&layout=' + layout);
  await p.waitForFunction(id => {
    const s=window.__game?.scene.getScene('GauntletGameScene');
    return s?.gCur?.id===id && s?.boss?.active && s?.gCtrl;
  }, boss, {timeout:90000});
  await p.evaluate(cast => {
    const s=window.__game.scene.getScene('GauntletGameScene');
    s.game.loop.sleep(); window.proofTime=s.game.loop.now;
    s.boss.sprite.setPosition(s.player.x-124,s.player.y-15);
    s.boss.hp=s.boss.maxHp*.48;
    s.gCtrl.next=s.combatNow/1000+.15;
    s.gCtrl.casts=Number(cast);
    s.gCtrl.queue=[];
  }, firstCast);
  const frames=[];
  for(let i=0;i<52;i++){
    const state=await p.evaluate(() => {
      const s=window.__game.scene.getScene('GauntletGameScene');
      for(let j=0;j<10;j++){
        if(s.mode==='levelup')s.chooseUpgrade(0);
        s.game.step(window.proofTime+=20,20);
      }
      const w=s.gCtrl?.queue?.[0];
      return {id:s.gCur?.id,mode:s.mode,seconds:s.combatNow/1000,move:w?.name,shape:w?.kind,
        warning:!!w && s.combatNow/1000>=w.startsAt && !w.resolved,hit:!!w?.resolved,
        boss:{x:s.boss?.x,y:s.boss?.y},player:{x:s.player.x,y:s.player.y,hp:s.player.hp}};
    });
    if(state.mode==='result')break; // End the clip at defeat; never include the results panel.
    assert.equal(state.id,boss); assert.equal(state.mode,'none','An interface obscured the battlefield');
    const filename=String(i).padStart(3,'0')+'.jpg';
    await p.screenshot({path:join(out,filename),quality:86,type:'jpeg'});
    frames.push({...state,filename});
  }
  const names=[...new Set(frames.map(row=>row.move).filter(Boolean))];
  writeFileSync(join(out,'timeline.json'),JSON.stringify({boss,layout,firstCast,errors,names,frames},null,2));
  assert.deepEqual(errors,[]); assert.ok(frames.some(x=>x.warning)); assert.ok(frames.some(x=>x.hit));
  assert.ok(frames.length>=8,'No complete attack to review');
  const video=spawnSync(process.env.FFMPEG ?? 'ffmpeg',['-y','-loglevel','error','-framerate','5','-i',join(out,'%03d.jpg'),'-frames:v',String(frames.length),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',join(out,'combat.mp4')],{stdio:'inherit'});
  assert.equal(video.status,0,video.error?.message);
  console.log(boss,layout,names.join(' / '),frames.length);
} finally {await browser.close();}
