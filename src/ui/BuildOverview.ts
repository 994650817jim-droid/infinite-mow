import Phaser from 'phaser';
import { FONT, HEADING_FONT } from '../config';
import type { RunGrowth } from '../systems/RunGrowth';
import { MARTIALS, type MasteryId } from '../systems/RunGrowth';
import { ATTRIBUTE_IDS, ATTRIBUTE_INFO, primaryAttribute, type AttributeId } from '../data/attributes';
import { TACTICS, TREASURES, TAG_NAMES, tacticDescription, type BuildTag, type TacticId, type TreasureId } from '../data/builds';
import { AWAKENINGS, activeAwakenings } from '../data/awakenings';
import { getCharacter } from '../data/characters';
import { WEAPON_META } from '../data/upgrades';
import { WEAPON_DEFS } from '../weapons/registry';
import type { WeaponState } from '../types';
import type { ItemInstance } from '../data/items';
import { itemTile } from './ItemQuality';
import { attrBadge } from './AttrBadge';
import { primarySummary } from './PrimaryAttrInfo';
import type { ItemTooltip, InfoTip } from './ItemTooltip';

/**
 * 构筑总览（2026-11-18 用户：「这个玩家看自己 build 不清楚，需要优化一下」）：
 * 行营休整「将帅帐」与战斗内暂停菜单的「战法构筑」共用。一屏三栏（电脑）/ 上下三段（手机）：
 * 左 武将卡（立绘、等级、主属性印、本命武器、专属武学、四项属性）；中 战法 6 格 + 信物 / 宝物格；右 八系进度 + 已觉醒 + 下一步提示。
 * 所有格子悬停弹出完整说明（ItemTooltip 同款漆底卡片；信物直接用兵装悬停卡）。不再分页、不再一条条点开。
 * 对象名：<prefix>-hero / -weapon / -martial-<id> / -attr-<id> / -tactic-<i> / -token-<i> / -treasure-<i> / -tag-<tag> / -awake-<id> / -next-<i>。
 */

/** 每系的颜色与一句大白话说明（觉醒门槛：同系 4 个不同来源觉醒本系；两个搭档系各 2 个觉醒双系）。 */
export const TAG_STYLE: Record<BuildTag, { color: number; css: string; plain: string }> = {
  combo: { color: 0xe0a24a, css: '#f0b864', plain: '多打几下、追打旁边的敌人' },
  critical: { color: 0xd8564a, css: '#ef7a68', plain: '提高暴击，暴击时追加伤害' },
  skirmish: { color: 0x58b27a, css: '#7fd39c', plain: '边走边打：走动之后下一击更强' },
  flame: { color: 0xe8662c, css: '#ff8a4c', plain: '点燃敌人，火会烧到旁边' },
  charge: { color: 0x9a7ad8, css: '#bba2f0', plain: '停手蓄力，下一击更重、能贯穿' },
  control: { color: 0x4aa6c8, css: '#78c8e6', plain: '减速、拉扯、困住敌人' },
  command: { color: 0xd8c25a, css: '#f0dc7a', plain: '指挥、治疗、保护部下士兵' },
  bulwark: { color: 0x8a96a8, css: '#b8c2d0', plain: '减伤、反震、保命' },
};
export const TAG_ORDER: readonly BuildTag[] = ['combo', 'critical', 'skirmish', 'charge', 'flame', 'control', 'command', 'bulwark'];
type Awakening = typeof AWAKENINGS[number];
/** 觉醒还差的：[系, 还差几个]。 */
export function awakeningMissing(a: Awakening, tags: Record<BuildTag, number>): Array<[BuildTag, number]> {
  const need = a.tags.length === 1 ? 4 : 2;
  return (a.tags as readonly BuildTag[]).map(t => [t, Math.max(0, need - tags[t])] as [BuildTag, number]).filter(([, n]) => n > 0);
}
/** 觉醒条件的大白话：「〔连击〕凑满 4 个」/「〔控场〕〔烈焰〕各 2 个」。 */
export function awakeningCondition(a: Awakening): string {
  return a.tags.length === 1 ? `〔${TAG_NAMES[a.tags[0] as BuildTag]}〕凑满 4 个来源` : `${(a.tags as readonly BuildTag[]).map(t => `〔${TAG_NAMES[t]}〕`).join('')}各 2 个来源`;
}
/** 离激活最近的未激活觉醒（按还差总数排序）。 */
export function nearestAwakenings(tags: Record<BuildTag, number>, n = 2): Array<{ a: Awakening; missing: Array<[BuildTag, number]>; total: number }> {
  return AWAKENINGS.map(a => ({ a, missing: awakeningMissing(a, tags) })).filter(x => x.missing.length)
    .map(x => ({ ...x, total: x.missing.reduce((s, [, k]) => s + k, 0) })).sort((p, q) => p.total - q.total).slice(0, n);
}
/** 每系离下一个门槛还差几个：不到 2 个 → 到双系门槛（2）；2–3 个 → 到本系觉醒（4）；满 4 为 0。 */
export function tagGap(n: number): { target: number; left: number } { return n < 2 ? { target: 2, left: 2 - n } : n < 4 ? { target: 4, left: 4 - n } : { target: 4, left: 0 }; }

