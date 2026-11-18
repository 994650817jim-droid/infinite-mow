// 首领存在感（systems/BossPresence.ts）：张梁（1-1）/ 吕布骑赤兔（虎牢关）/ 庞德（9-2），电脑布局 1280×720。
// 检查：首领显示 ×1.4、精锐 ×1.15、判定半径同倍；脚下火环、身上光晕、头顶名牌、屏外箭头；登场暗场与镜头不暂停战斗、1.7 秒内复原；
// 场上小兵不与首领同图；帧率（与 ?presence=0 对比）；截图改前（?presence=0）/ 改后。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-presence.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-presence';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const BOSSES = [
  { id: 'zhangliang', name: '张梁', url: '?dev=1&autostart=1&stage=1', scene: 'GameScene' },
  { id: 'lubu', name: '吕布', url: '?dev=1', scene: 'LubuGameScene', menu: true },
  { id: 'pangde', name: '庞德', url: '?dev=1', scene: 'XiangfanGameScene', xiangfan: 2 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const open = async (c, presence) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + c.url + '&layout=desktop' + (presence ? '' : '&presence=0'));
  if (c.menu || c.xiangfan) {
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') && window.__game.registry.get('battleReady'), null, { timeout: 120000 });
    await p.evaluate(([k, st]) => { const g = window.__game; if (st) { g.registry.set('xiangfanStage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); } for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start(k); }, [c.scene, c.xiangfan ?? 0]);
  }
  await p.waitForFunction(k => { const s = window.__game?.scene.getScene(k); return s?.player && window.__game.scene.isActive(k); }, c.scene, { timeout: 120000 });
  await p.waitForTimeout(1500);
  // 章首剧情卷轴（如 9-2「水淹七军」）逐页点掉，与本测试无关
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); for (let i = 0; i < 30 && s.mode === 'story'; i++) { const root = s.children.list.find(o => o.type === 'Container' && o.list?.some(c => /-(next|confirm)$/.test(c.name ?? ''))); const hit = root?.list.find(c => /-next$/.test(c.name ?? '')) ?? root?.list.find(c => /-confirm$/.test(c.name ?? '')); if (!hit) break; hit.emit('pointerup'); } }, c.scene);
  await p.waitForTimeout(300);
  // 清场、主将无敌、首领不死；弹窗自动关
  await p.evaluate(k => { const s = window.__game.scene.getScene(k), pl = s.player; s.__DEV_ACTIONS?.closePopup?.(); pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9;
    for (const u of s.legion?.units ?? []) u.setVisible?.(false);
    s.events.on('preupdate', () => { if (s.mode === 'levelup' || s.mode === 'recruit' || s.mode === 'bossloot') s.__DEV_ACTIONS?.closePopup?.(); if (s.boss?.active && s.boss.hp < s.boss.maxHp * .5) s.boss.hp = s.boss.maxHp; pl.hp = pl.maxHp; }); }, c.scene);
  return { p, errs, ev: (fn, arg) => p.evaluate(([k, f, a]) => { const s = window.__game.scene.getScene(k); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [c.scene, fn.toString(), arg]) };
};
// 渲染那一刻的显示高度（BossPresence 在 PRE_RENDER 放大、RENDER 还原；这里在它之后的 PRE_RENDER 里量）
const measure = s => new Promise(res => { const out = {}; const f = () => { s.events.off('prerender', f); const sp = s.boss.sprite; out.render = sp.displayHeight; out.renderScale = sp.scaleY; }; s.events.once('postupdate', () => { out.logic = s.boss.sprite.displayHeight; out.logicScale = s.boss.sprite.scaleY; s.events.on('prerender', f); }); setTimeout(() => res(out), 400); });
const fps = async ev => { await new Promise(r => setTimeout(r, 300)); return ev(s => new Promise(res => { const a = []; const t = setInterval(() => a.push(s.game.loop.actualFps), 250); setTimeout(() => { clearInterval(t); res(+(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)); }, 3000); })); };
try {
  for (const c of BOSSES) {
    // ---------- 改前（?presence=0）：截图 + 帧率 ----------
    { const { p, ev } = await open(c, false);
      // 登场卡顿的基准：生成首领本身（换曲、控制器、倒地帧预载）就有一两百毫秒，改后只看新增部分
      await ev(s => { let last = performance.now(); window.__gap = 0; const f = () => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; }; s.events.on('preupdate', f); setTimeout(() => s.events.off('preupdate', f), 1500); });
      await ev(s => { if (!s.boss?.active) s.spawnBoss(); for (let i = 0; i < 10 && s.mode === 'levelup'; i++) s.chooseUpgrade(0); });
      await p.waitForTimeout(1600); c.gapBefore = await p.evaluate(() => Math.round(window.__gap));
      await ev(s => { s.boss.sprite.setPosition(s.player.x + 190, s.player.y - 30); for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', s.player.x + 120 + i * 30, s.player.y + 60 + (i % 2) * 40, 1, true); });
      await p.waitForTimeout(2600); await p.screenshot({ path: `${OUT}/${c.id}-before.png` });
      c.fpsBefore = await fps(ev); await p.close(); }
    // ---------- 改后 ----------
    const { p, errs, ev } = await open(c, true);
    // 登场前后 1.5 秒记录最长帧间隔（光晕 / 火环不能在登场时卡一下）
    await ev(s => { let last = performance.now(); window.__gap = 0; const f = () => { const t = performance.now(); window.__gap = Math.max(window.__gap, t - last); last = t; }; s.events.on('preupdate', f); setTimeout(() => s.events.off('preupdate', f), 1500); });
    const sp = await ev(s => { const before = s.boss?.active; if (!before) s.spawnBoss(); /* 首领登场的保底三选一（等级合并后的游戏流程）先点掉，只看登场演出本身 */ for (let i = 0; i < 10 && s.mode === 'levelup'; i++) s.chooseUpgrade(0); return { before, mode: s.mode, clock: s.combatNow, entrance: s.presence?.stats.entrance, dim: !!s.children.getByName('boss-entrance-dim') }; });
    // 登场不暂停：战斗时钟照走、模式不变
    await p.waitForTimeout(600);
    const mid = await ev(s => ({ mode: s.mode, clock: s.combatNow, look: { ...s.presence.look } }));
    ck(`${c.name}：登场演出不暂停战斗（模式 none、战斗时钟在走）`, (sp.entrance || sp.before) && mid.mode === 'none' && mid.clock > sp.clock + 300, { sp, mid });
    if (!sp.before) ck(`${c.name}：登场时画面暗一下、镜头朝首领探出去`, sp.dim && Math.hypot(mid.look.x, mid.look.y) > 20, { sp, mid });
    await p.waitForTimeout(1400);
    const end = await ev(s => ({ look: { ...s.presence.look }, dim: !!s.children.getByName('boss-entrance-dim') }));
    ck(`${c.name}：登场演出 ~1.6 秒内复原（暗场消失、镜头回到主将）`, !end.dim && end.look.x === 0 && end.look.y === 0, end);
    const gap = await p.evaluate(() => Math.round(window.__gap));
    // 登场前后最长帧间隔只记录（生成首领本身就有一两百毫秒，且机器忙时单次读数波动很大）；新增开销直接测本系统每帧三个回调
    console.log(`  ${c.name} 登场最长帧间隔：改前 ${c.gapBefore} ms / 改后 ${gap} ms`);
    const cost = await ev(s => { const pr = s.presence, n = 200, t0 = performance.now(); for (let i = 0; i < n; i++) { pr.update(); pr.grow(); pr.restore(); } return +((performance.now() - t0) / n).toFixed(3); });
    ck(`${c.name}：本系统每帧开销 ${cost} ms（< 0.5）`, cost < .5, { cost });
    // 摆位：首领在主将右边，旁边一队小兵 + 一个精锐
    await ev(s => { s.boss.sprite.setPosition(s.player.x + 190, s.player.y - 30); for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', s.player.x + 120 + i * 30, s.player.y + 60 + (i % 2) * 40, 1, true); s.__elite = s.spawnEnemy('elite', s.player.x - 160, s.player.y + 40, 1, true); });
    await p.waitForTimeout(1200);
    const size = await p.evaluate(([k, f]) => new Function('s', 'return (' + f + ')(s)')(window.__game.scene.getScene(k)), [c.scene, measure.toString()]);
    ck(`${c.name}：显示体型 ×1.4（渲染时放大，逻辑上原尺寸）`, Math.abs(size.renderScale / size.logicScale - 1.4) < .02, size);
    const look = await ev(s => { const b = s.boss, e = s.__elite, minions = s.enemies.filter(x => x.active && !x.isSupplySlot && x !== b && x.kind !== 'boss').map(x => x.sprite.texture.key.replace(/^(iff\w*_enemy_|readable_)+/, ''));
      const bossKey = b.sprite.texture.key.replace(/^(iff\w*_enemy_|readable_)+/, ''), plate = s.children.getByName('boss-name-plate'), ring = s.children.getByName('boss-presence-ring'), aura = s.presence.stats.glow && !!b.sprite.preFX?.list?.length;
      return { bossKey, shared: minions.filter(k => k === bossKey), nMinions: minions.length, radius: b.radius, eliteRadius: e?.radius, eliteBase: s.chapter?.enemies?.elite?.radius,
        ring: !!ring?.visible, ringUnder: ring ? Math.abs(ring.x - b.sprite.x) < 2 && Math.abs(ring.y - b.sprite.y) < 8 : false, plate: !!plate?.visible, plateText: plate?.list.filter(o => o.type === 'Text').map(o => o.text), plateAbove: plate ? plate.y < b.y : false,
        aura, stats: { ...s.presence.stats } }; });
    ck(`${c.name}：脚下火环、身上光晕、头顶印章 + 名字`, look.ring && look.ringUnder && look.aura && look.plate && look.plateAbove && look.plateText?.join('') === c.name.slice(-1) + c.name, look);
    ck(`${c.name}：场上小兵没有与首领同一套图`, look.nMinions > 0 && look.shared.length === 0, look);
    if (look.eliteBase) ck(`${c.name}：精锐判定半径 ×1.15`, Math.abs(look.eliteRadius / look.eliteBase - 1.15) < .01, look);
    await p.screenshot({ path: `${OUT}/${c.id}-after.png` });
    // 帧率：分开两页测的改前 / 改后只记录（无头浏览器不限帧，机器忙时读数浮动一两成）；判定用同一页面里轮流开关辉光（唯一走显卡的新开销）
    const fpsAfter = await fps(ev); console.log(`  ${c.name} 帧率：改前 ${c.fpsBefore} / 改后 ${fpsAfter}`);
    const ab = { on: [], off: [] };
    for (let i = 0; i < 3; i++) for (const off of [false, true]) { await ev((s, o) => { s.presence.glowOff = o; }, off); (off ? ab.off : ab.on).push(await fps(ev)); }
    await ev(s => { s.presence.glowOff = false; });
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    ck(`${c.name}：身上辉光不拖帧率（开 ${avg(ab.on).toFixed(1)} / 关 ${avg(ab.off).toFixed(1)}）`, avg(ab.on) >= avg(ab.off) * .92, ab);
    // 屏外箭头：把首领挪到屏幕外
    await ev(s => { s.boss.sprite.setPosition(s.player.x + 1400, s.player.y + 300); });
    await p.waitForTimeout(120);
    const off = await ev(s => ({ arrow: s.presence.stats.arrow, plate: s.presence.stats.plate }));
    await p.screenshot({ path: `${OUT}/${c.id}-offscreen.png` });
    ck(`${c.name}：首领在屏外时屏幕边缘有指向首领的箭头`, off.arrow, off);
    await ev(s => { s.boss.sprite.setPosition(s.player.x + 150, s.player.y); });
    await p.waitForTimeout(150);
    ck(`${c.name}：回到屏内箭头消失`, !(await ev(s => s.presence.stats.arrow)));
    // 首领倒下：辉光摘掉（敌兵精灵对象池复用，不能带着辉光变成小兵）、火环 / 名牌收起
    const dead = await ev(s => new Promise(res => { const sp = s.boss.sprite; s.__letDie = true; s.killEnemy(s.boss); setTimeout(() => { for (let i = 0; i < 5 && s.mode === 'levelup'; i++) s.chooseUpgrade(0); res({ fx: sp.preFX?.list?.length ?? 0, glow: s.presence.stats.glow, ring: !!s.children.getByName('boss-presence-ring')?.visible, plate: !!s.children.getByName('boss-name-plate')?.visible }); }, 400); }));
    ck(`${c.name}：首领倒下后辉光摘掉、火环和名牌收起`, dead.fx === 0 && !dead.glow && !dead.ring && !dead.plate, dead);
    ck(`${c.name}：无页面报错`, !errs.length, errs.slice(0, 3));
    await p.close();
  }
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
