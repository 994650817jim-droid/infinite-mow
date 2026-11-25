import type Phaser from 'phaser';
import { DIVINE_GENERALS, GHOST_GENERALS, mythicArtKey, mythicArtUrl, mythicBoss, type MythicWarning } from '../data/mythicGauntlet';

export { clearMythicWarning, drawMythicWarning } from './MythicTelegraph';
import { preloadMythicTelegraph } from './MythicTelegraph';
import { MYTHIC_RELEASE_CELL, clearMythicSignature, mythicLaneSprite, paintMythicRelease } from './MythicSkillFx';

export { clearMythicSignature } from './MythicSkillFx';

const DEFERRED_ART = ['stride', 'attack', 'cast', 'fx'];

function loadMythicSheet(scene: Phaser.Scene, id: string, action: string, deferred: boolean): void {
  const signature = deferred && action === 'fx';
  const stride = action === 'stride';
  const cell = action === 'walk' || stride ? 176 : signature ? MYTHIC_RELEASE_CELL : 232;
  const url = signature || stride
    ? 'assets/mythic-gauntlet/' + id + (stride ? '-stride.webp' : '-signature.webp')
    : mythicArtUrl(id, action);
  scene.load.spritesheet(mythicArtKey(id, action), url, { frameWidth: cell, frameHeight: cell });
}

const loadedActions=new WeakMap<Phaser.Scene,Set<string>>();

/** Incoming bosses get their art during the approach. Only the current boss's extra sheets stay resident. */
export function prepareMythicActions(scene: Phaser.Scene,id: string): void {
  let pending=loadedActions.get(scene);
  if (!pending) {
    pending=new Set<string>();
    const tracked=pending;
    const finish=()=> {
      tracked.clear();
      if (scene.sys.isActive()) pruneMythicActions(scene,activeActionBoss.get(scene)??'');
    };
    scene.load.on('complete',finish);
    scene.events.once('shutdown',()=> {
      scene.load.off('complete',finish);
      loadedActions.delete(scene);
      activeActionBoss.delete(scene);
      pruneMythicActions(scene,'');
    });
    loadedActions.set(scene,pending);
  }
  activeActionBoss.set(scene,id);
  pruneMythicActions(scene,id);
  if (mythicBoss(id)?.art!=='actions') return;
  let added=false;
  for (const action of DEFERRED_ART) {
    const key=mythicArtKey(id,action);
    if(scene.textures.exists(key)||pending.has(key))continue;
    loadMythicSheet(scene,id,action,true);
    pending.add(key);
    added=true;
  }
  if(added&&!scene.load.isLoading())scene.load.start();
}
const activeActionBoss=new WeakMap<Phaser.Scene,string>();

function pruneMythicActions(scene: Phaser.Scene,id: string): void {
  for(const boss of [...GHOST_GENERALS,...DIVINE_GENERALS]){
    if(boss.id===id||boss.art!=='actions')continue;
    for(const action of DEFERRED_ART){
      const key=mythicArtKey(boss.id,action);
      if(scene.textures.exists(key)) scene.textures.remove(key);
    }
  }
}

export function preloadMythic(scene: Phaser.Scene, includeActions=false): void {
  preloadMythicTelegraph(scene);
  for (const id of ['ghost_guanyu', 'divine_guanyu']) {
    const key = mythicArtKey(id, 'sweep');
    if (!scene.textures.exists(key)) scene.load.spritesheet(key,
      'assets/mythic-gauntlet/' + id + '-sweep-v2.webp', { frameWidth: 256, frameHeight: 256 });
  }
  for (const boss of [...GHOST_GENERALS,...DIVINE_GENERALS]) {
    const actions = boss.art === 'animated' ? ['walk','attack','cast','fall','fx'] :
      includeActions&&boss.art==='actions' ? ['walk',...DEFERRED_ART] : ['walk'];
    for (const action of actions) {
      const key = mythicArtKey(boss.id,action);
      if (scene.textures.exists(key)) continue;
      loadMythicSheet(scene,boss.id,action,boss.art==='actions');
    }
  }
}

export function mythicFacing(angle: number): number {
  const x = Math.cos(angle), y = Math.sin(angle);
  return Math.abs(x)>Math.abs(y) ? (x<0?1:2) : (y<0?3:0);
}