export interface BuildOverviewOpts {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  x: number; y: number; w: number; h: number;
  desktop: boolean;
  /** 对象名前缀（行营：camp-build；战斗内：build-panel）。 */
  prefix: string;
  growth: RunGrowth;
  level: number;
  weapon?: WeaponState;
  tokens: readonly ItemInstance[];
  tokenSlots: number;
  tooltip: ItemTooltip;
  /** 部曲训练（行营才有）。 */
  training?: { hp: number; attack: number; armor: number };
}

const GOLD = 0xc9a35e, LACQUER = 0x1b120b;

/**
 * 武将卡头像（2026-11-18 用户：「这里的武将头像改一下」——原来是行走图单帧的小像素人）：
 * 用主页卷轴 / 图鉴同一套水墨立绘（assets/ink-scroll/<id>.webp，600×900，纹理键 ink_hero_<id>，没加载过就现场加载），
 * 按武将裁出头肩：fx / fy = 脸中心在原图的横 / 纵比例，w = 裁切宽占原图宽的比例（高按框的比例算），脸放在框上部约 34% 处。
 * 缺水墨立绘时退回旧的立绘贴图（CharacterDef.portrait）。
 */
const INK_FACE: Record<string, { fx: number; fy: number; w: number }> = {
  zhaoyun: { fx: .47, fy: .12, w: .40 }, guanyu: { fx: .38, fy: .135, w: .44 }, zhangfei: { fx: .36, fy: .175, w: .44 }, machao: { fx: .48, fy: .165, w: .42 },
  huangzhong: { fx: .34, fy: .145, w: .42 }, zhuge: { fx: .33, fy: .165, w: .40 }, liubei: { fx: .33, fy: .15, w: .42 }, weiyan: { fx: .52, fy: .135, w: .42 },
  pangtong: { fx: .49, fy: .19, w: .40 }, huangyueying: { fx: .45, fy: .15, w: .40 }, sunshangxiang: { fx: .41, fy: .15, w: .40 }, diaochan: { fx: .31, fy: .195, w: .42 },
};
const inkKey = (id: string) => 'ink_hero_' + id;
/** 画头像进 (x, y, w, h) 框；水墨立绘未加载时先加载、加载完再补画（root 已销毁则不画）。 */
export function heroPortrait(s: Phaser.Scene, root: Phaser.GameObjects.Container, hero: string, x: number, y: number, w: number, h: number, name: string): void {
  const face = INK_FACE[hero], key = inkKey(hero); let done = false;
  const draw = () => {
    if (done || !root.active || !root.scene) return; done = true;
    if (face && s.textures.exists(key)) {
      const src = s.textures.get(key).getSourceImage() as { width: number; height: number }, cw = src.width * face.w, ch = cw * h / w;
      const cx = Phaser.Math.Clamp(src.width * face.fx - cw / 2, 0, src.width - cw), cy = Phaser.Math.Clamp(src.height * face.fy - ch * .34, 0, src.height - ch), k = w / cw;
      const im = s.add.image(x - cx * k, y - cy * k, key).setOrigin(0).setScale(k).setCrop(cx, cy, cw, ch).setScrollFactor(0).setName(name).setData('src', 'ink');
      root.add(im); return;
    }
    const c = getCharacter(hero as Parameters<typeof getCharacter>[0]);
    if (c && s.textures.exists(c.portrait)) {
      const im = s.add.image(x + w / 2, y, c.portrait).setOrigin(.5, 0).setScrollFactor(0).setName(name).setData('src', 'sprite'), sc = w / im.width * 1.25;
      im.setScale(sc).setCrop((im.width - w / sc) / 2, 0, w / sc, h / sc); root.add(im);
    }
  };
  if (!face || s.textures.exists(key)) { draw(); return; }
  s.load.image(key, `assets/ink-scroll/${hero}.webp`);
  s.load.once('filecomplete-image-' + key, draw);
  const onErr = (file: Phaser.Loader.File) => { if (file.key === key) { s.load.off('loaderror', onErr); draw(); } };
  s.load.on('loaderror', onErr);
  if (!s.load.isLoading()) s.load.start();
}
const dots = (lv: number, max: number) => '●'.repeat(Math.max(0, Math.min(lv, max))) + '○'.repeat(Math.max(0, max - lv));

