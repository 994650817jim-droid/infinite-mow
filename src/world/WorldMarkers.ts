import Phaser from 'phaser';
import {HEADING_FONT, RENDER_SCALE} from '../config';
import type {CityDef, FactionId} from './WorldCities';
import {FACTIONS} from './WorldCities';
import {BANNER_CHAR, type CityMarker} from './WorldMapLayers';

/**
 * 天下地图标记 v2（程序化过渡美术，正式图见 public/assets/world/markers-v2/ASSET_REQUEST.md）：
 * 城池 = 立体城郭小图标 + 势力军旗 + 势力色描边的名牌；章节节点 = 牙旗（战 / 捷 / 锁）与营帐；
 * 关卡 = 朱砂方印；军情 = 三角令旗。参照《三国志》系列的城郭图标与《全面战争：三国》的名牌横幅。
 * 贴图按渲染倍率在 Canvas 上绘制并缓存；命中区与旧版同名，测试与手柄导航沿用。
 * 默认启用（2026-11-16 用户批准）；地址加 ?markers=v1 可回到旧版圆形徽框。
 */
export const MARKERS_V2 = (() => { try { return new URLSearchParams(location.search).get('markers') !== 'v1'; } catch { return true; } })();

const S = () => Math.max(2, Math.min(4, RENDER_SCALE * 2));
const mix = (n: number, m: number, k: number) => { const f = (s: number) => Math.round(((n >> s) & 255) * (1 - k) + ((m >> s) & 255) * k); return (f(16) << 16) | (f(8) << 8) | f(0); };

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const s = S(), c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
  const ctx = c.getContext('2d')!; ctx.scale(s, s); draw(ctx);
  scene.textures.addCanvas(key, c); return key;
}

/** 歇山顶：两端起翘的屋檐，深青瓦。 */
function roof(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number, tile = '#3a4350') {
  const l = cx - w / 2, r = cx + w / 2;
  ctx.beginPath(); ctx.moveTo(l - w * .08, y + h * .78);
  ctx.quadraticCurveTo(l + w * .06, y + h * .62, l + w * .2, y + h * .2);
  ctx.lineTo(r - w * .2, y + h * .2);
  ctx.quadraticCurveTo(r - w * .06, y + h * .62, r + w * .08, y + h * .78);
  ctx.quadraticCurveTo(cx, y + h, l - w * .08, y + h * .78); ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5b6675'); g.addColorStop(.5, tile); g.addColorStop(1, '#1f252d');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#14181d'; ctx.lineWidth = .8; ctx.stroke();
  ctx.strokeStyle = 'rgba(210,190,140,.55)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(l + w * .2, y + h * .2); ctx.lineTo(r - w * .2, y + h * .2); ctx.stroke();
  // 瓦垄
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .5;
  for (let x = l + w * .08; x < r - w * .06; x += w / 9) { ctx.beginPath(); ctx.moveTo(x + (cx - x) * .25, y + h * .26); ctx.lineTo(x, y + h * .8); ctx.stroke(); }
}

/** 城墙正面：夯土 / 青砖，带垛口与砖缝。 */
function wall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#cdb88f'); g.addColorStop(.45, '#a38c66'); g.addColorStop(1, '#6e5d43');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * .03, y); ctx.lineTo(x + w * .97, y); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3d3122'; ctx.lineWidth = .9; ctx.stroke();
  ctx.strokeStyle = 'rgba(60,45,28,.35)'; ctx.lineWidth = .5;
  for (let yy = y + h * .3; yy < y + h; yy += h * .24) { ctx.beginPath(); ctx.moveTo(x + 1, yy); ctx.lineTo(x + w - 1, yy); ctx.stroke(); }
  // 垛口
  const n = Math.max(4, Math.round(w / 5)), step = w * .94 / n;
  ctx.fillStyle = '#d8c59c';
  for (let i = 0; i < n; i += 2) ctx.fillRect(x + w * .03 + i * step, y - h * .2, step, h * .2 + .5);
  ctx.strokeStyle = '#3d3122'; ctx.lineWidth = .6;
  for (let i = 0; i < n; i += 2) ctx.strokeRect(x + w * .03 + i * step, y - h * .2, step, h * .2);
}

function gate(ctx: CanvasRenderingContext2D, cx: number, bottom: number, w: number, h: number) {
  ctx.fillStyle = '#20160d'; ctx.beginPath(); ctx.moveTo(cx - w / 2, bottom); ctx.lineTo(cx - w / 2, bottom - h + w / 2); ctx.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(cx + w / 2, bottom); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = .7; ctx.stroke();
  ctx.fillStyle = '#6a2a1a'; ctx.fillRect(cx - w * .38, bottom - h * .62, w * .76, h * .62);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(cx, bottom - h * .62); ctx.lineTo(cx, bottom); ctx.stroke();
}

