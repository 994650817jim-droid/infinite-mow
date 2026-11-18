/**
 * 招贤馆（RECRUIT_PLAN.md · R2）：人才席位（换季自动刷新、花军粮手动刷新、保底）、降将栏、麾下名册（随行、将阶、遣散）。
 * 史事名将与无名之辈暂无立绘：用品质色印章 + 模板字（枪 / 刀 / 弓 / 谋）作程序化过渡；可玩名将用现有头像。
 */
import Phaser from 'phaser';
import { heroLevel, type HeroKey } from '../systems/HeroProgress';
import { playMenuMusic } from '../systems/Music';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { W, H, worldText, worldButton, worldShell, panel } from '../world/WorldUI';
import { loadWorld, worldUnlocked } from '../world/WorldStore';
import { FACTIONS } from '../world/WorldCities';
import { QUALITIES } from '../data/items';
import { CHARACTERS, getCharacter } from '../data/characters';
import { RANK, RECRUIT, TEMPLATES, TEMPLATE_ORDER, type FollowerTemplate } from '../data/recruits';
import { LORD_LEVEL_HINT, followerLevel, followerLevelCap, hallInTown, hallLevel, dismiss, followerCap, loadRoster, manualRefresh, rankBonus, rankCap, rankUp, recruit, refreshCost, toggleFollower, upgradeHall, type Offer, type Recruit } from '../systems/RosterStore';

