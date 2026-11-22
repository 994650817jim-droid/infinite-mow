import Phaser from 'phaser';
import { FONT, GAME_HEIGHT as H, GAME_WIDTH as W, HEADING_FONT, TITLE_FONT } from '../config';
import { CHRONICLE } from '../data/chronicle';
import { ENDING } from '../data/beifaChapter';
import { getCharacter, HOME_ART_HEROES, type CharacterId } from '../data/characters';
import { chronicleProgress } from '../ui/CampaignChronicle';
import { homeCommand } from '../ui/HomeCommand';
import { loadRoster } from '../systems/RosterStore';
import { loadWorld } from '../world/WorldStore';
import { CITIES } from '../world/WorldCities';
import { playMenuMusic, type MenuMood } from '../systems/Music';

export type EndingKind = 'unify' | 'tripartite';
/** 结局判定：占城数 ≥ 全部城池 × ENDING.unifyRatio → 天下一统，否则三分天下。 */
export function endingKind(owned: number, total: number = CITIES.length): EndingKind { return owned >= Math.ceil(total * ENDING.unifyRatio) ? 'unify' : 'tripartite'; }

/** 结局文字：按结局与主公（是不是刘备）改写。 */
export function endingLines(kind: EndingKind, lordId: string, owned: number, total: number): { title: string; kicker: string; lines: { who?: string; text: string }[]; reward: string } {
  const lord = getCharacter(lordId as CharacterId).name, liubei = lordId === 'liubei';
  if (kind === 'unify') return {
    kicker: '结局 · 天下一统', title: liubei ? '汉室复兴' : '四海归一', reward: `占城 ${owned}/${total} · 天下一统`,
    lines: liubei ? [
      { text: '五丈原之后，关中门户洞开。大军东出，洛阳、许昌相继归附，江东亦遣使称臣。' },
      { who: '诸葛亮', text: '陛下，兴复汉室，还于旧都——先帝与臣等的誓言，今日践之。' },
      { who: '刘备', text: '桃园一拜，至今三十余年。云长、翼德……你们看见了吗？' },
      { text: '汉室复兴，四海归一。乱世百年，至此而终。' },
    ] : [
      { text: '五丈原之后，关中门户洞开。大军所至，诸州望风归附，江东亦遣使称臣。' },
      { who: lord, text: '起于行伍，转战半生，不过想让百姓不再流离。今日天下一统，此愿终偿。' },
      { who: '诸葛亮', text: '将军之功，当图于麒麟阁上，与日月同光。' },
      { text: `${lord}平定四海，乱世百年，至此而终。` },
    ],
  };
  return {
    kicker: '结局 · 三分天下', title: liubei ? '鼎足而立' : '据有一方', reward: `占城 ${owned}/${total} · 三分天下`,
    lines: liubei ? [
      { text: '五丈原一战，司马懿退守关中。然而我军占城有限，魏据中原、吴据江东，终未能一举而定。' },
      { who: '诸葛亮', text: '陛下，天下三分，益州疲弊……然汉祚未绝，后人当继此志。' },
      { who: '刘备', text: '鼎足而立，亦是天命。守好巴蜀，与民休息。' },
      { text: '天下三分，魏、蜀、吴鼎足而立。故事未完——' },
    ] : [
      { text: '五丈原一战，司马懿退守关中。然而我军占城有限，诸强割据，天下终成鼎足之势。' },
      { who: lord, text: '据有一方，保境安民，亦不负这些年转战的弟兄。' },
      { text: `天下三分，${lord}据有一方。故事未完——` },
    ],
  };
}

/**
 * 结局美术（美术会话 2026-11-21 交付并通过验收，说明见共享笔记 ending-art.md）。图都是 1920×1080 / 2× 图，按 960×540 逻辑画面使用。
 * 版式坐标（逻辑坐标）集中在这里，方便微调。
 */