function tower(ctx: CanvasRenderingContext2D, cx: number, bottom: number, w: number, h: number) {
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, '#8e7552'); g.addColorStop(1, '#c2a77b');
  ctx.fillStyle = g; ctx.fillRect(cx - w / 2, bottom - h, w, h); ctx.strokeStyle = '#3d3122'; ctx.lineWidth = .7; ctx.strokeRect(cx - w / 2, bottom - h, w, h);
  ctx.fillStyle = '#2a1d12'; ctx.fillRect(cx - w * .18, bottom - h * .72, w * .36, h * .3);
}

const CITADEL = {large: {w: 56, h: 46}, medium: {w: 44, h: 36}, small: {w: 32, h: 26}} as const;
/** 城郭正式图（ChatGPT 生成，2026-11-15，见 public/assets/world/markers-v2/ASSET_REQUEST.md W2-1/2/3）；缺图时退回程序画。 */
export const CITY_ART_FILES = {wm2_city_large: 'assets/world/markers-v2/W2-1_city_large.png', wm2_city_medium: 'assets/world/markers-v2/W2-2_city_medium.png', wm2_city_small: 'assets/world/markers-v2/W2-3_city_small.png'} as const;
/** 正式图在地图上的显示宽度（设计像素）。 */
const CITY_ART_W = {large: 78, medium: 62, small: 50} as const;

/** 城郭图标：大城 = 双角楼 + 两层城楼；中城 = 城门楼；小城 = 木栅寨 + 望楼。 */
export function citadelTexture(scene: Phaser.Scene, tier: CityDef['tier']): string {
  const {w, h} = CITADEL[tier];
  return canvasTexture(scene, `wm2-citadel-${tier}-${S()}`, w, h, ctx => {
    // 地面投影
    ctx.fillStyle = 'rgba(10,8,5,.45)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 3.5, w * .47, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    if (tier === 'small') {
      // 木栅
      for (let x = 3; x < w - 3; x += 3.2) {
        const g = ctx.createLinearGradient(x, 0, x + 2.6, 0); g.addColorStop(0, '#5a3d22'); g.addColorStop(1, '#9a6f43');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, h - 4); ctx.lineTo(x, h - 13); ctx.lineTo(x + 1.3, h - 15.5); ctx.lineTo(x + 2.6, h - 13); ctx.lineTo(x + 2.6, h - 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = .4; ctx.stroke();
      }
      ctx.fillStyle = '#3a2614'; ctx.fillRect(3, h - 11, w - 6, 1.2);
      // 望楼
      ctx.strokeStyle = '#4a321b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(w * .62, h - 6); ctx.lineTo(w * .62, h - 20); ctx.moveTo(w * .82, h - 6); ctx.lineTo(w * .82, h - 20); ctx.stroke();
      ctx.fillStyle = '#9a6f43'; ctx.fillRect(w * .58, h - 21, w * .28, 3);
      roof(ctx, w * .72, h - 26.5, w * .36, 6.5, '#5a4630');
      gate(ctx, w * .3, h - 4, 5, 8);
      return;
    }
    const big = tier === 'large', wallTop = h * (big ? .5 : .52), wallH = h - 4 - wallTop;
    if (big) { tower(ctx, w * .12, h - 4, w * .17, h * .62); tower(ctx, w * .88, h - 4, w * .17, h * .62); }
    wall(ctx, w * (big ? .12 : .06), wallTop, w * (big ? .76 : .88), wallH);
    if (big) { roof(ctx, w * .12, h * .28, w * .26, h * .14); roof(ctx, w * .88, h * .28, w * .26, h * .14); }
    // 城门楼
    const tw = w * (big ? .36 : .4), tBottom = wallTop - (big ? 1 : .5), th = h * (big ? .14 : .16);
    ctx.fillStyle = '#7a2a1a'; ctx.fillRect(w / 2 - tw * .42, tBottom - th, tw * .84, th);
    ctx.fillStyle = '#c99a4a'; for (let i = 0; i < 4; i++) ctx.fillRect(w / 2 - tw * .36 + i * tw * .23, tBottom - th * .8, tw * .1, th * .55);
    if (big) { roof(ctx, w / 2, tBottom - th - h * .12, tw * 1.18, h * .14); ctx.fillStyle = '#7a2a1a'; ctx.fillRect(w / 2 - tw * .32, tBottom - th - h * .12 - h * .08, tw * .64, h * .09); roof(ctx, w / 2, tBottom - th - h * .32, tw * .95, h * .16); }
    else roof(ctx, w / 2, tBottom - th - h * .17, tw * 1.2, h * .19);
    gate(ctx, w / 2, h - 4, w * (big ? .12 : .14), wallH * .78);
  });
}

