import {chromium} from 'playwright';import{mkdirSync,writeFileSync}from'node:fs';const b=await chromium.launch({channel:'chrome',headless:true}),results=[];mkdirSync('assets/review/phase20a',{recursive:true});const ck=(name,ok)=>{results.push({name,ok});console.log(ok?'PASS':'FAIL',name);if(!ok)process.exitCode=1;};
try{const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.BASE??'http://127.0.0.1:5173/')+'?dev=1&autostart=1&layout=mobile');await p.waitForFunction(()=>window.__game?.scene.isActive('GameScene'));
const tests=await p.evaluate(async()=>{const {BuildState,TACTICS,TREASURES}=await import('/src/data/builds.ts'),{BuildCombat}=await import('/src/systems/BuildCombat.ts'),{RunGrowth,MARTIALS}=await import('/src/systems/RunGrowth.ts'),{buildUpgradeOptions}=await import('/src/data/upgrades.ts');const checks=[];const ck=(name,ok)=>{checks.push({name,ok:!!ok});};const enemy=(id=1,kind='infantry')=>({x:id*10,y:0,spawnId:id,active:true,isSupplySlot:false,kind});const setup=(id,level)=>{const s=new BuildState();s.tactics[id]=level;const e=enemy(),other=enemy(2),hits=[];const c=new BuildCombat(s,()=>[e,other],(e,n,f)=>hits.push({id:e.spawnId,n,f}),()=>{});return{s,c,e,other,hits};};
/* 2026-11-15：内容已扩充为 25 战法 / 13 宝物 */ck('content_12_tactics_6_treasures',Object.keys(TACTICS).length>=12&&Object.keys(TREASURES).length>=6);
for(let level=1;level<=3;level++){
 let t=setup('pursuit',level);for(let i=0;i<[6,5,4][level-1];i++)t.c.onHit(t.e,100,false,1000);ck('pursuit_'+level,t.hits.length===1&&t.hits[0].n===[25,35,45][level-1]);
 t=setup('chain',level);t.c.onHit(t.e,100,false,1000);ck('chain_'+level,Math.abs(t.c.damage(t.e,100,false,1100)-(101+level))<.001);
 t=setup('momentum',level);t.c.onKill(t.e,1000);/* 2026-11-19 流派重做：乘胜 +4/6/8% */ck('momentum_'+level,Math.abs(t.c.damage(t.other,100,false,1100)-[104,106,108][level-1])<.001);
 t=setup('eagle',level);/* 鹰眼 +5/8/12%；2 级起弓弩到 2 势「神射」再 +8% */ck('eagle_'+level,Math.abs(t.c.criticalBonus()-[.05,.16,.20][level-1])<1e-9);
 t=setup('sunder',level);t.c.onHit(t.e,100,true,1000);/* 断金破甲 +8/12/15% */ck('sunder_'+level,Math.abs(t.c.damage(t.e,100,false,1100)-[108,112,115][level-1])<.001);
 t=setup('reap',level);t.e.kind='boss';ck('reap_'+level,Math.abs(t.c.damage(t.e,100,true,1100)-[110,115,120][level-1])<.001);
 t=setup('windstep',level);t.c.movement(120);ck('windstep_'+level,Math.abs(t.c.damage(t.e,100,false,1000)-[110,115,120][level-1])<.001&&t.c.damage(t.e,100,false,1100)===100);
 t=setup('flank',level);t.c.movement([200,170,140][level-1]);t.c.onHit(t.e,100,false,1000);ck('flank_'+level,t.hits.length===1&&Math.abs(t.hits[0].n-[35,45,55][level-1])<.001);
 t=setup('swift',level);t.c.movement(2);ck('swift_'+level,t.c.criticalBonus()===[.03,.05,.07][level-1]);
 t=setup('ember',level);const random=Math.random;Math.random=()=>0;t.c.onHit(t.e,100,false,1000);Math.random=random;t.c.update(1499);const before=t.hits.length;t.c.update(1500);t.c.update(1500);/* 2 级起火攻到 2 势「火势」：火伤 +15% */ck('ember_tick_'+level,before===0&&t.hits.length===1&&Math.abs(t.hits[0].n-(level>=2?11.5:10))<1e-9);
 t=setup('spread',level);t.s.treasures=['wildfire_lamp'];t.c.onHit(t.e,100,false,1000);t.c.onKill(t.e,1001);t.e.active=false;t.c.update(1501);ck('spread_'+level,t.hits.some(h=>h.id===2));
 t=setup('hotwind',level);t.s.treasures=['wildfire_lamp'];t.c.onHit(t.e,100,false,1000);/* 焚风 +15/22/30%（流派重做：旧「2 件 +5%」取消） */ck('hotwind_'+level,Math.abs(t.c.damage(t.e,100,false,1100)-[115,122,130][level-1])<.001);
}
for(const [treasure,count]of[['soul_bell',8],['breaker_jade',10]]){const t=setup('chain',0);t.s.treasures=[treasure];for(let i=0;i<count;i++)t.c.onHit(t.e,100,false,1000);ck('treasure_'+treasure,t.hits.length===1);}
let t=setup('chain',0);t.s.treasures=['slayer_tally'];t.e.kind='boss';t.c.onHit(t.e,100,true,1000);t.c.onHit(t.e,100,true,1000);ck('slayer_cooldown',t.hits.length===1&&t.hits[0].n===25);
t=setup('chain',0);t.s.treasures=['horse_order'];t.c.movement(150);t.c.onHit(t.e,100,false,1000);ck('horse_order',t.hits.length===1&&t.hits[0].n===25);
t=setup('chain',0);t.s.treasures=['wildfire_lamp'];t.c.onHit(t.e,100,false,1000);t.c.update(1500);ck('lamp_burn',t.hits.length===1&&t.hits[0].f);
t=setup('ember',3);t.s.treasures=['wildfire_lamp'];t.c.onHit(t.e,100,false,1000);t.e.spawnId=999;t.c.update(1500);ck('pool_reuse_no_burn',t.hits.length===0);
const six=Object.keys(TACTICS).slice(0,6),rest=Object.keys(TACTICS).slice(6);const cap=new BuildState();six.forEach(id=>{cap.learn(id);cap.learn(id);cap.learn(id);});ck('six_slots_and_level_cap',!cap.learn(six[0])&&!cap.learn(rest[0])&&Object.keys(cap.tactics).length===6);const data=cap.snapshot();data.tactics[six[0]]=1;ck('snapshot_independent',cap.level(six[0])===3);
/* 流派重做：势 = 本派战法等级之和（升级也算） */{const want={};for(const id of six){const g=TACTICS[id].tag;want[g]=(want[g]??0)+3;}ck('tags_shi_sum_of_levels',Object.entries(want).every(([g,n])=>cap.tags()[g]===n));}
for(let level=1;level<=3;level++){
 const state=new BuildState();state.tactics.ember=1;state.tactics.spread=level;
 const enemies=[enemy(1),enemy(2),enemy(3),enemy(4),enemy(5)];const damage=[];
 const c=new BuildCombat(state,()=>enemies,(e,n)=>damage.push(e.spawnId),()=>{});
 const random=Math.random;Math.random=()=>0;c.onHit(enemies[0],100,false,1000);Math.random=random;
 c.onKill(enemies[0],1001);enemies[0].active=false;c.update(1501);
 ck('spread_target_count_'+level,damage.length===level);
 const before=c.burns.size;c.onKill(enemies[1],1600);enemies[1].active=false;
 ck('spread_no_recursive_'+level,c.burns.size===before-1);
 /* 流派重做：灼烧 3 秒、火攻 2 势再 +1 秒 */c.update(6000);ck('burn_expiry_cleanup_'+level,c.burns.size===0);
}
const bounded=new BuildState();bounded.treasures=['wildfire_lamp'];const burner=new BuildCombat(bounded,()=>[],()=>{},()=>{});for(let i=0;i<200;i++)burner.onHit(enemy(i+10),10,false,1000);ck('burn_pool_bounded',burner.burns.size===160);
const scene=window.__game.scene.getScene('GameScene'),player=scene.player;for(const hero of['zhaoyun','guanyu','huangzhong','zhuge']){const g=new RunGrowth(hero);player.growth=g;let valid=true;for(let i=0;i<200;i++){const opts=buildUpgradeOptions(player,player.weapons,g);valid&&=opts.length===3&&new Set(opts.map(o=>o.id)).size===3&&opts.some(o=>['weapon','martial','attribute','foundation'].includes(o.kind))&&!opts.some(o=>o.kind==='potion');const own=opts.find(o=>o.kind==='martial');if(own){own.apply(player,player.weapons,g);valid&&=Object.entries(g.masteries).every(([id,n])=>!n||MARTIALS[id]?.character===hero/* 2026-11-17：按 RunGrowth.MARTIALS 归属判断（黄忠武学已换成静心 / 老骥伏枥） */);}}ck('upgrade_pool_'+hero,valid);}
return checks;});for(const t of tests)ck(t.name,t.ok);ck('browser_errors',errors.length===0);await p.close();
}finally{await b.close();writeFileSync('assets/review/phase20a/results.json',JSON.stringify(results,null,2));}console.log('SUMMARY',results.filter(r=>r.ok).length+'/'+results.length);
