// 战斗 HUD 调整：取消「战况」、音效 / 音乐开关常驻右上；护阵按钮缩小半透明；动作帧统一缩放（关羽满势重斩不再忽大忽小）。
// 需要开发服务器 5173。用法：node tools/test-hud-tweaks.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hud-tweaks';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
for (const layout of ['mobile', 'desktop']) {
  const p = await b.newPage(layout === 'mobile' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; }, G);
  await p.waitForTimeout(400);
  const hud = await p.evaluate(G0 => { const s = eval(G0), t = s.hudTexts; return { details: t.details.visible, mute: { v: t.mute.visible, text: t.mute.text, x: Math.round(t.mute.x) }, music: { v: t.music.visible, text: t.music.text }, W: s.scale.width / (window.__game.config.zoom || 1) }; }, G);
  ck(`${layout}：「战况」已隐藏，音效 / 音乐开关常驻`, !hud.details && hud.mute.v && hud.music.v && /^音效:/.test(hud.mute.text) && /^音乐:/.test(hud.music.text), hud);
  const toggled = await p.evaluate(G0 => { const s = eval(G0), before = s.sfx.muted; s.hudTexts.mute.emit('pointerdown'); const r = { before, after: s.sfx.muted, text: s.hudTexts.mute.text }; s.hudTexts.mute.emit('pointerdown'); return r; }, G);
  ck(`${layout}：点「音效」切换开关并更新文字`, toggled.after !== toggled.before && toggled.text === (toggled.after ? '音效:关' : '音效:开'), toggled);
  const order = await p.evaluate(G0 => { const s = eval(G0), ui = s.legionUI ?? Object.values(s).find(v => v && v.orderPlate && v.order); if (!ui) return null; const before = s.legion.order; ui.order.emit('pointerdown'); ui.order.emit('pointerup'); const after = s.legion.order; return { w: ui.order.width, h: ui.order.height, hint: ui.orderHint.visible, text: ui.order.text, before, after }; }, G);
  ck(`${layout}：护阵按钮紧凑（≤110×40）、无说明行、可切换军令`, order && order.w <= 110 && order.h <= 40 && !order.hint && order.before !== order.after, order);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${layout}-hud.png` });
  await p.close();
}
// 关羽：招牌技 4 帧同一缩放
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => errors.push('guanyu ' + e.message));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=mobile');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'guanyu', weapon: 'guandao' }); s.scene.restart(); }, G);
  await p.waitForTimeout(500); await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'guanyu' && s.__DEV_ACTIONS; });
  const scales = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player; s.__DEV_ACTIONS.closePopup?.(); pl.weapons[0].cooldownLeft = 1e9; pl.playAction('skill', 'right'); const out = []; for (let i = 0; i < 12; i++) { out.push([String(pl.sprite.frame.name), +pl.sprite.scaleY.toFixed(4)]); await new Promise(r => setTimeout(r, 45)); } return out; }, G);
  const skill = scales.filter(([f]) => ['16', '17', '18', '19'].includes(f));
  ck('关羽招牌技各帧缩放一致（不再忽大忽小）', new Set(skill.map(x => x[1])).size === 1 && new Set(skill.map(x => x[0])).size >= 3, skill);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