export const ENDING_ART = {
  unify: { key: 'ending_unify', file: 'assets/ending/ending_unify.webp', finis: 'ending_finis_a' },
  tripartite: { key: 'ending_three', file: 'assets/ending/ending_three.webp', finis: 'ending_finis_b' },
  pavilion: { key: 'ending_pavilion', file: 'assets/ending/ending_pavilion.webp' },
  finis: { ending_finis_a: 'assets/ending/finis_a.png', ending_finis_b: 'assets/ending/finis_b.png' } as Record<string, string>,
  /** 朱印（2× 图 192²，显示 96²，这里缩到 30）：红印叠白字；未盖用淡墨虚框。优先用 2 号。 */
  seal: { red: 'ending_seal_red', redFile: 'assets/ending/seal_red_2.png', ghost: 'ending_seal_ghost', ghostFile: 'assets/ending/seal_ghost_2.png', size: 30 },
} as const;
/** 结局画卷的文字区（画面下三分之一，y ≥ 360）：天下一统居中偏左；三分天下左下将领背影在 y 205..350（文字区之上），文字放 x 280..870。 */
export const ENDING_TEXT = { top: 360, unify: { cx: 470, w: 560 }, tripartite: { cx: 575, w: 590 } } as const;
/** 麒麟阁长卷上的文字 / 印章安全区（逻辑坐标，见 ending-art.md）。 */
export const PAVILION_SAFE = { x0: 121, x1: 841, y0: 112, y1: 363 } as const;
/** 结局音乐：不用主菜单曲（home）；先用界面曲的「静」编制（古琴 + 二胡，无鼓）。换正式结局曲时改这里。 */
export const ENDING_MUSIC: MenuMood = 'rest';

type Screen = 'story' | 'pavilion' | 'heroes' | 'finale';
const INK = '#2a1c10', PAPER_INK = '#4a3420';

/**
 * 最终章之后的结局（2026-11-21 总制作人「重做大结局的呈现」）：四屏，每屏一个水墨「继续」，Esc 直接到收尾。
 * ① 结局画卷：全屏手绘画缓慢推近，标题与几段文字逐段淡入，压在画面下方三分之一（只垫淡墨晕）。
 * ② 麒麟阁：殿阁里一幅横展长卷（美术底图），十二章从右到左竖排，每章三枚印（已平定盖朱印、未至淡墨虚框）。
 * ③ 功臣：本局麾下武将的水墨立绘横排（放不下时缓缓滚过；没有立绘的跳过）。
 * ④ 收尾：按结局的题字（一统「乱世终 · 天下定」/ 三分「山河为证」）+ 感谢游玩 + 还能做什么，「回到天下」小号描金字。
 * 文字（endingLines）与结局判定（endingKind）不改。电脑布局。
 */
export class EndingScene extends Phaser.Scene {
  kind: EndingKind = 'tripartite'; private lord = 'liubei';
  screen: Screen = 'story';
  private root?: Phaser.GameObjects.Container;
  private owned = 0; private total = 0;
  constructor() { super('EndingScene'); }
  init(data: { lord?: string }): void { this.lord = data?.lord ?? 'liubei'; this.screen = 'story'; }
  preload(): void {
    const img = (k: string, f: string): void => { if (!this.textures.exists(k)) this.load.image(k, f); };
    img(ENDING_ART.unify.key, ENDING_ART.unify.file); img(ENDING_ART.tripartite.key, ENDING_ART.tripartite.file); img(ENDING_ART.pavilion.key, ENDING_ART.pavilion.file);
    for (const [k, f] of Object.entries(ENDING_ART.finis)) img(k, f);
    img(ENDING_ART.seal.red, ENDING_ART.seal.redFile); img(ENDING_ART.seal.ghost, ENDING_ART.seal.ghostFile);
    for (const id of this.heroIds()) img('ink_hero_' + id, `assets/ink-scroll/${id}.webp`);
  }
  create(): void {
    playMenuMusic(this, ENDING_MUSIC);
    this.cameras.main.setBackgroundColor('#0b0806');
    const s = loadWorld(); this.owned = s.ownedCities.length; this.total = CITIES.length;
    this.kind = endingKind(this.owned, this.total);
    const esc = (): void => { if (this.screen !== 'finale') this.show('finale'); };
    this.input.keyboard?.on('keydown-ESC', esc);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', esc));
    this.show('story');
  }