/** 画构筑总览（所有对象 scrollFactor 0，加进 root）。 */
export function drawBuildOverview(o: BuildOverviewOpts): void {
  const { scene: s, root, desktop: D, prefix: P, growth: g } = o, b = g.build, tags = b.tags(), tip = o.tooltip;
  const add = <T extends Phaser.GameObjects.GameObject & { setScrollFactor: (n: number) => T }>(obj: T): T => { obj.setScrollFactor(0); root.add(obj); return obj; };
  const text = (x: number, y: number, v: string, size: number, color = '#eadcbd', heading = false) => add(s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
  const g0 = add(s.add.graphics());
  /** 漆底描金小框。 */
  const frame = (x: number, y: number, w: number, h: number, accent = GOLD, alpha = .82) => { g0.fillStyle(LACQUER, alpha).fillRoundedRect(x, y, w, h, 5).lineStyle(1, 0x000000, .8).strokeRoundedRect(x + .5, y + .5, w - 1, h - 1, 5).lineStyle(1, accent, .75).strokeRoundedRect(x + 2.5, y + 2.5, w - 5, h - 5, 4); };
  const dashed = (x: number, y: number, w: number, h: number) => { g0.fillStyle(0x0e0905, .45).fillRoundedRect(x, y, w, h, 5); for (let i = x + 4; i < x + w - 4; i += 7) { g0.lineStyle(1, GOLD, .45).lineBetween(i, y + 2, Math.min(x + w - 4, i + 3), y + 2).lineBetween(i, y + h - 2, Math.min(x + w - 4, i + 3), y + h - 2); } for (let j = y + 4; j < y + h - 4; j += 7) { g0.lineStyle(1, GOLD, .45).lineBetween(x + 2, j, x + 2, Math.min(y + h - 4, j + 3)).lineBetween(x + w - 2, j, x + w - 2, Math.min(y + h - 4, j + 3)); } };
  const hot = (x: number, y: number, w: number, h: number, name: string, info: () => InfoTip) => { const z = add(s.add.rectangle(x, y, w, h, 0, .001).setOrigin(0).setInteractive({ useHandCursor: false }).setName(name)); tip.attachInfo(z, info); return z; };
  const icon = (x: number, y: number, key: string, size: number) => { if (!s.textures.exists(key)) return; const im = add(s.add.image(x, y, key)); im.setScale(size / Math.max(im.width, im.height)); };

  // ── 三栏 / 三段的位置 ──
  const gap = D ? 12 : 10;
  const L = D ? { x: o.x, y: o.y, w: Math.round(o.w * .285), h: o.h } : { x: o.x, y: o.y, w: o.w, h: 214 };
  const M = D ? { x: L.x + L.w + gap, y: o.y, w: Math.round(o.w * .395), h: o.h } : { x: o.x, y: L.y + L.h + gap, w: o.w, h: 236 };
  const R = D ? { x: M.x + M.w + gap, y: o.y, w: o.x + o.w - (M.x + M.w + gap), h: o.h } : { x: o.x, y: M.y + M.h + gap, w: o.w, h: Math.max(240, o.y + o.h - (M.y + M.h + gap)) };

  // ── 左：武将卡 ──
  {
    frame(L.x, L.y, L.w, L.h);
    const hero = getCharacter(g.character), pad = 10, pw = 62, ph = 74;
    g0.fillStyle(0x0b0704, .9).fillRect(L.x + pad, L.y + pad, pw, ph);
    heroPortrait(s, root, g.character, L.x + pad + 1, L.y + pad + 1, pw - 2, ph - 2, P + '-hero-portrait');
    g0.lineStyle(1, GOLD, .7).strokeRect(L.x + pad + .5, L.y + pad + .5, pw - 1, ph - 1);
    const nx = L.x + pad + pw + 10;
    text(nx, L.y + pad, hero.name, D ? 19 : 20, '#f6dc9a', true).setName(P + '-hero-name');
    text(nx, L.y + pad + 26, `武将 Lv.${o.level}`, 13, '#d9c58f').setName(P + '-hero-level');
    const main = primaryAttribute(g.character);
    // 主属性摘要（与加点面板同一份，ui/PrimaryAttrInfo）：「主属性：敏捷 · 每点效果 ×1.5」+ 专精进度；悬停看完整说明
    const sum = main ? primarySummary(g.character, g.attributes[main] ?? 0, g.attrMax) : null;
    const fit = (t: Phaser.GameObjects.Text, max: number) => { if (t.width > max) t.setScale(max / t.width); return t; };
    let y = L.y + pad + ph + 8;
    if (main && sum) {
      const seal = attrBadge(s, L.x + L.w - 22, L.y + 22, g.character, 26, { scrollFactor: 0 }); if (seal) root.add(seal);
      const colW = L.x + L.w - 32 - nx;
      fit(text(nx, L.y + pad + 46, sum.head, 12, '#f3d48a').setName(P + '-primary-head'), colW);
      // 电脑：武将卡窄，专精进度放到立绘下面整行；手机：卡片整宽，放名字栏
      const next = D ? text(L.x + pad, y - 2, sum.next, 12, '#c9b88f') : text(nx, L.y + pad + 62, sum.next, 12, '#c9b88f');
      fit(next.setName(P + '-primary-next'), D ? L.w - pad * 2 : colW);
      if (D) { hot(L.x + pad, y - 4, L.w - pad * 2, 18, P + '-primary-hit', () => sum.tip); y += 18; }
    }
    hot(L.x + pad, L.y + pad, L.w - pad * 2 - 30, ph, P + '-hero', () => sum ? { ...sum.tip, title: hero.name, sub: `武将 Lv.${o.level} · ${sum.tip.sub}`, body: hero.desc + '\n\n' + sum.head + '\n' + sum.tip.body } : { title: hero.name, sub: `武将 Lv.${o.level}`, body: hero.desc, color: 0xc9a35e });
    // 本命武器
    const w = o.weapon, wmax = w ? WEAPON_DEFS[w.id]?.maxLevel ?? 5 : 5;
    text(L.x + pad, y, '本命', 12, '#a8956c');
    text(L.x + pad + 34, y - 1, w ? `${WEAPON_META[w.id].name}  ${dots(w.level, wmax)}` : '—', 13, '#eadcbd').setName(P + '-weapon');
    if (w) hot(L.x + pad, y - 2, L.w - pad * 2, 18, P + '-weapon-hit', () => ({ title: WEAPON_META[w.id].name, sub: `本命武器 · Lv.${w.level}/${wmax}`, body: WEAPON_META[w.id].desc + (w.level < wmax ? '\n升级时可在三选一里继续强化。' : '\n已满级。'), color: 0xe0b860 }));
    y += 20;
    // 专属武学
    const arts = (Object.keys(MARTIALS) as MasteryId[]).filter(id => MARTIALS[id].character === g.character);
    for (const id of arts) {
      const lv = g.masteries[id] ?? 0, m = MARTIALS[id];
      text(L.x + pad, y, '武学', 12, '#a8956c');
      text(L.x + pad + 34, y - 1, `${m.name}  ${dots(lv, 3)}`, 13, lv ? '#eadcbd' : '#8e7f62').setName(P + '-martial-' + id);
      hot(L.x + pad, y - 2, L.w - pad * 2, 18, P + '-martial-hit-' + id, () => ({ title: m.name, sub: `专属武学 · Lv.${lv}/3${lv ? '' : '（未学）'}`, body: m.desc, color: 0xd8a85a }));
      y += 19;
    }
    // 四项属性：10 格小条，主属性描金
    y += 4; g0.lineStyle(1, GOLD, .35).lineBetween(L.x + pad, y, L.x + L.w - pad, y); y += 7;
    const bw = L.w - pad * 2 - 74, seg = bw / g.attrMax;
    for (const id of ATTRIBUTE_IDS as readonly AttributeId[]) {
      const v = g.attributes[id] ?? 0, isMain = id === main;
      text(L.x + pad, y - 1, ATTRIBUTE_INFO[id].name, 12, isMain ? '#f3d48a' : '#c9b88f');
      const bx = L.x + pad + 42;
      for (let k = 0; k < g.attrMax; k++) g0.fillStyle(k < v ? (isMain ? 0xe8c27a : 0xb89a66) : 0x3a2c1c, k < v ? 1 : .8).fillRect(bx + k * seg + .5, y + 3, seg - 1.5, 8);
      text(bx + bw + 6, y - 1, String(v), 12, isMain ? '#f3d48a' : '#d8c8a4').setName(P + '-attr-' + id);
      hot(L.x + pad, y - 2, L.w - pad * 2, 16, P + '-attr-hit-' + id, () => isMain && sum ? sum.tip : ({ title: ATTRIBUTE_INFO[id].name, sub: `${v} / ${g.attrMax} 点`, body: ATTRIBUTE_INFO[id].effect, color: 0x9a8a6a }));
      y += 17;
    }
    if (g.unallocated > 0) text(L.x + pad, y + 2, `还有 ${g.unallocated} 点属性未分配`, 12, '#7fd88a').setName(P + '-unallocated');
    else if (o.training) text(L.x + pad, y + 2, `部曲训练  体魄 ${o.training.hp} · 兵刃 ${o.training.attack} · 甲胄 ${o.training.armor}`, 11, '#a8956c');
  }

  // ── 中：战法 6 格 + 信物 / 宝物 ──
  {
    frame(M.x, M.y, M.w, M.h);
    const learned = (Object.keys(b.tactics) as TacticId[]).filter(id => b.level(id) > 0), pad = 10;
    text(M.x + pad, M.y + 7, `战法  ${learned.length} / 6`, 15, '#f6dc9a', true).setName(P + '-tactic-count');
    const cols = 3, cg = 8, cw = (M.w - pad * 2 - cg * (cols - 1)) / cols, ch = D ? Math.min(74, (M.h - 120) / 2) : 72, gy = M.y + 30;
    for (let i = 0; i < 6; i++) {
      const cx = M.x + pad + (i % cols) * (cw + cg), cy = gy + Math.floor(i / cols) * (ch + cg), id = learned[i];
      if (!id) {
        dashed(cx, cy, cw, ch);
        text(cx + cw / 2, cy + ch / 2 - 8, '空', 13, '#7a6a4c', true).setOrigin(.5);
        text(cx + cw / 2, cy + ch / 2 + 10, '升级 / 商人处获得', 10, '#7a6a4c').setOrigin(.5);
        hot(cx, cy, cw, ch, P + '-tactic-' + i, () => ({ title: '空战法格', sub: `已学 ${learned.length} / 6`, body: '武将升级时的三选一、或行营的军需商人处可学战法。最多学 6 种，每种可升到 3 级；同系战法越多，越接近觉醒。', color: 0x7a6a4c }));
        continue;
      }
      const t = TACTICS[id], st = TAG_STYLE[t.tag], lv = b.level(id);
      frame(cx, cy, cw, ch, st.color, .9);
      g0.fillStyle(st.color, .95).fillTriangle(cx + 3, cy + 3, cx + 24, cy + 3, cx + 3, cy + 24);
      text(cx + 6, cy + 3, TAG_NAMES[t.tag][0], 10, '#120904', true);
      icon(cx + cw / 2, cy + 22, 'build_icon_' + id, 30);
      text(cx + cw / 2, cy + ch - 30, t.name, 13, '#f0e2c0', true).setOrigin(.5, 0).setName(P + '-tactic-name-' + i);
      text(cx + cw / 2, cy + ch - 15, dots(lv, 3), 11, st.css).setOrigin(.5, 0).setName(P + '-tactic-lv-' + i);
      hot(cx, cy, cw, ch, P + '-tactic-' + i, () => ({ title: t.name, sub: `〔${TAG_NAMES[t.tag]}〕战法 · Lv.${lv}/3`, body: tacticDescription(id, lv) + (lv < 3 ? `\n下一级：${tacticDescription(id, lv + 1)}` : ''), color: st.color, icon: 'build_icon_' + id }));
    }
    // 信物格（穿戴的信物）+ 宝物（由信物注入的机制）
    let y = gy + 2 * ch + cg + 8;
    text(M.x + pad, y, '信物', 13, '#f6dc9a', true); y += 20;
    const ts = 40, tg = 8;
    for (let i = 0; i < Math.max(1, o.tokenSlots); i++) {
      const tx = M.x + pad + i * (ts + tg), item = o.tokens[i];
      if (item) {
        const tile = itemTile(s, tx + ts / 2, y + ts / 2, ts, item).setScrollFactor(0).setName(P + '-token-' + i); root.add(tile);
        const z = add(s.add.rectangle(tx, y, ts, ts, 0, .001).setOrigin(0).setInteractive({ useHandCursor: false }).setName(P + '-token-hit-' + i)); tip.attach(z, () => item, () => item);
      } else { dashed(tx, y, ts, ts); hot(tx, y, ts, ts, P + '-token-' + i, () => ({ title: '空信物格', sub: `信物格 ${i + 1} / ${o.tokenSlots}`, body: '在行囊里给武将戴上信物：属性类直接加成，机制类会带来宝物效果并计入流派件数。', color: 0x7a6a4c })); }
    }
    const tr = b.treasures as readonly TreasureId[], tx0 = M.x + pad + Math.max(1, o.tokenSlots) * (ts + tg) + 10;
    if (tr.length) text(tx0, y - 18, '宝物', 13, '#f6dc9a', true);
    tr.slice(0, 6).forEach((id, i) => {
      const tx = tx0 + i * (34 + 6), def = TREASURES[id], st = TAG_STYLE[def.tag];
      frame(tx, y + 3, 34, 34, st.color, .9); icon(tx + 17, y + 20, 'build_icon_' + id, 26);
      hot(tx, y + 3, 34, 34, P + '-treasure-' + i, () => ({ title: def.name, sub: `宝物 · 〔${TAG_NAMES[def.tag]}〕`, body: def.desc, color: st.color, icon: 'build_icon_' + id }));
    });
    if (!o.tokens.length && !tr.length) text(M.x + pad + Math.max(1, o.tokenSlots) * (ts + tg) + 8, y + 12, '尚未佩戴信物', 12, '#7a6a4c');
  }

  // ── 右：流派进度 + 已觉醒 + 下一步 ──
  {
    frame(R.x, R.y, R.w, R.h);
    const pad = 10, active = activeAwakenings(tags), near = nearestAwakenings(tags, 2);
    text(R.x + pad, R.y + 7, '流派 · 觉醒', 15, '#f6dc9a', true);
    text(R.x + R.w - pad, R.y + 10, `已觉醒 ${active.length}`, 12, active.length ? '#f3d48a' : '#8e7f62').setOrigin(1, 0).setName(P + '-awake-count');
    let y = R.y + 32;
    const rowH = D ? 16 : 19, nameW = 30, barW = R.w - pad * 2 - nameW - 74, sw = barW / 4;
    for (const t of TAG_ORDER) {
      const n = tags[t], st = TAG_STYLE[t], gp = tagGap(n);
      text(R.x + pad, y - 1, TAG_NAMES[t], 12, n ? st.css : '#8e7f62', true);
      const bx = R.x + pad + nameW;
      for (let k = 0; k < 4; k++) g0.fillStyle(k < n ? st.color : 0x3a2c1c, k < n ? 1 : .85).fillRect(bx + k * sw + .5, y + 3, sw - 2, 8);
      g0.lineStyle(1, 0xf3d48a, .8).lineBetween(bx + 2 * sw - 1, y + 1, bx + 2 * sw - 1, y + 13); // 双系门槛刻度
      text(bx + barW + 4, y - 1, `${Math.min(n, 4)}/4`, 12, n >= 4 ? '#f3d48a' : '#d8c8a4').setName(P + '-tag-' + t);
      text(R.x + R.w - pad, y, gp.left ? `差${gp.left}` : '满', 11, gp.left ? '#a8956c' : '#f3d48a').setOrigin(1, 0).setName(P + '-tag-gap-' + t);
      hot(R.x + pad, y - 2, R.w - pad * 2, rowH, P + '-tag-hit-' + t, () => ({ title: `〔${TAG_NAMES[t]}〕 ${n} 个来源`, sub: gp.left ? `离 ${gp.target} 个还差 ${gp.left} 个` : '已满 4 个', body: `${st.plain}。\n学一种该系战法、或戴一件该系信物，各算 1 个来源（同一种只算 1 个）。\n凑满 4 个：觉醒「${AWAKENINGS.find(a => a.tags.length === 1 && a.tags[0] === t)?.name ?? ''}」；与搭档系各 2 个：觉醒「${AWAKENINGS.find(a => a.tags.length === 2 && (a.tags as readonly string[]).includes(t))?.name ?? ''}」。`, color: st.color }));
      y += rowH;
    }
    // 已觉醒：点亮的小卡
    y += 4; g0.lineStyle(1, GOLD, .35).lineBetween(R.x + pad, y, R.x + R.w - pad, y); y += 6;
    if (!active.length) { text(R.x + pad, y, '还没有觉醒：同一系凑满 4 个，或两个搭档系各 2 个', 11, '#8e7f62').setWordWrapWidth(R.w - pad * 2, true).setName(P + '-awake-none'); y += 30; }
    else {
      // 觉醒小卡：能放几行放几行（给下一步提示留位），放不下的收成「+N」，悬停列出其余
      const chipH = 22, room = R.y + R.h - y - (near.length ? 58 : 26), maxRows = Math.max(1, Math.floor((room + 4) / (chipH + 4)));
      let cx = R.x + pad, rowsUsed = 0;
      for (let i = 0; i < active.length; i++) {
        const a = active[i], label = a.name.replace(/^.+ · /, ''), cw = Math.min(R.w - pad * 2, 30 + label.length * 12);
        if (cx + cw > R.x + R.w - pad) { cx = R.x + pad; y += chipH + 4; rowsUsed++; }
        if (rowsUsed >= maxRows) { const rest = active.slice(i), more = text(R.x + R.w - pad, y - chipH - 2, `+${rest.length}`, 12, '#f3d48a').setOrigin(1, 0).setName(P + '-awake-more'); hot(more.x - more.width - 4, more.y - 2, more.width + 8, 20, P + '-awake-more-hit', () => ({ title: `另有 ${rest.length} 个觉醒`, body: rest.map(a => `· ${a.name}：${a.desc}`).join('\n'), color: 0xf3d48a })); y -= chipH + 4; /* 换行后才发现放不下：退回上一行 */ break; }
        g0.fillStyle(0x3a2616, .95).fillRoundedRect(cx, y, cw, chipH, 4).lineStyle(1, 0xf3d48a, .9).strokeRoundedRect(cx + .5, y + .5, cw - 1, chipH - 1, 4);
        icon(cx + 11, y + chipH / 2, a.icon, 16);
        text(cx + 22, y + 3, label, 12, '#ffe7b0', true);
        hot(cx, y, cw, chipH, P + '-awake-' + a.id, () => ({ title: a.name, sub: '已觉醒 · ' + awakeningCondition(a), body: a.desc, color: 0xf3d48a, icon: a.icon }));
        cx += cw + 6;
      }
      y += chipH + 8;
    }
    // 下一步：最接近的 1–2 个觉醒
    near.forEach((x, i) => {
      if (y > R.y + R.h - 20) return;
      const need = x.missing.map(([t, k]) => `${k} 个〔${TAG_NAMES[t]}〕`).join('、');
      const line = text(R.x + pad, y, `再拿 ${need}来源，即可激活「${x.a.name}」`, 12, i ? '#c9b88f' : '#e8c98a').setWordWrapWidth(R.w - pad * 2, true).setName(P + '-next-' + i);
      hot(R.x + pad, y - 2, R.w - pad * 2, line.height + 4, P + '-next-hit-' + i, () => ({ title: x.a.name, sub: '未激活 · ' + awakeningCondition(x.a), body: x.a.desc, color: 0x9a8a6a, icon: x.a.icon }));
      y += line.height + 6;
    });
    if (!near.length) text(R.x + pad, Math.min(y, R.y + R.h - 20), '全部觉醒都已激活', 12, '#f3d48a').setName(P + '-next-0');
  }
}
