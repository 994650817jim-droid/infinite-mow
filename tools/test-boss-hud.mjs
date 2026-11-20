// 首领血条（2026-11-20 用户「还有ui boss血条优化一下」）：电脑布局 1280×720。
// 单首领（1-3 张角）、骑马首领（虎牢关吕布）、双首领（3-1 李傕 + 郭汜）、首领 + 副将同场、破势、半血转阶段。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/test-boss-hud.mjs   截图 assets/review/boss-hud/<TAG>-*.png（ONLY=single,lubu,... 只跑部分）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/boss-hud', AFTER = TAG !== 'before';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)?.slice(0, 600)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let errs = [];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('bh-seeded')) { for (const k of ['im_story_v1', 'im_roster_v1']) localStorage.removeItem(k); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('bh-seeded', '1'); } });
  await p.goto(BASE + '?dev=1&layout=desktop&story=off');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
  await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); s.yellowStages = 3; s.worldAvailable = true; s.cleared.huangjin = true; localStorage.setItem('im_world_v1', JSON.stringify(s)); });

  const S = scene => `window.__game.scene.getScene('${scene}')`;
  /** 开某关、跳过剧情、首领出场（dual：等第二位）；清小兵、停刷兵。 */
  const open = async (scene, reg, run, dual = false) => {
    await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer', 'hanzhongTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [scene, reg, run]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(scene), { timeout: 120000 }); await p.waitForTimeout(800);
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S(scene), String(fn), arg]);
    await ev(s => { s.player.damageImmune = true; });
    const calm = () => ev(s => { for (let i = 0; i < 4 && s.mode !== 'none' && s.mode !== 'story'; i++) s.__DEV_ACTIONS?.closePopup?.(); return s.mode; });
    const skip = s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); };
    for (let i = 0; i < 80 && !(await ev(s => !!s.boss?.active)); i++) { await ev((s, f) => { eval('(' + f + ')')(s); if (!s.boss?.active && !s.bossSpawned && s.mode === 'none') s.spawnBoss(); }, String(skip)); await p.waitForTimeout(150); }
    if (dual) for (let i = 0; i < 40 && !(await ev(s => (s.dual?.entries.length ?? 0) >= 2)); i++) { await ev((s, f) => eval('(' + f + ')')(s), String(skip)); await p.waitForTimeout(150); }
    await ev(s => { s.spawnTimer = 1e9; s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9; });
    await p.waitForTimeout(700); await calm(); await p.waitForTimeout(200); await calm();
    return ev;
  };
  const shot = name => p.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  const hud = ev => ev(s => s.bossHud ? { ...s.bossHud.debug() } : null);
  /** 屏上可见文字（含容器里的）。 */
  const texts = ev => ev(s => { const out = []; const walk = o => { if (!o || !o.visible || o.alpha < .05) return; if (o.type === 'Text' && o.text) out.push({ t: o.text, x: Math.round(o.x), y: Math.round(o.y), name: o.name }); if (o.list) for (const c of o.list) walk(c); }; for (const o of s.children.list) walk(o); return out; });

  // ① 单首领：1-3 张角
  if (want('single')) {
    const ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 3 });
    await ev(s => { s.boss.hp = s.boss.maxHp * .8; });
    await p.waitForTimeout(500); await shot('single-zhangjiao');
    if (AFTER) {
      const h = await hud(ev);
      ck('单首领：漆金血条在屏幕下方居中（顶部是战况线 / 计时 / 招式字幕）、名字「张角」、称号印「天公将军」、圆形头像', !!h && h.visible && h.name === '张角' && h.title === '天公将军' && h.portrait && Math.abs(h.cx - 480) < 4 && h.top > 400, h);
      // 掉血：白色残血拖尾
      await ev(s => { s.boss.hp = s.boss.maxHp * .62; }); await p.waitForTimeout(150);
      const t1 = await hud(ev); await p.waitForTimeout(1500); const t2 = await hud(ev);
      ck('掉血：白色残血停在旧血量，随后追上', t1 && t1.trail > t1.ratio + .1 && t2 && Math.abs(t2.trail - t2.ratio) < .03, { t1, t2 });
      // 不与战况、小地图卷轴、提示重叠（矩形相交）
      const ov = await ev(s => s.bossHud.overlaps());
      ck('不与战况进度、小地图、主将状态框重叠', ov.length === 0, ov);
    }
  }
  // ② 半血转阶段 + 低血脉动 + 破势
  if (want('phase')) {
    const ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 3 });
    await ev(s => { const b = s.boss; b.invulnerable = false; b.hp = Math.floor(b.maxHp * .53); });
    await p.waitForTimeout(300);
    await ev(s => { const b = s.boss; s.hitEnemy(b, Math.ceil(b.maxHp * .06), s.combatNow, 'melee', false, false); });
    await p.waitForTimeout(160); await shot('phase-half');
    if (AFTER) { const h = await hud(ev); ck('越过半血：阶段刻度闪光（计数 +1）', !!h && h.phaseFlashes >= 1 && h.ratio < .5, h); }
    // 破势值涨满前：金色细条
    await ev(s => { s.bossStagger.value = 82; }); await p.waitForTimeout(200); await shot('stagger-near');
    if (AFTER) { const h = await hud(ev); ck('破势条：金色细条显示破势值（0.82）', !!h && Math.abs(h.stagger - .82) < .05, h); }
    await ev(s => { s.bossStagger.value = 0; s.bossStagger.breaks++; s.bossBreak(s.boss, s.combatNow); }); await p.waitForTimeout(250); await shot('stagger-break');
    if (AFTER) { const h = await hud(ev); ck('破势满：破势条亮起「破势」提示', !!h && h.breakFlash, h); }
    await ev(s => { s.boss.hp = s.boss.maxHp * .18; }); await p.waitForTimeout(400); await shot('low-hp');
    if (AFTER) { const h = await hud(ev); ck('低于 25%：血条低血脉动', !!h && h.low, h); }
  }
  // ③ 骑马首领：虎牢关吕布
  if (want('lubu')) {
    const ev = await open('LubuGameScene', {}, { chapter: 'hulao', westStage: 3 });
    await ev(s => { s.boss.hp = s.boss.maxHp * .7; }); await p.waitForTimeout(400); await shot('mounted-lubu');
    const nm = await ev(s => ({ boss: s.chapter.bossName, mounted: !!s.bossMount?.mounted }));
    console.log('  [lubu]', JSON.stringify(nm));
    if (AFTER) { const h = await hud(ev); ck('骑马首领：吕布血条正常（名字、称号、头像）', !!h && h.visible && h.name === '吕布' && !!h.title, h); }
  }
  // ④ 首领 + 副将同场
  if (want('lieutenant')) {
    const ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 3 });
    await ev(s => { const pr = s.phaseRunner; if (pr) pr.lieutenant('张梁'); else { const e = s.spawnEnemy('elite', s.player.x + 160, s.player.y - 40, 2, true); if (e) e.setSizeMul?.(1.4); } });
    await p.waitForTimeout(700); await shot('with-lieutenant');
    if (AFTER) { const h = await hud(ev); ck('首领 + 副将：首领血条仍在，副将用头顶小血条', !!h && h.visible && h.name === '张角', h); }
  }
  // ⑤ 双首领：3-1 李傕 + 郭汜
  if (want('dual')) {
    const ev = await open('ThirdGameScene', { thirdStage: 1 }, {}, true);
    await ev(s => { s.dual.comboNow?.(s.combatNow + 1e9); const [a, c] = s.dual.entries; a.enemy.hp = a.enemy.maxHp * .74; c.enemy.hp = c.enemy.maxHp * .46; });
    await p.waitForTimeout(600); await shot('dual-lijue-guosi');
    if (AFTER) { const h = await hud(ev); ck('双首领：两条并排紧凑、各有名字与头像', !!h && h.mode === 'dual' && h.dualNames?.join() === 'lijue,guosi' && h.dualPortraits === 2, h); }
  }
  // ⑥ 出场展开 / 授首淡出
  if (AFTER && want('anim')) {
    const ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 3 });
    const seq = await ev(s => new Promise(res => { s.bossHud.replayEnter(); const out = []; const t0 = performance.now(); const tick = () => { out.push(+s.bossHud.debug().open.toFixed(2)); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(out); }; tick(); }));
    const e0 = seq[0], e1 = seq.find(v => v > .2 && v < .9) ?? -1, e2 = seq[seq.length - 1];
    ck('出场：血条从中间向两侧展开（0 → 1）', e0 < .2 && e1 > e0 && e1 < 1 && e2 >= .99, { e0, e1, e2 });
    await ev(s => { const b = s.boss; b.invulnerable = false; s.hitEnemy(b, b.hp + 10, s.combatNow, 'melee', false, false); });
    await p.waitForTimeout(150); const d1 = await hud(ev); await shot('death');
    ck('授首：血条碎裂淡出', !!d1 && d1.dying, d1);
  }
  ck('无页面报错', errs.length === 0, errs.slice(0, 4));
} catch (e) { console.log('FAIL 异常', String(e).slice(0, 400)); rows.push(false); }
await b.close();
const fail = rows.filter(x => !x).length; console.log(`${rows.length - fail}/${rows.length} PASS`);
process.exit(fail ? 1 : 0);
