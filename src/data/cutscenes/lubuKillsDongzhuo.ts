import type { CutsceneScript } from './types';

/**
 * 2-3 洛阳 · 吕布斩董卓（董卓剩 20% 时；用户设计的董卓 + 吕布同场首领战的收尾，约 13 秒）。
 * 台词按 story-plan.md 第四节。锚点（DongzhuoLubu 提供）：dongzhuo（董卓精灵）、gate（洛阳城门）、player（主将）、zhangfei（张飞在队时）。
 * 演完由调用方结算：董卓倒下（不再重播倒地）、掉宝箱、战报。跳过 = 直接到这个结果。
 */
export const LUBU_KILLS_DONGZHUO: CutsceneScript = {
  id: 'lubu_kills_dongzhuo', title: '吕布斩董卓', level: 'key',
  linger: { dongzhuo: 'fall' },
  steps: [
    { t: 'letterbox', on: true, ms: 450, wait: false },
    { t: 'music', duck: .35 },
    { t: 'bind', id: 'dongzhuo', anchor: 'dongzhuo', fall: 'boss_death_dongzhuo' },
    { t: 'face', id: 'dongzhuo', dir: 'down' },
    // 镜头移到城门下的董卓；远处马蹄声
    { t: 'cam', to: { a: 'dongzhuo', x: -110, y: -50 }, zoom: 1.12, ms: 1100 },
    { t: 'sfx', key: 'waveDrum', times: 4, every: 300, wait: false },
    { t: 'actor', id: 'lubu', spec: { kind: 'ride', rider: 'lubu', horse: 'chitu' }, at: { a: '@left', x: -140, ay: 'dongzhuo', y: 10 }, face: 'right' },
    // 吕布骑赤兔从画面边奔来（扬尘），在董卓身边勒马
    { t: 'move', id: 'lubu', to: { a: 'dongzhuo', x: -130, y: 10 }, ms: 1500, ease: 'out', pose: 'ride', dust: true },
    { t: 'pose', id: 'lubu', pose: 'idle', face: 'right' },
    { t: 'face', id: 'dongzhuo', dir: 'left' },
    { t: 'say', who: 'dongzhuo', name: '董卓', text: '奉先……我儿……你……', style: 'cry', ms: 1700, color: '#f2d7a0' },
    // 举戟：慢动作 + 推近
    { t: 'slow', scale: .3, ms: 900, wait: false },
    { t: 'cam', to: { a: 'dongzhuo', x: -65, y: -60 }, zoom: 1.38, ms: 450, ease: 'quad', wait: false },
    { t: 'pose', id: 'lubu', pose: 'attack', face: 'right', fps: 9 },
    // 一戟：手绘刀光 + 顿帧 + 震屏 + 红闪
    { t: 'fx', key: 'fx_drag_wave', at: { a: 'dongzhuo', y: -40 }, size: 300, ms: 420, add: true, wait: false },
    { t: 'fx', key: 'fx_strike_glint', at: { a: 'dongzhuo', y: -70 }, size: 200, ms: 380, add: true, wait: false },
    { t: 'sfx', key: 'bossBreak', wait: false },
    { t: 'hitstop', ms: 160 },
    { t: 'flash', color: 0xb01010, ms: 260, alpha: .45, wait: false },
    { t: 'shake', ms: 320, k: .012, wait: false },
    { t: 'pose', id: 'dongzhuo', pose: 'fall', fps: 6 },
    { t: 'fx', key: 'fx_collapse_dust', at: { a: 'dongzhuo', y: 6 }, size: 200, ms: 650, originY: .8, wait: false },
    { t: 'wait', ms: 450 },
    { t: 'cam', to: { a: 'dongzhuo', x: -110, y: -50 }, zoom: 1.15, ms: 600, wait: false },
    { t: 'say', who: 'lubu', name: '吕布', text: '我姓吕，不姓董！', style: 'cry', ms: 1600, color: '#ffb08a' },
    { t: 'say', if: { hero: 'zhangfei' }, who: 'zhangfei', name: '张飞', text: '三姓家奴！', style: 'cry', ms: 1300, color: '#ffe08a' },
    // 吕布拨马离去
    { t: 'move', id: 'lubu', to: { a: '@left', x: -220, ay: 'lubu' }, ms: 1300, ease: 'quad', pose: 'ride', dust: true, face: 'left' },
    { t: 'remove', id: 'lubu' },
    { t: 'cam', to: { a: 'player' }, zoom: 1, ms: 800 },
    { t: 'music', duck: 1 },
    { t: 'letterbox', on: false, ms: 400 },
  ],
};