/** 势力色名牌：漆底 + 顶边势力色条 + 两端菱钉；己方描金。 */
function namePlate(scene: Phaser.Scene, y: number, name: string, owner: FactionId, size: number) {
  const color = FACTIONS[owner].color, player = owner === 'player';
  const t = scene.add.text(0, y, name, {fontFamily: HEADING_FONT, fontSize: size + 'px', color: player ? '#fff1c4' : '#f4e6c6', resolution: 2 * RENDER_SCALE}).setOrigin(.5, 0);
  const w = t.width + 14, h = t.height + 2, g = scene.add.graphics();
  g.fillStyle(0x000000, .35).fillRoundedRect(-w / 2 + 1, y + 1.5, w, h, 3);
  g.fillStyle(0x1b120b, .9).fillRoundedRect(-w / 2, y, w, h, 3);
  g.fillStyle(mix(color, 0xffffff, .15), 1).fillRect(-w / 2 + 2, y, w - 4, 2.2);
  g.lineStyle(1, player ? 0xf3d48a : mix(color, 0x000000, .2), player ? 1 : .9).strokeRoundedRect(-w / 2, y, w, h, 3);
  g.fillStyle(player ? 0xf3d48a : 0xc9a35e, 1);
  for (const sx of [-1, 1]) g.fillTriangle(sx * w / 2, y + h / 2 - 2.5, sx * (w / 2 + 2.5), y + h / 2, sx * w / 2, y + h / 2 + 2.5);
  return {t, g, h};
}

/** 方旗（燕尾）：杆 + 势力色旗面 + 姓氏；纯程序化。 */
function flag(scene: Phaser.Scene, x: number, bottom: number, height: number, color: number, glyph?: string): Phaser.GameObjects.GameObject[] {
  const g = scene.add.graphics(), fw = height * .5, fh = height * .5, top = bottom - height;
  g.lineStyle(1.6, 0x3a2614, 1).lineBetween(x, bottom, x, top - 2);
  g.fillStyle(0xe2c27a, 1).fillCircle(x, top - 3, 1.6);
  g.fillStyle(0x000000, .3).fillPoints([{x: x + 1, y: top + 1}, {x: x + fw + 1, y: top + 1}, {x: x + fw * .8 + 1, y: top + fh * .5 + 1}, {x: x + fw + 1, y: top + fh + 1}, {x: x + 1, y: top + fh + 1}], true);
  g.fillStyle(color, 1).fillPoints([{x, y: top}, {x: x + fw, y: top}, {x: x + fw * .78, y: top + fh * .5}, {x: x + fw, y: top + fh}, {x, y: top + fh}], true);
  g.lineStyle(1, 0xf0d496, .9).strokePoints([{x, y: top}, {x: x + fw, y: top}, {x: x + fw * .78, y: top + fh * .5}, {x: x + fw, y: top + fh}, {x, y: top + fh}], true, true);
  const out: Phaser.GameObjects.GameObject[] = [g];
  if (glyph) out.push(scene.add.text(x + fw * .42, top + fh * .5, glyph.length > 1 ? glyph[0] : glyph, {fontFamily: HEADING_FONT, fontSize: Math.round(fh * .62) + 'px', color: '#fff6e0', resolution: 2 * RENDER_SCALE}).setOrigin(.5).setStroke('#1a120a', 2));
  return out;
}

