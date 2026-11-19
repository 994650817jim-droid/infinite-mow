/**
 * 城池建设（城镇全景）：天下地图点我方城池 →「进入城池」。一整张城池全景，建好的建筑出现在固定位置，
 * 没建的是地基；点建筑弹出建造 / 升级面板（效果、花费、前提）。用户 2026-11-17 批准，方案见 city-build-proposal.md。
 * 第一批：府衙、屯田、募兵所（用户：城池不需要太多建筑，城墙箭楼不做）。小 / 中 / 大城各用一张全景。
 * 美术：assets/town-city/（画风会话 2026-11-17 出图，tools/prepare-town-city-art.mjs 切图）。TOWN_ART_READY=false 时退回借营寨图。
 */
import Phaser from 'phaser';
import {playMenuMusic} from '../systems/Music';
import {isChapterTestRun} from '../systems/ChapterProgress';
import {W,H,worldShell,worldAssets} from '../world/WorldUI';
import {FONT,HEADING_FONT} from '../config';
import {homeCommand,warPanelTexture} from '../ui/HomeCommand';
import {uiSfx} from '../systems/Sfx';
import {loadWorld,worldUnlocked,storageUnavailable,incompatibleSave,cityLevels,cityBuild} from '../world/WorldStore';
import {cityById,SPECIALTIES,TIER_NAME,type CityTier} from '../world/WorldCities';
import {CITY_BUILDINGS,CITY_BUILDING_IDS,cityBuildCost,cityBuildBlockers,cityIncome,type CityBuildingId} from '../data/cityBuildings';
import {incomeText} from '../town/TownData';
import {PANO_W,PANO_H,LEVEL_SCALE} from '../town/CityLayout';
import {TownFolk,folkCount,loadTownLife,drawTownDecor,zy} from '../town/TownLife';

/** 城池正式美术是否已导入（assets/town-city/bg_<档>.webp、<建筑>_<级>.webp）。未导入时借营寨图。 */
export const TOWN_ART_READY = true;
const BORROW_BG: Record<CityTier, number> = {small: 1, medium: 2, large: 3};
const BORROW_BUILDING: Record<CityBuildingId, string> = {office: 'hall', tuntian: 'farm', muster: 'barracks'};
interface Slot {x: number; y: number; w: number}
/** 建筑位置（全景像素，建筑底边中心，落在底图画好的地基上）。借营寨图时用 BORROW_SLOTS。多出来的地基留作空地。 */
const SLOTS: Record<CityTier, Record<CityBuildingId, Slot>> = {
 // 小城：4 处地基——正中靠后放府衙，左前放屯田，右中放募兵所，左后空着
 small: {office: {x: 772, y: 474, w: 300}, tuntian: {x: 352, y: 760, w: 400}, muster: {x: 1275, y: 570, w: 330}},
 // 中城：6 处地基——左中府衙，左下屯田，右下募兵所
 medium: {office: {x: 418, y: 516, w: 330}, tuntian: {x: 292, y: 842, w: 430}, muster: {x: 1300, y: 842, w: 440}},
 // 大城：6 处地基——右上第二块府衙，左下大地基屯田，右下大地基募兵所
 large: {office: {x: 1265, y: 482, w: 390}, tuntian: {x: 392, y: 784, w: 400}, muster: {x: 1292, y: 784, w: 460}},
};
const BORROW_SLOTS: Record<CityTier, Record<CityBuildingId, Slot>> = {
 small: {office: {x: 950, y: 720, w: 360}, tuntian: {x: 170, y: 930, w: 290}, muster: {x: 1090, y: 1010, w: 280}},
 medium: {office: {x: 950, y: 720, w: 380}, tuntian: {x: 170, y: 930, w: 290}, muster: {x: 1090, y: 1010, w: 290}},
 large: {office: {x: 768, y: 475, w: 400}, tuntian: {x: 180, y: 960, w: 280}, muster: {x: 1240, y: 1010, w: 280}},
};
const txt = (s: Phaser.Scene, x: number, y: number, v: string, size = 15, color = '#ede3c9', font = FONT) => s.add.text(x, y, v, {fontFamily: font, fontSize: size + 'px', color, resolution: 2});
let D = false;

