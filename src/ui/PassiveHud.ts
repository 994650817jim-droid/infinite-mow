import type { CharacterId } from '../data/characters';
import { ZHANGLIAO } from '../data/zhangliao';
import { ZHOUYU } from '../data/zhouyu';
import { TAISHICI } from '../data/taishici';
import { MENGDE } from '../data/mengde';
import Phaser from 'phaser';
import { DEPTH, FONT, IS_DESKTOP } from '../config';
import { CHARACTER_PASSIVES } from '../data/passives';
import type { CharacterPassives } from '../systems/CharacterPassives';
import type { BranchStatus } from '../data/weaponBranches';

/** 被动技能完整说明（悬停 / 点按弹出）。数值见 data/passives.ts 的 PASSIVE_RULES。 */
export const PASSIVE_DETAILS: Record<CharacterId, string> = {
  mengde: '奸雄：部曲每阵亡一人积 1 层并为主将回血 4%，满 8 层召「虎豹骑」：5 骑铁骑沿最密的敌群一线冲过。倚天剑命中挂「军令」：受伤 +20%，部曲集火。',
  taishici: '信义：身边部曲每挨一次打积 1 层，满 15 层「单骑突围」：朝最密的敌群冲出一条通道，沿途敌兵重创、沿途部曲得护盾。',
  zhouyu: '英发：火船与火场每烧死 1 名敌兵积 1 层，满 20 层刮「东风」6 秒：全场火场顺风推进，伤害翻倍。',
  zhangliao: '止啼：双戟每击叠震慑，3 层溃逃 2 秒（溃兵受伤 +25%）；击杀溃逃的敌兵积 1 层，满 12 层召「八百虎贲」虚影骑兵绕身环冲两圈。',
  lvbu: '无双：每击杀 1 名敌人积 1 层战意，满 25 层进入「人中吕布」8 秒：移速、攻速 +40%，每次出手打两次，不被击退；随后清空。',
  sunshangxiang: '侍婢执刀：移动中每 0.8 秒积 1 层疾步（停下不会掉层）。\n满 6 层后，下一次掷刀时召来 2 名执刀侍婢护身 6 秒（最多 3 名）：绕身巡护，70 像素内的敌人每 0.5 秒挨一刀（掷刀伤害的 50%–70%，随武器等级提高），随后清空。',
  diaochan: '离间：飞扇每命中一次加 1 层魅惑，满 3 层的敌人倒戈 3 秒（精锐 1.5 秒）——转身去撞最近的同伴，自己受伤 +20%；首领不倒戈，改为 3 秒受伤 +15%。\n每离间 1 名敌人积 1 层舞势，满 5 层后下一次化为「闭月」：舞带环身旋舞 2 秒，半径 160 内每 0.4 秒 50% 伤害并令圈内敌人倒戈。',
  machao: '西凉铁骑：湛金枪每命中敌人积 1 层铁骑（每 0.3 秒最多 1 层）。\n满 6 层后，下一枪化为「锦马冲锋」：向前突进 180 像素，沿途敌人受到 160% 伤害并被撞开，随后清空。',
  weiyan: '镇守汉中：每次受到伤害积 1 层拒敌（每 0.5 秒最多 1 层）；身边每有 3 名敌人，每秒再积 1 层（被围也能蓄势）。\n满 5 层后，下一刀化为「谁敢杀我」：怒吼并朝 6 个方向劈出裂波（各 80% 伤害），自身 3 秒内受到伤害 -30%，随后清空。',
  liubei: '双剑一次砍中 2 名敌人积 1 层仁德。\n满 4 层后，下一次出剑伤害 +15%，自身回复 8% 最大生命、身边部曲回复 35% 生命，并在 4 秒内攻速 +30%，随后清空。',
  pangtong: '连环计：一次连锁引爆至少 3 枚火雷积 1 层计策。\n满 3 层后，下一次布雷化为「火烧连环」：身边布下以锁链相连的 6 枚火雷，敌人踏入圈内或 2 秒后齐爆并留火 2 秒，随后清空（凤雏连环令满级时，圈内先整片起火 3 秒再齐爆）。\n落凤坡伏兵：生命低于 30% 时脚下自动布 4 枚火雷并以铁索连成方阵（每 30 秒最多一次）。',
  huangyueying: '连弩每命中敌人上紧 1 层机括（每 0.25 秒最多 1 层）。\n满 12 层后，下一次射击额外扇形齐射 6 支机关弩箭（60% 伤害、弹射 +1），随后清空。',
  zhangfei: '声浪每命中敌人积 1 层怒气（每 0.35 秒最多 1 层）。\n满 5 层后，下一次大喝化为「据水断桥」：周围敌人受到 140% 伤害并被震慑 1.2 秒（首领只受伤害），原地留下 3 秒敌人进不来的断桥区，随后清空。',
  zhaoyun: '本命龙枪每命中敌人积累 1 层龙胆（每 0.15 秒最多 1 层）。\n满 7 层后，下一次出枪多 1 枪、枪长 +25%，随后清空重新积累。',
  guanyu: '一次斩击命中至少 3 名敌人积 1 层武势，每层斩击范围 +6%。\n满 3 层后，下一次斩击伤害 +25%、范围 +18%，随后清空。',
  huangzhong: '重箭每命中一次积 1 层蓄势，满 4 层进入「神射」6 秒（技艺「静心」可延长到 9 秒）：暴击率 +10%，重箭命中处再爆裂一圈（半径 60、50% 伤害）。\n受到伤害掉 1 层蓄势（神射中受伤不打断）。',
  zhuge: '观星：场上没有首领 / 精锐时，天火每发都积 1 层星象；有首领 / 精锐时，同一目标每吃一发天火积 1 层（最多同时记 5 个目标）。4 秒没再落地就散。\n满 3 层后，下一发天火必定暴击且伤害 ×2（算无遗策），落地留下 4.5 秒星火焦土，灼烧范围内所有敌人，随后清空。',
};
/** 被动技能 HUD；悬停（电脑）或点按（手机）弹出完整说明，点按不会触发移动摇杆。 */
export class PassiveHud {
  readonly root: Phaser.GameObjects.Container;
  readonly title: Phaser.GameObjects.Text;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly emblem: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly tip: Phaser.GameObjects.Container;
  private readonly tipBg: Phaser.GameObjects.Graphics;
  private readonly tipTitle: Phaser.GameObjects.Text;
  private readonly tipText: Phaser.GameObjects.Text;
  private tipUntil = 0; private hovering = false; private character: keyof typeof PASSIVE_DETAILS = 'zhaoyun'; private ready = false;
  /** 兵器专职行（2026-11-20 用户「武器转职完也要显示在被动下面」）：图标、分支名 + Lv、进阶进度；悬停全文（与构筑总览专职栏同一份数据 branchStatus）。 */
  private readonly brG: Phaser.GameObjects.Graphics; private readonly brIcon: Phaser.GameObjects.Image; private readonly brName: Phaser.GameObjects.Text; private readonly brProg: Phaser.GameObjects.Text; private readonly brHit: Phaser.GameObjects.Rectangle;
  private branch: BranchStatus | null = null; private brHover = false; private brTipUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(22, 136).setScale(.68).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    this.graphics = scene.add.graphics();
    const text = (x: number, y: number, size: number, color: string) => scene.add.text(x, y, '', {
      fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, stroke: '#111d16', strokeThickness: 2,
    });
    this.emblem = text(24, 24, 22, '#e7c474').setOrigin(.5);
    this.title = text(47, 8, 19, '#f7eedc').setFontStyle('bold');
    this.counter = text(248, 11, 14, '#e7c474').setOrigin(1, 0);
    this.hint = text(12, 49, 13, '#c4b59e');
    this.hint.setVisible(false);
    this.root.add([this.graphics, this.emblem, this.title, this.counter, this.hint]);
    // 命中框须自身 scrollFactor=0（输入检测按对象自身的 scrollFactor 换算，镜头跟随后才不会错位）
    const hit = scene.add.rectangle(130, 26, 270, 56, 0, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName('passive-hud-hit');
    // 触屏点按也会触发 pointerover 且没有 pointerout：触屏只按点按计时，不算悬停
    hit.on('pointerover', (ptr: Phaser.Input.Pointer) => { if (ptr.wasTouch) return; this.hovering = true; })
      .on('pointerout', () => { this.hovering = false; if (IS_DESKTOP) this.tipUntil = 0; })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation?.(); this.tipUntil = scene.time.now + 3000; });
    this.root.add(hit);
    // 专职行（被动栏下面；没选专职时整行隐藏）
    this.brG = scene.add.graphics(); this.brIcon = scene.add.image(24, 88, 'icon_passive').setDisplaySize(32, 32).setScrollFactor(0);
    this.brName = text(47, 68, 16, '#f0dcae').setFontStyle('bold').setName('passive-branch-name'); this.brProg = text(47, 90, 14, '#c4b59e').setName('passive-branch-progress');
    this.brHit = scene.add.rectangle(130, 88, 270, 44, 0, .001).setScrollFactor(0).setInteractive({ useHandCursor: true }).setName('passive-branch-hit');
    this.brHit.on('pointerover', (ptr: Phaser.Input.Pointer) => { if (ptr.wasTouch) return; this.brHover = true; }).on('pointerout', () => { this.brHover = false; if (IS_DESKTOP) this.brTipUntil = 0; })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation?.(); this.brTipUntil = scene.time.now + 3000; });
    this.root.add([this.brG, this.brIcon, this.brName, this.brProg, this.brHit]);
    for (const o of [this.brG, this.brIcon, this.brName, this.brProg, this.brHit]) o.setVisible(false);
    const label = (x: number, y: number, size: number, color: string) => scene.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2 });
    this.tip = scene.add.container(22, 176).setScrollFactor(0).setDepth(DEPTH.hud + 6).setVisible(false).setName('passive-tip');
    this.tipBg = scene.add.graphics(); this.tipTitle = label(10, 8, 15, '#f5d780'); this.tipText = label(10, 34, 13, '#d4c7ad').setWordWrapWidth(258, true).setLineSpacing(3);
    this.tip.add([this.tipBg, this.tipTitle, this.tipText]);
  }
  get tipVisible(): boolean { return this.tip.visible; }
  private renderTip(now: number, visible: boolean): void {
    const br = !!this.branch && (this.brHover || now < this.brTipUntil), show = visible && (br || this.hovering || now < this.tipUntil);
    this.tip.setVisible(show); if (!show) return;
    if (br && this.branch) { const st = this.branch; this.tip.setY(216); this.tipTitle.setText('兵器专职 · ' + st.b.name + ' · Lv.' + st.lv + (st.final ? ' · 已进阶' : '')); this.tipText.setText(st.tip + '\n当前：' + st.progress); }
    else { this.tip.setY(176); this.tipTitle.setText(`${CHARACTER_PASSIVES[this.character].name} · 被动${this.ready ? ' · 已就绪' : ''}`); this.tipText.setText(PASSIVE_DETAILS[this.character] + '\n当前：' + this.hint.text); }
    const h = this.tipText.height + 46;
    this.tipBg.clear().fillStyle(0x17140d, .94).fillRect(0, 0, 278, h).lineStyle(1, 0xb09056, .7).strokeRect(0, 0, 278, h);
  }

  get description(): string { return this.hint.text; }
  /** 专职行显示着没（GameScene 据此把增益栏往下让）。 */
  get branchShown(): boolean { return !!this.branch; }
  /** 每帧：专职状态（null = 没选专职，整行隐藏）。达成进阶后名字与进度换金色、写进阶形态名。 */
  updateBranch(st: BranchStatus | null): void {
    this.branch = st; const on = !!st;
    for (const o of [this.brG, this.brIcon, this.brName, this.brProg, this.brHit]) o.setVisible(on);
    if (!st) return;
    const gold = st.final, g = this.brG.clear();
    g.fillStyle(0x000000, .22).fillRect(0, 62, 256, 1).fillStyle(gold ? 0xf5d780 : 0xb08a3a, 1).fillRect(0, 70, 3, 38);
    if (this.brIcon.texture.key !== st.b.icon && this.brIcon.scene.textures.exists(st.b.icon)) this.brIcon.setTexture(st.b.icon).setDisplaySize(30, 30);
    this.brName.setText(st.b.name + ' · Lv.' + st.lv).setColor(gold ? '#f5d780' : '#f0dcae');
    this.brProg.setText(st.progress).setColor(gold ? '#f5d780' : st.shi >= 4 || st.over >= 2 ? '#e7c474' : '#c4b59e');
  }

  update(passive: CharacterPassives, now: number, visible: boolean): void {
    this.root.setVisible(visible);
    if (!visible) { this.renderTip(now, false); return; }
    const s = passive.snapshot(now);
    this.character = s.character; this.ready = s.ready;
    const colors = { mengde: 0x9a7cc8, taishici: 0x7fb08a, zhouyu: 0xe8884a, zhangliao: 0x8fa0b8, lvbu: 0xe0604a, zhaoyun: 0x70cbdc, guanyu: 0x88c88b, huangzhong: 0xe8c16a, zhuge: 0xe49a6d, zhangfei: 0xd8645a, huangyueying: 0x7fc4a8, pangtong: 0xd9824a, liubei: 0xe0c37a, weiyan: 0xc8885a, machao: 0x9fc6e8, sunshangxiang: 0xe88a7a, diaochan: 0xd9a0e8 };
    const tint = s.ready ? 0xf5d780 : colors[s.character];
    const g = this.graphics.clear();
    g.fillStyle(tint, 1).fillRect(0, 10, 3, 22);
    this.emblem.setText({ mengde: '雄', taishici: '义', zhouyu: '风', zhangliao: '啼', lvbu: '戟', zhaoyun: '龙', guanyu: '势', huangzhong: '弓', zhuge: '策', zhangfei: '怒', huangyueying: '巧', pangtong: '凤', liubei: '仁', weiyan: '战', machao: '骑', sunshangxiang: '姬', diaochan: '月' }[s.character]);
    this.emblem.setColor(`#${tint.toString(16).padStart(6, '0')}`);
    this.title.setText(CHARACTER_PASSIVES[s.character].name);
    this.counter.setText(s.ready ? (s.character === 'huangzhong' ? '神射中' : '已就绪') : s.maxStacks ? `${s.stacks} / ${s.maxStacks}` : `${(s.calmProgress * 5).toFixed(1)}秒`);
    this.counter.setColor(s.ready ? '#f5d780' : '#c4b59e');
    if (s.character === 'huangzhong') {
      g.fillStyle(0x423b2c).fillRoundedRect(47, 35, 201, 6, 2);
      if (s.calmProgress > 0) g.fillStyle(tint).fillRoundedRect(47, 35, 201 * s.calmProgress, 6, 2);
    } else {
      const gap = 4, width = (201 - gap * (s.maxStacks - 1)) / s.maxStacks;
      for (let i = 0; i < s.maxStacks; i++) {
        g.fillStyle(i < s.stacks ? tint : 0x423b2c).fillRoundedRect(47 + i * (width + gap), 35, width, 6, 2);
      }
    }
    const hints = {
      mengde: `部曲阵亡积奸雄 · 满 ${MENGDE.need} 层召虎豹骑`,
      taishici: `部曲挨打积信义 · 满 ${TAISHICI.need} 层单骑突围`,
      zhouyu: `火烧敌兵积英发 · 满 ${ZHOUYU.need} 层刮东风`,
      zhangliao: `击杀溃兵积止啼 · 满 ${ZHANGLIAO.need} 层召八百虎贲`,
      lvbu: s.ready ? '人中吕布：每击两次 · 移速攻速 +40%' : '击杀积战意 · 满 25 层人中吕布',
      zhaoyun: s.ready ? '下次龙枪 +1枪 · 穿透距离 +25%' : '命中蓄龙胆 · 每0.15秒最多1层',
      guanyu: s.ready ? '下次斩击 伤害+25% · 范围+18%' : `斩中3敌蓄势 · 当前范围 +${s.stacks * 6}%`,
      huangzhong: s.ready ? '暴击率 +10% · 重箭爆裂' : '重箭命中积蓄势 · 满4层进入神射',
      machao: s.ready ? '下一枪 锦马冲锋' : '命中积铁骑 · 每0.3秒最多1层',
      weiyan: s.ready ? '下一刀 谁敢杀我 · 六向裂波' : '受伤或被围积拒敌 · 身边每3敌每秒1层',
      liubei: s.ready ? '下次出剑 回复8% · 攻速+30%' : '双剑砍中2敌积仁德',
      pangtong: s.ready ? '下次布雷 火烧连环' : '一次连锁引爆3雷积计策',
      huangyueying: s.ready ? '下次射击 扇形齐射6箭' : '命中上机括 · 每0.25秒最多1层',
      sunshangxiang: s.ready ? '下次掷刀 召侍婢护身' : '移动积疾步 · 每0.8秒1层',
      diaochan: s.ready ? '下次出手 闭月：圈内敌人倒戈' : `离间敌人积舞势${s.turned ? ` · 倒戈中 ${s.turned}` : ''}`,
      zhangfei: s.ready ? '下次大喝 据水断桥' : '声浪命中积怒气 · 每0.35秒1层',
      zhuge: s.ready ? '下一发天火 算无遗策 · 暴击×2' : '无首领时天火每发都积星象 · 满3层爆发',
    };
    this.hint.setText(hints[s.character]).setColor(s.ready ? '#efdcaa' : '#c4b59e');
    // 点按计时用场景真实时钟（战斗暂停时也能自然消失）
    this.renderTip(this.root.scene.time.now, true);
  }
}
