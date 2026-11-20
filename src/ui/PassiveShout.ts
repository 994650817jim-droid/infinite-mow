import Phaser from 'phaser';
import { DEPTH, HEADING_FONT } from '../config';
import type { CharacterId } from '../data/characters';
import type { CharacterPassives } from '../systems/CharacterPassives';

/**
 * 被动满层战吼：被动刚攒满（下一击要强化）的那一刻，武将「喊」出一句台词。
 * 2026-11-16 用户：「马超喊出台词需要像是真的喊出来一样，而不是一行字」→ 做成战吼：
 *  - 字：大号书法体逐字砸下（先放大再回弹、金字深墨边），落定后一抖，约 1.2 秒后上浮淡出；
 *  - 声：2026-11-16 用户：「喝——的音效可以去除不要」→ 只留被动满层那声轻鼓（Sfx 'passiveFull'）；合成战吼 'warCry' 保留在 Sfx 里备用；
 *  - 画面：脚下一圈声浪冲击 + 身上迸发的气势（手绘图集 warcry_paint，2026-11-17 Gemini 出图替换像素 warcry_fx；缺图时只保留其余表现，不画程序圈）、轻微震屏、
 *    人物身上金光一闪；附近敌人被吓得一缩（只做表现，不改位置和判定）。
 * 技能提示方案 C：地上不画程序圈。
 * 只在「未满 → 满」的那一帧触发；同一武将喊过后 cooldownMs（默认 PASSIVE_SHOUT_COOLDOWN_MS）内再攒满不喊（被动效果照常触发），避免刷屏。
 * 想给别的武将配台词，往 PASSIVE_FULL_SHOUTS 里加一行即可（不配就不喊）。
 */
/** 默认：同一武将两次喊话的最短间隔（2026-11-16 用户：台词不要太频繁 → 60 秒）。单个武将可用 cooldownMs 覆盖。 */
export const PASSIVE_SHOUT_COOLDOWN_MS = 60000;
/** 战吼字停留时长（毫秒），之后上浮淡出。 */
export const WAR_CRY_HOLD_MS = 1200;
/**
 * 战吼大字（马超 / 孙尚香被动满层战吼、魏延「谁敢杀我」、各武将台词共用一套表现）：书法体逐字砸下（放大 → 回弹）、金字深墨边，
 * 落定后一抖，停 WAR_CRY_HOLD_MS 后上浮淡出；跟着 body 走。scale：随从说话用 0.7。不压顶部 HUD（离屏幕顶部至少 topMargin）。
 */