/** v2 城池标记：城郭图标立在城址上，旗插在城楼左侧，名牌在下。 */
export function cityMarkerV2(scene: Phaser.Scene, city: CityDef, owner: FactionId): CityMarker {
  // 贴图按基准尺寸绘制，显示时按城级放大（渲染倍率足够，不发糊）
  const art = 'wm2_city_' + city.tier, hasArt = scene.textures.exists(art), root = scene.add.container(0, 0), color = FACTIONS[owner].color;
  let w: number, h: number;
  if (hasArt) { const fr = scene.textures.getFrame(art); w = CITY_ART_W[city.tier]; h = w * fr.height / fr.width; }
  else { const K = city.tier === 'large' ? 1.15 : city.tier === 'medium' ? 1.3 : 1.4; w = CITADEL[city.tier].w * K; h = CITADEL[city.tier].h * K; }
  const ring = scene.add.graphics();
  // 正式图脚下带一片草地，底边比城址略低，名牌压在草地上
  const icon = scene.add.image(0, hasArt ? 11 : 8, hasArt ? art : citadelTexture(scene, city.tier)).setOrigin(.5, 1).setDisplaySize(w, h);
  const parts: Phaser.GameObjects.GameObject[] = [ring, icon];
  const ch = BANNER_CHAR[owner];
  if (owner !== 'han') parts.push(...flag(scene, -w * .5 + (city.tier === 'small' ? 5 : 3), 8 - h * .38, city.tier === 'large' ? 40 : city.tier === 'medium' ? 34 : 26, color, ch));
  if (owner === 'player') { const g = scene.add.graphics(); g.lineStyle(1.5, 0xf3d48a, .85).strokeEllipse(0, 3, w * .98, 9); parts.unshift(g); }
  const plate = namePlate(scene, hasArt ? 7 : 9, city.name, owner, city.tier === 'large' ? 13 : city.tier === 'medium' ? 12 : 11);
  const hit = scene.add.circle(0, -h * .3, Math.max(w * .5, 16), 0, .001).setInteractive({useHandCursor: true}).setName('city-' + city.id);
  root.add([...parts, plate.g, plate.t, hit]);
  root.setData('banner', ch ?? null).setData('v2', true).setData('plate', plate.g).setData('icon', icon);
  // 选中光环、告急外环以 outer 为半径，top 为图标顶到城址的高度
  return {city, root, label: plate.t, ring, hit, outer: w * .5, top: h + (owner !== 'han' ? 10 : 0)};
}

/** v2 选中：城郭脚下一圈金色光晕椭圆。 */
export function paintSelectionV2(m: CityMarker, on: boolean) {
  m.ring.clear(); if (!on) return;
  m.ring.fillStyle(0xffe9a8, .22).fillEllipse(0, 3, m.outer * 2.6, 16).lineStyle(2, 0xffe9a8, 1).strokeEllipse(0, 3, m.outer * 2.5, 14).lineStyle(1, 0xffe9a8, .5).strokeEllipse(0, 3, m.outer * 2.9, 19);
}

