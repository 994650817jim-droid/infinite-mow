import { chromium } from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok,detail}); console.log(ok?'PASS':'FAIL',name,JSON.stringify(detail??''));};
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const chapter of ['huangjin','hulao']) {
await page.goto(`http://127.0.0.1:5173/?dev=1&autostart=1&chapter=${chapter}`); await page.waitForFunction(()=>!!window.__IM);
const result=await page.evaluate(()=>{
const s=window.__game.scene.getScene('GameScene');s.spawnTimer=s.eliteTimer=1e8;s.player.weapons=[];s.scene.pause();const p=s.player,now=s.combatNow+1000;
p.stats.regen=0;p.hp=p.maxHp;p.invulnUntil=0;
p.takeDamage(10,now);const hp=p.hp;
s.__DEV_ACTIONS.god();const enabled=p.damageImmune,blocked=!p.takeDamage(30,now+10000)&&p.hp===hp;
s.__DEV_ACTIONS.god();const disabled=!p.damageImmune,damage=p.takeDamage(10,now+20000)&&p.hp<hp;
s.__DEV_ACTIONS.god();s.__DEV_ACTIONS.god();const info=window.__DEV_INFO();
s.legion.recruit('swordsman',1,true);const u=s.allies[0];u.attach(u.constructor.makeView(s));
const directions=[];for(const [x,y] of [[100,-100],[-100,-100],[-100,100],[100,100]]) {u.reset(0,0,'swordsman',1,0);for(let i=0;i<20;i++){u.beginStep();u.moveTo(x,y,1/60,150);u.render(now);}directions.push({x,y,dir:u.dir,frame:u.view.sprite.frame.name,dist:Math.hypot(u.x,u.y)});}
u.beginStep();u.moveTo(u.x,u.y,1/60,150);u.render(now);const idle=u.view.sprite.frame.name.endsWith('_0');
const simulate=fps=>{u.reset(0,0,'swordsman',1,0);for(let i=0;i<fps;i++){u.beginStep();u.moveTo(1000,0,1/fps,150);}return u.x;};const fps=[30,60,120].map(simulate);
u.reset(0,0,'swordsman',1,0);for(let i=0;i<180;i++){u.beginStep();u.moveTo(10,0,1/60,150);}const arrive=u.x;
u.reset(0,0,'swordsman',1,0);u.beginStep();u.moveTo(100,0,1/60,150);u.beginStep();u.moveTo(-100,0,1/60,150);u.render(now);const reverse=u.dir==='left';
u.reset(0,0,'swordsman',1,0);u.act(-100,0,now,300);u.beginStep();u.render(now+100);const attack=u.view.sprite.frame.name.startsWith('atk_left');
u.reset(0,0,'swordsman',1,0);const reset=u.walked===0&&!u.moving;
return {enabled,blocked,disabled,damage,info,directions,idle,fps,arrive,reverse,attack,reset};});
check(`${chapter}: god after being hurt`,result.enabled&&result.blocked,result);
check(`${chapter}: god can turn off`,result.disabled&&result.damage);
check(`${chapter}: diagonal faces travel`,result.directions.every(d=>d.y<0?d.dir==='up':d.dir==='down'));
check(`${chapter}: idle frame`,result.idle);
check(`${chapter}: 30/60/120 movement same`,result.fps.every(x=>Math.abs(x-150)<.001),result.fps);
check(`${chapter}: arrives without overshoot`,result.arrive>=7.9&&result.arrive<=8.01,result.arrive);
check(`${chapter}: reversal faces immediately`,result.reverse);
check(`${chapter}: attack remains attack`,result.attack);
check(`${chapter}: pool resets walk state`,result.reset);
await page.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.scene.resume();s.scene.restart();});await page.waitForTimeout(350);
check(`${chapter}: restart clears god`,await page.evaluate(()=>!window.__game.scene.getScene('GameScene').player.damageImmune));
await page.evaluate(()=>{const s=window.__game.scene.getScene('GameScene');s.spawnTimer=s.eliteTimer=1e8;s.player.weapons=[];for(const kind of ['swordsman','spearman','archer','crossbowman','guardian','rider','halberdier','medic'])s.legion.recruit(kind,2,true);});
await page.keyboard.down('d');await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('d');await page.keyboard.up('w');await page.waitForTimeout(500);
check(`${chapter}: actual movement finite`,await page.evaluate(()=>window.__game.scene.getScene('GameScene').allies.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y))));
}
check('no browser errors',errors.length===0,errors);
}finally {await browser.close();mkdirSync('assets/review/ally-follow',{recursive:true});writeFileSync('assets/review/ally-follow/checks.json',JSON.stringify(checks,null,2));}
console.log(`SUMMARY ${checks.filter(c=>c.ok).length}/${checks.length}`);if(checks.some(c=>!c.ok))process.exitCode=1;