export function warCryText(sc: Phaser.Scene, line: string, color: string, x: number, y: number, body?: { active: boolean; x: number; y: number }, scale = 1, name = 'passive-shout', topMargin = 110): Phaser.GameObjects.Container {
  const tw = sc.tweens, chars = [...line], size = Math.round(20 * scale), gap = size * .98, w = (chars.length - 1) * gap, stagger = 35, pop = 120;
  // 外层跟着武将走（马超喊完马上冲锋，字不能留在原地），内层 box 负责砸字、抖动、上浮
  const holder = sc.add.container(x, y).setDepth(DEPTH.dmgText + 3).setName(name);
  const lift = -78 * (scale < 1 ? .9 : 1), cam = sc.cameras.main;
  const follow = (): void => { if (body?.active && holder.active) holder.setPosition(body.x, Math.max(body.y, cam.worldView.top + topMargin - lift)); };
  follow();
  const total = chars.length * stagger + pop + WAR_CRY_HOLD_MS + 300;
  if (body) { const st = { t: 0 }; tw.add({ targets: st, t: 1, duration: total, onUpdate: follow }); }
  const box = sc.add.container(0, lift).setName(name + '-text'); holder.add(box);
  chars.forEach((ch, i) => {
    const t = sc.add.text(-w / 2 + i * gap, 0, ch, { fontFamily: HEADING_FONT, fontSize: size + 'px', color, stroke: '#2a1206', strokeThickness: Math.max(3, Math.round(4 * scale)), resolution: 2 })
      .setOrigin(.5, .5).setShadow(0, 1, '#000000', 3, true, true).setAlpha(0).setScale(1.7);
    box.add(t);
    tw.add({ targets: t, alpha: 1, scale: 1, duration: pop, delay: i * stagger, ease: 'Back.Out' });
  });
  const landed = chars.length * stagger + pop;
  tw.add({ targets: box, x: { from: -1.5, to: 1.5 }, duration: 40, yoyo: true, repeat: 2, delay: landed, onComplete: () => box.setX(0) });
  tw.add({ targets: box, y: lift - 12 * scale, alpha: 0, delay: landed + WAR_CRY_HOLD_MS - 150, duration: 380, ease: 'Sine.In', onComplete: () => holder.destroy() });
  return holder;
}
export interface PassiveFullShout { lines: readonly string[]; color: string; cooldownMs?: number; }
export const PASSIVE_FULL_SHOUTS: Partial<Record<CharacterId, PassiveFullShout>> = {
  // 2026-11-16 用户选定台词：马超「西凉铁骑」满 6 层、下一枪要冲锋时喊一句，三句轮流；
  // 用户：「马超可以被动好了就出发台词」→ 不设冷却，每次攒满都喊
  machao: { lines: ['吾乃西凉马孟起！', '铁骑踏阵，片甲不留！', '锦马超在此，谁敢一战！'], color: '#ffe08a', cooldownMs: 0 },
  // 2026-11-16 用户定稿台词：孙尚香「侍婢执刀」疾步满 6 层、下一次掷刀召侍婢时喊一句，三句轮流
  sunshangxiang: { lines: ['侍婢何在，随我执刀！', '弓腰姬在此，谁敢近前！', '江东孙尚香，岂输男儿！'], color: '#ffc8b0' },
  // P2：吕布「无双」进狂暴、张辽「止啼」召八百虎贲时喊一句
  lvbu: { lines: ['人中吕布，马中赤兔！', '天下谁人能挡我！', '无双之名，岂是虚传！'], color: '#ff9c8a' },
  menghuo: { lines: ['南中的猛兽，冲啊！', '孟获在此！', '不服！再来！'], color: '#ffb070' },
  sunquan: { lines: ['阵势已变，随孤再战！', '江东子弟，齐射！', '制衡之道，审时度势。'], color: '#a8e8b0' },
  dianwei: { lines: ['古之恶来在此！', '谁敢伤我主公！', '来！都来！'], color: '#ff9a7a' },
  ganning: { lines: ['百骑劫营，随我来！', '锦帆贼甘宁在此！', '铃声一响，取尔首级！'], color: '#ffc890' },
  mengde: { lines: ['虎豹骑，随我冲阵！', '宁教我负天下人！', '天下英雄，唯使君与操耳！'], color: '#d0b8f0' },
  taishici: { lines: ['随我杀出重围！', '东莱太史慈在此！', '信义所在，万死不辞！'], color: '#b8e0c0' },
  zhouyu: { lines: ['万事俱备，东风已至！', '火船齐发！', '樯橹灰飞烟灭！'], color: '#ffb080' },
  zhangliao: { lines: ['八百虎贲，随我破阵！', '辽来辽来！', '张文远在此！'], color: '#c8d4e8' },
};
/** 附近敌人（只做「吓一缩」表现用）。 */
export interface ShoutTarget { active: boolean; sprite: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject; isSupplySlot?: boolean; }
export interface PassiveShoutOptions { sfx?: () => void; nearby?: (x: number, y: number, r: number) => ShoutTarget[]; }