type NodeState = 'home' | 'cleared' | 'open' | 'locked';
/** 牙旗：长杆 + 竖幅旗面（火焰齿边）+ 旗面大字；营 = 军帐。 */
export function nodeBannerTexture(scene: Phaser.Scene, st: NodeState): string {
  const w = 34, h = 50;
  return canvasTexture(scene, `wm2-node-${st}-${S()}`, w, h, ctx => {
    ctx.fillStyle = 'rgba(10,8,5,.45)'; ctx.beginPath(); ctx.ellipse(w * .32, h - 2.5, 9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    if (st === 'home') {
      // 军帐
      const g = ctx.createLinearGradient(0, h * .35, 0, h - 3); g.addColorStop(0, '#efe0bd'); g.addColorStop(1, '#a9916a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w * .5, h * .34); ctx.quadraticCurveTo(w * .7, h * .62, w * .97, h - 4); ctx.lineTo(w * .03, h - 4); ctx.quadraticCurveTo(w * .3, h * .62, w * .5, h * .34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a3720'; ctx.lineWidth = .9; ctx.stroke();
      ctx.fillStyle = '#7a2a1a'; ctx.beginPath(); ctx.moveTo(w * .5, h * .34); ctx.lineTo(w * .62, h * .5); ctx.lineTo(w * .38, h * .5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2614'; ctx.beginPath(); ctx.moveTo(w * .5, h * .62); ctx.lineTo(w * .62, h - 4); ctx.lineTo(w * .38, h - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(w * .5, h * .34); ctx.lineTo(w * .5, h * .12); ctx.stroke();
      ctx.fillStyle = '#2f7a4a'; ctx.beginPath(); ctx.moveTo(w * .5, h * .12); ctx.lineTo(w * .78, h * .17); ctx.lineTo(w * .5, h * .23); ctx.closePath(); ctx.fill();
      return;
    }
    const cloth = st === 'cleared' ? ['#2c5a3a', '#1c3a26'] : st === 'open' ? ['#b0321f', '#6e1a10'] : ['#5f625c', '#3a3d38'];
    const trim = st === 'cleared' ? '#e6c77a' : st === 'open' ? '#f3d48a' : '#9a9c92';
    const px = w * .2, top = 3;
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, h - 3); ctx.lineTo(px, top); ctx.stroke();
    ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(px - 2.2, top + 1); ctx.lineTo(px, top - 2.5); ctx.lineTo(px + 2.2, top + 1); ctx.closePath(); ctx.fill();
    // 横杆
    ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px, top + 3); ctx.lineTo(w * .92, top + 3); ctx.stroke();
    // 旗面（底边火焰齿）
    const l = px + 1, r = w * .9, t = top + 4, b = h * .74, g = ctx.createLinearGradient(l, 0, r, 0); g.addColorStop(0, cloth[1]); g.addColorStop(.35, cloth[0]); g.addColorStop(1, cloth[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(r, t); ctx.lineTo(r, b);
    const teeth = 4, tw = (r - l) / teeth; for (let i = teeth; i > 0; i--) { ctx.lineTo(l + tw * (i - .5), b + 5); ctx.lineTo(l + tw * (i - 1), b); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,170,.35)'; ctx.lineWidth = .6; ctx.strokeRect(l + 2.2, t + 2.2, r - l - 4.4, b - t - 3);
  });
}

/** v2 章节节点：返回要放进节点容器的物件（命中区沿用旧名 node-<id>）。 */
export function nodeMarkerV2(scene: Phaser.Scene, st: NodeState, glyph: string, label: string, active: boolean): {parts: Phaser.GameObjects.GameObject[]; hit: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; plate: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image} {
  const img = scene.add.image(0, 8, nodeBannerTexture(scene, st)).setOrigin(.32, 1).setDisplaySize(34, 50);
  const parts: Phaser.GameObjects.GameObject[] = [img];
  if (st !== 'home') parts.push(scene.add.text(34 * (.55 - .32), 8 - 50 * .55, glyph, {fontFamily: HEADING_FONT, fontSize: '15px', color: st === 'locked' ? '#d8d8cc' : '#fff1cc', resolution: 2 * RENDER_SCALE}).setOrigin(.5).setStroke('#1a0e08', 3));
  const t = scene.add.text(0, 12, label, {fontFamily: HEADING_FONT, fontSize: '12px', color: active ? '#fff0cd' : '#c9c7b8', resolution: 2 * RENDER_SCALE}).setOrigin(.5, 0);
  const pw = t.width + 16, ph = t.height + 2, g = scene.add.graphics();
  const edge = st === 'open' ? 0xb0321f : st === 'cleared' ? 0x5f9a5a : st === 'home' ? 0x88c5a4 : 0x6a6d64;
  g.fillStyle(0x000000, .35).fillRect(-pw / 2 + 1, 13.5, pw, ph);
  g.fillStyle(0x1b120b, .9).fillRect(-pw / 2, 12, pw, ph);
  g.fillStyle(edge, 1).fillRect(-pw / 2, 12, 3, ph).fillRect(pw / 2 - 3, 12, 3, ph);
  g.lineStyle(1, 0xc9a35e, .8).strokeRect(-pw / 2, 12, pw, ph);
  parts.push(g, t);
  const hit = scene.add.circle(0, -12, 22, 0, .001);
  return {parts, hit, label: t, plate: g, icon: img};
}

/** 朱砂方印（关卡）：已捷为青绿印、未开为灰石印。 */
export function sealGraphics(scene: Phaser.Scene, state: 'cleared' | 'open' | 'locked', r: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics(), s = r * 1.7, fill = state === 'cleared' ? 0x2c5a3a : state === 'open' ? 0x9a2a1c : 0x4a4d46, line = state === 'cleared' ? 0xe6c77a : state === 'open' ? 0xf0c9a0 : 0x9a9c92;
  g.fillStyle(0x000000, .4).fillRoundedRect(-s / 2 + 2, -s / 2 + 3, s, s, 4);
  g.fillStyle(fill, 1).fillRoundedRect(-s / 2, -s / 2, s, s, 4);
  g.lineStyle(1.6, line, .95).strokeRoundedRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6, 2);
  return g;
}

/** 三角令旗（军情）：杆 + 势力 / 军情色三角旗面。返回物件，旗面中心约在 (8,-14)。 */
export function intelPennant(scene: Phaser.Scene, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, .35).fillEllipse(0, 12, 14, 4);
  g.lineStyle(1.8, 0x3a2614, 1).lineBetween(-6, 12, -6, -26);
  g.fillStyle(0xe2c27a, 1).fillCircle(-6, -27, 2);
  const pts = [{x: -5, y: -24}, {x: 20, y: -15}, {x: -5, y: -4}];
  g.fillStyle(0x000000, .3).fillPoints(pts.map(p => ({x: p.x + 1, y: p.y + 1.5})), true);
  g.fillStyle(color, 1).fillPoints(pts, true);
  g.lineStyle(1.2, 0xf0d496, .95).strokePoints(pts, true, true);
  return g;
}

export const intelGlyphPos = {x: 3, y: -14};
