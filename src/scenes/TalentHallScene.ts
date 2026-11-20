/**
 * 招贤馆（RECRUIT_PLAN.md · R2）：人才席位（换季自动刷新、花军粮手动刷新、保底）、降将栏、麾下名册（随行、将阶、遣散）。
 * 史事名将与无名之辈暂无立绘：用品质色印章 + 模板字（枪 / 刀 / 弓 / 谋）作程序化过渡；可玩名将用现有头像。
 */
import Phaser from 'phaser';
import { surrenderMoveLine } from '../data/surrenderMoves';
import { heroLevel, type HeroKey } from '../systems/HeroProgress';
import { playMenuMusic } from '../systems/Music';
import { uiSfx } from '../systems/Sfx';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { W, H, worldText, worldButton, worldShell, panel } from '../world/WorldUI';
import { loadWorld, worldUnlocked } from '../world/WorldStore';
import { FACTIONS } from '../world/WorldCities';
import { QUALITIES } from '../data/items';
import { CHARACTERS, getCharacter } from '../data/characters';
import { RECRUIT, TEMPLATES, TEMPLATE_ORDER, type FollowerTemplate } from '../data/recruits';
import { captiveSeasonsLeft, followerLevel, hallOdds, followerLevelCap, hallInTown, hallLevel, dismiss, followerCap, loadRoster, manualRefresh, rankBonus, rankCap, recruit, refreshCost, rosterFollowers, toggleFollower, upgradeHall, type Offer, type Recruit } from '../systems/RosterStore';
import { attrBadge } from '../ui/AttrBadge';
import { homeCommand } from '../ui/HomeCommand';
import { lqHitBox, lqPanel, lqSkin } from '../ui/LacquerKit';
import { HEADING_FONT } from '../config';
import { heroHireCost, heroHired, hireHero } from '../systems/RosterStore';
import { heroUnlocked } from '../systems/HeroUnlocks';
import { LOCKED_HINT as UNJOINED_HINT } from '../data/heroUnlocks';
import type { CharacterId } from '../data/characters';

