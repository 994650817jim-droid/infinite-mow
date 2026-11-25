import {CINDERS,EMBER} from '../rules/burning';
import {CoopRetinueView,preloadCompany} from '../coop/CoopRetinueView';
import { drawMortalWarning } from '../systems/MythicTelegraph';
import { loadSurvivorBossFx, playSurvivorBossFx, updateSurvivorBossFx, clearSurvivorBossFx } from '../systems/SurvivorBossFx';
import Phaser from 'phaser';
import { SnapshotTimeline, type BattleSnapshot } from '../coop/SnapshotTimeline';
import { GAME_WIDTH, GAME_HEIGHT, IS_DESKTOP } from '../config';
import { Joystick } from '../ui/Joystick';
import { coopSocketUrl, type Fighter, type Foe, type ServerMessage, type Side, type CoopMode, type BossWarning, type PartyMember } from '../coop/protocol';
import world from '../coop/arena.json';
import gauntlet from '../coop/gauntlet.json';
import { challengeWave, mythicArtKey, mythicBoss, tierTitle, type MythicWarning } from '../data/mythicGauntlet';
import { walkRow } from '../systems/GroundMotion';
import { preloadMythic, prepareMythicActions, mythicFacing, poseMythic, clearMythicSignature, clearMythicWarning, drawMythicWarning, paintMythicSignature } from '../systems/MythicArt';
import { GAUNTLET_NAME } from '../data/gauntlet';
import { CHARACTERS, getCharacter, type CharacterId } from '../data/characters';
import { heroUnlocked } from '../systems/HeroUnlocks';
import roster from '../coop/roster.json';
import { buildRecolor } from '../systems/IffOverlay';
import { ART_V2_FILES } from '../systems/ArtStyle';
import { FIELD_STARS, MARK_STAR, COMPANY_STARS } from '../data/coopStars';
const networkStars=[...FIELD_STARS,MARK_STAR,...COMPANY_STARS,CINDERS];

type ActorView = { body: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; tx: number; ty: number; strike: number; walkFacing?: number; walkPhase?: number; walkStride?: number };
const TROOPS: Record<string, {name:string;art:{walk:string;attack:string;cell:number}}> = roster.types;
const BOSS_SHEETS: Record<string, string[]> = gauntlet.bosses;
const ATTACK_SHEETS: Readonly<Record<string, string>> = {
  zhangliang: 'yellow_zhangliang_attack', zhangbao: 'yellow_zhangbao_cast', zhangjiao: 'zhangjiao_cast', huaxiong: 'huaxiong_attack', lubu: 'lubu_attack',
};
const REWARDS = new Map([...gauntlet.rewards, ...networkStars.map(s=>({...s,name:'将星 · '+s.name})), {id:EMBER.id,name:'火种',detail:'本命命中点燃敌军，每半秒结算一次。'}, { id: 'heal', name: '整备', detail: '回复 45% 最大生命' }].map(reward => [reward.id, reward]));

export class CoopScene extends Phaser.Scene {
  private panel!: HTMLElement;
  private status!: HTMLElement;
  private socket?: WebSocket;
  private connectionTimer?: number;
  private retryTimer?: number;
  private retryUntil = 0;
  private resumeSession?: { code: string; token: string; graceMs: number };
  private connectionBlocked = false;
  private connectionNotice?: HTMLElement;
  private arena?: Phaser.GameObjects.TileSprite;
  private keyset?: Record<string, Phaser.Input.Keyboard.Key>;
  private stick?: Joystick;
  private hp?: Phaser.GameObjects.Text;
  private score?: Phaser.GameObjects.Text;
  private partyBars?: Phaser.GameObjects.Graphics;
  private movementAt = 0;
  private timeline = new SnapshotTimeline();
  private displayed?: BattleSnapshot;
  private slot: Side = 0;
  private phase: 'setup' | 'lobby' | 'battle' | 'draft' | 'result' = 'setup';
  private readonly companyView=new CoopRetinueView();
  private companyOrder?:HTMLButtonElement;
  private fighters = new Map<Side, ActorView>();
  private foes = new Map<number, ActorView>();
  private marks: Phaser.GameObjects.Line[] = [];
  private troopFx?: Phaser.GameObjects.Graphics;
  private readonly troopTextures = new Set<string>();
  private warning?: Phaser.GameObjects.Graphics;
  private generalTexture?: string;
  private mythicSignature?: Phaser.GameObjects.Image;
  private mythicClock = 0;
  private preparedMythic = '';
  private mythicId = '';
  private mythicCue: MythicWarning | null = null;
  private generalTextures = new Set<string>();
  private readonly heroTextures = new Set<string>();
  private availableHeroes: CharacterId[] = [];

  constructor() { super('CoopScene'); }