/** 普通招募武将（内部 kind = 'common'）对玩家显示的称呼（用户 2026-11-17：不叫「大众脸」，改三国风；候选 无名之辈 / 偏裨之将 / 庸碌之将，待用户定）。 */
export const COMMON_LABEL = '无名之辈';
type Tab = 'offers' | 'roster';
export class TalentHallScene extends Phaser.Scene {
  private tab: Tab = 'offers'; private page = 0; private message = ''; private content?: Phaser.GameObjects.Container; private status!: Phaser.GameObjects.Text;
  constructor() { super('TalentHallScene'); }
  init(data?: { tab?: Tab }) { this.tab = data?.tab ?? 'offers'; this.page = 0; this.message = ''; }
  /** 可玩名将头像（战斗图集在战略界面会被卸载，这里按需加载，离开时卸掉自己加的，避免与下次出征重复排队）。 */
  preload() {
    const added: string[] = [];
    for (const c of CHARACTERS) if (!this.textures.exists(c.portrait)) { this.load.image(c.portrait, `assets/processed/${c.portrait}.png`); added.push(c.portrait); }
    // 史事名将 / 无名之辈的模板头像（ChatGPT 正式图，tools/prepare-recruit-faces.mjs；帧顺序 枪 / 刀 / 弓 / 谋）。缺图时退回印章字
    if (!this.textures.exists('recruit_faces')) this.load.spritesheet('recruit_faces', 'assets/recruits/recruit_faces.png', { frameWidth: 128, frameHeight: 128 });
    this.events.once('shutdown', () => { for (const k of added) if (this.textures.exists(k)) this.textures.remove(k); });
  }
  create() {
    playMenuMusic(this);
    if (!worldUnlocked() && !isChapterTestRun()) { this.scene.start('MenuScene'); return; }
    worldShell(this, '招贤馆');
    this.status = worldText(this, 24, 64, '', 13, '#cfdcc6').setWordWrapWidth(W - 48);
    worldButton(this, W / 2, H - (W > 600 ? 34 : 62), '返回营寨', () => this.scene.start('CityScene'), 220).image.setName('talent-home');
    this.render();
  }
  private small(x: number, y: number, w: number, label: string, fn: () => void, name: string, enabled = true, gold = false) {
    const h = W > 600 ? 30 : 38;
    const bg = this.add.rectangle(x, y, w, h, gold ? 0x6a4526 : 0x2a221a, enabled ? .96 : .5).setStrokeStyle(1, gold ? 0xd7b778 : 0x7a6a50).setName(name);
    const t = worldText(this, x, y, label, W > 600 ? 13 : 14, enabled ? '#f2dfb2' : '#8a7e68').setOrigin(.5);
    if (enabled) bg.setInteractive({ useHandCursor: true }).on('pointerup', () => fn());
    this.content!.add([bg, t]); return bg;
  }
  private seal(x: number, y: number, size: number, quality: keyof typeof QUALITIES, glyph: string, portrait?: string, template?: FollowerTemplate) {
    const q = QUALITIES[quality];
    const ring = this.add.rectangle(x, y, size, size, q.dark, 1).setStrokeStyle(2, q.color);
    this.content!.add(ring);
    if (portrait && this.textures.exists(portrait)) { const img = this.add.image(x, y, portrait); img.setScale(Math.min((size - 6) / img.width, (size - 6) / img.height)); this.content!.add(img); }
    else if (template && this.textures.exists('recruit_faces')) { const img = this.add.image(x, y, 'recruit_faces', TEMPLATE_ORDER.indexOf(template)).setName('talent-face'); img.setScale((size - 6) / 128); this.content!.add(img); }
    else this.content!.add(worldText(this, x, y, glyph, Math.round(size * .5), q.css).setOrigin(.5));
  }
  private render() {
    this.content?.destroy(true); this.content = this.add.container(0, 0);
    const s = loadRoster(), w = loadWorld(), D = W > 600, cap = followerCap(s), hall = hallLevel(s);
    this.status.setText(`军粮 ${w.provisions}\n${hall > 0 ? `招贤馆 ${hall} 级 · 席位 ${RECRUIT.seats[hall - 1]}` : '营寨尚未建造招贤馆 · 暂不能招募'} · 随行 ${s.followers.length}/${cap} · 将阶上限 ${rankCap(s)}`);
    // 页签
    const tabY = D ? 112 : 124;
    this.small(D ? 90 : 90, tabY, 140, `人才（${s.offers.length + s.captives.length}）`, () => { this.tab = 'offers'; this.page = 0; this.render(); }, 'talent-tab-offers', true, this.tab === 'offers');
    this.small(D ? 240 : 240, tabY, 140, `麾下（${s.owned.length}）`, () => { this.tab = 'roster'; this.page = 0; this.render(); }, 'talent-tab-roster', true, this.tab === 'roster');
    if (hall < 3) { const c = RECRUIT.hallUpgrade[Math.max(1, hall) - 1]; this.small(W - (D ? 130 : 110), tabY, D ? 220 : 180, `升级招贤馆（${c.provisions} 军粮）`, () => { this.message = upgradeHall().message; this.render(); }, 'talent-hall-up'); }
    const top = tabY + (D ? 26 : 34), bottom = H - (D ? 64 : 104) - 30, rowH = D ? 74 : this.tab === 'roster' ? 118 : 104;
    const per = Math.max(1, Math.floor((bottom - top) / rowH));
    const rows: Array<() => void> = [];
    let y = top;
    const at = () => y + rowH / 2 - 2;
    if (this.tab === 'offers') {
      const list: Array<{ o: Offer; i: number; captive: boolean }> = [...s.offers.map((o, i) => ({ o, i, captive: false })), ...s.captives.map((o, i) => ({ o, i, captive: true }))];
      for (const it of list) rows.push(() => this.offerRow(it.o, it.i, it.captive, at(), rowH - 8));
      const cost = refreshCost(s), left = RECRUIT.pity - s.dry;
      this.content.add(worldText(this, 24, bottom + 6, `换季自动刷新 · 再刷 ${Math.max(1, left + 1)} 次内必出未归附名将`, 12, '#b9ceb8'));
      this.small(W - (D ? 110 : 100), bottom + 14, D ? 190 : 170, `刷新（${cost} 军粮）`, () => { this.message = manualRefresh().message; this.page = 0; this.render(); }, 'talent-refresh', w.provisions >= cost, true);
    } else {
      for (const r of s.owned) rows.push(() => this.rosterRow(r, s.lord === r.hero, s.followers.includes(r.id), at(), rowH - 8, rankCap(s)));
      this.content.add(worldText(this, 24, bottom + 6, `随行 ${s.followers.length}/${cap} · 出战时与主将同名的随行自动留守`, 12, '#b9ceb8'));
    }
    const pages = Math.max(1, Math.ceil(rows.length / per)); this.page = Math.min(this.page, pages - 1);
    for (const draw of rows.slice(this.page * per, this.page * per + per)) { draw(); y += rowH; }
    if (!rows.length) this.content.add(worldText(this, W / 2, top + 60, this.tab === 'offers' ? '席位已空，换季或刷新后会有新人才' : '麾下无人', 15, '#cdbf9f').setOrigin(.5));
    if (pages > 1) {
      this.small(W / 2 - 90, bottom - 4 + (D ? 0 : 0), 70, '上页', () => { this.page = (this.page + pages - 1) % pages; this.render(); }, 'talent-prev');
      this.content.add(worldText(this, W / 2, bottom - 4, `${this.page + 1}/${pages}`, 13, '#e6c88e').setOrigin(.5));
      this.small(W / 2 + 90, bottom - 4, 70, '下页', () => { this.page = (this.page + 1) % pages; this.render(); }, 'talent-next');
    }
    this.content.add(worldText(this, 24, bottom + 28, this.message, 13, '#ffd98a').setWordWrapWidth(W - 48).setName('talent-message'));
  }
  private offerRow(o: Offer, i: number, captive: boolean, y: number, h: number) {
    const D = W > 600, x0 = 16, w = W - 32, q = QUALITIES[o.quality];
    this.content!.add(panel(this, W / 2, y, w, h));
    const size = h - 16; this.seal(x0 + 12 + size / 2, y, size, o.quality, TEMPLATES[o.template].name, o.hero ? getCharacter(o.hero).portrait : undefined, o.template);
    const tx = x0 + 24 + size, kind = o.kind === 'hero' ? '可玩名将 · 随行' : o.kind === 'named' ? `史事名将${o.faction ? ' · ' + FACTIONS[o.faction].name : ''}` : COMMON_LABEL;
    this.content!.add(worldText(this, tx, y - h / 2 + 8, `${captive ? '【降将】' : ''}${o.name}`, D ? 17 : 18, q.css).setName('talent-offer-name'));
    this.content!.add(worldText(this, tx, y - h / 2 + (D ? 32 : 36), `${q.label} · ${kind}\n${TEMPLATES[o.template].name}：${TEMPLATES[o.template].desc}${captive && o.expires !== undefined ? ' · 两季内可招降' : ''}`, 12, '#cdbf9f').setWordWrapWidth(w - size - 150));
    const cost = captive ? Math.ceil(o.cost * RECRUIT.captiveDiscount) : o.cost;
    this.small(W - 16 - 70, y, 120, `${captive ? '招降' : '招募'} ${cost}粮`, () => { this.message = recruit(i, captive).message; this.render(); }, `talent-${captive ? 'captive' : 'offer'}-${i}`, true, o.kind !== 'common');
  }
  private rosterRow(r: Recruit, lord: boolean, following: boolean, y: number, h: number, cap: number) {
    const D = W > 600, x0 = 16, w = W - 32, q = QUALITIES[r.quality];
    this.content!.add(panel(this, W / 2, y, w, h));
    const size = h - 16; this.seal(x0 + 12 + size / 2, y, size, r.quality, TEMPLATES[r.template].name, r.hero ? getCharacter(r.hero).portrait : undefined, r.template);
    const tx = x0 + 24 + size, b = rankBonus(r);
    // 等级：主公随征战提升（不受随行上限）；随行显示「Lv 3 / 上限 5（解锁下一章提升）」
    const lv = followerLevel(r), lvCap = followerLevelCap(), lvText = lord ? `Lv ${lv}` : `Lv ${lv} / 上限 ${lvCap}（解锁下一章提升）`;
    this.content!.add(worldText(this, tx, y - h / 2 + 8, `${r.name} ${lvText}${lord ? ' · 主公' : ''}${following ? ' · 随行' : ''}`, D ? 17 : 18, q.css).setName('talent-roster-name'));
    const c = RANK.cost(r.rank + 1), canRank = r.rank < cap && !lord;
    const line = lord ? `${LORD_LEVEL_HINT}，不在招贤馆升级\n将阶 ${r.rank} · 兵器 +${Math.round(b.damage * 100)}% · 生命 +${Math.round(b.hp * 100)}%` : `将阶 ${r.rank}/${cap}${canRank ? ` · 下一阶 ${c.provisions} 军粮` : r.rank >= RANK.max ? ' · 已满' : ' · 升级招贤馆可继续'}
兵器 +${Math.round(b.damage * 100)}% · 生命 +${Math.round(b.hp * 100)}%${r.hero ? '' : ' · 只能随行'}`;
    this.content!.add(worldText(this, tx, y - h / 2 + (D ? 30 : 34), line, 12, '#cdbf9f').setWordWrapWidth(D ? w - size - 330 : w - size - 40));
    const bx = D ? W - 16 - 320 : tx + 50, by = D ? y : y + h / 2 - 24;
    // 主公：两个升阶按钮置灰不可点（说明写在上一行「主公等级随征战提升」）
    this.small(bx, by, D ? 96 : 92, '升·兵器', () => { this.message = rankUp(r.id, 'weapon').message; this.render(); }, `talent-rank-weapon-${r.id}`, canRank);
    this.small(bx + (D ? 102 : 98), by, D ? 96 : 92, '升·被动', () => { this.message = rankUp(r.id, 'passive').message; this.render(); }, `talent-rank-passive-${r.id}`, canRank);
    this.small(bx + (D ? 204 : 196), by, D ? 82 : 82, following ? '留守' : '随行', () => { this.message = toggleFollower(r.id).message; this.render(); }, `talent-follow-${r.id}`, true, following);
    if (!lord) this.small(bx + (D ? 280 : 276), by, 60, '遣散', () => { this.message = dismiss(r.id).message; this.render(); }, `talent-dismiss-${r.id}`);
  }
}