export class PassiveShout {
  private wasReady = false; private triggers = 0; private character: CharacterId | null = null;
  private lastAt = -Infinity; private next = 0;
  /** 测试用：累计喊了几次、最近一句。 */
  count = 0; lastLine = '';
  private readonly opts: PassiveShoutOptions;
  constructor(private readonly scene: Phaser.Scene, opts: PassiveShoutOptions | (() => void) = {}) { this.opts = typeof opts === 'function' ? { sfx: opts } : opts; }
  /** 每帧调用。x / y 为武将脚底位置，now 为战斗时间（毫秒）；body 为武将身体图（用来闪金光）。 */
  update(passive: CharacterPassives, now: number, x: number, y: number, visible: boolean, body?: Phaser.GameObjects.Image): void {
    const id = passive.characterId;
    const snap = passive.snapshot(now);
    if (id !== this.character) { this.character = id; this.wasReady = false; this.triggers = snap.triggers; this.lastAt = -Infinity; this.next = 0; }
    // 刚攒满；或同一帧里攒满又立刻放出（没看到满层就多了一次触发）也算
    const ready = snap.ready, rose = (ready && !this.wasReady) || (snap.triggers > this.triggers && !this.wasReady);
    this.wasReady = ready; this.triggers = snap.triggers;
    const cfg = PASSIVE_FULL_SHOUTS[id];
    if (!rose || !cfg || !visible || now - this.lastAt < (cfg.cooldownMs ?? PASSIVE_SHOUT_COOLDOWN_MS)) return;
    this.lastAt = now;
    this.shout(cfg.lines[this.next++ % cfg.lines.length], cfg.color, x, y, body);
  }
  private shout(line: string, color: string, x: number, y: number, body?: Phaser.GameObjects.Image): void {
    this.count++; this.lastLine = line;
    const sc = this.scene, tw = sc.tweens;
    // 1) 字：共用 warCryText（书法体逐字砸下、金字深墨边、落定一抖、停留后上浮淡出；武将台词也用这一套）
    const holder = warCryText(sc, line, color, x, y, body);
    void holder; // x / y 仍是武将脚底世界坐标，下面的声浪 / 气势用
    // 2) 声浪冲击（脚下压扁的气浪）+ 身上迸发的气势（手绘图集 warcry_paint：2 行 × 6 帧，每帧 256×512，透明底叠加）
    if (sc.textures.exists('warcry_paint')) {
      const play = (row: number, oy: number, dw: number, dh: number, fps: number, name: string) => {
        const s = sc.add.sprite(x, y + 4, 'warcry_paint', row * 6).setOrigin(.5, oy).setDisplaySize(dw, dh).setBlendMode(Phaser.BlendModes.ADD).setDepth(name === 'warcry-wave' ? DEPTH.fx : DEPTH.fx + 1).setName(name);
        const st = { t: 0 };
        tw.add({ targets: st, t: 5.99, duration: 6000 / fps, onUpdate: () => { if (s.active) s.setFrame(row * 6 + Math.floor(st.t)); }, onComplete: () => s.destroy() });
      };
      play(0, .45, 230, 460, 16, 'warcry-wave'); // 图里声浪椭圆中心在格子约 0.45 高处
      play(1, .75, 120, 240, 14, 'warcry-aura'); // 气势的底在格子约 0.75 高处，贴脚底
    }
    // 3) 轻微震屏
    sc.cameras.main.shake(140, .0022);
    // 4) 附近敌人被吓得一缩（只做表现：缩一下再弹回，不改位置）
    for (const e of this.opts.nearby?.(x, y, 170) ?? []) {
      if (!e.active || e.isSupplySlot) continue;
      const sp = e.sprite as unknown as Phaser.GameObjects.Components.Transform & { scene?: Phaser.Scene };
      const sx = sp.scaleX, sy = sp.scaleY;
      tw.add({ targets: sp, scaleX: sx * 1.08, scaleY: sy * .84, duration: 90, yoyo: true, ease: 'Quad.Out', onComplete: () => { sp.scaleX = sx; sp.scaleY = sy; } });
    }
    // 5) 人物身上闪一下金光：叠一层同帧的金色剪影（叠加混合），跟着人物走，0.45 秒淡出；不画在地上
    if (body?.active && body.visible) {
      const glow = sc.add.image(body.x, body.y, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY)
        .setDisplaySize(body.displayWidth, body.displayHeight).setFlipX(body.flipX).setTintFill(0xffd77a).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(body.depth + .001).setAlpha(.8).setName('passive-shout-glow');
      tw.add({ targets: glow, alpha: 0, duration: 450, ease: 'Quad.Out',
        onUpdate: () => { if (body.active) glow.setPosition(body.x, body.y).setFrame(body.frame.name).setFlipX(body.flipX); },
        onComplete: () => glow.destroy() });
    }
    // 6) 战吼音效
    this.opts.sfx?.();
  }
}
