/** BGM 试听页（bgm-preview.html，只在 dev server 下可用，不进正式包）：界面曲各情绪、各章战斗曲、首领曲、胜负短曲、开场动画曲。 */
import { Music, MENU_MOODS, type MenuMood } from '../systems/Music';
import { BATTLE_THEMES, type BattleThemeKey } from '../systems/EpicBgm';
import { bossProfile } from '../data/bossMusic';

const MOOD_NAME: Record<MenuMood, [string, string]> = {
  home: ['主页 / 选将 / 结局', '《营火望乡》原样：古琴琶音、竹笛、远鼓'],
  map: ['天下地图 / 各章选关', '大气：低音更深、合唱铺底、每小节大鼓、后半曲号角'],
  camp: ['营寨 / 城池 / 城中募兵', '暖：古琴八分拨弦、小鼓、远处人声嘈嘈与营火噼啪'],
  hall: ['招贤馆', '雅：古琴、箫、编钟，无鼓'],
  rest: ['战斗结算 / 战败退守', '静：古琴 + 二胡（胜负短曲之后接上）'],
};
const BOSSES = ['张角', '华雄', '吕布', '董卓', '袁术', '曹操', '司马懿'];

let menu: Music | null = null, battle: Music | null = null, opening: HTMLAudioElement | null = null;
const status = document.getElementById('status')!;
const say = (t: string): void => { status.textContent = t; };
const stopAll = (except?: 'menu'): void => {
  if (except !== 'menu') { menu?.fadeStop(500); }
  battle?.dispose(); battle = null;
  if (opening) { opening.pause(); opening = null; }
};
function playMood(m: MenuMood): void {
  stopAll('menu');
  if (!menu) menu = new Music('menu');
  menu.reloadPrefs(); menu.setMood(m, !menu.playingState);
  if (!menu.playingState) menu.start(); else menu.cancelFade();
  menu.unlock(); say(`界面曲 · ${MOOD_NAME[m][0]}（同一实例换情绪：淡出 → 换编制 → 淡入）`);
}
function playBattle(key: BattleThemeKey, boss?: string): void {
  stopAll(); battle = new Music('battle'); battle.setBattleTheme(key); battle.start(); battle.unlock();
  if (boss) { const b = battle; window.setTimeout(() => { if (battle === b) b.setBoss(bossProfile(boss)); }, 800); say(`首领曲 · ${boss}（先出场锣鼓，再进主题）`); }
  else say(`战斗曲 · ${BATTLE_THEMES[key].title}`);
}
function playJingle(win: boolean): void {
  stopAll(); battle = new Music('battle'); battle.start(); battle.unlock(); const b = battle;
  window.setTimeout(() => { if (battle === b) b.endBattle(win); }, 2500); say(`战斗曲 2.5 秒后接${win ? '胜利' : '败退'}短曲`);
}
function playOpening(): void {
  stopAll(); let vol = .4; try { vol = Number(localStorage.getItem('im_bgm_vol') ?? 40) / 100; } catch { /* ignore */ }
  opening = new Audio('assets/audio/opening_theme.ogg'); opening.volume = Math.min(1, vol * .55); void opening.play(); say('开场动画曲（20.5 秒，与游戏 BGM 同响度）');
}

function section(title: string, cards: Array<{ t: string; s: string; btns: Array<[string, () => void]> }>): void {
  const sec = document.createElement('section'), h = document.createElement('h2'), grid = document.createElement('div');
  h.textContent = title; grid.className = 'grid'; sec.append(h, grid);
  for (const c of cards) {
    const card = document.createElement('div'); card.className = 'card';
    const b = document.createElement('b'); b.textContent = c.t; const sm = document.createElement('small'); sm.textContent = c.s; card.append(b, sm);
    for (const [label, fn] of c.btns) { const btn = document.createElement('button'); btn.textContent = label; btn.onclick = fn; card.append(btn); }
    grid.append(card);
  }
  document.getElementById('app')!.append(sec);
}
section('界面曲（非战斗界面）', MENU_MOODS.map(m => ({ t: MOOD_NAME[m][0], s: MOOD_NAME[m][1], btns: [['播放', () => playMood(m)]] as Array<[string, () => void]> })));
section('战斗曲', (Object.keys(BATTLE_THEMES) as BattleThemeKey[]).map(k => ({ t: BATTLE_THEMES[k].title, s: `${BATTLE_THEMES[k].bpm} BPM`, btns: [['播放', () => playBattle(k)]] as Array<[string, () => void]> })));
section('首领曲', [{ t: '首领出场 + 主题', s: '按首领气质（调式、主奏乐器、特效）', btns: BOSSES.map(n => [n, () => playBattle('huangjin', n)] as [string, () => void]) }]);
section('胜负短曲 · 开场', [{ t: '胜负短曲', s: '接在战斗曲后约 4 秒', btns: [['胜利', () => playJingle(true)], ['败退', () => playJingle(false)]] }, { t: '开场水墨动画曲', s: 'assets/audio/opening_theme.ogg', btns: [['播放', playOpening]] }]);
document.getElementById('stop')!.onclick = () => { stopAll(); say('已停止'); };
const vol = document.getElementById('vol') as HTMLInputElement;
try { vol.value = localStorage.getItem('im_bgm_vol') ?? '40'; } catch { /* ignore */ }
vol.oninput = () => { const v = Number(vol.value); menu?.setVolume(v); battle?.setVolume(v); if (opening) opening.volume = Math.min(1, v / 100 * .55); say(`音乐音量 ${v}%（写入游戏设置 im_bgm_vol）`); };
(window as unknown as { __bgmPreview?: unknown }).__bgmPreview = { playMood, playBattle, playJingle, stopAll, get menu() { return menu; }, get battle() { return battle; } };
