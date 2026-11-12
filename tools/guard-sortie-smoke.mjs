import{chromium}from'playwright';import{mkdirSync,writeFileSync}from'node:fs';const b=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];const check=(name,ok,data)=>{checks.push({name,ok,data});console.log(ok?'PASS':'FAIL',name,JSON.stringify(data??''));};
try{for(const chapter of ['huangjin','hulao']){const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:5173/?dev=1&autostart=1&chapter=${chapter}`);await p.waitForFunction(()=>!!window.__IM);if(chapter==='hulao'){await p.evaluate(()=>window.__game.scene.getScene('GameScene').__DEV_ACTIONS.chapter2());await p.waitForTimeout(100);}
const result=await p.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.scene.pause();s.spawnTimer=s.eliteTimer=1e8;s.player.weapons=[];s.player.stats.regen=0;s.player.sprite.setPosition(0,0);for(const e of s.enemies)e.deactivate();s.legion.clear();s.legion.recruit('swordsman',1,true);const u=s.allies.find(u=>u.active);u.setPosition(0,60);const e=s.spawnEnemy('infantry',350,0,1,true);e.hp=e.maxHp=1e6;s.rebuildGrid();let now=s.combatNow+1000;const hit=(e,n)=>{e.hp-=n;};
const tick=(seconds)=>{for(let i=0;i<seconds*60;i++){now+=1000/60;s.legion.update(1/60,now,s.enemies,s.grid,hit);}};
const defaultGuard=s.legion.order==='guard';tick(2);const guardX=u.x;s.legion.cycleOrder();const sortie=s.legion.order==='sortie';tick(4);const sortieX=u.x,attacked=e.hp<e.maxHp;s.legion.cycleOrder();tick(3);const returned=u.x<100;
// Acquisition occurs before movement and uses the ally spatial grid.
u.setPosition(160,0);e.sprite.setPosition(300,0);s.legion.rebuildGrid();s.updateEnemies(1/60,now);const target=e.targetAlly===u&&e.targetLife===u.lifeId;
u.active=false;s.legion.rebuildGrid();s.updateEnemies(1/60,now);const deadReleased=e.targetAlly===null;
u.reset(160,0,'swordsman',1,0);s.legion.rebuildGrid();s.updateEnemies(1/60,now);const reused=e.targetAlly===u&&e.targetLife===u.lifeId;
// A soldier intercepts a contact attack, sharing the enemy's cooldown with the hero.
e.sprite.setPosition(0,0);u.setPosition(0,0);e.contactCd=0;e.stunUntil=0;u.hurtUntil=0;u.hp=u.maxHp;s.player.hp=s.player.maxHp;s.player.invulnUntil=0;u.cooldown=100;s.legion.rebuildGrid();s.rebuildGrid();s.legion.update(.11,now,s.enemies,s.grid,hit);s.applyContactDamage();const intercept=u.hp<u.maxHp&&s.player.hp===s.player.maxHp;
e.contactCd=0;e.stunUntil=now+500;u.hurtUntil=0;const hp=u.hp;s.legion.update(.11,now,s.enemies,s.grid,hit);const stunned=u.hp===hp;
const cavalry=s.spawnEnemy('cavalry',400,0,1,true);s.rebuildGrid();s.updateEnemies(1/60,now);const cavalrySpecial=!cavalry.targetAlly;
return{defaultGuard,sortie,guardX,sortieX,attacked,returned,target,deadReleased,reused,intercept,stunned,cavalrySpecial};});
for(const key of ['defaultGuard','sortie','attacked','returned','target','deadReleased','reused','intercept','stunned','cavalrySpecial'])check(`${chapter}: ${key}`,result[key],result[key]);check(`${chapter}: orders change actual movement`,result.guardX<40&&result.sortieX>250,result);
await p.close();}
check('no page errors',errors.length===0,errors);
}finally{await b.close();mkdirSync('assets/review/guard-sortie',{recursive:true});writeFileSync('assets/review/guard-sortie/checks.json',JSON.stringify(checks,null,2));}console.log(`SUMMARY ${checks.filter(c=>c.ok).length}/${checks.length}`);if(checks.some(c=>!c.ok))process.exitCode=1;
