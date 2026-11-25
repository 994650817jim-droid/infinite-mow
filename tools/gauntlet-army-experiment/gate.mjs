// Paired five-wave fixture. Both arms rebuild the same naturally earned checkpoint on an empty field.
// Active projectiles, hazards, passives and actor attacks restart in both arms.
export async function restoreGate(v) {
  const s=window.__game.scene.getScene('GauntletGameScene'),p=s.player,g=p.growth;
  const [rules,M]=await Promise.all([import('/src/data/gauntlet.ts'),import('/src/data/mythicGauntlet.ts')]);
  const all=[...rules.GAUNTLET_POOL,...M.GHOST_GENERALS,...M.DIVINE_GENERALS];
  const lookup=id=>{const boss=all.find(v=>v.id===id);if(!boss)throw Error('Missing boss '+id);return boss;};
  if(s.runConfig.character!==v.hero)throw Error('Checkpoint hero mismatch');
  for(const e of s.enemies)if(e.active)e.deactivate();
  s.gTier='ghost';s.gWave=15;s.gPhase='clear';s.gMilestones=2;s.gLootShown=true;
  // A naturally defeated gate boss has already spawned; nextWave clears bossKilled but preserves
  // bossSpawned until startBoss. The base chapter timeout checks this flag during the next mow.
  s.bossSpawned=true;s.bossWarned=true;s.bossKilled=true;
  s.gKills=v.kills.map(lookup);s.gCur=s.gKills.at(-1);s.gOrder=v.gOrder.map(lookup);
  s.roster={ghost:v.roster.ghost.map(lookup),divine:v.roster.divine.map(lookup)};
  s.elapsed=v.t;s.combatNow=v.combatNow;s.gAt=s.elapsed;s.kills=v.killsTotal;s.damageDealt=v.damage;
  s.allyDamageDealt=v.allyDamage;s.playerDamageDealt=v.playerDamage;
  p.sprite.setPosition(...v.position);
  s.heroLv=v.life.level;s.heroStartLevel=1;
  Object.assign(p,{level:v.life.level,xp:v.life.xp,xpNext:v.life.xpNext,runXp:v.life.runXp,overflowXp:v.life.overflowXp});
  Object.assign(p.stats,v.pack.player.stats);Object.assign(g,v.growth);
  Object.assign(g.masteries,v.pack.player.growth.masteries);
  g.masteryExtra={...v.pack.player.growth.masteryExtra};
  g.cardStars=true;
  for(const row of v.gBuildLog.filter(x=>x.id.startsWith('gauntlet_star_'))){
    const id=row.id.replace('gauntlet_star_','');
    if(v.stars.includes(id))g.grantCardStar(id);
  }
  g.setStars(v.stars);
  if(g.stars.length!==v.stars.length||v.stars.some(id=>!g.stars.includes(id)))throw Error('Checkpoint star membership mismatch');
  g.stars=[...v.stars];
  p.passive.areaMul=g.areaMultiplier();
  Object.assign(g.attributes,v.pack.player.growth.attributes);
  g.build.restore(v.build);Object.assign(g.build,v.buildExtra);
  p.weapons=v.weapons.map(w=>({...w,cooldownLeft:0}));
  s.gGear=v.kit.gear;s.gCharms=v.kit.charms;s.gHorse=v.kit.horse;s.refreshGear();
  if(s.gHorse)s.equipMount(s.gHorse);
  // statsWithoutCharms followed by refreshGear may vary with store flags. Gate measurements take precedence.
  Object.assign(p.stats,v.stats);p.hp=v.life.hp;
  s.legion.restore(v.pack.army);if(s.legion.order!==v.order)s.legion.cycleOrder();
  s.gRecruits={...v.recruits};s.gStats=v.statsLog;s.gBuildLog=v.gBuildLog;
  s.gFormations=[...v.formations];s.formationRt?.setLoadout(v.formations.slice(0,2));
  for(const saved of v.followers){
    const unit=s.takeFollower(lookup(saved.boss));
    if(!unit)throw Error('Follower failed '+saved.boss);
    unit.hp=saved.hp;
    if(saved.downed)unit.downed=true;
  }
  s.supplies.pouch.splice(0,s.supplies.pouch.length,...v.purse);
  s.gRerollFree=v.limited.reroll;s.gRerollPaid=v.limited.paid;s.gExcludes=v.limited.excludes;s.gExcluded=new Set(v.limited.excluded);
  // Common streams for the regular draws prevent a new arrow or a changed kill time from
  // independently changing all subsequent paid troop types and reward rolls.
  const seed=window.armyConfig.seed;
  for(const [index,key] of ['recruitTroops','upgradeChoices','openLoot'].entries()){
    const original=s[key],count=new Map();
    s[key]=function(...args){
      const indexAtWave=count.get(this.gWave)??0,previous=Math.random;
      Math.random=window.seededRng(seed+this.gWave*16381+index*6203+indexAtWave*7919);
      try { const result=original.apply(this,args);if(key!=='recruitTroops'||result)count.set(this.gWave,indexAtWave+1);return result; }
      finally { Math.random=previous; }
    };
  }
  const startBoss=s.startBoss;
  s.startBoss=function(...args){Math.random=window.seededRng(seed+this.gWave*7901+667);return startBoss.apply(this,args);};
  s.pendingLevels=v.pendingLevels;s.openClearChoice();
  // Combat clock is paused by the native gate. The two branches start subsequent combat with the same PRNG.
  return {hp:p.hp,maxHp:p.maxHp,level:p.level,xp:p.xp,stars:[...g.stars],army:s.legion.count,food:s.legion.food,order:s.legion.order,
    troops:s.legion.exportState().soldiers,weapon:p.weapons,over:g.weaponOver,masteries:g.masteries,attributes:g.attributes,
    build:g.build.snapshot(),kit:s.gauntletKit,followers:s.gFollowers.map(x=>[x.boss.id,x.f.hp]),formation:s.gFormations,
    roster:{ghost:s.roster.ghost.map(x=>x.id),divine:s.roster.divine.map(x=>x.id)},position:[p.x,p.y],timer:s.elapsed};
}

