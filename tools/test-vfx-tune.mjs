// 战法触发特效放大 / 放慢 / 节流（BuildVfx.VFX_TUNE）：尺寸按档放大、时长 ×1.7、同一流派 0.5 秒内只播一次（核心不受限）、离主将近时半透明、改前开关可恢复。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-vfx-tune.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const V = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('systems/BuildVfx.ts')) ?? '/src/systems/BuildVfx.ts');
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); const v = V.buildVfx(s), px = s.player.x, py = s.player.y, now = s.combatNow, o = {};
    const far = (dx) => [px + dx, py + 140];
    const e0 = v.emitted; v.emit('critical', ...far(60), now, 48); v.emit('pure_critical', ...far(120), now + 100, 48); v.emit('flame', ...far(180), now + 100, 42); // 弓弩两次（第二次被合并）+ 火攻一次
    o.gate = v.emitted - e0;
    const sl = v.slots.find(x => x.row === V.VFX_STYLES.indexOf('critical') && x.end > now); o.size = sl && Math.round(sl.image.displayWidth); o.dur = sl && Math.round(sl.end - sl.start);
    v.emit('pure_critical', ...far(-60), now + 20, 48, 0, 300, true); v.emit('pure_critical', ...far(-120), now + 40, 48, 0, 300, true); o.core = v.emitted - e0 - o.gate; // 核心样式不受合并限制
    v.emit('combo', px + 4, py - 6, now + 900, 40); const near = v.slots.filter(x => x.end > now + 900 && x.alpha < .5); o.nearAlpha = near.length;
    o.frames = [0, .1, .2, .4, .6, .8, .95].map(V.vfxFrame);
    V.vfxLegacy(true); const e1 = v.emitted; v.emit('skirmish', ...far(10), now + 3000, 48); const sl2 = v.slots.find(x => x.row === V.VFX_STYLES.indexOf('skirmish') && x.end > now + 3000); o.legacySize = sl2 && Math.round(sl2.image.displayWidth); o.legacyDur = sl2 && Math.round(sl2.end - sl2.start); V.vfxLegacy(false); o.legacyEmit = v.emitted - e1;
    return o; });
  ck('同一流派 0.5 秒内合并：弓弩两次只播一次 + 火攻一次 = 2', r.gate === 2, r);
  ck('小图标放大 ×1.7（48 → 约 82）、时长 ×1.7（300 → 约 510）', r.size >= 80 && r.size <= 84 && r.dur >= 500 && r.dur <= 520, { size: r.size, dur: r.dur });
  ck('核心样式不受合并限制（两次都播）', r.core === 2, r);
  ck('离主将很近的特效半透明', r.nearAlpha >= 1, r);
  ck('帧停留表：开头停、峰值帧（2–3）停得更久、尾帧收', r.frames.join() === '0,0,1,2,3,4,5', r.frames);
  ck('改前开关：尺寸 / 时长恢复原值', r.legacyEmit === 1 && r.legacySize === 48 && r.legacyDur === 300, r);
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
