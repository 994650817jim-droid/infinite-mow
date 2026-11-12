/** 设计分辨率：手机模式 540x960（竖屏），电脑模式 960x540（横屏）。 */
export let GAME_WIDTH = 540;
export let GAME_HEIGHT = 960;
export let IS_DESKTOP = false;

/** 启动前根据 URL / 本地偏好 / 设备自动选择布局。 */
export function initLayout(): boolean {
  let pref: string | null = null;
  try {
    pref = localStorage.getItem('im_layout');
  } catch {
    /* ignore */
  }
  const fromUrl = new URLSearchParams(window.location.search).get('layout');
  const autoDesktop = window.innerWidth >= 900 && !window.matchMedia('(pointer: coarse)').matches;
  IS_DESKTOP = fromUrl ? fromUrl === 'desktop' : pref ? pref === 'desktop' : autoDesktop;
  GAME_WIDTH = IS_DESKTOP ? 960 : 540;
  GAME_HEIGHT = IS_DESKTOP ? 540 : 960;
  return IS_DESKTOP;
}

/** 切换布局：写偏好并刷新页面（画布尺寸需重建）。 */
export function switchLayout(mode: 'desktop' | 'mobile'): void {
  try {
    localStorage.setItem('im_layout', mode);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('layout');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export const TITLE_FONT = '"IMWarTitle","STKaiti","KaiTi",serif';
export const HEADING_FONT = '"IMWarHeading","Noto Serif SC","Songti SC","SimSun",serif';
export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",Arial,sans-serif';

export const COLORS = {
  bg: '#14100c',
  ink: 0x0b0906,
  panel: 0x1d1712,
  panelLight: 0x2a211a,
  gold: 0xe8c76a,
  goldDark: 0x9a7a34,
  red: 0xd24b3f,
  jade: 0x4fd1a5,
  white: 0xf5efe6,
  grey: 0x8a8078,
  hp: 0xe04a3a,
  xp: 0x5ac8fa,
  steel: 0xb9c2cc,
} as const;

/** 数值平衡：集中在此处，方便改数值不碰逻辑。 */
export const BALANCE = {
  player: {
    maxHp: 100,
    speed: 178,
    radius: 16,
    invuln: 0.6,
    pickupRadius: 95,
  },
  gameTime: 360,
  bossTime: 300,
  enemyCap: 150,
  enemyCapLow: 100,
  eliteFirst: 55,
  eliteInterval: 60,
  critMultiplier: 1.8,
  maxWeapons: 4,
  maxWeaponLevel: 5,
} as const;

export const DEPTH = {
  ground: 0,
  deco: 4,
  gem: 8,
  enemy: 20,
  player: 30,
  blade: 32,
  projectile: 40,
  fx: 45,
  dmgText: 50,
  hud: 1000,
  overlay: 1500,
} as const;

/** Shared ground-contact ordering, bounded below weapon and effect layers. */
export function actorDepth(footY: number): number {
  return DEPTH.enemy + 1 + Math.atan(footY / 256) / Math.PI * 1.8;
}