  private lastBossFx = '';
  preload(): void {
    preloadCompany(this);
    preloadMythic(this);
    loadSurvivorBossFx(this);
    // Small standalone bundle; the home scene may have skipped the main battle preload.
    if (!this.textures.exists('coop_foe')) {
      this.load.spritesheet('coop_foe', 'assets/processed/enemy_infantry_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    }
    if (!this.textures.exists('coop_ground')) this.load.image('coop_ground', 'assets/processed/yellow/ground-1.png');
  }

  create(): void {
    this.lastBossFx = '';
    this.timeline.clear(); this.displayed=undefined;
    this.phase = 'setup';
    this.movementAt = 0;
    this.fighters.clear();
    this.troopTextures.clear();
    this.foes.clear();this.companyView.clear();this.companyOrder=undefined;
    this.generalTexture = undefined;
    this.mythicSignature = undefined; this.mythicCue = null; this.mythicId = ''; this.mythicClock = 0; this.preparedMythic = '';
    this.marks = [];
    this.cameras.main.setScroll(0, 0).setBackgroundColor('#1b170f');
    this.panel = document.createElement('section');
    this.panel.className = 'coop-layer';
    this.panel.style.setProperty('--coop-camp', 'url("' + new URL('assets/world/rest-camp.webp', document.baseURI).href + '")');
    this.panel.setAttribute('aria-label', '双人联机');
    document.body.append(this.panel);
    this.renderSetup();
    this.events.once('shutdown', () => {
      this.disconnect();
      this.panel.remove();
      this.input.keyboard?.removeAllKeys(true);
      this.arena = undefined;
      this.stick = undefined;
      this.partyBars = undefined;
      this.hp = undefined;
      this.score = undefined;
      this.warning = undefined;
      for (const foe of this.foes.values()) foe.body.destroy();
      this.releaseGeneral();
      for (const fighter of this.fighters.values()) fighter.body.destroy();
      for (const key of this.heroTextures) if (this.textures.exists(key)) this.textures.remove(key);
      this.heroTextures.clear();
      this.fighters.clear();
      this.troopTextures.clear();
      this.foes.clear();this.companyView.clear();this.companyOrder=undefined;
      this.marks = [];
    });
  }

  private card(title: string, description: string, layout = 'summary'): HTMLElement {
    this.panel.classList.remove('coop-during-battle', 'coop-draft');
    this.panel.replaceChildren();
    const card = document.createElement('div');
    card.className = 'coop-card coop-' + layout;
    const heading = document.createElement('h1');
    heading.textContent = title;
    const detail = document.createElement('p');
    detail.textContent = description;
    this.status = document.createElement('p');
    this.status.className = 'coop-status';
    this.status.setAttribute('role', 'status');
    const header = document.createElement('header');
    header.append(heading);
    if (description) header.append(detail);
    card.append(header, this.status);
    this.panel.append(card);
    return card;
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', action);
    return element;
  }

  private back(): void { this.scene.start('MenuScene'); }

  private renderSetup(message = '', previousCode = ''): void {
    this.phase = 'setup';
    const card = this.card('双人联机', `与好友合力斩将，靠近倒地队友 ${gauntlet.rescueSeconds} 秒即可扶起。`, 'setup');
    this.status.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'coop-entries';
    const hostSection = document.createElement('section');
    const hostTitle = document.createElement('h2');
    hostTitle.textContent = '创建战局';
    const modes = document.createElement('div');
    modes.className = 'coop-feature';
    modes.style.setProperty('--coop-cover', 'url("' + new URL('assets/epic-home/dongzhuo-mobile.webp', document.baseURI).href + '")');
    const name = document.createElement('strong');
    name.textContent = GAUNTLET_NAME;
    const detail = document.createElement('span');
    detail.textContent = '并肩闯十阵 · 告捷后可挑战鬼神名将';
    const portrait = new Image();
    portrait.alt = '';
    portrait.src = 'assets/ink-scroll/lvbu.webp';
    modes.append(portrait, name, detail);
    const host = this.button('创建房间', () => this.connect({ type: 'create', mode: 'gauntlet', extreme:new URLSearchParams(location.search).get('challenge')==='extreme' }));
    host.classList.add('coop-primary');
    hostSection.append(hostTitle, modes, host);

    const guestSection = document.createElement('section');
    const guestTitle = document.createElement('h2');
    guestTitle.textContent = '加入好友';
    const form = document.createElement('form');
    const code = document.createElement('input');
    code.placeholder = '六位房间码';
    code.setAttribute('aria-label', '六位房间码');
    code.autocomplete = 'off';
    code.autocapitalize = 'characters';
    code.maxLength = 6;
    code.value = previousCode;
    const join = document.createElement('button');
    join.type = 'submit';
    join.textContent = '加入';
    form.append(code, join);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = code.value.trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(value)) {
        this.status.textContent = '请输入六位房间码';
        code.focus();
        return;
      }
      this.connect({ type: 'join', code: value });
    });
    guestSection.append(guestTitle, form);
    actions.append(hostSection, guestSection);
    const back = this.button('返回主菜单', () => this.back());
    back.className = 'coop-back';
    card.insertBefore(actions, this.status);
    card.querySelector('header')!.append(back);
  }

  private showConnection(text: string): void {
    if (!text) { this.connectionNotice?.remove(); this.connectionNotice = undefined; return; }
    if (!this.connectionNotice) {
      this.connectionNotice = document.createElement('aside');
      this.connectionNotice.className = 'coop-reconnect';
      this.connectionNotice.setAttribute('role', 'status');
      document.body.append(this.connectionNotice);
    }
    this.connectionNotice.textContent = text;
  }

  private disconnect(): void {
    window.clearTimeout(this.connectionTimer); window.clearTimeout(this.retryTimer);
    const socket = this.socket; this.socket = undefined;
    this.resumeSession = undefined; this.retryUntil = 0; this.connectionBlocked = false;
    this.showConnection('');
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
    socket?.close();
  }

  private connect(command: { type: 'create'; mode: CoopMode; extreme?:boolean } | { type: 'join'; code: string }): void {
    this.disconnect();
    this.availableHeroes = CHARACTERS.filter(hero => heroUnlocked(hero.id, false)).map(hero => hero.id);
    this.status.textContent = '正在连接…';
    this.openSocket(command);
  }

  private connectionFailed(message: string, terminal = false): void {
    window.clearTimeout(this.connectionTimer);
    const socket = this.socket; this.socket = undefined; socket?.close();
    if (!terminal && this.resumeSession) {
      this.retryUntil ||= Date.now() + this.resumeSession.graceMs;
      const left = Math.ceil((this.retryUntil - Date.now()) / 1000);
      if (left > 0) {
        this.connectionBlocked = true;
        this.timeline.clear();
        this.displayed=undefined;
        this.stick?.reset();
        this.showConnection('连接中断 · 战局暂停 · 自动重连 ' + left + '秒');
        window.clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => {
          if (this.resumeSession) this.openSocket({ type: 'resume', code: this.resumeSession.code, token: this.resumeSession.token });
        }, 1000);
        return;
      }
      message = '重连超时，战局已结束，请重新创建房间';
    }
    this.disconnect();
    if (this.phase === 'battle' || this.phase === 'draft' || this.phase === 'result') this.renderResult('连接已断开', message);
    else this.renderSetup(message);
  }

  private openSocket(command: { type: 'create'; mode: CoopMode; extreme?:boolean } | { type: 'join'; code: string } | { type: 'resume'; code: string; token: string }): void {
    const url = coopSocketUrl();
    if (!url) { this.connectionFailed('联机服务未配置', true); return; }
    if (this.retryUntil && Date.now() >= this.retryUntil) { this.connectionFailed('重连超时，请重新创建房间', true); return; }
    const socket = new WebSocket(url); this.socket = socket;
    const fail = (text: string, terminal = false) => { if (this.socket === socket) this.connectionFailed(text, terminal); };
    this.connectionTimer = window.setTimeout(() => fail('连接超时，请重试'), Math.min(8000, this.retryUntil ? this.retryUntil - Date.now() : 8000));
    socket.onopen = () => { if (this.socket === socket) socket.send(JSON.stringify(command.type === 'resume' ? command : { ...command, heroes: this.availableHeroes, starDraft:4 })); };
    socket.onerror = () => fail('无法连接联机服务，请检查网络');
    socket.onclose = () => fail('连接中断，请重试');
    socket.onmessage = event => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let message: ServerMessage;
      try { message = JSON.parse(event.data) as ServerMessage; } catch { return; }
      window.clearTimeout(this.connectionTimer);
      if (message.type === 'session') {
        this.resumeSession = { code: message.code, token: message.token, graceMs: message.graceMs };
        this.slot = message.slot; this.retryUntil = 0; this.connectionBlocked = false; this.showConnection('');
      } else if (message.type === 'connection') {
        this.connectionBlocked = message.paused;
        if (message.paused) { this.timeline.clear(); this.displayed=undefined; }
        this.showConnection(message.paused ? '队友掉线 · 战局暂停 · 等待重连 ' + message.remaining + '秒' : '');
      } else if (message.type === 'error') fail(message.message, true);
      else if (message.type === 'closed') fail(message.reason === 'reconnect-timeout' ? '队友重连超时，战局已结束' : message.reason === 'expired' ? '房间已到期' : '好友已离开房间', true);
      else if (message.type === 'lobby') this.renderLobby(message);
      else if (message.type === 'state') {
        if (this.phase==='lobby') this.enterBattle();
        if (this.phase==='draft') this.showBattleControls();
        if (this.phase==='battle') this.timeline.push(message,performance.now());
      }
      else if (message.type === 'draft') { this.timeline.clear(); this.displayed=undefined; this.renderDraft(message); }
      else if (message.type === 'result') {
        this.disconnect();
        this.renderResult(message.milestones===3?'封神告捷':message.milestones===2?'鬼门告捷':message.victory?'凡将十阵告捷':'连战败退', '合力斩将 ' + message.generals + ' 位 · 击破 ' + message.kills + ' 名敌军');
      }
    };
  }

  private member(label: string, hero: CharacterId | null | undefined, empty: string): HTMLElement {
    const member = document.createElement('div');
    member.className = 'coop-member';
    const role = document.createElement('span');
    role.textContent = label;
    const name = document.createElement('strong');
    name.textContent = hero ? getCharacter(hero).name : empty;
    member.append(role, name);
    if (hero) {
      member.classList.add('coop-picked');
      const portrait = new Image();
      portrait.src = 'assets/ink-scroll/' + hero + '.webp';
      portrait.alt = '';
      portrait.decoding = 'async';
      member.prepend(portrait);
    }
    return member;
  }

  private async copyCode(code: HTMLOutputElement, button: HTMLButtonElement): Promise<void> {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(code.value); copied = true; } catch { /* Try selection on LAN HTTP. */ }
    }
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      try { copied = document.execCommand('copy'); } catch { /* Leave the code selected for manual copy. */ }
      if (copied) selection?.removeAllRanges();
    }
    button.textContent = copied ? '已复制' : '请手动复制';
  }

  private renderLobby(message: Extract<ServerMessage, { type: 'lobby' }>): void {
    this.slot = message.slot;
    this.phase = 'lobby';
    const self = message.picks.find(pick => pick.slot === this.slot)?.hero;
    const partner = message.picks.find(pick => pick.slot !== this.slot)?.hero;
    if (self) this.loadHero(self);
    if (partner) this.loadHero(partner);
    const rosterScroll = this.panel.querySelector('.coop-hero-grid')?.scrollTop ?? 0;
    const focused = this.panel.contains(document.activeElement) && document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.focus : undefined;
    const card = this.card(GAUNTLET_NAME, '', 'lobby');
    const room = document.createElement('div');
    room.className = 'coop-room-code';
    const label = document.createElement('span');
    label.textContent = '房间码';
    const code = document.createElement('output');
    code.className = 'coop-code';
    code.value = message.code;
    code.setAttribute('aria-label', '房间码');
    const copy = this.button('复制', () => { void this.copyCode(code, copy); });
    copy.dataset.focus = 'copy';
    room.append(label, code, copy);

    const lineup = document.createElement('div');
    lineup.className = 'coop-lineup';
    lineup.append(this.member('我方', self, '待选武将'),
      this.member('队友', partner, message.count === 2 ? '待选武将' : '等待加入'));
    const heading = document.createElement('h2');
    heading.textContent = '选择出战武将';
    const picker = document.createElement('div');
    picker.className = 'coop-hero-grid';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', '选择出战武将');
    for (const id of this.availableHeroes) {
      const hero = this.button(getCharacter(id).name, () => this.send({ type: 'pickHero', hero: id }));
      hero.setAttribute('aria-pressed', String(id === self));
      hero.dataset.focus = id;
      const portrait = new Image();
      portrait.alt = '';
      portrait.loading = 'lazy';
      portrait.decoding = 'async';
      portrait.src = 'assets/ink-scroll/' + id + '.webp';
      hero.prepend(portrait);
      picker.append(hero);
    }
    card.querySelector('header')!.append(room);
    card.insertBefore(lineup, this.status);
    card.insertBefore(heading, this.status);
    card.insertBefore(picker, this.status);
    picker.scrollTop = rosterScroll;
    this.status.textContent = message.count !== 2 ? '把房间码发给好友。'
      : self && partner ? this.slot ? '等待房主出征。' : '双方已就绪。' : '双方选定武将后即可出征。';

    const actions = document.createElement('footer');
    const leave = this.button('离开房间', () => this.back());
    leave.dataset.focus = 'leave';
    actions.append(leave);
    if (!this.slot) {
      const start = this.button('并肩出征', () => this.send({ type: 'start' }));
      start.disabled = !self || !partner;
      start.classList.add('coop-primary');
      start.dataset.focus = 'start';
      actions.append(start);
    }
    card.append(actions);
    if (focused) Array.from(card.querySelectorAll('button')).find(button => button.dataset.focus === focused)?.focus({ preventScroll: true });
  }

  private send(message: object): boolean {
    if (this.connectionBlocked) return false;
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 16_384) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private showBattleControls(): void {
    this.phase = 'battle';
    this.stick?.setEnabled(true);
    this.panel.replaceChildren(this.button('离开战斗', () => this.back()));
    this.panel.classList.remove('coop-draft');
    this.panel.classList.add('coop-during-battle');
  }

  private enterBattle(): void {
    this.showBattleControls();
    this.textures.get('coop_foe').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.warning = this.add.graphics().setDepth(0.5);
    this.troopFx = this.add.graphics().setDepth(.6);
    const camera = this.cameras.main;
    camera.setRoundPixels(true);
    this.arena = this.add.tileSprite(0, 0, world.width, world.height, 'coop_ground').setOrigin(0).setTileScale(.5).setDepth(-1);
    this.add.rectangle(world.width / 2, world.height / 2, world.width - 4, world.height - 4).setStrokeStyle(3, 0x41321c, .8);
    const theme = { fontFamily: 'IMWarHeading, serif', fontSize: '20px', color: '#f3dfad', stroke: '#191411', strokeThickness: 5 };
    this.partyBars = this.add.graphics().setScrollFactor(0).setDepth(94);
    this.hp = this.add.text(22, 14, '', { ...theme, fontSize: '17px', lineSpacing: 9 }).setScrollFactor(0).setDepth(95);
    this.score = this.add.text(22, 78, '', theme).setScrollFactor(0).setDepth(95);
    this.keyset = this.input.keyboard?.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    if (!IS_DESKTOP) {
      this.stick = new Joystick(this);
      this.input.on('pointerdown', this.stick.handleDown, this.stick);
      this.input.on('pointermove', this.stick.handleMove, this.stick);
      this.input.on('pointerup', this.stick.handleUp, this.stick);
      this.input.on('pointerupoutside', this.stick.handleUp, this.stick);
      const blur = () => this.stick?.reset();
      const stick = this.stick;
      window.addEventListener('blur', blur);
      this.events.once('shutdown', () => {
        this.input.off('pointerdown', stick.handleDown, stick);
        this.input.off('pointermove', stick.handleMove, stick);
        this.input.off('pointerup', stick.handleUp, stick);
        this.input.off('pointerupoutside', stick.handleUp, stick);
        window.removeEventListener('blur', blur);
      });
    }
    for (let i = 0; i < 2; i++) this.marks.push(this.add.line(0, 0, 0, 0, 0, 0, i ? 0xc9dfa2 : 0xc0e7fe).setOrigin(0).setDepth(88).setLineWidth(1.5).setAlpha(0));
  }

  private makeView(key: string, x: number, y: number, size: number): ActorView {
    const body = this.add.image(x, y, key, 0).setOrigin(.5, .78).setDisplaySize(size, size);
    const label = this.add.text(x, y - 38, '', { fontSize: '14px', color: '#f7e6b5', stroke: '#171210', strokeThickness: 4 }).setOrigin(.5);
    return { body, label, tx: x, ty: y, strike: 0 };
  }

  private renderState(state: BattleSnapshot, immediate=true): void {
    if (this.phase === 'lobby') this.enterBattle();
    if (this.phase === 'draft') this.showBattleControls();
    if (this.phase !== 'battle') return;
    const fxNow=state.battleMs??state.seconds*1000;

    const cue=state.gauntlet?.warning, key=cue?.fx+':'+cue?.endsAt;
    if (cue?.resolved && cue.fx && this.lastBossFx!==key) {
      this.lastBossFx=key;const arrow=cue.fx==='arrow';
      playSurvivorBossFx(this,cue.fx,cue.x+(arrow?Math.cos(cue.angle)*cue.radius/2:0),cue.y+(arrow?Math.sin(cue.angle)*cue.radius/2:0),cue.radius*(arrow?1.1:cue.fx==='thunder'?3:2.2),fxNow,arrow?cue.angle:0);
    }
    this.mythicClock=(state.battleMs??state.seconds*1000)/1000;
    this.mythicId=state.gauntlet.general?.id??'';
    this.mythicCue=cue?.mythic?cue as MythicWarning:null;
    if(mythicBoss(this.mythicId)&&!this.mythicSignature) this.mythicSignature=this.add.image(0,0,mythicArtKey(this.mythicId)).setDepth(75);
    this.companyView.sync(this,state.retainers??[],performance.now());
    if(state.players.some(p=>p.slot===this.slot) && state.retainers?.some(u=>u[1]===this.slot) && !this.panel.contains(this.companyOrder??null)){
      const button=this.button('部曲 · 出击',()=>{const order=button.dataset.next==='guard'?'guard':'sortie';this.send({type:'order',order});});
      button.classList.add('coop-order');this.companyOrder=button;this.panel.prepend(button);
    }
    const own=state.players.find(p=>p.slot===this.slot);
    if(this.companyOrder&&own?.order){this.companyOrder.dataset.next=own.order==='guard'?'sortie':'guard';this.companyOrder.textContent=own.order==='guard'?'护阵中 · 出击':'出击中 · 归阵';}
    this.drawTroops(state);
    if(immediate){updateSurvivorBossFx(this,fxNow);this.presentCues(state);}
    const nextIds=roster.waves[state.gauntlet.wave<=10?state.gauntlet.wave-1:7+(state.gauntlet.wave-11)%3]??[];
    for(const id of nextIds)this.loadTroop(id);
    for (const fighter of state.players) this.updateFighter(fighter);
    const liveIds = new Set<number>();
    for (const enemy of state.enemies) {
      liveIds.add(enemy.id);
      const attack = enemy.general && !mythicBoss(enemy.general.id)
        ? (state.gauntlet.warnings ?? (cue ? [cue] : [])).find(w => w.ownerId === enemy.id || (w.ownerId === undefined && !state.gauntlet.dual && enemy.general?.id === this.mythicId)) : undefined;
      this.updateFoe(enemy, attack);
    }
    for (const [id, view] of this.foes) {
      if (liveIds.has(id)) continue;
      view.body.destroy();
      view.label.destroy();
      this.foes.delete(id);
    }
    this.loadGeneral(state.gauntlet.upcoming.id);
    if(this.preparedMythic!==state.gauntlet.upcoming.id){
      this.preparedMythic=state.gauntlet.upcoming.id;
      prepareMythicActions(this,this.preparedMythic);
    }
    const needed=new Set([state.gauntlet.upcoming.id,...state.enemies.flatMap(e=>e.general?[e.general.id]:[])].flatMap(id => ['coop_general_'+id, 'coop_general_'+id+'_action']));
    for(const key of this.generalTextures)if(!needed.has(key)){if(this.textures.exists(key))this.textures.remove(key);this.generalTextures.delete(key);}
    const self = state.players.find(f => f.slot === this.slot);
    const partner = state.players.find(f => f.slot !== this.slot);
    if (self && partner) {
      const team = [self, partner];
      this.hp?.setText(team.map((p, i) => (i ? '队友 ' : '自己 ') + getCharacter(p.hero).name + '  ' + p.hp + '/' + p.maxHp));
      const bars = this.partyBars?.clear();
      team.forEach((p, i) => {
        const y = 36 + 29 * i;
        bars?.fillStyle(0x30261f, .92).fillRect(22, y, 148, 3);
        bars?.fillStyle(p.hp / p.maxHp < .3 ? 0xe48770 : i ? 0x86bba7 : 0xe4bd76).fillRect(22, y, 148 * p.hp / p.maxHp, 3);
      });
    }
    const run = state.gauntlet;
    if (run) {
      const cue = run.warning?.name ?? (run.general ? (run.dual?'河北双雄':run.general.name) + '在阵' : run.remaining === 0 ? '本阵已平定' : `名将 ${run.remaining} 秒后登场`);
      const tier = run.tier ?? (run.wave>run.total?'endless':'mortal');
      const wave = tier==='endless'?`无尽 · 第 ${run.wave} 阵`:
        `${tierTitle[tier]} · ${challengeWave(tier,run.wave,run.total,run.mythicSize)}/${tier==='mortal'?run.total:(run.mythicSize??run.total)}`;
      const lines = [wave + ' · 已破 ' + run.cleared + ' 阵', cue];
      if (self && partner && (!self.hp || !partner.hp)) {
        const fallen = self.hp ? partner : self;
        const angle = Math.atan2(partner.y - self.y, partner.x - self.x);
        const arrow = ['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(angle / (Math.PI / 4)) + 8) % 8];
        lines.push(fallen.rescue > 0 ? '救援中 ' + Math.min(99, Math.floor(fallen.rescue / gauntlet.rescueSeconds * 100)) + '%'
          : self.hp ? arrow + ' 队友倒地 · 靠近救援' : '已倒地 · 等待队友救援');
      }
      this.score?.setText(lines);
    }
  }

  private updateFighter(fighter: Fighter): void {
    const key = this.loadHero(fighter.hero);
    const loaded = this.textures.exists(key);
    let view = this.fighters.get(fighter.slot);
    if (!view) {
      view = this.makeView(loaded ? key : 'coop_foe', fighter.x, fighter.y, 78);
      this.fighters.set(fighter.slot, view);
    }
    view.tx = fighter.x;
    view.ty = fighter.y;
    const frame = fighter.moving ? Math.floor(this.time.now / 105) % 4 : 0;
    if (loaded && view.body.texture.key !== key) view.body.setTexture(key, 0).setDisplaySize(78, 78);
    view.body.setVisible(loaded).setOrigin(.5, .89).setFrame(fighter.dir * 4 + frame).setAlpha(fighter.hp > 0 ? 1 : .35);
    view.label.setText((fighter.slot === this.slot ? '主将 ' : '队友 ') + getCharacter(fighter.hero).name + (fighter.hp ? '' : ' · 倒地'));
    if (fighter.strike.n > view.strike) {
      view.strike = fighter.strike.n;
      const mark = this.marks[fighter.slot];
      mark.setTo(fighter.x, fighter.y - 13, fighter.strike.x, fighter.strike.y - 12).setAlpha(.85);
      this.tweens.killTweensOf(mark);
      this.tweens.add({ targets: mark, alpha: 0, duration: 160 });
    }
  }

  private updateFoe(enemy: Foe, attack?: BossWarning): void {
    if(enemy.general)this.loadGeneral(enemy.general.id);
    const challenge = enemy.general && mythicBoss(enemy.general.id);
    const bossKey = enemy.general && (challenge?mythicArtKey(challenge.id):'coop_general_'+enemy.general.id);
    const troop=enemy.troop?TROOPS[enemy.troop]:undefined;
    if(enemy.troop)this.loadTroop(enemy.troop);
    const source=troop&&this.textures.exists(troop.art.walk)?(enemy.cue&&this.textures.exists(troop.art.attack)?troop.art.attack:troop.art.walk):'coop_foe';
    const texture=enemy.boss?(bossKey&&this.textures.exists(bossKey)?bossKey:'coop_foe'):(buildRecolor(this.game,source,'enemy',false,true)??source);
    let view = this.foes.get(enemy.id);
    if (!view) {
      view = this.makeView(texture, enemy.x, enemy.y, enemy.boss ? 122 : 56);
      this.foes.set(enemy.id, view);
    }
    if ((!challenge || texture === 'coop_foe') && view.body.texture.key !== texture) {
      view.body.setTexture(texture, 0);
    }
    view.body.setOrigin(.5, enemy.boss?.89:troop?(troop.art.cell-7)/troop.art.cell:.78).setDisplaySize(enemy.boss?122:troop?78:56,enemy.boss?122:troop?78:56);
    if (enemy.boss && texture === 'coop_foe') view.body.setTint(0xffba75);
    else view.body.clearTint();
    const dx = enemy.x - view.tx, dy = enemy.y - view.ty;
    const moving = Math.hypot(dx, dy) > .01;
    if (moving) view.walkFacing = walkRow(dx, dy, view.walkFacing ?? 0);
    const dir = view.walkFacing ?? 0;
    const frame = moving ? Math.floor(view.walkPhase ?? 0) % 4 : 0;
    view.tx = enemy.x;
    view.ty = enemy.y;
    const face=enemy.cue&&enemy.face!==undefined?(Math.abs(Math.cos(enemy.face))>Math.abs(Math.sin(enemy.face))?(Math.cos(enemy.face)<0?1:2):(Math.sin(enemy.face)<0?3:0)):dir;
    const cue = challenge && this.mythicId === challenge.id ? this.mythicCue : null;
    view.walkStride = moving && !cue && !attack && !enemy.cue ? (enemy.boss ? 10 : 9) : undefined;
    if (challenge && texture !== 'coop_foe') {
      if (cue) view.walkFacing = mythicFacing(cue.kind === 'line' || cue.kind === 'sweep' ? cue.angle : cue.face);
      poseMythic(view.body, challenge.id, this.mythicClock, view.walkFacing ?? 0, moving, cue, frame);
    } else if (attack && bossKey && texture === bossKey) {
      const dir = mythicFacing(attack.angle);
      view.walkFacing = dir;
      const wind = Math.max(.1, attack.endsAt - (attack.startsAt ?? attack.endsAt - .9));
      const progress = Phaser.Math.Clamp(1 - (attack.endsAt - this.mythicClock) / wind, 0, 1);
      const phase = attack.resolved ? (this.mythicClock - attack.endsAt < .16 ? 2 : 3) : (progress < .55 ? 0 : 1);
      const actionKey = bossKey + '_action';
      if (this.textures.exists(actionKey)) view.body.setTexture(actionKey, dir * 4 + phase).setFlipX(false);
      else if (view.body.texture.has('23')) {
        const cast = attack.kind === 'circle' || attack.kind === 'ring';
        view.body.setFrame(cast ? [24, 25, 26, 27][phase] : [16, 17, 19, 23][phase]).setFlipX(Math.cos(attack.angle) < 0);
      } else view.body.setFrame(dir * 4).setFlipX(false);
    } else view.body.setFlipX(false).setFrame(face * 4 + (enemy.cue ? Math.floor(this.time.now / 150) % 4 : frame));
    if(!enemy.boss)view.label.setText(troop?(enemy.cue?.kind==='heal'?'施药':enemy.cue?.kind==='signal'?'鸣号':troop.name):'').setFontSize(11);
    if (enemy.boss) view.label.setText(`${enemy.general?.name ?? '敌将'}${enemy.enraged ? ' · 奋威' : ''} ${Math.ceil(enemy.hp)}/${enemy.maxHp}`);
  }

  private loadTroop(id:string):void {
    const t=TROOPS[id];if(!t)return;
    let added=false;
    for(const key of [t.art.walk,t.art.attack]){
      if(this.textures.exists(key)||this.troopTextures.has(key))continue;
      const file=ART_V2_FILES[key];if(!file)continue;this.troopTextures.add(key);
      this.load.once('filecomplete-spritesheet-'+key,()=>{this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);buildRecolor(this.game,key,'enemy',false,true);});
      this.load.spritesheet(key,file,{frameWidth:t.art.cell,frameHeight:t.art.cell});
      added=true;
    }
    if(added&&!this.load.isLoading())this.load.start();
  }
  private drawTroops(state:Extract<ServerMessage,{type:'state'}>):void {
    const g=this.troopFx?.clear();if(!g)return;
    for(const e of state.enemies){
      if(state.burning?.includes(e.id)){
        const flicker=Math.floor(this.mythicClock*9+e.id)%3;
        g.fillStyle(0xba4828,.95).fillTriangle(e.x-5,e.y+1,e.x+5,e.y+1,e.x+2,e.y-10-flicker);
        g.fillStyle(0xffcb69,.95).fillTriangle(e.x-2,e.y,e.x+3,e.y,e.x,e.y-5-flicker);
      }
      if(state.spellMarks?.includes(e.id)) g.lineStyle(2,0xa4d9ed,.9).strokeTriangle(e.x-4,e.y-39,e.x+4,e.y-39,e.x,e.y-33);
      const c=e.cue;
      if(c){
        g.lineStyle(2,0xe6aa79,.85);
        if(['line','fan','net'].includes(c.kind)){
          for(const off of c.kind==='fan'?[-(c.spread??.3),0,c.spread??.3]:[0]){
            const a=c.angle+off,dx=Math.cos(a),dy=Math.sin(a),w=c.width/2;
            const points=[{x:c.x-dy*w,y:c.y+dx*w},{x:c.x+dy*w,y:c.y-dx*w},{x:c.x+dx*c.range+dy*w,y:c.y+dy*c.range-dx*w},{x:c.x+dx*c.range-dy*w,y:c.y+dy*c.range+dx*w}];
            g.fillStyle(0xad4933,.1).fillPoints(points,true).strokePoints(points,true);
          }
        }else g.lineBetween(e.x-15,e.y-52,e.x+15,e.y-52).lineBetween(e.x,e.y-60,e.x,e.y-44);
      }
      if(e.boosted)g.lineStyle(2,0xe2ad75,.7).lineBetween(e.x-7,e.y+3,e.x,e.y-2).lineBetween(e.x,e.y-2,e.x+7,e.y+3);
    }
    for(const s of state.shots??[]){const dx=Math.cos(s.angle),dy=Math.sin(s.angle);g.lineStyle(2,0xe9d4ad,.95).lineBetween(s.x-dx*14,s.y-dy*14,s.x+dx*4,s.y+dy*4);if(s.net)g.strokeRect(s.x-7,s.y-7,14,14);}
    for(const f of state.troopEffects??[]){
      if(f.kind==='spell-chain' && f.fromX!==undefined && f.fromY!==undefined){g.lineStyle(2,0xa4d9ed,.85).lineBetween(f.fromX,f.fromY-16,f.x,f.y-16);continue;}
      g.lineStyle(2,f.kind==='heal'?0x9fc59c:0xf3ce9c,.9);if(f.kind==='heal')g.lineBetween(f.x-6,f.y-22,f.x+6,f.y-22).lineBetween(f.x,f.y-28,f.x,f.y-16);else g.strokeRect(f.x-13,f.y-20,26,18);}
  }

  private loadHero(id: CharacterId): string {
    const key = 'coop_hero_' + id;
    if (this.heroTextures.has(key)) return key;
    this.heroTextures.add(key);
    const walk = id === 'zhaoyun' ? 'hero_walk_sheet' : id + '_walk_sheet';
    this.load.once('filecomplete-spritesheet-' + key, () => this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST));
    this.load.spritesheet(key, ART_V2_FILES[walk], { frameWidth: 176, frameHeight: 176 });
    if (!this.load.isLoading()) this.load.start();
    return key;
  }

  private releaseGeneral(): void {
    for(const key of this.generalTextures)if(this.textures.exists(key))this.textures.remove(key);
    this.generalTextures.clear();
    this.generalTexture = undefined;
  }

  private loadGeneral(id: string): void {
    const key = 'coop_general_' + id;
    const file = BOSS_SHEETS[id]?.[0];
    if (!file || this.generalTextures.has(key)) return;
    this.generalTexture = key;
    const sheets = [[key, file]];
    if (ATTACK_SHEETS[id]) sheets.push([key+'_action', ATTACK_SHEETS[id]]);
    for (const [texture, sheet] of sheets) {
      this.generalTextures.add(texture);
      if (this.textures.exists(texture)) continue;
      this.load.once('filecomplete-spritesheet-' + texture, () => {
        if (!this.generalTextures.has(texture)) this.textures.remove(texture);
        else this.textures.get(texture).setFilter(Phaser.Textures.FilterMode.NEAREST);
      });
      this.load.spritesheet(texture, 'assets/bosses-v2/' + sheet + '.png', { frameWidth: 288, frameHeight: 288 });
    }
    if (!this.load.isLoading()) this.load.start();
  }

  private drawWarning(cue: BossWarning | null, clear=true): void {
    const g = this.warning;
    if(clear&&g) clearMythicWarning(g);
    if (!g || !cue) return;
    if(cue.mythic) { drawMythicWarning(g,cue as MythicWarning,this.mythicId,this.mythicClock); return; }
    drawMortalWarning(g,cue,this.mythicClock);
  }

  private partyMember(p: PartyMember, checkpoint: boolean): HTMLElement {
    const row = document.createElement('div');
    row.className = 'coop-party-member';
    const portrait = new Image();
    portrait.src = 'assets/ink-scroll/' + p.hero + '.webp';
    portrait.alt = '';
    const title = document.createElement('strong');
    title.textContent = (p.slot === this.slot ? '自己 · ' : '队友 · ') + getCharacter(p.hero).name;
    const hp = document.createElement('span');
    hp.textContent = '生命 ' + p.hp + '/' + p.maxHp;
    const bar = document.createElement('progress');
    bar.max = p.maxHp;
    bar.value = p.hp;
    bar.setAttribute('aria-label', title.textContent + '生命');
    const status = document.createElement('small');
    status.textContent = checkpoint ? '阶段告捷' : p.ready ? '已选定' : '选择中';
    row.append(portrait, title, hp, bar, status);
    if(p.stars?.length) {
      const stars=document.createElement('small');
      stars.textContent=p.stars.map(k=>networkStars.find(s=>s.id===k)?.name).filter(Boolean).join(' · ');
      row.append(stars);
    }
    return row;
  }

  private renderDraft(message: Extract<ServerMessage, { type: 'draft' }>): void {
    clearSurvivorBossFx(this);
    if(this.warning) clearMythicWarning(this.warning);
    this.phase = 'draft';
    this.stick?.reset();
    this.stick?.setEnabled(false);
    const tier = message.tier??'mortal';
    const card = this.card(message.checkpoint ? (tier==='mortal'?'鬼门已开':tier==='ghost'?'天门将启':'封神告捷') : '斩将强化',
      `第 ${challengeWave(tier,message.wave,message.total,message.mythicSize)} 阵 · 已击败${message.general}`);
    if (this.mythicSignature) clearMythicSignature(this.mythicSignature);
    this.panel.classList.add('coop-draft');
    const party = document.createElement('div');
    party.className = 'coop-party';
    party.setAttribute('aria-label', '队伍状态');
    const members = [...message.party].sort((a, b) => Number(b.slot === this.slot) - Number(a.slot === this.slot));
    const company=members.find(m=>m.slot===this.slot)?.company;
    if(company&&!message.checkpoint){
      const label=document.createElement('small');label.textContent='钱币 '+company.coins+' · 部曲 '+company.men+'/'+company.cap+' · 阵亡 '+company.deaths;
      party.append(label);const button=this.button('招募三人 · '+company.cost+'钱',()=>this.send({type:'recruit',receipt:company.receipt,wave:message.wave}));
      button.disabled=company.coins<company.cost||company.men+3>company.cap||!!members.find(m=>m.slot===this.slot)?.ready;party.append(button);
    }
    for (const member of members) party.append(this.partyMember(member, message.checkpoint));
    card.insertBefore(party, this.status);
    if (message.checkpoint) {
      const votes = message.votes ?? [];
      const mine = votes[this.slot], other = votes[1-this.slot];
      this.status.textContent = mine && other && mine!==other ? '两人选择不同，可改选或收兵结算' :
        mine ? '已确认，等待战友' : other ? '战友已选择，请确认去向' : '两人选择相同后继续，一人收兵即可结算';
      {
        for (const choice of message.continuation??['endless']) {
          const label = choice==='ghost'?'挑战鬼将 · '+(message.mythicSize??10)+'阵':choice==='divine'?'挑战神将 · '+(message.mythicSize??10)+'阵':'进入无尽';
          const proceed=this.button(label,() => this.send(choice==='endless'?{type:'endless',wave:message.wave}:{type:'challenge',tier:choice,wave:message.wave}));
          if(choice!=='endless') proceed.classList.add('coop-primary');
          proceed.disabled = choice === mine;
          card.append(proceed);
        }
        card.append(this.button('结束并结算',() => this.send({type:'finish',wave:message.wave})));
      }
    } else {
      this.status.textContent = message.choices.length ? '选择本阵奖励，两人选定后进入下一阵' : `已就绪 ${message.ready}/2 · 等待队友`;
      for (const id of message.choices) {
        const reward = REWARDS.get(id);
        if (!reward) continue;
        const choice = this.button('', () => {
          if (!this.send({ type: 'reward', id })) {
            this.status.textContent='等待连接恢复后再选择奖励';
            return;
          }
          for (const option of card.querySelectorAll<HTMLButtonElement>('.coop-reward')) option.disabled = true;
        });
        const name = document.createElement('strong');
        name.textContent = id===EMBER.id?'火种 · Lv.'+((members.find(m=>m.slot===this.slot)?.ember??0)+1):reward.name;
        const detail = document.createElement('span');
        detail.textContent = reward.detail;
        choice.classList.add('coop-reward');
        choice.append(name, detail);
        card.append(choice);
      }
    }
    card.append(this.button('离开战斗', () => this.back()));
  }

  update(time: number, delta: number): void {
    if(this.phase==='battle'&&!this.connectionBlocked)this.companyView.draw(performance.now(),delta);
    if (this.phase !== 'battle') return;
    if (this.connectionBlocked) return;
    const frame=this.timeline.sample(performance.now());
    if (!frame) return;
    const state=frame.a.state;
    if (this.displayed!==state) { this.displayed=state; this.renderState(state,false); }
    this.mythicClock=frame.ms/1000;
    updateSurvivorBossFx(this,frame.ms);
    if (time >= this.movementAt) {
      this.movementAt = time + 65;
      const keys = this.keyset;
      const dx = Number(!!(keys?.D?.isDown || keys?.RIGHT?.isDown)) - Number(!!(keys?.A?.isDown || keys?.LEFT?.isDown));
      const dy = Number(!!(keys?.S?.isDown || keys?.DOWN?.isDown)) - Number(!!(keys?.W?.isDown || keys?.UP?.isDown));
      this.send({ type: 'input', dx: this.stick?.active ? this.stick.vector.x : dx, dy: this.stick?.active ? this.stick.vector.y : dy });
    }
    const t = 1 - Math.exp(-Math.min(delta, 90) / 65);
    const smooth = (view: ActorView, next?: {x:number;y:number}, local=false) => {
      const { body, label, tx, ty, walkStride } = view;
      const mix=next && Math.hypot(next.x-tx,next.y-ty)<320 ? frame.mix : 0;
      const x=next ? (local?next.x:tx+(next.x-tx)*mix) : tx;
      const y=next ? (local?next.y:ty+(next.y-ty)*mix) : ty;
      const dx=(x-body.x)*(local?t:1), dy=(y-body.y)*(local?t:1);
      body.x += dx;
      body.y += dy;
      if (walkStride) {
        view.walkPhase = ((view.walkPhase ?? 0) + Math.hypot(dx, dy) / walkStride) % 4;
        const frame = (view.walkFacing ?? 0) * 4 + Math.floor(view.walkPhase);
        if (Number(body.frame.name) !== frame && body.texture.has(String(frame))) body.setFrame(frame);
      }
      body.setDepth(body.y / 10);
      label.setPosition(body.x, body.y - body.displayHeight * .78 - 8).setDepth(81);
    };
    this.fighters.forEach((v,id)=>smooth(v,(id===this.slot?frame.latest:frame.b).party.get(id),id===this.slot));
    this.foes.forEach((v,id)=>smooth(v,frame.b.foes.get(id)));
    this.presentCues(state);
    const self = this.fighters.get(this.slot)?.body;
    if (self) {
      this.cameras.main.setScroll(
        Math.max(0, Math.min(world.width - GAME_WIDTH, self.x - GAME_WIDTH / 2)),
        GAME_HEIGHT > world.height ? -(GAME_HEIGHT - world.height) / 2 : Math.max(0, Math.min(world.height - GAME_HEIGHT, self.y - GAME_HEIGHT / 2)),
      );
    }
  }

  private presentCues(state: BattleSnapshot): void {
    this.drawWarning(null);
    for(const cue of state.gauntlet.warnings??(state.gauntlet.warning?[state.gauntlet.warning]:[])) this.drawWarning(cue,false);
    if(this.mythicSignature){
      const enemy=state.enemies.find(e=>e.general?.id===this.mythicId);
      const body=enemy && this.foes.get(enemy.id)?.body;
      paintMythicSignature(this.mythicSignature,this.mythicId,body?this.mythicCue:null,this.mythicClock,body);
      if(body && this.mythicCue) poseMythic(body,this.mythicId,this.mythicClock,0,false,this.mythicCue);
    }
  }

  private renderResult(title: string, message: string): void {
    clearSurvivorBossFx(this);
    if(this.warning) clearMythicWarning(this.warning);
    if (this.mythicSignature) clearMythicSignature(this.mythicSignature);
    this.phase = 'result';
    this.stick?.setEnabled(false);
    const card = this.card(title, message);
    card.append(this.button('返回主菜单', () => this.back()));
  }
}
