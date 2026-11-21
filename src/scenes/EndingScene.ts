import Phaser from 'phaser';
import { FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D, TITLE_FONT } from '../config';
import { CHRONICLE } from '../data/chronicle';
import { ENDING } from '../data/beifaChapter';
import { getCharacter, type CharacterId } from '../data/characters';
import { chronicleProgress } from '../ui/CampaignChronicle';
import { storyScroll } from '../ui/StoryScroll';
import { loadWorld } from '../world/WorldStore';
import { CITIES } from '../world/WorldCities';
import { playMenuMusic } from '../systems/Music';

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
 * 最终章之后的结局：先放结局卷轴（天下一统 / 三分天下，主公不是刘备时改写），再展开「麒麟阁 · 本局编年史」：
 * 逐章列出已平定的关（印章）、占城与结局，最后回天下地图。电脑布局。
 */
export class EndingScene extends Phaser.Scene {
  kind: EndingKind = 'tripartite'; private lord = 'liubei';
  constructor() { super('EndingScene'); }
  init(data: { lord?: string }): void { this.lord = data?.lord ?? 'liubei'; }
  create(): void {
    playMenuMusic(this);
    this.cameras.main.setBackgroundColor('#120d09');
    const s = loadWorld(), owned = s.ownedCities.length, total = CITIES.length;
    this.kind = endingKind(owned, total);
    const e = endingLines(this.kind, this.lord, owned, total);
    storyScroll(this, W, H, D, { name: 'story-ending', confirmName: 'story-ending-confirm', kicker: e.kicker, title: e.title, lines: e.lines, reward: e.reward, confirm: '登麒麟阁', background: 'rest_camp', onDone: () => this.pavilion(owned, total) });
  }
  /** 麒麟阁 · 本局编年史。 */
  private pavilion(owned: number, total: number): void {
    const root = this.add.container(0, 0).setName('ending-pavilion'), prog = chronicleProgress();
    const t = (x: number, y: number, v: string, size: number, color = '#e7d4ae', font = FONT) => this.add.text(x, y, v, { fontFamily: font, fontSize: size + 'px', color, resolution: 2 }).setShadow(0, 1, '#0a0603', 3, true, true);
    root.add(this.add.rectangle(W / 2, H / 2, W, H, 0x120d09, 1));
    root.add(t(W / 2, 34, '麒麟阁 · 本局编年史', 30, '#f0d79e', TITLE_FONT).setOrigin(.5));
    const lord = getCharacter(this.lord as CharacterId).name, cleared = CHRONICLE.reduce((n, c) => n + (prog[c.arc]?.cleared ?? 0), 0);
    root.add(t(W / 2, 70, `主将 ${lord} · 占城 ${owned}/${total} · 平定 ${cleared}/${CHRONICLE.length * 3} 关 · ${this.kind === 'unify' ? '天下一统' : '三分天下'}`, 15, '#c9ad7a').setOrigin(.5));
    const cols = 2, rows = Math.ceil(CHRONICLE.length / cols), cw = (W - 80) / cols, rh = Math.min(64, (H - 170) / rows);
    CHRONICLE.forEach((c, i) => {
      const x = 40 + (i % cols) * cw, y = 100 + Math.floor(i / cols) * rh, p = prog[c.arc] ?? { cleared: 0 }, done = p.cleared;
      root.add(this.add.rectangle(x + cw / 2 - 6, y + rh / 2 - 4, cw - 16, rh - 8, done >= 3 ? 0x3a2a18 : 0x221a13, .95).setStrokeStyle(1, done >= 3 ? 0xc8a468 : 0x5a4a38).setName('ending-row-' + c.arc));
      root.add(t(x + 8, y + 4, c.title, 16, done ? '#f0dfbb' : '#8f8473'));
      root.add(t(x + 8, y + 26, c.years + (done >= 3 ? ' · 已平定' : done ? ` · ${done}/3` : ' · 未至'), 12, '#a99c86'));
      c.stages.forEach((st, k) => { const on = k < done; root.add(t(x + cw - 40 - (2 - k) * 34, y + 10, st.seal, 22, on ? '#e8443a' : '#4a3d30', TITLE_FONT).setOrigin(.5, 0)); });
    });
    const btn = this.add.rectangle(W / 2, H - 40, 220, 46, 0x744530, .96).setStrokeStyle(1, 0xc39b61).setInteractive({ useHandCursor: true }).setName('ending-return');
    root.add(btn); root.add(t(W / 2, H - 40, '回到天下', 20, '#ffdf9d').setOrigin(.5));
    btn.on('pointerup', () => this.scene.start('WorldMapScene'));
  }
}
