// 战法特效（build_vfx 手绘图集）在真实地面上的预览：每个样式按游戏里的典型尺寸放一遍，分组截图 assets/review/school-fx/vfx-<组>.png。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/shot-build-vfx.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/school-fx'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.addInitScript(() => { window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, ''))); if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 180000 }); await p.waitForTimeout(800);
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) { e.hp = 0; e.deactivate(); } window.__bv = await window.__mod('systems/BuildVfx.ts'); });
const GROUPS = { fire: ['flame', 'pure_flame', 'fire_gate', 'ember'], stratagem: ['control', 'pure_control', 'pull', 'stun_burst'], archery: ['critical', 'pure_critical', 'roaming_break', 'sunder_hit'], cavalry: ['skirmish', 'charge', 'pure_skirmish', 'pure_charge'], warrior: ['combo', 'pure_combo', 'peerless', 'heavy'], formation: ['command', 'bulwark', 'pure_command', 'pure_bulwark', 'iron_army', 'reinforce', 'watch', 'breakout'] };
for (const [g, styles] of Object.entries(GROUPS)) {
  const r = await p.evaluate(async ([styles]) => { const s = window.__game.scene.getScene('GameScene'), v = window.__bv.buildVfx(s), px = s.player.x, py = s.player.y, now = s.combatNow, ok = [];
    styles.forEach((st, i) => { const x = px - 190 + (i % 4) * 130, y = py - 70 + Math.floor(i / 4) * 120; const before = v.emitted; v.emit(st, x, y, now, st.startsWith('pure') || st === 'fire_gate' || st === 'iron_army' ? 120 : 90, 0, 900, true); ok.push(v.emitted > before); });
    return ok; }, [styles]);
  await p.waitForTimeout(430); await p.screenshot({ path: `${OUT}/vfx-${g}.png`, clip: { x: 340, y: 160, width: 600, height: 400 } });
  console.log(g, JSON.stringify(r)); await p.waitForTimeout(900);
}
console.log('errors', errs.slice(0, 3)); await b.close();
