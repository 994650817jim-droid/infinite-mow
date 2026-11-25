// Capture on the native promotion panel, before a reward changes the build.
export async function installGateCapture(){
  const s=window.__game.scene.getScene('GauntletGameScene'),p=s.player,c=window.armyConfig;
  const C=await import('/src/systems/Campaign.ts');
  window.captureGate=()=>{
    const pack=C.packCampaign(c.hero,p,s.legion,s.followers), copy=v=>JSON.parse(JSON.stringify(v));
    window.gateSnapshot=copy({hero:c.hero,pack,stats:p.stats,life:{hp:p.hp,maxHp:p.maxHp,level:p.level,xp:p.xp,xpNext:p.xpNext,runXp:p.runXp,overflowXp:p.overflowXp},
      weapons:p.weapons,over:p.growth.weaponOver,kit:{gear:s.gGear,charms:s.gCharms,horse:s.gHorse},formations:s.gFormations,order:s.legion.order,
      buildExtra:{extraTags:p.growth.build.extraTags,bonus:p.growth.build.bonus,treasures:p.growth.build.treasures,branchSchool:p.growth.build.branchSchool},
      limited:{reroll:s.gRerollFree,paid:s.gRerollPaid,excludes:s.gExcludes,excluded:[...s.gExcluded]},
      followers:s.gFollowers.map(v=>({boss:v.boss.id,hp:v.f.hp,maxHp:v.f.maxHp,downed:v.f.downed})),soldiers:s.legion.exportState().soldiers,
      gOrder:s.gOrder.map(v=>v.id),roster:{ghost:s.roster.ghost.map(v=>v.id),divine:s.roster.divine.map(v=>v.id)},kills:s.gKills.map(v=>v.id),
      recruits:s.gRecruits,t:s.elapsed,combatNow:s.combatNow,position:[p.x,p.y],growth:Object.fromEntries(Object.entries(p.growth).filter(([k,v])=>['number','boolean','string'].includes(typeof v))),
      purse:s.supplies?.pouch??[],gBuildLog:s.gBuildLog,damage:s.damageDealt,playerDamage:s.playerDamageDealt,allyDamage:s.allyDamageDealt,
      killsTotal:s.kills,pendingLevels:s.pendingLevels,statsLog:s.gStats,stars:[...p.growth.stars],build:p.growth.build.snapshot()});
  };
}
