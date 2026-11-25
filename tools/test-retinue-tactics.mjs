import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BASE??'http://127.0.0.1:5173')+'/?gauntlet=1&dev=1&mythic=divine_zhaoyun&layout=desktop');
  await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.gCtrl?.definition?.id==='divine_zhaoyun',null,{timeout:100000});
  const result=await page.evaluate(async()=>{
    const s=window.__game.scene.getScene('GauntletGameScene'),army=s.legion;
    s.game.loop.sleep();
    const {BossMoveset}=await import('/src/systems/BossMoveset.ts'),{BOSS_MOVES}=await import('/src/data/bossMoves.ts');
    const {SpatialGrid}=await import('/src/systems/SpatialGrid.ts');
    const grid=new SpatialGrid(100);
    const ctrl=new BossMoveset(s.gCtrl.host,s.boss.sprite.texture.key,s.combatNow,BOSS_MOVES.chengong,'walk');
    army.recruit('spearman',2,true);army.recruit('archer',1,true);
    const [center,flank,bow]=army.units.filter(u=>u.active).slice(-3);
    const b=s.boss;let time=s.combatNow;
    s.player.sprite.setPosition(0,-140);b.sprite.setPosition(75,0);b.contactCd=20;grid.insert(b);
    center.setPosition(0,0);flank.setPosition(0,65);bow.setPosition(101,0);army.rebuildGrid();
    const original=[center.hp,flank.hp,bow.hp];
    const lane={kind:'lane',x:-100,y:0,angle:0,len:200,width:27};
    ctrl.add(lane,time,time+1,.8);ctrl.updateHazards(time+2);time+=1000;
    const laneHp=[center.hp,flank.hp,bow.hp];
    for(const u of [center,flank,bow]){u.hp=u.maxHp;u.bossImmuneUntil=0;}
    center.setPosition(0,0);flank.setPosition(0,75);bow.setPosition(101,0);army.rebuildGrid();
    if(army.order!=='sortie')army.cycleOrder();
    const advance=()=>{time+=25;army.update(.025,time,[b],grid,()=>{});ctrl.updateHazards(time);};
    ctrl.add(lane,time,time+900,.8);
    for(let i=0;i<37;i++)advance();
    const warned={x:center.x,y:center.y,hp:center.hp,full:center.maxHp};
    for(let i=0;i<40;i++)advance();
    const rangedDistance=Math.hypot(bow.x-b.x,bow.y-b.y);
    return {original,laneHp,warned,rangedDistance};
  });console.log(JSON.stringify({...result,errors}));
  assert.ok(result.laneHp[0]<result.original[0] && result.laneHp[1]===result.original[1],'true lane hits; clear flank stays safe');
  assert.equal(result.warned.hp,result.warned.full,'warned spearman leaves before impact');
  assert.ok(result.rangedDistance>127,'archer maintains firing distance');
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
