// Combat input policy adapted from the recorded natural standard run.
export async function attachDriver(){
    const s=window.__game.scene.getScene('GauntletGameScene'),p=s.player;
    const {heroUnlocked,UNLOCK_RULES,realProgress}=await import('/src/systems/HeroUnlocks.ts');
    const {STARTER_HEROES}=await import('/src/data/heroUnlocks.ts');
    const cfg=window.armyConfig;
    const allowed=STARTER_HEROES.includes(cfg.hero)||UNLOCK_RULES[cfg.hero]?.(realProgress());
    if(!allowed||!heroUnlocked(cfg.hero,false)||s.runConfig.character!==cfg.hero||s.roster.ghost.length!==(cfg.route==='extreme'?10:5))throw Error('Wrong starting hero or route');
    const opening={x:p.x,y:p.y}, held=new Set(), rows=[], picks=[], recruits=[], medicine=[], transitions=[], hits=[], attrs=[];
    const r=x=>Math.round(x*100)/100, dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const now=()=>r(s.elapsed);
    const state=()=>({time:now(),wave:s.gWave,tier:s.gTier,phase:s.gPhase,boss:s.gCur?.name??null,bossHp:s.boss?.active?r(s.boss.hp):null,
      hp:r(p.hp),maxHp:p.maxHp,level:p.level,xp:r(p.xp),armor:r(p.stats.armor),speed:r(p.speed),damage:r(s.damageDealt),kills:s.kills,
      hero:p.growth.character,weapon:p.weapons.map(w=>[w.id,w.level,w.branch??null]),overlevels:Object.fromEntries(p.weapons.map(w=>[w.id,w.over??0])),stars:[...p.growth.stars],attributes:{...p.growth.attributes},
      army:s.legion.count,fallen:s.legion.dead,food:s.legion.food,recruits:s.gRecruits.men,followers:s.gFollowers.length,
      position:[r(p.x),r(p.y)],cleared:s.gKills.length,milestones:s.gMilestones,revivalUsed:p.growth.revivalUsed===true,
      gameOver:s.over,alive:p.alive,mode:s.mode,timescale:s.time.timeScale});
    const codes={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,KeyC:67};
    function key(code,down){
      window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key:code==='KeyC'?'c':code,code,keyCode:codes[code],which:codes[code],bubbles:true,cancelable:true}));
    }
    function move(dx,dy){
      const next=new Set([dx>0?'ArrowRight':dx<0?'ArrowLeft':'',dy>0?'ArrowDown':dy<0?'ArrowUp':''].filter(Boolean));
      for(const k of held)if(!next.has(k))key(k,false);
      for(const k of next)if(!held.has(k))key(k,true);
      held.clear();for(const k of next)held.add(k);
    }
    const safeOption=o=>!String(o.id).includes('reviv')&&!/复活|死而复生/.test(o.name+' '+o.desc);
    const armyOption=o=>o.id==='mythic_soldier_purse'||o.id.startsWith('gauntlet_star_command.')||/部曲|军阵|统御|招兵|援军|亲兵/.test(o.name+' '+o.desc);
    function choose(){
      const options=s.upgradeOptions.filter((o,i)=>safeOption(o)&&s.upgradeCardShown(i));
      if(!options.length)return;
      const score=o=>{
        if(s.gPhase!=='choice'&&cfg.build==='army'&&armyOption(o))return 320;
        if(s.gPhase!=='choice'&&cfg.build==='personal'&&armyOption(o))return -20;
        const id=o.id,description=o.name+' '+o.desc; if(s.gPhase!=='choice'&&window.armyConfig.build==='command'&&/部曲|军阵|统御/.test(description)&&id!=='mythic_soldier_purse')return 215; if(s.gPhase!=='choice'&&window.armyConfig.build==='agility'&&/移动速度|移速|冷却|攻速|追风/.test(description))return 211;
        if(s.gPhase==='choice')return id===(s.gTier==='mortal'?'gauntlet_ghost':s.gTier==='ghost'?'gauntlet_divine':'gauntlet_settle')?1e5:0;
        if(id==='gauntlet_spoils')return p.hp/p.maxHp<.57?300:25;
        if(id==='gauntlet_follow')return s.gFollowers.length<3?260:0;
        if(id.startsWith('signature_weapon_')||id==='gauntlet_qiyu_weapon')return 205;
        if(/移速|移动速度/.test(description)&&p.stats.moveMul<1.22)return 190;
        if(/吸血|回血|回复生命/.test(description))return 160;
        if(id.startsWith('weapon_over_'))return 150;
        if(/减伤|护甲|格挡/.test(description))return 130;
        if(/冷却|攻速|攻击速度/.test(description))return 120;
        if(id.startsWith('gauntlet_star_'))return 110;
        if(id.startsWith('martial_'))return 100;
        return 40;
      };
      const best=options.reduce((a,b)=>score(a)>=score(b)?a:b);
      picks.push({time:now(),wave:s.gWave,choice:best.id,name:best.name,offered:options.map(o=>o.id),armyOffered:options.filter(armyOption).map(o=>o.id),armyChosen:armyOption(best)});
      s.chooseUpgrade(s.upgradeOptions.indexOf(best));
    }
    function threatened(h,q){
      const dx=q.x-h.x,dy=q.y-h.y,d=Math.hypot(dx,dy);
      if(h.kind==='circle')return d<h.r+12&&d>(h.inner??0)-12;
      const c=Math.cos(h.angle??0),sn=Math.sin(h.angle??0);
      if(h.kind==='lane')return dx*c+dy*sn>=-12&&dx*c+dy*sn<=h.len+12&&Math.abs(-dx*sn+dy*c)<h.width*.5+12;
      if(h.kind==='sector')return d<h.r+12&&dx*c+dy*sn>d*Math.cos(h.arc*.5+.1);
      return false;
    }
    let prevDx=1,prevDy=0,lastSample=-100,lastState='',lastHp=p.hp,lastAttribute=-30,ticks=0,steered=0;
    const inspect=()=>{
      const h=state();
      if(lastState!==[h.wave,h.phase].join('/')||h.gameOver){transitions.push(h);lastState=[h.wave,h.phase].join('/');}
      if(h.time-lastSample>=5||h.gameOver){rows.push(h);lastSample=h.time;}
      if(h.hp<lastHp-.05)hits.push({time:h.time,wave:h.wave,hp:h.hp,delta:r(h.hp-lastHp),boss:h.boss,nearest:Math.round(Math.min(999,...s.enemies.filter(e=>e.active&&!e.isSupplySlot).map(e=>dist(e,p))))});
      lastHp=h.hp;return h;
    };
    function steer(){
      const foes=s.enemies.filter(e=>e.active&&!e.isSupplySlot&&e.hp>0&&dist(p,e)<420);
      const loot=s.gems.filter(g=>g.active && g.phase!=='fly').map(g=>g.img).filter(q=>dist(p,q)<340);
      const pots=(s.supplies?.potions??[]).filter(v=>v.active).map(v=>v.image).filter(q=>dist(p,q)<430);
      const boss=s.boss?.active?s.boss:null;
      const hazards=[...(s.gCtrl?.hazards??[]),...(s.gEscort?.ctrl?.hazards??[])].filter(h=>h.shape&&h.from<=s.combatNow&&!h.hit);
      for(const h of s.gStrikes?.list??[])hazards.push({shape:{kind:'circle',x:h.x,y:h.y,r:h.r}});
      for(const h of s.gBandCells??[])if(h.at-s.combatNow<1100)hazards.push({shape:{kind:'circle',x:h.x,y:h.y,r:s.gCur?.fireBand?.r??65}});
      let best=-Infinity,winner=[1,0];
      for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
        if(!dx&&!dy)continue;
        const mag=Math.hypot(dx,dy),ux=dx/mag,uy=dy/mag;
        let score=9*(prevDx*ux+prevDy*uy);
        for(const [seconds,w] of [[.25,.8],[.55,1],[.95,.6]]){
          const q={x:p.x+ux*p.speed*seconds,y:p.y+uy*p.speed*seconds};
          if(s.arena&&!s.arena.inside(q.x,q.y,p.radius+6))score-=1200*w;
          if(!s.legion.navigation.clearSegment(p.x,p.y,q.x,q.y,p.radius))score-=1020*w;
          let closest=999;
          for(const e of foes){
            const predicted={x:e.x+(e.moveVx??0)*seconds*.65,y:e.y+(e.moveVy??0)*seconds*.65};
            const clearance=dist(q,predicted)-(e.radius??15)-(p.radius??10);
            closest=Math.min(closest,clearance);
            if(clearance<68)score-=w*(68-clearance)*(e.kind==='boss'?7:2.6);
            if(clearance<10)score-=w*260;
          }
          if(boss)score-=w*Math.abs(dist(q,boss)-175)*.75;
          else{
            if(foes.length)score-=w*Math.max(0,closest-150)*.68;
            score-=w*Math.max(0,dist(q,opening)-340)*.08;
          }
          if(loot.length)score-=w*Math.min(230,Math.min(...loot.map(g=>dist(q,g))))*.32;
          if(pots.length&&p.hp/p.maxHp<.85)score-=w*Math.min(300,Math.min(...pots.map(g=>dist(q,g))))*.9;
          for(const h of hazards)if(threatened(h.shape,q))score-=340*w;
        }
        if(score>best){best=score;winner=[dx,dy];}
      }
      const mag=Math.hypot(...winner);prevDx=winner[0]/mag;prevDy=winner[1]/mag;move(...winner);steered++;
    }
    function drive(){
      if(window.qaPaused)return; ticks++;const st=inspect();
      if(st.gameOver||!p.alive){move(0,0);clearInterval(timer);return;}
      if(st.revivalUsed)throw Error('Unexpected revival');
      if(s.mode==='levelup'||s.mode==='bossloot'){move(0,0);if(!cfg.gateFile&&cfg.route!=='extreme'&&s.gPhase==='choice'&&s.gWave===15&&!window.gateSnapshot)window.captureGate();choose();return;}
      if(s.mode==='branch'){move(0,0);s.chooseBranch(0);return;}
      if(s.mode==='attributes'){
        const panel=s.starPanel;
        if(!panel?.root?.visible)throw Error('Expected visible star map');
        const choices=[...panel.nodes.values()].filter(n=>n.hit.input?.enabled&&!panel.block(n.n.id));
        const focus=cfg.build==='army'?'command':cfg.build==='personal'?'strength':null;
        const rank=n=>focus?(n.region===focus?100:0)+(n.kind==='keystone'?7:n.kind==='notable'?5:1):
          n.kind==='keystone'?70:n.kind==='notable'?50:n.region===(cfg.build==='weapon'?'strength':cfg.build)?35:n.region==='strength'?32:10;
        const best=choices.sort((a,b)=>rank(b.n)-rank(a.n))[0];
        if(best){
          const before=p.growth.unallocated;
          best.hit.emit('pointerup',s.input.activePointer);
          const light=panel.root.getByName('star-map-light');
          if(!light?.input?.enabled)throw Error('Selected star has no enabled confirmation');
          light.emit('pointerup',s.input.activePointer);
          if(!p.growth.stars.includes(best.n.id)||p.growth.unallocated!==before-1)throw Error('UI did not spend one point');
          attrs.push({time:now(),wave:s.gWave,id:best.n.id,pointsBefore:before,pointsAfter:p.growth.unallocated});
        }
        key('KeyC',true);key('KeyC',false);return;
      }
      if(s.mode!=='none')return; window.applyArmyOrder();
      if(p.growth.unallocated>0&&s.elapsed-lastAttribute>2){lastAttribute=s.elapsed;key('KeyC',true);key('KeyC',false);}
      if(cfg.build!=='personal'&&s.recruitOpen()&&s.legion.count<25){
        const before=s.legion.food;
        if(s.recruitTroops())recruits.push({time:now(),wave:s.gWave,before,after:s.legion.food,army:s.legion.count});
      }
      if(s.supplies?.canUsePotion&&p.hp<p.maxHp*.79){const held=s.supplies.pouch.length;s.usePotion();
        if(held>s.supplies.pouch.length)medicine.push({time:now(),wave:s.gWave,hp:p.hp});}
      steer();
    }
    const beginning=state();
    let fault;
    const timer=setInterval(()=>{try{drive();}catch(err){fault=String(err.stack??err);clearInterval(timer);move(0,0);}},110);
    window.challengeState=()=>({beginning,current:state(),rows,transitions,hits,picks,recruits,medicine,attrs,ticks,steered,fault,
      randomLineup:s.gOrder.map(b=>b.id),roster:{mortal:s.gOrder.map(b=>b.id),ghost:s.roster.ghost.map(b=>b.id??b),divine:s.roster.divine.map(b=>b.id??b)}});
}