export function poseMythic(sprite: Phaser.GameObjects.Image, id: string, now: number,
  direction: number, moving: boolean, warning?: MythicWarning | null, stepFrame?: number): void {
  const boss = mythicBoss(id);
  if (!boss) return;
  const stepSheet = boss.art === 'actions' && sprite.scene.textures.exists(mythicArtKey(id, 'stride'));
  const walkAction = stepSheet ? 'stride' : 'walk';
  const walkFrame = moving ? (stepFrame ?? Math.floor(now * 9) % 4) : 0;
  let action = walkAction, row = direction, frame = walkFrame;
  if (warning) {
    const aimed = warning.kind==='line'||warning.kind==='sweep';
    row = mythicFacing(aimed ? warning.angle : warning.face);
    if (boss.art === 'animated') {
      const weaponSwing = warning.visual==='blade'||warning.visual==='cross'||warning.kind==='sweep';
      action = weaponSwing ? 'attack' : 'cast';
      if (warning.resolved) {
        const age=Math.max(0,now-warning.endsAt);
        frame=weaponSwing&&age<.075?1:age<.18?2:3;
      } else {
        // The attack sheet's second cel is already a swing. Keep it for the actual hit.
        frame=!weaponSwing&&now>warning.endsAt-.3?1:0;
      }
    } else if (boss.art==='actions'){
      action=warning.action??'cast';
      const age=now-warning.endsAt;
      frame=!warning.resolved?0:age<.17?1:2;
    }
  }
  const poseDirection = row;
  if (!sprite.scene.textures.exists(mythicArtKey(id,action))) {
    action = walkAction;
    row = direction;
    frame = walkFrame;
  }
  const locomotion = action === 'walk' || action === 'stride';
  const staticPose = boss.art !== 'animated' && action === 'walk';
  if (staticPose) { row=0; frame=0; }
  const key=mythicArtKey(id,action);
  if (!sprite.scene.textures.exists(key)) return;
  const columns = boss.art === 'actions' && !locomotion ? 3 : 4;
  const anchor = locomotion ? 168/176 : boss.art === 'actions' ? 208/232 : 216/232;
  const index = row * columns + frame;
  if (sprite.texture.key !== key || Number(sprite.frame.name) !== index) sprite.setTexture(key, index);
  sprite.setOrigin(.5, anchor);
  const size = locomotion ? 144 : 144*232/176;
  const stride = staticPose&&moving ? Math.sin(now*24)*.014 : 0;
  let recoil = 0;
  if(staticPose&&warning){
    const releaseAge=Math.max(0,now-warning.endsAt);
    const charge=Math.min(1,Math.max(0,(now-warning.startsAt)/(warning.endsAt-warning.startsAt)));
    recoil=warning.resolved?.055*Math.max(0,1-releaseAge/.23):-.012-.026*charge;
  }
  sprite.setDisplaySize(size*(1+recoil),size*(1+stride-recoil));
  sprite.setRotation(staticPose?(recoil+stride)*(poseDirection===1?-1:1):0);
  sprite.setFlipX(staticPose&&poseDirection===1);
}

/** Signature art follows the resolved attack using the shared battle clock. */
export function paintMythicSignature(sprite: Phaser.GameObjects.Image, id: string, w: MythicWarning | null, now: number, owner?: {x:number;y:number}): void {
  const boss = mythicBoss(id), key = mythicArtKey(id,'fx');
  clearMythicSignature(sprite);
  if (!boss || w?.wind || (w?.charge && (!w.halberd?.locked || w.resolved)) || w?.transit?.harmless || (w?.closing && w.constellation?.broken) || !sprite.scene.textures.exists(key)) return;
  if (w?.resolved && w.kind === 'sweep' && (id === 'ghost_guanyu' || id === 'divine_guanyu')) {
    const sweepKey = mythicArtKey(id, 'sweep');
    if (sprite.scene.textures.exists(sweepKey)) {
      const age = now - w.endsAt;
      if (age >= 0 && age < .32) {
        const frame = Math.min(7, Math.floor(age / .04));
        // The baked fan pivots at (42,128). Its outer ellipse maps to the attack radius.
        sprite.setTexture(sweepKey, frame).setVisible(true).setOrigin(42 / 256, .5)
          .setPosition(w.x, w.y)
          .setDisplaySize(w.radius * 256 / 174, w.radius * 256 / 174).setRotation(w.angle).setAlpha(Math.min(1, (.32-age)/.045)).setDepth(75);
      }
      return;
    }
  }
  // Parallel arrow lanes have their own releases; keep the open shield gap readable.
  if (w?.wei) return;
  if (boss.art === 'actions') {
    if (w?.resolved) paintMythicRelease(sprite, key, w, now - w.endsAt);
    return;
  }
  if (boss.art !== 'animated') return;
  if (!w?.resolved) {
    if (w && boss.tierName==='divine'&&owner) sprite.setTexture(key,2).setVisible(true).setOrigin(.5)
      .setPosition(owner.x,owner.y-96).setDisplaySize(120,120).setRotation(0).setAlpha(.65).setDepth(10);
    return;
  }
  const age=now-w.endsAt;
  if (age < 0 || age >= .32) return;
  const visual=w.visual ?? (boss.tierName==='ghost'?'blade':'cross');
  // Sample a drawn impact immediately. Frame zero is the tiny pre-release glint.
  const frame=age<.065?1:age<.22?2:3;
  const alpha=age<.23 ? 1 : Math.max(0,1-(age-.23)/.09);
  if(visual==='seal'){
    // Place the seals on the damaging annulus, leaving its safe centre readable.
    const inner = w.innerRadius ?? 0, reach = (inner + w.radius) / 2;
    const size = (w.radius - inner) * .85;
    for (let i = 0; i < 4; i++) {
      const a = w.angle + i * Math.PI / 2;
      mythicLaneSprite(sprite,key,i).setTexture(key,age<.11?2:3).setVisible(true).setOrigin(.5)
        .setPosition(w.x+Math.cos(a)*reach,w.y+Math.sin(a)*reach).setDisplaySize(size,size)
        .setDepth(75).setRotation(0).setAlpha(alpha);
    }
    return;
  }
  const isDragon=visual==='dragon';
  const split=(w.lanes??1)>1;
  const range=isDragon ? Math.min(118,w.radius*.42) : split ? w.radius * .56 : Math.min(73,w.radius*.42);
  const size=isDragon ? Math.min(212,w.radius*.76) : split ? 108 : Math.min(176,w.radius*1.09);
  const frameOffset=isDragon?0:4;
  const lanes = w.lanes ?? 1;
  for (let i = 0; i < lanes; i++) {
    const heading = w.angle + (i - (lanes - 1) / 2) * (w.spread ?? 0);
    mythicLaneSprite(sprite, key, i).setTexture(key,frameOffset+frame).setVisible(true).setOrigin(.5)
      .setPosition(w.x + Math.cos(heading)*range, w.y + Math.sin(heading)*range - (split ? 0 : 20))
      .setDisplaySize(size,size).setDepth(75).setRotation(heading).setAlpha(alpha);
  }
}