export class TownScene extends Phaser.Scene {
 private cityId = '';
 private pano!: Phaser.GameObjects.Container;
 private vr = {x: 0, y: 0, w: 0, h: 0}; private k = 1; private sx = 0; private sy = 0;
 private hits: Phaser.GameObjects.Rectangle[] = [];
 private drag: {x: number; y: number; sx: number; sy: number; moved: boolean} | null = null;
 private pressed: string | null = null;
 private folk?: TownFolk;
 private header!: Phaser.GameObjects.Text; private grain!: Phaser.GameObjects.Text; private income!: Phaser.GameObjects.Text;
 constructor() { super('TownScene'); }
 init(data: {city?: string}) {
  D = W > 600; this.cityId = data?.city ?? (this.registry.get('townCity') as string | undefined) ?? ''; this.registry.set('townCity', this.cityId);
  this.vr = D ? {x: 12, y: 74, w: W - 24, h: H - 74 - 58} : {x: 0, y: 116, w: W, h: H - 116 - 104}; this.k = Math.max(this.vr.w / PANO_W, this.vr.h / PANO_H); this.hits = []; this.drag = null;
 }
 private tier(): CityTier { return cityById(this.cityId)?.tier ?? 'small'; }
 private slots(): Record<CityBuildingId, Slot> { return (TOWN_ART_READY ? SLOTS : BORROW_SLOTS)[this.tier()]; }
 private bgKey(): string { return TOWN_ART_READY ? `town_bg_${this.tier()}` : `city_bg_${BORROW_BG[this.tier()]}`; }
 private artKey(id: CityBuildingId, level: number): string { const lv = Math.min(3, Math.max(1, level)); return TOWN_ART_READY ? `town_${id}_${lv}` : `city_${BORROW_BUILDING[id]}_${lv}`; }
 preload() {
  if (!worldUnlocked() && !isChapterTestRun()) return;
  const t = this.tier();
  // 民居店铺（攻城城内图集）、石桥、居民行走图：纯装饰（town/TownLife）
  loadTownLife(this);
  worldAssets(this, 'town_badge_upgrade', 'assets/town-city/badge_upgrade.png'); worldAssets(this, 'town_badge_build', 'assets/town-city/badge_build.png');
  if (TOWN_ART_READY) { worldAssets(this, `town_bg_${t}`, `assets/town-city/bg_${t}.webp`); for (const id of CITY_BUILDING_IDS) for (let l = 1; l <= 3; l++) worldAssets(this, `town_${id}_${l}`, `assets/town-city/${id}_${l}.webp`); }
  else { const n = BORROW_BG[t]; worldAssets(this, `city_bg_${n}`, `assets/city/bg_${n}.webp`); for (const id of CITY_BUILDING_IDS) for (let l = 1; l <= 3; l++) worldAssets(this, `city_${BORROW_BUILDING[id]}_${l}`, `assets/city/${BORROW_BUILDING[id]}_${l}.webp`); }
 }
 create() {
  playMenuMusic(this);
  const c = cityById(this.cityId), s = loadWorld();
  if ((!worldUnlocked() && !isChapterTestRun()) || !c || !s.ownedCities.includes(this.cityId)) { this.scene.start('WorldMapScene'); return; }
  this.pano = this.add.container(0, 0).setDepth(-5);
  const mask = this.make.graphics({x: 0, y: 0}).fillStyle(0xffffff).fillRect(this.vr.x, this.vr.y, this.vr.w, this.vr.h); this.pano.setMask(mask.createGeometryMask());
  // 居民与全景同一容器（按脚下 y 排前后，走到屋后被屋子挡住）；精灵不接收点击，不挡建筑
  this.folk = new TownFolk(this, this.pano, this.k, this.tier());
  const tick = (_t: number, dt: number) => this.folk?.update(dt); this.events.on('update', tick); this.events.once('shutdown', () => { this.events.off('update', tick); this.folk = undefined; }); this.events.once('shutdown', () => mask.destroy());
  const head = this.add.graphics().setDepth(-1); head.fillStyle(0x102019, 1).fillRect(0, 0, W, this.vr.y).fillRect(0, this.vr.y + this.vr.h, W, H - this.vr.y - this.vr.h);
  head.lineStyle(2, 0xb3935b, .85).strokeRect(this.vr.x, this.vr.y, this.vr.w, this.vr.h);
  worldShell(this, c.name);
  this.header = txt(this, D ? 150 : 24, D ? 26 : 62, '', D ? 15 : 13, '#e7c98a', HEADING_FONT).setOrigin(0, .5).setName('town-header');
  this.income = txt(this, D ? 150 : 24, D ? 52 : 86, '', D ? 13 : 12, '#b9d2a8').setOrigin(0, .5).setName('town-income');
  this.grain = txt(this, W - 24, D ? 26 : 30, '', D ? 15 : 14, '#efe0b4', HEADING_FONT).setOrigin(1, .5).setName('town-grain');
  const back = homeCommand(this, W / 2, D ? H - 28 : H - 72, D ? 260 : W - 60, D ? 40 : 52, '返回天下地图', true, true, D ? 16 : 17);
  back.hit.setName('town-back').on('pointerdown', () => { this.registry.set('mapFocusCity', this.cityId); this.scene.start('WorldMapScene'); });
  if (D) txt(this, 24, H - 28, '点建筑即可建造或升级', 12, '#a9b9a2').setOrigin(0, .5).setName('town-tip');
  this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (this.anyModal() || !this.inView(p.x, p.y)) return; this.drag = {x: p.x, y: p.y, sx: this.sx, sy: this.sy, moved: false}; });
  this.input.on('pointermove', (p: Phaser.Input.Pointer) => { const d = this.drag; if (!d || !p.isDown) return; const dx = p.x - d.x, dy = p.y - d.y; if (!d.moved && Math.hypot(dx, dy) < 8) return; d.moved = true; this.scrollTo(d.sx - dx, d.sy - dy); });
  this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
   // 点居民：没点到建筑、没在拖动时，最近的居民冒一句话
   if (!this.drag?.moved && !this.anyModal() && this.inView(p.x, p.y) && !over.some(o => /^bld-/.test(o.name))) this.folk?.barkAt(p.x - this.pano.x, p.y - this.pano.y);
   this.time.delayedCall(0, () => { this.drag = null; });
  });
  this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => { if (this.anyModal()) return; this.scrollTo(this.sx + (dx || dy) * .6, this.sy + dy * .3); });
  // 初始视角：横向对准府衙；大城府衙在城内深处，纵向也对准它，小 / 中城贴底
  // 初始视角：横向居中，纵向对准三座建筑的中间（城门与远景在上方，可往上拖着看）
  const sl = Object.values(this.slots()), cy = sl.reduce((n, s) => n + s.y, 0) / sl.length - 80; this.scrollTo((PANO_W * this.k - this.vr.w) / 2, cy * this.k - this.vr.h / 2, false);
  this.refresh();
 }
 private anyModal() { return this.children.list.some(o => (o as unknown as {depth: number}).depth >= 600); }
 private inView(x: number, y: number) { const r = this.vr; return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
 private scrollTo(sx: number, sy: number, _remember = true) {
  this.sx = Phaser.Math.Clamp(sx, 0, Math.max(0, PANO_W * this.k - this.vr.w)); this.sy = Phaser.Math.Clamp(sy, 0, Math.max(0, PANO_H * this.k - this.vr.h));
  this.pano?.setPosition(this.vr.x - this.sx, this.vr.y - this.sy);
  for (const h of this.hits) { const x = h.x + this.pano.x, y = h.y + this.pano.y; if (h.input) h.input.enabled = this.inView(x, y); }
 }
 private refresh() {
  const s = loadWorld(), c = cityById(this.cityId)!, lv = cityLevels(this.cityId, s), sp = SPECIALTIES[c.id];
  this.header.setText(`${TIER_NAME[c.tier]} · ${c.region} · 府衙 Lv${lv.office}`);
  this.folk?.setCount(folkCount(c.tier, lv.office)); this.folk?.setAmbient(lv);
  this.income.setText(`每战产出：${incomeText(cityIncome(c.tier, lv))}${sp ? `　特产「${sp.title}」${sp.text}` : ''}`);
  this.grain.setText(`军粮 ${s.provisions}`);
  this.drawPano();
 }
 private drawPano() {
  this.folk?.detach(); this.pano.removeAll(true); this.hits = [];
  const s = loadWorld(), t = this.tier(), lv = cityLevels(this.cityId, s), k = this.k, slots = this.slots();
  if (this.textures.exists(this.bgKey())) { const bg = this.add.image(0, 0, this.bgKey()).setOrigin(0).setDisplaySize(PANO_W * k, PANO_H * k).setName('town-bg'); zy(bg, -1e9); this.pano.add(bg); }
  else { const g = this.add.graphics(); g.fillStyle(0x7a6544, 1).fillRect(0, 0, PANO_W * k, PANO_H * k); this.pano.add(g); }
  // 民居店铺、空建筑位小旗、石桥（数量随档次与府衙等级；只是图片，不接收点击）
  drawTownDecor(this, this.pano, k, t, lv.office, lv, TOWN_ART_READY ? this.bgKey() : undefined);
  const ids = CITY_BUILDING_IDS.filter(id => CITY_BUILDINGS[id].max[t] > 0).sort((a, b) => slots[a].y - slots[b].y);
  for (const id of ids) {
   const sl = slots[id], l = lv[id], x = sl.x * k, y = sl.y * k, cost = cityBuildCost(id, t, l), block = cityBuildBlockers(id, t, lv), ready = cost !== null && !block.length && s.provisions >= cost;
   let w = sl.w * k * LEVEL_SCALE[Math.min(3, Math.max(1, l))], h = w * .72, art: Phaser.GameObjects.Image | undefined, glow: Phaser.GameObjects.Ellipse | undefined;
   if (l > 0 && this.textures.exists(this.artKey(id, l))) {
    glow = this.add.ellipse(x, y - w * .06, w * 1.02, w * .34, 0xffe39a, 0).setName('glow-' + id); this.pano.add(glow);
    art = this.add.image(x, y, this.artKey(id, l)).setOrigin(.5, 1); art.setScale(w / art.width); h = art.displayHeight; this.pano.add(art);
   } else {
    // 正式全景里地基已经画好：只放名牌，不再画地基圈
    if (TOWN_ART_READY) { h = w * .5; } else {
    const g = this.add.graphics(), fw = w * .8; g.fillStyle(0x3a2c1c, .38).fillEllipse(x, y - fw * .12, fw, fw * .32); g.lineStyle(2, block.length ? 0x8c8270 : 0xe8cf8f, .85);
    for (let a = 0; a < 20; a += 2) { const a0 = a / 20 * Math.PI * 2, a1 = (a + 1) / 20 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a0) * fw / 2, y - fw * .12 + Math.sin(a0) * fw * .16); g.lineTo(x + Math.cos(a1) * fw / 2, y - fw * .12 + Math.sin(a1) * fw * .16); g.strokePath(); }
    this.pano.add(g); h = fw * .5; }
   }
   const name = CITY_BUILDINGS[id].name, label = l > 0 ? `${name} Lv${l}` : block.length ? `${name} · 需${block[0]}` : `＋ ${name}`;
   const tag = txt(this, x, y - (l > 0 ? 4 : h * .24), label, D ? 12 : 13, l > 0 ? '#fff1cf' : block.length ? '#b3a78f' : '#f6e2ae').setOrigin(.5, 1).setBackgroundColor(l > 0 ? '#20150dcc' : '#20150d99').setPadding(6, 2, 6, 2).setName('tag-' + id);
   this.pano.add(tag);
   if (ready) { const badge = this.add.container(x + w * .32, Math.max(14, y - h + 10)); const bk = l > 0 ? 'town_badge_upgrade' : 'town_badge_build'; /* 2026-11-18 手绘「可升级 / 可建造」徽记（美术会话 art-style）；缺图时退回原绿圆 ↑ */ if (this.textures.exists(bk)) badge.add(this.add.image(0, 0, bk).setOrigin(.5, .56).setDisplaySize(32, 32)); else { badge.add(this.add.circle(0, 0, 11, 0x2f7a3a).setStrokeStyle(2, 0xd8f0b8)); badge.add(txt(this, 0, 0, '↑', 14, '#ffffff', HEADING_FONT).setOrigin(.5)); } badge.setName('ready-' + id); this.pano.add(badge); this.tweens.add({targets: badge, y: badge.y - 4, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut'}); }
   const hit = this.add.rectangle(x, y - h / 2, Math.max(w * .8, 60), Math.max(h, 50), 0xffffff, .001).setName('bld-' + id).setInteractive({useHandCursor: true});
   hit.on('pointerdown', () => { this.pressed = id; });
   hit.on('pointerup', () => { const own = this.pressed === id; this.pressed = null; if (!own || this.drag?.moved) return; this.openCard(id); });
   const base = art ? {x: art.scaleX, y: art.scaleY} : null, color = tag.style.color as string;
   hit.on('pointerover', () => { tag.setColor('#ffe08a').setScale(1.18); glow?.setFillStyle(0xffe39a, .5); if (art && base) art.setScale(base.x * 1.04, base.y * 1.04); })
    .on('pointerout', () => { tag.setColor(color).setScale(1); glow?.setFillStyle(0xffe39a, 0); if (art && base) art.setScale(base.x, base.y); });
   if (id === 'office') hit.setData('padDefault', true);
   this.pano.add(hit); this.hits.push(hit);
  }
  // 排前后：名牌、徽记、点击区总在最上；建筑与民居按底边 y；居民放回来一起排
  for (const o of this.pano.list) if ((o as unknown as {zy?: number}).zy === undefined && (o instanceof Phaser.GameObjects.Text || o instanceof Phaser.GameObjects.Rectangle || o instanceof Phaser.GameObjects.Container)) zy(o, 1e8);
  if (this.folk) this.folk.attach(); else this.pano.list.sort((p, q) => ((p as unknown as {zy?: number}).zy ?? (p as unknown as {y: number}).y) - ((q as unknown as {zy?: number}).zy ?? (q as unknown as {y: number}).y));
  this.scrollTo(this.sx, this.sy);
 }
 private toast(v: string) {
  const warn = storageUnavailable ? (incompatibleSave ? '存档版本较新，本次修改不会保存' : '存储不可用，修改仅保留本次会话') : '', msg = [v, warn].filter(Boolean).join('\n'); if (!msg) return;
  this.children.getByName('town-toast')?.destroy();
  const tt = txt(this, W / 2, this.vr.y + this.vr.h - 18, msg, D ? 15 : 14, '#ffe7a8', HEADING_FONT).setOrigin(.5, 1).setDepth(8).setAlign('center').setBackgroundColor('#1a120bdd').setPadding(12, 6, 12, 6).setName('town-toast');
  this.tweens.add({targets: tt, alpha: 0, delay: 2600, duration: 600, onComplete: () => tt.destroy()});
 }
 /** 建筑面板：现状、下一级效果、花费、前提，建造 / 升级。 */
 private openCard(id: CityBuildingId) {
  this.children.getByName('town-build-card')?.destroy();
  const s = loadWorld(), t = this.tier(), lv = cityLevels(this.cityId, s), l = lv[id], def = CITY_BUILDINGS[id], cost = cityBuildCost(id, t, l), block = cityBuildBlockers(id, t, lv), ok = cost !== null && !block.length && s.provisions >= cost;
  const h = D ? 380 : 560, w = Math.min(D ? 640 : W - 24, W - 24), y0 = (H - h) / 2, x0 = (W - w) / 2;
  const root = this.add.container(0, 0).setDepth(640).setName('town-build-card');
  root.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b0806, .78).setInteractive());
  root.add(this.add.image(W / 2, H / 2, warPanelTexture(this, w, h, true)).setDisplaySize(w + 16, h + 16));
  root.add(txt(this, W / 2, y0 + 30, `${def.name} · ${l ? 'Lv' + l : '未建'}`, 22, '#efd399', HEADING_FONT).setOrigin(.5).setName('town-build-card-title'));
  const px = D ? x0 + 130 : W / 2, py = D ? y0 + 240 : y0 + 220, key = this.artKey(id, Math.max(1, l));
  if (this.textures.exists(key)) { const img = this.add.image(px, py, key).setOrigin(.5, 1); img.setScale(Math.min((D ? 210 : 240) / img.width, (D ? 170 : 150) / img.height)); if (!l) img.setAlpha(.45); root.add(img); }
  const tx = D ? x0 + 260 : x0 + 30, tw = D ? w - 290 : w - 60; let y = D ? y0 + 64 : y0 + 240;
  const line = (v: string, size = 14, color = '#e9dcc0', name?: string) => { const o = txt(this, tx, y, v, size, color).setWordWrapWidth(tw, true); if (name) o.setName(name); root.add(o); y += o.height + 8; return o; };
  line(def.blurb, 13, '#c9bf99');
  line(l ? '现在：' + def.effect(l, t) : '尚未建造', 14, '#efe2c4');
  if (cost !== null) { line((l ? '下一级：' : '建成后：') + def.effect(l + 1, t), 14, '#cfe0c8'); line(`花费：军粮 ${cost}`, 14, s.provisions >= cost ? '#d9c58f' : '#d4887a', 'town-build-cost'); }
  else line(def.max[t] <= 0 ? `${TIER_NAME[t]}不能建造` : '已达最高等级', 14, '#b9a98a');
  if (block.length && cost !== null) line('需要：' + block.join('、'), 14, '#e59a83', 'town-build-block');
  line(`${TIER_NAME[t]}最高 Lv${def.max[t]}`, 12, '#9fa991');
  const msg = txt(this, W / 2, y0 + h - (D ? 112 : 126), '', 13, '#e8c98a').setOrigin(.5).setName('town-build-msg'); root.add(msg);
  const bw = Math.min(200, (w - 80) / 2), by = y0 + h - (D ? 80 : 90);
  const up = homeCommand(this, W / 2 + bw / 2 + 8, by, bw, 42, cost !== null ? (l ? `升级到 Lv${l + 1}` : '建造') : '已满级', true, ok, 16);
  up.hit.setName('town-build-upgrade').setData('padDefault', true).on('pointerdown', () => {
   if (!ok) { msg.setText(cost !== null ? (block.length ? '需要 ' + block.join('、') : '军粮不足：需要 ' + cost) : '已达最高等级'); return; }
   const res = cityBuild(this.cityId, id); if (!res.ok) { msg.setText(res.message); return; }
   uiSfx().play('uiClick'); root.destroy(); this.refresh(); this.toast(res.message);
  });
  const close = homeCommand(this, W / 2 - bw / 2 - 8, by, bw, 42, '返回', false, true, 15);
  close.hit.setName('town-build-close').on('pointerdown', () => { root.destroy(); this.refresh(); });
  root.add([up.g, up.hit, up.caption, close.g, close.hit, close.caption]);
 }
}