  // ───────────── 通用 ─────────────
  private endArt(): { key: string; finis: string } { return this.kind === 'unify' ? ENDING_ART.unify : ENDING_ART.tripartite; }
  private text(x: number, y: number, v: string, size: number, color = '#efe2c2', font = FONT): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, v, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }); this.root!.add(t); return t;
  }
  /** 整屏铺画（cover），可选缓慢推近（scale 1 → 1.06）。 */
  private cover(key: string, push = false, alpha = 1): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    const im = this.add.image(W / 2, H / 2, key).setAlpha(alpha).setName('ending-art'); const k = Math.max(W / im.width, H / im.height); im.setScale(k); this.root!.add(im);
    if (push) this.tweens.add({ targets: im, scale: k * 1.06, duration: 26000, ease: 'Sine.easeInOut' });
    return im;
  }
  /** 淡墨晕：自下而上 / 自上而下渐淡的暗色（不画边框）。 */
  private wash(y0: number, h: number, fromBottom: boolean, max = .7): void {
    const g = this.add.graphics(), N = Math.max(24, Math.round(h / 3)); // 条带细到 3px 一条，看不出分层
    for (let i = 0; i < N; i++) { const k = (i + .5) / N, a = max * (fromBottom ? k : 1 - k); g.fillStyle(0x080503, a).fillRect(0, y0 + i * h / N, W, h / N + 1); }
    this.root!.add(g);
  }
  /** 唯一的水墨主按钮「继续」（右下角）。 */
  private next(label: string, fn: () => void): void {
    const b = homeCommand(this, W - 88, H - 40, 150, 42, label, true, true, 17);
    for (const o of [b.g, b.hit, b.caption]) this.root!.add(o);
    b.hit.setName('ending-continue').on('pointerup', fn);
    this.text(W - 88, H - 12, 'Esc 跳到最后', 10, '#8e7f66').setOrigin(.5).setName('ending-skip-hint');
  }
  show(screen: Screen): void {
    this.tweens.killAll(); this.root?.destroy(); this.screen = screen;
    this.root = this.add.container(0, 0).setName('ending-' + screen);
    this.cameras.main.fadeIn(500, 8, 5, 3);
    if (screen === 'story') this.story(); else if (screen === 'pavilion') this.pavilion(); else if (screen === 'heroes') this.heroes(); else this.finale();
  }

  // ───────────── ① 结局画卷 ─────────────
  private story(): void {
    const e = endingLines(this.kind, this.lord, this.owned, this.total), L = ENDING_TEXT[this.kind];
    this.cover(this.endArt().key, true);
    this.wash(H * .55, H * .45, true, .78);
    const parts: Phaser.GameObjects.Text[] = [];
    // 小字一行：结局 · 天下一统　占城 x/y（原来单独一行的「占城」并进来，省出一行给正文）
    parts.push(this.text(L.cx, ENDING_TEXT.top, `${e.kicker}　${e.reward.split(' · ')[0]}`, 13, '#d8b878').setOrigin(.5, 0).setStroke('#0b0705', 3).setName('ending-kicker'));
    parts.push(this.text(L.cx, ENDING_TEXT.top + 17, e.title, 30, '#f3dca0', TITLE_FONT).setOrigin(.5, 0).setStroke('#0b0705', 4).setName('ending-title'));
    let y = ENDING_TEXT.top + 58;
    e.lines.forEach((l, i) => {
      const t = this.text(L.cx, y, (l.who ? l.who + '：' : '') + l.text, 14, l.who ? '#f1e6cc' : '#ddd0ae').setOrigin(.5, 0).setAlign('center').setWordWrapWidth(L.w, true).setLineSpacing(2).setStroke('#0b0705', 3).setName('ending-line-' + i);
      parts.push(t); y += t.height + 4;
    });
    parts.forEach((t, i) => { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, delay: 600 + i * 1100, duration: 900 }); });
    // 第一次点「继续」先把字全部显出，再点进麒麟阁
    this.next('继 续', () => { if (parts.some(t => t.alpha < .99)) { for (const tw of this.tweens.getTweens()) if (parts.includes(tw.targets[0] as Phaser.GameObjects.Text)) tw.stop(); parts.forEach(t => t.setAlpha(1)); return; } this.show('pavilion'); });
  }

  // ───────────── ② 麒麟阁 ─────────────
  private pavilion(): void {
    const prog = chronicleProgress(), lord = getCharacter(this.lord as CharacterId).name, cleared = CHRONICLE.reduce((n, c) => n + (prog[c.arc]?.cleared ?? 0), 0);
    this.cover(ENDING_ART.pavilion.key);
    this.wash(0, 96, false, .7);
    this.text(W / 2, 30, '麒麟阁', 30, '#f0d79e', TITLE_FONT).setOrigin(.5).setStroke('#0b0705', 4);
    this.text(W / 2, 62, `主将 ${lord} · 占城 ${this.owned}/${this.total} · 平定 ${cleared}/${CHRONICLE.length * 3} 关 · ${this.kind === 'unify' ? '天下一统' : '三分天下'}`, 13, '#ecdcb4').setOrigin(.5).setStroke('#0b0705', 3).setName('ending-summary');
    // 长卷安全区里十二列，从右到左：章序小字（右）+ 章名竖写（左）在上，三枚印竖排在下
    const S = PAVILION_SAFE, n = CHRONICLE.length, cw = (S.x1 - S.x0) / n, seal = ENDING_ART.seal.size;
    CHRONICLE.forEach((c, i) => {
      const cx = S.x1 - cw * (i + .5), done = prog[c.arc]?.cleared ?? 0;
      const col = this.add.container(0, 0).setName('ending-chapter-' + c.arc); this.root!.add(col);
      const vt = (v: string, x: number, y: number, size: number, color: string, font = FONT): Phaser.GameObjects.Text => { const t = this.add.text(x, y, [...v].join('\n'), { fontFamily: font, fontSize: size + 'px', color, resolution: 2, align: 'center' }).setOrigin(.5, 0).setLineSpacing(size > 12 ? -3 : -2); col.add(t); return t; };
      const m = /^(第.+?章)\s*(.*)$/.exec(c.title.replace(/[·]/g, ' ').trim()), num = m ? m[1] : '', name = (m ? m[2] : c.title).replace(/\s/g, '');
      const nameT = vt(name, cx - 5, S.y0 + 6, 16, done ? INK : '#8a7a62', TITLE_FONT);
      vt(num + '·' + (/\d+/.exec(c.years)?.[0] ?? ''), cx + 13, S.y0 + 8, 9, done ? PAPER_INK : '#9a8b72'); // 章序 + 起始年（整段年份竖排太长会压到印）
      const y0 = Math.max(S.y0 + 118, nameT.y + nameT.height + 10) + seal / 2;
      c.stages.forEach((st, k) => {
        const yy = y0 + k * (seal + 6);
        if (k < done) {
          const sealC = this.add.container(cx, yy).setName(`ending-seal-${c.arc}-${k}`); col.add(sealC);
          if (this.textures.exists(ENDING_ART.seal.red)) sealC.add(this.add.image(0, 0, ENDING_ART.seal.red).setDisplaySize(seal, seal));
          sealC.add(this.add.text(0, 0, st.seal, { fontFamily: TITLE_FONT, fontSize: Math.round(seal * .52) + 'px', color: '#fbf1e0', resolution: 2 }).setOrigin(.5));
          // 很轻的盖印：略大、透明 → 落定
          sealC.setScale(1.3).setAlpha(0); this.tweens.add({ targets: sealC, scale: 1, alpha: 1, delay: 300 + i * 110 + k * 60, duration: 240, ease: 'Back.easeOut' });
        } else if (this.textures.exists(ENDING_ART.seal.ghost)) col.add(this.add.image(cx, yy, ENDING_ART.seal.ghost).setDisplaySize(seal, seal).setName(`ending-seal-empty-${c.arc}-${k}`));
      });
    });
    this.next('继 续', () => this.show(this.heroIds().some(id => this.textures.exists('ink_hero_' + id)) ? 'heroes' : 'finale'));
  }

  // ───────────── ③ 功臣 ─────────────
  /** 本局麾下有水墨立绘的武将（主将在前）。 */
  heroIds(): string[] {
    const r = loadRoster(), ids: string[] = [this.lord, ...(r.lord ? [r.lord] : []), ...r.owned.map(o => o.hero).filter((h): h is CharacterId => !!h)];
    return [...new Set(ids)].filter(id => HOME_ART_HEROES.includes(id));
  }
  private heroes(): void {
    const ids = this.heroIds().filter(id => this.textures.exists('ink_hero_' + id));
    this.cover(this.endArt().key, false, .22);
    this.text(W / 2, 40, '功 臣', 30, '#f0d79e', TITLE_FONT).setOrigin(.5).setStroke('#0b0705', 4);
    this.text(W / 2, 76, '乱世千军，同袍共济', 14, '#cdb98e').setOrigin(.5);
    const strip = this.add.container(0, 0).setName('ending-hero-strip'); this.root!.add(strip);
    const ph = 300, gap = 40; let x = 0;
    for (const id of ids) {
      const im = this.add.image(0, 0, 'ink_hero_' + id).setOrigin(0, 0); const k = ph / im.height; im.setScale(k).setPosition(x, 108).setName('ending-hero-' + id); strip.add(im);
      strip.add(this.add.text(x + im.displayWidth / 2, 108 + ph + 12, getCharacter(id as CharacterId).name, { fontFamily: TITLE_FONT, fontSize: '22px', color: '#f0dfb8', resolution: 2 }).setOrigin(.5, 0));
      x += im.displayWidth + gap;
    }
    const width = Math.max(0, x - gap);
    // 一屏放得下就居中静置；放不下从第一位（主将）起，缓缓向左滚到最后一位，停一停再滚回来（约 26 px/秒）
    if (width <= W - 80) strip.x = (W - width) / 2;
    else { strip.x = 40; const to = W - 40 - width; this.tweens.add({ targets: strip, x: to, delay: 1200, duration: (40 - to) / 26 * 1000, ease: 'Sine.easeInOut', yoyo: true, hold: 1500, repeatDelay: 1500, repeat: -1 }); }
    this.next('继 续', () => this.show('finale'));
  }

  // ───────────── ④ 收尾 ─────────────
  private finale(): void {
    const prog = chronicleProgress(), cleared = CHRONICLE.reduce((n, c) => n + (prog[c.arc]?.cleared ?? 0), 0), all = CHRONICLE.length * 3;
    // 背景：对应那张结局画压暗到约 25%
    this.cover(this.endArt().key, false, .25);
    const fk = this.endArt().finis;
    if (this.textures.exists(fk)) { const im = this.add.image(W / 2, H * .33, fk).setName('ending-inscription'); im.setScale(Math.min(540 / im.width, 150 / im.height)); this.root!.add(im); }
    else this.text(W / 2, H * .33, this.kind === 'unify' ? '乱世终 · 天下定' : '山河为证', 48, '#f3dca0', TITLE_FONT).setOrigin(.5).setStroke('#0b0705', 6).setName('ending-inscription');
    this.text(W / 2, H * .55, '感谢游玩', 24, '#efe2c2', TITLE_FONT).setOrigin(.5).setName('ending-thanks');
    // 还能做什么：未占的城、未平定的关；乱世难度（data/hardMode.ts，天下地图已接入）只在有已平定章节时提
    const tips: string[] = [];
    if (this.total - this.owned > 0) tips.push(`还有 ${this.total - this.owned} 座城未占`);
    if (all - cleared > 0) tips.push(`${all - cleared} 关未平定`);
    if (CHRONICLE.some(c => (prog[c.arc]?.cleared ?? 0) >= 3)) tips.push('已平定的章节可在天下地图以「乱世难度」再战');
    this.text(W / 2, H * .63, tips.length ? tips.join(' · ') : '天下已尽在掌中', 14, '#d8c59c').setOrigin(.5).setName('ending-tips');
    const back = this.text(W / 2, H * .76, '回到天下', 18, '#e8c77e', HEADING_FONT).setOrigin(.5).setPadding(10, 6).setName('ending-return').setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#fff0c8')).on('pointerout', () => back.setColor('#e8c77e')).on('pointerup', () => this.scene.start('WorldMapScene'));
  }
}