export async function openExperiment(arm){
  const c=window.armyConfig,s=window.__game.scene.getScene('GauntletGameScene'),p=s.player;
  if(!['A','weapon','star','troops'].includes(arm)||s.gWave!==15||s.gTier!=='ghost'||s.roster.ghost.length!==5||s.gPhase!=='choice')throw Error('Incorrect experimental gate');
  const [recruitRules,cards,character,branches,registry,legion]=await Promise.all([import('/src/data/gauntletRecruit.ts'),import('/src/data/upgrades.ts'),import('/src/data/characters.ts'),import('/src/data/weaponBranches.ts'),import('/src/weapons/registry.ts'),import('/src/data/legion.ts')]);
  const {GAUNTLET_RECRUIT,recruitTier}=recruitRules;
  const normalAdvance=s.nextWave;
  let offers=[],selected=null,before,after;
  const status=()=>({stars:[...p.growth.stars],weapon:p.weapons.map(w=>({...w})),over:p.growth.weaponOver,
    soldiers:s.legion.count,food:s.legion.food});
  s.nextWave=function(){
    if(this.gTier!=='divine')throw Error('Gate did not advance to divine');
    this.nextWave=normalAdvance;
    const resume=()=>{
      Math.random=window.seededRng(c.seed+7193);
      normalAdvance.call(this);
    };
    if(arm==='A'){before=after=status();resume();return;}
    Math.random=window.seededRng(c.seed+503);
    const options=[],slots=[];
    const id=character.getCharacter(c.hero).startWeapon,active=p.weapons.find(x=>x.id===id),branch=branches.branchById(active?.branch);
    let weapon=null;
    if(active&&active.level<registry.WEAPON_DEFS[id].maxLevel)weapon=cards.weaponUpgrade(active,p);
    else if(active&&branch&&(active.over??0)<branches.WEAPON_OVER.cap)weapon=cards.overOption(active,branch,c.hero);
    if(weapon&&!this.gExcluded.has(weapon.id)){options.push(weapon);slots.push('weapon');}
    const stars=this.extraCards().map(x=>x.option).filter(x=>x.id.startsWith('gauntlet_star_')&&!p.growth.stars.includes(x.id.replace('gauntlet_star_','')));
    const star=stars.find(x=>x.id.includes(c.build==='command'?'command':c.build==='agility'?'agility':'strength'))??stars[0];
    if(star){options.push(star);slots.push('star');}
    const tier=recruitTier(this.gWave),k=tier.kinds[Math.floor(Math.random()*tier.kinds.length)];
    if(k){
      options.push({id:'experiment_reinforcements',name:'援军 · '+legion.TROOPS[k].name+' ×'+GAUNTLET_RECRUIT.per,desc:'本阵可招兵种，免费增援一队',kind:'foundation',scope:'once',categoryLabel:'援军',icon:'growth_icon_tiger_tally',apply:()=>{
        while(this.legion.levels[k]<tier.level)if(!this.legion.train(k,true))throw Error('Training failed');
        if(!this.legion.recruit(k,GAUNTLET_RECRUIT.per,true))throw Error('Reinforcement failed');
      }});slots.push('troops');
    }
    offers=options.map((x,i)=>({slot:slots[i],id:x.id,name:x.name}));
    let i=slots.indexOf(arm);if(i<0)i=slots.indexOf('star');if(i<0)i=0;
    selected=offers[i];
    this.showLoot('天门定向补强 · 实验','本局额外选一次',options,resume);
    if(!this.upgradeCardShown(i))throw Error('Experiment card unavailable');
    before=status();this.chooseUpgrade(i);after=status();
    if(selected.slot==='star'&&!after.stars.includes(selected.id.replace('gauntlet_star_','')))throw Error('Star grant ineffective');
    if(selected.slot==='weapon'&&JSON.stringify(before.weapon)===JSON.stringify(after.weapon)&&before.over===after.over)throw Error('Weapon grant ineffective');
    if(selected.slot==='troops'&&(after.soldiers-before.soldiers!==3||before.food!==after.food))throw Error('Invalid reinforcement price or count');
  };
  const index=s.upgradeOptions.findIndex(o=>o.id==='gauntlet_divine');
  if(index<0)throw Error('Missing native promotion card');
  s.chooseUpgrade(index);
  if(s.gWave!==16||s.gTier!=='divine')throw Error('Promotion failed');
  return {arm,offers,selected,before,after,field:'empty reconstructed battlefield; transient timers reset in both arms'};
}
