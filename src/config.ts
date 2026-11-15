/** 设计分辨率：手机模式 540x960（竖屏），电脑模式 960x540（横屏）。 */
export let GAME_WIDTH = 540;
export let GAME_HEIGHT = 960;
export let IS_DESKTOP = false;
/** 渲染倍率：画布按 设计分辨率×RENDER_SCALE 实际绘制，各场景相机放大同倍数，逻辑坐标不变。
 * 解决 540×960 / 960×540 画布被拉伸到高分屏后发糊的问题。?hd=1|2|3 或 localStorage im_render_scale 可覆盖。 */
export let RENDER_SCALE = 1;
/** 指针的画布像素坐标 → 设计分辨率坐标（与界面摆放坐标一致）。 */
export function screenPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / RENDER_SCALE, y: p.y / RENDER_SCALE };
}

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
  // 桌面版（Steam）固定电脑布局
  IS_DESKTOP = window.imDesktop ? true : fromUrl ? fromUrl === 'desktop' : pref ? pref === 'desktop' : autoDesktop;
  GAME_WIDTH = IS_DESKTOP ? 960 : 540;
  // 手机竖屏：宽固定540，高度按屏幕比例延伸（9:16→960，19.5:9约1170，最高1280），消除长屏上下黑边。
  // 960以内的设计坐标保持不变；新增高度由各场景按 GAME_HEIGHT 贴底或居中处理。?tall=0 可关闭。
  GAME_HEIGHT = IS_DESKTOP ? 540 : mobileHeight();
  RENDER_SCALE = pickRenderScale();
  return IS_DESKTOP;
}

function mobileHeight(): number {
  if (new URLSearchParams(window.location.search).get('tall') === '0') return 960;
  const w = window.innerWidth, h = window.innerHeight;
  if (!(w > 0 && h > 0)) return 960;
  return Math.round(Math.min(1280, Math.max(960, 540 * h / w)) / 2) * 2;
}

function pickRenderScale(): number {
  let forced: string | null = new URLSearchParams(window.location.search).get('hd');
  if (!forced) try { forced = localStorage.getItem('im_render_scale'); } catch { /* ignore */ }
  const n = Number(forced);
  if (forced && [1, 2, 3].includes(n)) return n;
  // 按实际显示像素选择：显示区域比设计分辨率大 1.25 倍以上才提升到 2 倍，默认最高 2 倍以控制填充开销。
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT) * dpr;
  return fit >= 1.25 ? 2 : 1;
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