/** 普通招募武将（内部 kind = 'common'）对玩家显示的称呼（用户 2026-11-17：不叫「大众脸」，改三国风；候选 无名之辈 / 偏裨之将 / 庸碌之将，待用户定）。 */
export const COMMON_LABEL = '无名之辈';
/** 电脑版左右边距（2026-11-18 用户截图：标题、军粮、行框、页签贴着左边）：行框从 MX 起，文字再往里。 */
const MX = 32;
type Tab = 'offers' | 'roster' | 'heroes';
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
    // 2026-11-17 用户批准 UI 审查 A：电脑版整页改漆底描金 + 水墨按钮（原深绿底、扁平矩形按钮、绿木纹行，像网页）
    const D = W > 600;
    if (D) { this.cameras.main.setBackgroundColor('#0e0a07'); const fr = this.add.graphics(); lqPanel(fr, 8, 8, W - 16, H - 16, { shadow: false }); }
    worldShell(this, '招贤馆');
    this.status = worldText(this, D ? MX + 4 : 24, 64, '', 13, D ? '#e8d8b2' : '#cfdcc6').setWordWrapWidth(W - 48);
    if (D) { const back = homeCommand(this, W / 2, H - 34, 220, 42, '返回营寨'); back.hit.setName('talent-home').on('pointerdown', () => this.scene.start('CityScene')); }
    else worldButton(this, W / 2, H - (W > 600 ? 34 : 62), '返回营寨', () => this.scene.start('CityScene'), 220).image.setName('talent-home');
    this.render();
  }
  private small(x: number, y: number, w: number, label: string, fn: () => void, name: string, enabled = true, gold = false) {
    // 2026-11-18 每个界面最多 1 处水墨笔刷：页签 / 升级 / 招募 / 刷新 / 随行 / 留守 / 遣散都用漆底描金（gold = 选中的页签或要紧的操作）
    if (W > 600) {
      const t = worldText(this, x, y, label, 14, '#ffe9bd').setOrigin(.5).setFontFamily(HEADING_FONT).setName(name);
      if (enabled) { t.setInteractive({ useHandCursor: true }); lqHitBox(t, w, 30); t.on('pointerup', () => fn()); }
      const sk = lqSkin(this, t, t, () => ({ w, h: 30 }), { tone: gold ? 'gold' : 'quiet', enabled: () => enabled });
      this.content!.add([sk.gfx, t]); return t;
    }
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
    this.small(D ? MX + 70 : 90, tabY, 140, `人才（${s.offers.length + s.captives.length}）`, () => { this.tab = 'offers'; this.page = 0; this.render(); }, 'talent-tab-offers', true, this.tab === 'offers');
    const men = rosterFollowers(s); // 2026-11-18 用户「主公不应该在这里」：麾下不含主公
    this.small(D ? MX + 70 + 150 : 240, tabY, 140, `麾下（${men.length}）`, () => { this.tab = 'roster'; this.page = 0; this.render(); }, 'talent-tab-roster', true, this.tab === 'roster');
    // 名将（2026-11-20 用户「解锁是指可以玩到的角色，不是解锁就可以跟随了，需要去招贤那里招」）：可玩武将在这里花军粮招为随从
    const heroList = CHARACTERS.filter(c => c.id !== s.lord), hirable = heroList.filter(c => heroUnlocked(c.id) && !heroHired(c.id, s)).length;
    this.small(D ? MX + 70 + 300 : 390, tabY, 140, `名将（可招 ${hirable}）`, () => { this.tab = 'heroes'; this.page = 0; this.render(); }, 'talent-tab-heroes', true, this.tab === 'heroes');
    if (hall < 3) { const c = RECRUIT.hallUpgrade[Math.max(1, hall) - 1]; this.small(W - (D ? MX + 110 : 110), tabY, D ? 220 : 180, `升级招贤馆（${c.provisions} 军粮）`, () => { this.message = upgradeHall().message; this.render(); }, 'talent-hall-up'); }
    const top = tabY + (D ? 26 : 34), bottom = H - (D ? 64 : 104) - 30, rowH = D ? 74 : this.tab === 'roster' ? 118 : 104;
    const per = Math.max(1, Math.floor((bottom - top) / rowH));
    const rows: Array<() => void> = [];
    let y = top;
    const at = () => y + rowH / 2 - 2;
    if (this.tab === 'offers') {
      const list: Array<{ o: Offer; i: number; captive: boolean }> = [...s.offers.map((o, i) => ({ o, i, captive: false })), ...s.captives.map((o, i) => ({ o, i, captive: true }))];
      for (const it of list) rows.push(() => this.offerRow(it.o, it.i, it.captive, at(), rowH - 8));
      // 名将出现率（用户 2026-11-17：Lv1 基本不出名将，升级招贤馆后提高）
      const cost = refreshCost(s), odds = hallOdds(s), pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
      this.content.add(worldText(this, D ? MX + 4 : 24, bottom + 6, `史事名将出现率：每席 ${pct(odds.seat)} · 升级招贤馆后提高 · 可玩武将在「名将」页直接招募`, 12, '#b9ceb8').setName('talent-odds'));
      this.small(W - (D ? MX + 95 : 100), bottom + 14, D ? 190 : 170, `刷新（${cost} 军粮）`, () => { this.message = manualRefresh().message; this.page = 0; this.render(); }, 'talent-refresh', w.provisions >= cost, true);
    } else if (this.tab === 'heroes') {
      // 已解锁未招的排前面，其次已在麾下，最后未归附
      const rank = (id: CharacterId) => !heroUnlocked(id) ? 2 : heroHired(id, s) ? 1 : 0;
      for (const c of [...heroList].sort((a, b) => rank(a.id) - rank(b.id))) rows.push(() => this.heroRow(c.id, at(), rowH - 8, s.followers.length, cap, w.provisions));
      this.content.add(worldText(this, D ? MX + 4 : 24, bottom + 20, '解锁的武将可以选为主将；要当随从（跟着出战）得在这里招募。招到后随行名额有空就直接随行。', 12, '#b9ceb8').setName('talent-heroes-note'));
    } else {
      for (const r of men) rows.push(() => this.rosterRow(r, s.followers.includes(r.id), at(), rowH - 8, rankCap(s)));
      this.content.add(worldText(this, D ? MX + 4 : 24, bottom + 6, `随行 ${s.followers.length}/${cap} · 出战时与主将同名的随行自动留守`, 12, '#b9ceb8'));
    }
    const pages = Math.max(1, Math.ceil(rows.length / per)); this.page = Math.min(this.page, pages - 1);
    for (const draw of rows.slice(this.page * per, this.page * per + per)) { draw(); y += rowH; }
    if (!rows.length) this.content.add(worldText(this, W / 2, top + 60, this.tab === 'offers' ? '席位已空，换季或刷新后会有新人才' : '麾下无人', 15, '#cdbf9f').setOrigin(.5));
    if (pages > 1) {
      this.small(W / 2 - 90, bottom - 4 + (D ? 0 : 0), 70, '上页', () => { this.page = (this.page + pages - 1) % pages; this.render(); }, 'talent-prev');
      this.content.add(worldText(this, W / 2, bottom - 4, `${this.page + 1}/${pages}`, 13, '#e6c88e').setOrigin(.5));
      this.small(W / 2 + 90, bottom - 4, 70, '下页', () => { this.page = (this.page + 1) % pages; this.render(); }, 'talent-next');
    }
    this.content.add(worldText(this, D ? MX + 4 : 24, bottom + 28, this.message, 13, '#ffd98a').setWordWrapWidth(W - 48).setName('talent-message'));
  }
  private offerRow(o: Offer, i: number, captive: boolean, y: number, h: number) {
    const D = W > 600, x0 = D ? MX : 16, w = W - x0 * 2, q = QUALITIES[o.quality];
    if (D) { const g = this.add.graphics(); g.fillStyle(0x000000, .35).fillRoundedRect(x0 + 2, y - h / 2 + 3, w, h, 8).fillStyle(0x1b120b, .96).fillRoundedRect(x0, y - h / 2, w, h, 8).lineStyle(1.5, 0xc9a35e, .8).strokeRoundedRect(x0, y - h / 2, w, h, 8); this.content!.add(g); } else this.content!.add(panel(this, W / 2, y, w, h)); // 电脑版漆底单描金边（双层边会压到第三行字）
    const size = h - 16; this.seal(x0 + 12 + size / 2, y, size, o.quality, TEMPLATES[o.template].name, o.hero ? getCharacter(o.hero).portrait : undefined, o.template);
    { const b = o.hero ? attrBadge(this, x0 + 12 + size - 6, y - h / 2 + 16, o.hero, 22) : null; if (b) this.content!.add(b); }
    const tx = x0 + 24 + size, kind = o.boss ? '首领降将' : o.kind === 'hero' ? '可玩名将 · 随行' : o.kind === 'named' ? `史事名将${o.faction ? ' · ' + FACTIONS[o.faction].name : ''}` : COMMON_LABEL;
    const nameT = worldText(this, tx, y - h / 2 + 8, `${captive ? '【降将】' : ''}${o.name}`, D ? 17 : 18, q.css).setName('talent-offer-name'); this.content!.add(nameT);
    // 首领降将（surrender-spec §7）：名字旁一枚「首领」小印（手绘印章图到之前用文字章）
    if (o.boss) { const sx = nameT.x + nameT.width + 22, sy = nameT.y + nameT.height / 2; if (this.textures.exists('seal_boss')) this.content!.add(this.add.image(sx, sy, 'seal_boss').setDisplaySize(32, 32).setAngle(-6).setName('talent-boss-seal')); else { const sg = this.add.graphics().lineStyle(1.5, 0xd0503a, .95).strokeRoundedRect(sx - 18, sy - 11, 36, 22, 4); this.content!.add([sg, worldText(this, sx, sy, '首领', 12, '#e0604a').setOrigin(.5).setName('talent-boss-seal')]); } }
    this.content!.add(worldText(this, tx, y - h / 2 + (D ? 32 : 36), `${q.label} · ${kind}${captive && o.expires !== undefined ? ` · 剩 ${captiveSeasonsLeft(o)} 季` : ''}\n${surrenderMoveLine(o.boss) ? TEMPLATES[o.template].name + ' · ' + surrenderMoveLine(o.boss) : TEMPLATES[o.template].name + '：' + TEMPLATES[o.template].desc}`, 12, '#cdbf9f').setWordWrapWidth(w - size - 150).setName('talent-offer-desc'));
    const cost = captive ? Math.ceil(o.cost * RECRUIT.captiveDiscount) : o.cost;
    this.small(W - x0 - 70, y, 120, `${captive ? '招降' : '招募'} ${cost}粮`, () => { const r = recruit(i, captive); this.message = r.message; if (r.ok) uiSfx().play('recruit'); this.render(); }, `talent-${captive ? 'captive' : 'offer'}-${i}`, true, o.kind !== 'common');
  }
  /** 「名将」页一行：头像、名字与状态；未归附 → 剪影 + 「尚未归附 · 需劝降招募」；已归附未招 → 「招募 · N 军粮」；已在麾下 → 灰按钮。 */
  private heroRow(id: CharacterId, y: number, h: number, following: number, cap: number, grain: number) {
    const D = W > 600, x0 = D ? MX : 16, w = W - x0 * 2, c = getCharacter(id), unlocked = heroUnlocked(id), hired = unlocked && heroHired(id), cost = heroHireCost(id);
    if (D) { const g = this.add.graphics(); g.fillStyle(0x000000, .35).fillRoundedRect(x0 + 2, y - h / 2 + 3, w, h, 8).fillStyle(0x1b120b, .96).fillRoundedRect(x0, y - h / 2, w, h, 8).lineStyle(1.5, unlocked && !hired ? 0xe0b25a : 0xc9a35e, unlocked ? .9 : .4).strokeRoundedRect(x0, y - h / 2, w, h, 8); this.content!.add(g); } else this.content!.add(panel(this, W / 2, y, w, h));
    const size = h - 16; this.seal(x0 + 12 + size / 2, y, size, 'orange', c.name.slice(0, 1), unlocked ? c.portrait : undefined);
    if (!unlocked) { const sh = this.content!.list[this.content!.list.length - 1] as Phaser.GameObjects.Text; sh?.setColor?.('#5a4a36'); }
    const tx = x0 + 24 + size;
    this.content!.add(worldText(this, tx, y - h / 2 + 8, unlocked ? c.name : '？？？', D ? 17 : 18, unlocked ? '#f2a24e' : '#8a7a62').setName('talent-hero-name-' + id));
    const status = !unlocked ? UNJOINED_HINT : hired ? '已在麾下 · 去「麾下」页设随行' : '已归附 · 可选为主将 · 需在此招募才会随行出战';
    this.content!.add(worldText(this, tx, y - h / 2 + (D ? 32 : 36), status, 12, unlocked ? '#cdbf9f' : '#8a7a62').setName('talent-hero-status-' + id));
    const label = !unlocked ? '未归附' : hired ? '已在麾下' : `招募 · ${cost} 军粮`, can = unlocked && !hired && grain >= cost;
    this.small(W - x0 - 90, y, 160, label, () => { const r = hireHero(id); this.message = r.message; this.render(); }, 'talent-hire-' + id, can, unlocked && !hired);
    void following; void cap;
  }
  private rosterRow(r: Recruit, following: boolean, y: number, h: number, cap: number) {
    const D = W > 600, x0 = D ? MX : 16, w = W - x0 * 2, q = QUALITIES[r.quality];
    if (D) { const g = this.add.graphics(); g.fillStyle(0x000000, .35).fillRoundedRect(x0 + 2, y - h / 2 + 3, w, h, 8).fillStyle(0x1b120b, .96).fillRoundedRect(x0, y - h / 2, w, h, 8).lineStyle(1.5, 0xc9a35e, .8).strokeRoundedRect(x0, y - h / 2, w, h, 8); this.content!.add(g); } else this.content!.add(panel(this, W / 2, y, w, h)); // 电脑版漆底单描金边（双层边会压到第三行字）
    const size = h - 16; this.seal(x0 + 12 + size / 2, y, size, r.quality, TEMPLATES[r.template].name, r.hero ? getCharacter(r.hero).portrait : undefined, r.template);
    { const ab = r.hero ? attrBadge(this, x0 + 12 + size - 6, y - h / 2 + 16, r.hero, 22) : null; if (ab) this.content!.add(ab); }
    const tx = x0 + 24 + size, b = rankBonus(r);
    // 等级：随行显示「Lv 3 / 上限 5（解锁下一章提升）」（主公不在麾下名单里）
    const lv = followerLevel(r), lvCap = followerLevelCap(), lvText = `Lv ${lv} / 上限 ${lvCap}（解锁下一章提升）`;
    this.content!.add(worldText(this, tx, y - h / 2 + 8, `${r.name} ${lvText}${following ? ' · 随行' : ''}`, D ? 17 : 18, q.css).setName('talent-roster-name'));
    // 将阶升级挪到讲武堂「随行操练」（用户 2026-11-17「升级随从功能挪到讲武堂」）；这里只显示现状
    // 降将（2026-11-18 专属招式）：第二行写专属招式，行高不变（「去讲武堂升阶」提示省掉，数值并到第一行）
    const sig = surrenderMoveLine(r.boss);
    const line = sig ? `将阶 ${r.rank}/${cap} · 兵器 +${Math.round(b.damage * 100)}% · 生命 +${Math.round(b.hp * 100)}% · 只能随行\n${sig}` : `将阶 ${r.rank}/${cap} · 去讲武堂「随行操练」升阶
兵器 +${Math.round(b.damage * 100)}% · 生命 +${Math.round(b.hp * 100)}%${r.hero ? '' : ' · 只能随行'}`;
    this.content!.add(worldText(this, tx, y - h / 2 + (D ? 30 : 34), line, 12, '#cdbf9f').setWordWrapWidth(D ? w - size - 330 : w - size - 40));
    const bx = D ? W - x0 - 320 : tx + 50, by = D ? y : y + h / 2 - 24;
    this.small(bx + (D ? 204 : 196), by, D ? 82 : 82, following ? '留守' : '随行', () => { this.message = toggleFollower(r.id).message; this.render(); }, `talent-follow-${r.id}`, true, following);
    this.small(bx + (D ? 280 : 276), by, 60, '遣散', () => { this.message = dismiss(r.id).message; this.render(); }, `talent-dismiss-${r.id}`);
  }
}
